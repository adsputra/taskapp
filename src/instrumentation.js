import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";

export async function register() {}

/**
 * Next.js instrumentation hook: called for every unhandled server error
 * (pages, route handlers, server actions). Never throws — instrumentation
 * failures must not affect request handling.
 */
export async function onRequestError(error, request, context) {
  try {
    incrementCounter("taskapp_server_errors_total", {
      route: context?.routePath || request?.path || "unknown",
      type: error?.name || "Error",
    });

    logger.error("server request error", {
      requestId: request?.headers?.["x-request-id"],
      method: request?.method,
      path: request?.path,
      route: context?.routePath,
      routerKind: context?.routerKind,
      detail: error?.message,
      stack: typeof error?.stack === "string" ? error.stack.split("\n").slice(0, 6).join("\n") : undefined,
    });
  } catch {
    // Never let instrumentation throw.
  }
}
