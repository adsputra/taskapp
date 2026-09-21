/**
 * Structured, leveled logger with field redaction.
 *
 * Emits one JSON object per line so logs stay greppable and filterable.
 * Sensitive fields (passwords, tokens, emails, cookies, API keys) are
 * redacted here centrally — call sites must never log secrets directly.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY =
  /(pass(word|code)?|token|secret|authorization|cookie|api[-_]?key|email)/i;

function resolveMinLevel() {
  const raw =
    typeof process !== "undefined" && process.env ? process.env.LOG_LEVEL : undefined;
  const level = typeof raw === "string" ? raw.toLowerCase() : "info";
  return LEVELS[level] ?? LEVELS.info;
}

export function redact(value, depth = 0) {
  if (value == null || depth > 4) return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => redact(entry, depth + 1));
  }

  if (typeof value === "object") {
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(entry, depth + 1);
    }
    return output;
  }

  if (typeof value === "string" && value.length > 500) {
    return `${value.slice(0, 500)}…`;
  }

  return value;
}

export function log(level, message, fields = {}) {
  if ((LEVELS[level] ?? LEVELS.info) < resolveMinLevel()) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...redact(fields),
  };

  const write = console[level] || console.log;
  write(JSON.stringify(entry));
}

export const logger = {
  debug: (message, fields) => log("debug", message, fields),
  info: (message, fields) => log("info", message, fields),
  warn: (message, fields) => log("warn", message, fields),
  error: (message, fields) => log("error", message, fields),
};
