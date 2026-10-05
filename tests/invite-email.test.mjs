import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInviteEmail, escapeHtml } from "../src/lib/invite-email.js";

test("escapeHtml neutralises markup", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">'`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;");
});

test("board titles and inviter names cannot inject HTML", () => {
  const { html, subject } = buildInviteEmail({
    boardTitle: "<script>alert(1)</script>",
    inviterName: 'Eve" onmouseover="x',
    role: "editor",
    link: "https://app.example.com/join?token=abc",
  });
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes('Eve" onmouseover'));
  assert.ok(html.includes('href="https://app.example.com/join?token=abc"'));
  assert.ok(!/[\r\n]/.test(subject));
});

test("subject cannot carry header injection", () => {
  const { subject } = buildInviteEmail({ boardTitle: "Q3\r\nBcc: all@corp.com", inviterName: "Ann", role: "viewer", link: "x" });
  assert.ok(!/[\r\n]/.test(subject));
});
