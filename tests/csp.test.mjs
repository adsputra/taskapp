import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentSecurityPolicy, createNonce } from "../src/lib/csp.js";

const directive = (csp, name) => csp.split("; ").find((d) => d.startsWith(`${name} `));

test("createNonce returns a fresh base64 value of 128 bits", () => {
  const a = createNonce();
  const b = createNonce();
  assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
  assert.notEqual(a, b);
});

test("scripts are allowed only through the nonce", () => {
  const csp = buildContentSecurityPolicy({ nonce: "abcdefghijklmnop", supabaseUrl: "https://xyz.supabase.co" });
  const scripts = directive(csp, "script-src");
  assert.equal(scripts, "script-src 'self' 'nonce-abcdefghijklmnop' 'strict-dynamic'");
  assert.ok(!scripts.includes("unsafe-inline"));
  assert.ok(!scripts.includes("unsafe-eval"));
});

test("development adds unsafe-eval for React debugging only", () => {
  const csp = buildContentSecurityPolicy({ nonce: "abcdefghijklmnop", supabaseUrl: "https://x.supabase.co", isDev: true });
  assert.match(directive(csp, "script-src"), /'unsafe-eval'$/);
  assert.ok(!csp.includes("upgrade-insecure-requests"));
});

test("connect-src is pinned to the project's API and realtime origins", () => {
  const csp = buildContentSecurityPolicy({ nonce: "abcdefghijklmnop", supabaseUrl: "https://xyz.supabase.co/rest" });
  assert.equal(directive(csp, "connect-src"), "connect-src 'self' https://xyz.supabase.co wss://xyz.supabase.co");
  assert.ok(csp.includes("upgrade-insecure-requests"));

  const local = buildContentSecurityPolicy({ nonce: "abcdefghijklmnop", supabaseUrl: "http://127.0.0.1:54321" });
  assert.equal(directive(local, "connect-src"), "connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321");
  assert.ok(!local.includes("upgrade-insecure-requests"), "would break a local http backend");
});

test("framing and plugins stay blocked", () => {
  const csp = buildContentSecurityPolicy({ nonce: "abcdefghijklmnop", supabaseUrl: "" });
  for (const expected of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.ok(csp.includes(expected), expected);
  }
});

test("a malformed nonce is rejected instead of weakening the policy", () => {
  for (const nonce of ["", "short", "abc'; script-src *", undefined]) {
    assert.throws(() => buildContentSecurityPolicy({ nonce, supabaseUrl: "" }));
  }
});
