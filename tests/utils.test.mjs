import { test } from "node:test";
import assert from "node:assert/strict";
import { readableTextOn } from "../src/lib/utils.js";

test("light label colors get dark text, dark ones white", () => {
  assert.equal(readableTextOn("#C4C4C4"), "#0f172a");
  assert.equal(readableTextOn("#FFCB00"), "#0f172a");
  assert.equal(readableTextOn("#2563EB"), "#ffffff");
  assert.equal(readableTextOn("#1e293b"), "#ffffff");
  assert.equal(readableTextOn("fff"), "#0f172a");
});

test("anything that is not a hex color falls back to white", () => {
  assert.equal(readableTextOn("red"), "#ffffff");
  assert.equal(readableTextOn(undefined), "#ffffff");
});
