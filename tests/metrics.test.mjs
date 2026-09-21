import { test } from "node:test";
import assert from "node:assert/strict";
import {
  incrementCounter,
  observeHistogram,
  renderPrometheus,
  resetMetrics,
} from "../src/lib/metrics.js";

test("renders counters in Prometheus text format", () => {
  resetMetrics();
  incrementCounter("taskapp_http_requests_total", { method: "GET", route: "/boards" });
  incrementCounter("taskapp_http_requests_total", { method: "GET", route: "/boards" }, 2);
  incrementCounter("taskapp_rate_limit_blocked_total", { scope: "login_ip" });

  const output = renderPrometheus();

  assert.match(output, /# TYPE taskapp_http_requests_total counter/);
  assert.match(output, /taskapp_http_requests_total\{method="GET",route="\/boards"\} 3/);
  assert.match(output, /taskapp_rate_limit_blocked_total\{scope="login_ip"\} 1/);
});

test("renders histogram buckets, sum and count", () => {
  resetMetrics();
  observeHistogram("taskapp_supabase_auth_check_duration_ms", 10, { route: "/boards" });
  observeHistogram("taskapp_supabase_auth_check_duration_ms", 700, { route: "/boards" });

  const output = renderPrometheus();

  assert.match(output, /# TYPE taskapp_supabase_auth_check_duration_ms histogram/);
  assert.match(
    output,
    /taskapp_supabase_auth_check_duration_ms_bucket\{le="25",route="\/boards"\} 1/
  );
  assert.match(
    output,
    /taskapp_supabase_auth_check_duration_ms_bucket\{le="1000",route="\/boards"\} 2/
  );
  assert.match(
    output,
    /taskapp_supabase_auth_check_duration_ms_bucket\{le="\+Inf",route="\/boards"\} 2/
  );
  assert.match(output, /taskapp_supabase_auth_check_duration_ms_sum\{route="\/boards"\} 710/);
  assert.match(output, /taskapp_supabase_auth_check_duration_ms_count\{route="\/boards"\} 2/);
});

test("escapes label values and ignores non-finite histogram samples", () => {
  resetMetrics();
  incrementCounter("quotes_total", { path: '/a"b\\c' });
  observeHistogram("ignored_histogram", Number.NaN, { route: "/" });

  const output = renderPrometheus();

  assert.match(output, /path="\/a\\"b\\\\c"/);
  assert.doesNotMatch(output, /ignored_histogram/);
});
