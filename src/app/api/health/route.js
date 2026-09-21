import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/metrics";
import { getRequestId } from "@/lib/request-context";

export const dynamic = "force-dynamic";

/**
 * Health check for load balancers / uptime monitors.
 * Verifies the app can actually reach Supabase Auth, not just that
 * the process answers. Returns 503 when a critical dependency is down.
 */
export async function GET() {
  const requestId = await getRequestId();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    incrementCounter("taskapp_health_check_total", { status: "unavailable" });
    logger.error("health check: missing Supabase configuration", { requestId });
    return NextResponse.json(
      { status: "unavailable", checks: { config: false } },
      { status: 503 }
    );
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Supabase auth health returned ${response.status}`);
    }

    incrementCounter("taskapp_health_check_total", { status: "ok" });
    return NextResponse.json({
      status: "ok",
      checks: { config: true, database: true },
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    incrementCounter("taskapp_health_check_total", { status: "degraded" });
    logger.error("health check failed", { requestId, detail: error?.message });
    return NextResponse.json(
      { status: "degraded", checks: { config: true, database: false } },
      { status: 503 }
    );
  }
}
