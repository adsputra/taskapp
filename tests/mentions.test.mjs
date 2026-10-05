import { test } from "node:test";
import assert from "node:assert/strict";
import { extractMentionedUserIds, mentionHandle, splitMentions } from "../src/lib/mentions.js";

const people = [
  { id: "u-ann", email: "ann@acme.io" },
  { id: "u-anna", email: "Anna@acme.io" },
  { id: "u-budi", email: "budi.s@acme.io" },
];

test("mentionHandle is the lower-cased email local part", () => {
  assert.equal(mentionHandle({ email: "Anna@acme.io" }), "anna");
  assert.equal(mentionHandle({ email: "budi.s@acme.io" }), "budi.s");
  assert.equal(mentionHandle({}), "");
});

test("only handles that still appear in the text are mentioned", () => {
  assert.deepEqual(extractMentionedUserIds("hi @anna, can you check?", people), ["u-anna"]);
  assert.deepEqual(extractMentionedUserIds("@ann and @budi.s please", people), ["u-ann", "u-budi"]);
  assert.deepEqual(extractMentionedUserIds("no mentions here", people), []);
});

test("an email address or a longer handle is not a mention", () => {
  assert.deepEqual(extractMentionedUserIds("mail ann@acme.io", people), []);
  assert.deepEqual(extractMentionedUserIds("@annabel says hi", people), []);
});

test("mentions are de-duplicated and capped", () => {
  assert.deepEqual(extractMentionedUserIds("@ann @ann @ANN", people), ["u-ann"]);
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `u${i}`, email: `p${i}@x.io` }));
  const text = many.map((p) => `@${mentionHandle(p)}`).join(" ");
  assert.equal(extractMentionedUserIds(text, many).length, 20);
});

test("splitMentions marks mention segments for rendering", () => {
  assert.deepEqual(splitMentions("ping @anna and @ann.", ["ann", "anna"]), [
    { text: "ping ", mention: false },
    { text: "@anna", mention: true },
    { text: " and ", mention: false },
    { text: "@ann", mention: true },
    { text: ".", mention: false },
  ]);
  assert.deepEqual(splitMentions("plain text", ["ann"]), [{ text: "plain text", mention: false }]);
});
