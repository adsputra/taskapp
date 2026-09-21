/**
 * Upstash Redis REST store for the rate limiter (multi-instance safe).
 *
 * Uses the REST API directly via fetch — no SDK dependency, and it
 * works in both the Node.js and Edge runtimes. Atomicity comes from a
 * small Lua script (INCR + PEXPIRE in one round trip).
 *
 * Configure with:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */
const INCREMENT_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "return current",
].join(" ");

export function createRedisStore({ url, token, fetchImpl = fetch, timeoutMs = 1500 }) {
  const baseUrl = String(url).replace(/\/+$/, "");

  async function command(args) {
    const response = await fetchImpl(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`rate-limit redis HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload?.error) {
      throw new Error(`rate-limit redis: ${payload.error}`);
    }
    return payload?.result;
  }

  return {
    async increment(key, windowMs, timestamp) {
      // Fixed window: key includes the window bucket, so resetAt is
      // computable locally and keys expire on their own.
      const bucket = Math.floor(timestamp / windowMs);
      const bucketKey = `${key}:${bucket}`;

      const count = await command([
        "EVAL",
        INCREMENT_SCRIPT,
        "1",
        bucketKey,
        String(windowMs + 1000),
      ]);

      return {
        count: Number(count) || 0,
        resetAt: (bucket + 1) * windowMs,
      };
    },
  };
}

export function createConfiguredRedisStore(env = typeof process !== "undefined" ? process.env : {}) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    new URL(url);
  } catch {
    return null;
  }

  return createRedisStore({ url, token });
}
