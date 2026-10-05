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
 * Client IP for rate limiting, from a Headers-like object.
 *
 * Any request header can be forged by the client unless the proxy in
 * front of the app overwrites it. Trusting a header the platform does
 * NOT set (e.g. `cf-connecting-ip` on Vercel) lets an attacker rotate it
 * and get a fresh rate-limit bucket per request (CWE-348). So:
 *
 * - TRUSTED_IP_HEADER set (recommended): read only that header — the one
 *   your edge always overwrites, e.g. `x-vercel-forwarded-for` on Vercel,
 *   `cf-connecting-ip` behind Cloudflare, `x-real-ip` behind nginx.
 * - Unset: use the RIGHTMOST `x-forwarded-for` entry, i.e. the address
 *   appended by the closest proxy — correct behind exactly one proxy.
 */
export function getClientIp(headerStore, trustedHeader = process.env.TRUSTED_IP_HEADER) {
  if (!headerStore) return "unknown";

  const getHeader = (name) => {
    if (typeof headerStore.get === "function") return headerStore.get(name);
    return headerStore[name] || headerStore[name.toLowerCase()];
  };

  const headerName = typeof trustedHeader === "string" ? trustedHeader.trim().toLowerCase() : "";
  if (headerName) {
    // Overwriting edges write a single address; if it is a list, the
    // first entry is the one the edge recorded for the client.
    const value = getHeader(headerName);
    const first = typeof value === "string" ? value.split(",")[0] : null;
    return cleanIp(first) || "unknown";
  }

  const forwarded = getHeader("x-forwarded-for");
  if (typeof forwarded === "string") {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const closest = cleanIp(parts[parts.length - 1]);
    if (closest) return closest;
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

// Invitation emails go to third parties: cap them per inviting user.
export const inviteRateLimiter = createRateLimiter({
  limit: 30,
  windowMs: 60 * 60 * 1000,
  store: redisStore,
});
