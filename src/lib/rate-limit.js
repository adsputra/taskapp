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
 * Simple format validator for IPv4 and IPv6 addresses.
 */
function isValidIp(ip) {
  if (typeof ip !== "string") return false;
  const trimmed = ip.trim();
  const ipv4Parts = trimmed.split(".");
  if (ipv4Parts.length === 4) {
    const validOctets = ipv4Parts.every((octet) => {
      if (!/^\d{1,3}$/.test(octet)) return false;
      const num = Number(octet);
      return num >= 0 && num <= 255 && (octet === "0" || !octet.startsWith("0"));
    });
    if (validOctets) return true;
  }
  if (/^[0-9a-fA-F:]{2,39}$/.test(trimmed) && trimmed.includes(":")) {
    return true;
  }
  return false;
}

/**
 * Clean and normalize an IP candidate (strips surrounding spaces and ports).
 */
function cleanIp(raw) {
  if (!raw || typeof raw !== "string") return null;
  let ip = raw.trim();
  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  } else if (ip.includes(".") && ip.includes(":")) {
    ip = ip.split(":")[0];
  }
  return isValidIp(ip) ? ip : null;
}

/**
 * Production-ready client IP extraction from a Headers-like object.
 * Protects against X-Forwarded-For header spoofing (CWE-348) by:
 * 1. Prioritizing trusted platform edge headers (Cloudflare, Vercel)
 * 2. Checking trusted single-hop reverse proxy headers (X-Real-IP)
 * 3. Inspecting the rightmost entry appended by the closest upstream proxy in X-Forwarded-For
 * 4. Strictly validating IP format and stripping port numbers
 */
export function getClientIp(headerStore) {
  if (!headerStore) return "unknown";

  const getHeader = (name) => {
    if (typeof headerStore.get === "function") return headerStore.get(name);
    return headerStore[name] || headerStore[name.toLowerCase()];
  };

  // 1. Cloudflare edge header
  const cfIp = cleanIp(getHeader("cf-connecting-ip"));
  if (cfIp) return cfIp;

  // 2. Vercel edge/proxy headers
  const vercelIp = cleanIp(getHeader("x-vercel-proxied-for") || getHeader("x-vercel-forwarded-for"));
  if (vercelIp) return vercelIp;

  // 3. X-Real-IP set by single-hop reverse proxies
  const realIp = cleanIp(getHeader("x-real-ip"));
  if (realIp) return realIp;

  // 4. X-Forwarded-For (scan right-to-left to pick the closest verified proxy entry)
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded && typeof forwarded === "string") {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = cleanIp(parts[i]);
      if (candidate) return candidate;
    }
  }

  return "unknown";
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
