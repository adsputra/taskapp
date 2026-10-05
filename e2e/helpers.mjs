import crypto from "node:crypto";
import { expect } from "@playwright/test";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const hasBackend = Boolean(SUPABASE_URL && ANON_KEY);
export const PASSWORD = "Correct-Horse-42";

export function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}@e2e.test`;
}

export async function signUp(page, { name, email, password = PASSWORD, redirect }) {
  await page.goto(redirect ? `/auth/signup?redirect=${encodeURIComponent(redirect)}` : "/auth/signup");
  await page.getByLabel("Nama lengkap").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Buat akun" }).click();
}

export async function logIn(page, { email, password = PASSWORD, redirect }) {
  await page.goto(redirect ? `/auth/login?redirect=${encodeURIComponent(redirect)}` : "/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

export async function createBoard(page, title) {
  await page.goto("/boards");
  await page.getByRole("button", { name: /New Board|Create Your First Board/ }).first().click();
  await page.getByLabel("Board Title").fill(title);
  await page.getByRole("button", { name: "Create Board", exact: true }).click();
  await page.getByRole("link", { name: new RegExp(title) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return page.url().match(/\/boards\/([0-9a-f-]{36})/)[1];
}

export async function addTask(page, title) {
  await page.getByRole("button", { name: "Add Task" }).first().click();
  const input = page.getByLabel("New task title");
  await input.fill(title);
  await input.press("Enter");
  await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
}

// RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret.
export function totp(secret, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

// Wait for the start of the next 30 s window so a code is never reused.
export async function freshTotp(secret) {
  const msIntoWindow = Date.now() % 30_000;
  await new Promise((resolve) => setTimeout(resolve, 30_000 - msIntoWindow + 500));
  return totp(secret);
}

/** Access token of the signed-in browser session (from the auth cookie). */
export async function accessToken(context) {
  // The session may be split into chunks: sb-<ref>-auth-token.0, .1, …
  const chunk = (name) => Number(name.match(/\.(\d+)$/)?.[1] ?? -1);
  const cookies = (await context.cookies()).filter((c) => /-auth-token(\.\d+)?$/.test(c.name));
  cookies.sort((a, b) => chunk(a.name) - chunk(b.name));
  let raw = cookies.map((c) => c.value).join("");
  if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64").toString("utf8");
  return JSON.parse(decodeURIComponent(raw)).access_token;
}

export async function restSelect(context, table, query = "select=id") {
  const token = await accessToken(context);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() };
}
