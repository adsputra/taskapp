import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampLimit,
  isValidEmail,
  isValidUuid,
  parseSort,
  passwordError,
  requireNonEmptyString,
  requireUuidArray,
  sanitizeFilename,
  validateUploadFile,
} from "../src/lib/validation.js";

test("isValidEmail accepts normal addresses and rejects malformed ones", () => {
  assert.equal(isValidEmail("user@example.com"), true);
  assert.equal(isValidEmail("USER@sub.example.co.id"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("missing@domain"), false);
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail("a@b.com".padEnd(300, "x")), false);
});

test("isValidUuid accepts generated UUIDs and rejects arbitrary strings", () => {
  assert.equal(isValidUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
  assert.equal(isValidUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301"), true);
  assert.equal(isValidUuid("drop table users;"), false);
  assert.equal(isValidUuid(""), false);
  assert.equal(isValidUuid(undefined), false);
});

test("passwordError enforces length bounds", () => {
  assert.equal(passwordError("short"), "Password minimal 8 karakter.");
  assert.equal(passwordError("longenough-but-over-72".padEnd(73, "a")), "Password maksimal 72 karakter.");
  assert.equal(passwordError("correct-horse"), null);
});

test("parseSort only allows whitelisted columns and honours the minus prefix", () => {
  const allowed = ["updated_at", "created_at", "title"];

  assert.deepEqual(parseSort("-updated_at", allowed), { field: "updated_at", ascending: false });
  assert.deepEqual(parseSort("title", allowed), { field: "title", ascending: true });
  // injection / unknown column falls back to the safe default
  assert.deepEqual(parseSort("user_id", allowed), { field: "updated_at", ascending: false });
  assert.deepEqual(parseSort("id; drop table boards", allowed), {
    field: "updated_at",
    ascending: false,
  });
  assert.deepEqual(parseSort(12345, allowed), { field: "updated_at", ascending: false });
});

test("clampLimit applies default and maximum bounds", () => {
  assert.equal(clampLimit(undefined, { defaultLimit: 100, maxLimit: 200 }), 100);
  assert.equal(clampLimit(0, { defaultLimit: 100, maxLimit: 200 }), 100);
  assert.equal(clampLimit(-5, { defaultLimit: 100, maxLimit: 200 }), 100);
  assert.equal(clampLimit(1000000, { defaultLimit: 100, maxLimit: 200 }), 200);
  assert.equal(clampLimit("50", { defaultLimit: 100, maxLimit: 200 }), 50);
  assert.equal(clampLimit("abc", { defaultLimit: 100, maxLimit: 200 }), 100);
});

test("sanitizeFilename strips path separators and control characters", () => {
  assert.equal(sanitizeFilename("../../etc/passwd"), ".._.._etc_passwd");
  assert.equal(sanitizeFilename("re\\port\\x.pdf"), "re_port_x.pdf");
  assert.equal(sanitizeFilename("inv\u0000oice.pdf"), "invoice.pdf");
  assert.equal(sanitizeFilename(""), "file");
  assert.equal(sanitizeFilename("a".repeat(400)).length, 180);
});

test("validateUploadFile enforces size and type", () => {
  assert.equal(validateUploadFile({ name: "a.png", size: 1024, type: "image/png" }), null);
  assert.equal(
    validateUploadFile({ name: "big.zip", size: 11 * 1024 * 1024, type: "application/zip" }),
    "Ukuran file maksimal 10 MB."
  );
  assert.equal(
    validateUploadFile({ name: "evil.exe", size: 100, type: "application/x-msdownload" }),
    "Tipe file tidak diizinkan."
  );
  assert.equal(validateUploadFile({ name: "empty.txt", size: 0, type: "text/plain" }), "File kosong.");
  assert.equal(validateUploadFile(null), "File tidak valid.");
});

test("requireNonEmptyString trims and rejects blank input", () => {
  assert.equal(requireNonEmptyString("  hi  ", { field: "Nama" }), "hi");
  assert.throws(() => requireNonEmptyString("   ", { field: "Nama" }), /Nama wajib diisi/);
  assert.throws(() => requireNonEmptyString("a".repeat(11), { field: "Nama", max: 10 }), /maksimal 10/);
});

test("requireUuidArray rejects non-UUID members and oversized batches", () => {
  const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
  assert.deepEqual(requireUuidArray([uuid]), [uuid]);
  assert.throws(() => requireUuidArray([]), /tidak boleh kosong/);
  assert.throws(() => requireUuidArray(["nope"]), /tidak valid/);
  assert.throws(() => requireUuidArray([uuid, uuid], { max: 1 }), /maksimal 1/);
});
