/**
 * Fixed-window rate limiter.
 *
 * Stores:
 * - Upstash Redis (configured via env) when available → correct across
 *   multiple instances/serverless invocations.
 * - In-memory Map as automatic fallback (single instance, and keeps
 *   auth endpoints protected if Redis is unreachable).
 *
 * `now` and `store` are injectable so the behavior is testable.
 */
import { logger } from "./logger.js";
import { createConfiguredRedisStore } from "./rate-limit-redis.js";

export function createMemoryStore({ now = () => Date.now(), maxKeys = 10000 } = {}) {
  const buckets = new Map();

  function pruneExpired(timestamp) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= timestamp) buckets.delete(key);
    }
  }

  return {
    increment(key, windowMs, timestamp) {
      if (buckets.size >= maxKeys) pruneExpired(timestamp);

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= timestamp) {
        bucket = { count: 0, resetAt: timestamp + windowMs };
        buckets.set(key, bucket);
      }

      bucket.count += 1;
      return { count: bucket.count, resetAt: bucket.resetAt };
    },

    reset(key) {
      buckets.delete(key);
    },

    size() {
      return buckets.size;
    },
  };
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10000,
  now = () => Date.now(),
  store = null,
}) {
  const fallback = createMemoryStore({ now, maxKeys });
  const activeStore = store || fallback;

  return {
    async check(key) {
      const timestamp = now();

      let result;
      try {
        result = await activeStore.increment(key, windowMs, timestamp);
      } catch (error) {
        logger.warn("rate limiter store unavailable; using local fallback", {
          detail: error?.message,
        });
        result = fallback.increment(key, windowMs, timestamp);
      }

      const allowed = result.count <= limit;
      return {
        allowed,
        remaining: Math.max(0, limit - result.count),
        retryAfterMs: allowed ? 0 : Math.max(0, result.resetAt - timestamp),
      };
    },

    reset(key) {
      fallback.reset(key);
    },

    size() {
      return fallback.size();
    },
  };
}

/**
 * Best-effort client IP extraction from a Headers-like object.
 * `x-forwarded-for` is set by Vercel/other proxies in front of Next.js.
 */
export function getClientIp(headerStore) {
  const forwarded = headerStore?.get?.("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headerStore?.get?.("x-real-ip") || "unknown";
}

const redisStore = createConfiguredRedisStore();

export const authRateLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60 * 1000,
  store: redisStore,
});

export const authAccountRateLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60 * 1000,
  store: redisStore,
});

export const requestRateLimiter = createRateLimiter({
  limit: 60,
  windowMs: 60 * 1000,
  store: redisStore,
});
