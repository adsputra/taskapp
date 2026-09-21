import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter, createMemoryStore, getClientIp } from "../src/lib/rate-limit.js";
import { createConfiguredRedisStore, createRedisStore } from "../src/lib/rate-limit-redis.js";

function createClock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

test("allows requests up to the limit, then blocks", async () => {
  const clock = createClock();
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: clock.now });

  assert.equal((await limiter.check("ip")).allowed, true);
  assert.equal((await limiter.check("ip")).allowed, true);
  assert.equal((await limiter.check("ip")).allowed, true);

  const blocked = await limiter.check("ip");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterMs, 1000);
});

test("blocked keys recover after the window elapses", async () => {
  const clock = createClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });

  assert.equal((await limiter.check("ip")).allowed, true);
  assert.equal((await limiter.check("ip")).allowed, false);

  clock.advance(1001);
  assert.equal((await limiter.check("ip")).allowed, true);
});

test("keys are isolated from each other", async () => {
  const clock = createClock();
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });

  assert.equal((await limiter.check("a")).allowed, true);
  assert.equal((await limiter.check("b")).allowed, true);
  assert.equal((await limiter.check("a")).allowed, false);
  assert.equal((await limiter.check("b")).allowed, false);
});

test("falls back to the in-memory store when the remote store fails", async () => {
  const clock = createClock();
  const failingStore = {
    async increment() {
      throw new Error("redis down");
    },
  };
  const limiter = createRateLimiter({
    limit: 1,
    windowMs: 1000,
    now: clock.now,
    store: failingStore,
  });

  assert.equal((await limiter.check("ip")).allowed, true);
  assert.equal((await limiter.check("ip")).allowed, false);
  assert.equal(limiter.size(), 1);
});

test("expired buckets are pruned once the key cap is reached", () => {
  const clock = createClock();
  const store = createMemoryStore({ now: clock.now, maxKeys: 2 });

  store.increment("a", 100, clock.now());
  store.increment("b", 100, clock.now());
  assert.equal(store.size(), 2);

  clock.advance(200);
  store.increment("c", 100, clock.now());
  assert.equal(store.size(), 1);
});

test("redis store sends an atomic EVAL and computes the fixed window locally", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ result: 2 }) };
  };

  const store = createRedisStore({
    url: "https://redis.example.com/",
    token: "secret-token",
    fetchImpl,
  });

  const result = await store.increment("rl:auth", 1000, 1500);

  assert.deepEqual(result, { count: 2, resetAt: 2000 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://redis.example.com");
  assert.equal(calls[0].body[0], "EVAL");
  assert.equal(calls[0].body[1].includes("INCR"), true);
  assert.equal(calls[0].body[3], "rl:auth:1");
});

test("redis store surfaces HTTP failures so the limiter can fall back", async () => {
  const store = createRedisStore({
    url: "https://redis.example.com",
    token: "secret-token",
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
  });

  await assert.rejects(() => store.increment("rl:auth", 1000, 1500), /HTTP 500/);
});

test("configured redis store requires both env vars and a valid URL", () => {
  assert.equal(createConfiguredRedisStore({}), null);
  assert.equal(
    createConfiguredRedisStore({
      UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
    }) !== null,
    true
  );
  assert.equal(
    createConfiguredRedisStore({
      UPSTASH_REDIS_REST_URL: "not a url",
      UPSTASH_REDIS_REST_TOKEN: "token",
    }),
    null
  );
});

test("getClientIp prefers the first x-forwarded-for entry", () => {
  const headers = new Map([
    ["x-forwarded-for", "203.0.113.7, 70.41.3.18"],
    ["x-real-ip", "10.0.0.1"],
  ]);
  const headerStore = { get: (key) => headers.get(key) };

  assert.equal(getClientIp(headerStore), "203.0.113.7");
  assert.equal(getClientIp({ get: () => null }), "unknown");
});
