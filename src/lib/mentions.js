/**
 * @mention helpers (pure). A person is mentioned by their handle — the
 * local part of their email — e.g. "@rina". The comment text stays plain;
 * the ids of the people actually mentioned travel alongside it in
 * task_comments.mentioned_user_ids so the database can notify them.
 */
import { MAX_MENTIONS } from "./validation.js";

const BOUNDARY_AFTER = "(?=$|[\\s.,!?;:)\\]}'\"])";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mentionHandle(person) {
  const email = typeof person?.email === "string" ? person.email : "";
  const local = email.split("@")[0] || "";
  return local.toLowerCase();
}

function mentionPattern(handle) {
  return new RegExp(`(^|[\\s(])@${escapeRegExp(handle)}${BOUNDARY_AFTER}`, "i");
}

/**
 * Ids of the people whose "@handle" still appears in the text.
 * @param {string} content
 * @param {{ id: string, email: string }[]} people
 */
export function extractMentionedUserIds(content, people) {
  if (typeof content !== "string" || !Array.isArray(people)) return [];

  const ids = [];
  for (const person of people) {
    const handle = mentionHandle(person);
    if (!person?.id || !handle || ids.includes(person.id)) continue;
    if (mentionPattern(handle).test(content)) ids.push(person.id);
    if (ids.length >= MAX_MENTIONS) break;
  }
  return ids;
}

/**
 * Split text into plain and mention segments for rendering.
 * @returns {{ text: string, mention: boolean }[]}
 */
export function splitMentions(content, handles) {
  const text = typeof content === "string" ? content : "";
  const known = [...new Set((handles || []).filter(Boolean).map((h) => h.toLowerCase()))];
  if (known.length === 0 || !text.includes("@")) return [{ text, mention: false }];

  // Longest first so "@ann" does not win over "@anna".
  known.sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `(^|[\\s(])(@(?:${known.map(escapeRegExp).join("|")}))${BOUNDARY_AFTER}`,
    "gi"
  );

  const segments = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index + match[1].length;
    if (start > last) segments.push({ text: text.slice(last, start), mention: false });
    segments.push({ text: match[2], mention: true });
    last = start + match[2].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), mention: false });
  return segments;
}
