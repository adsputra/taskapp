import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { renderPrometheus } from "@/lib/metrics";

export const dynamic = "force-dynamic";

function safeEqual(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Prometheus-format metrics endpoint.
 *
 * Returns 404 unless METRICS_TOKEN is configured, and requires
 * `Authorization: Bearer <METRICS_TOKEN>`.
 */
export async function GET(request) {
  const token = process.env.METRICS_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const header = request.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!safeEqual(provided, token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return new NextResponse(renderPrometheus(), {
    status: 200,
    headers: {
      "content-type": "text/plain; version=0.0.4; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
