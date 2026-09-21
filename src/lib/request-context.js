/**
 * Request-scoped helpers for server code (Server Actions, Route Handlers).
 * `x-request-id` is generated/forwarded by src/proxy.js.
 */
import { headers } from "next/headers";

export async function getRequestId() {
  try {
    return (await headers()).get("x-request-id") || undefined;
  } catch {
    return undefined;
  }
}
