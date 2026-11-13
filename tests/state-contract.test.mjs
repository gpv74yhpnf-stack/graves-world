import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateState, validateCharacterInvariants, validateHistoryPreservation, validateUpdate, LOCKED_RULES } from "../scripts/state-contract.mjs";

const fixture = JSON.parse(fs.readFileSync(new URL("../state.json", import.meta.url), "utf8"));

test("current bundled fallback satisfies the state contract", () => {
  assert.deepEqual(validateState(fixture), []);
  assert.deepEqual(validateCharacterInvariants(fixture), []);
});

test("locked character rules cannot be removed", () => {
  const changed = structuredClone(fixture);
  changed.sheet.locked.pop();
  assert.ok(validateCharacterInvariants(changed).some(message => message.includes("protected rule missing")));
});

test("invalid location and out-of-range needs are rejected", () => {
  const changed = structuredClone(fixture);
  changed.location = "outside-the-town";
  changed.needs.energy = 101;
  const errors = validateState(changed);
  assert.ok(errors.some(message => message.startsWith("location:")));
  assert.ok(errors.some(message => message.startsWith("needs.energy:")));
});

test("journal, replies, visitor records and memories cannot silently disappear", () => {
  const previous = structuredClone(fixture);
  previous.visitors.moth = { display: "Moth", first_seen: "2026-11-11", notes: ["likes moonbells"] };
  previous.replies.push({ to: "Moth", date: "2026-11-11", offering: "Hello", reply: "Welcome." });
  const next = structuredClone(previous);
  next.journal = [];
  next.replies = [];
  delete next.visitors.moth;
  next.memories.keeping = [];
  next.memories.fading = [];
  const errors = validateHistoryPreservation(previous, next);
  assert.ok(errors.some(message => message.startsWith("journal entry lost")));
  assert.ok(errors.some(message => message.startsWith("visitor reply lost")));
  assert.ok(errors.some(message => message.includes("visitor record removed")));
  assert.ok(errors.some(message => message.startsWith("memory lost")));
});

test("memories may move between keeping and fading without being erased", () => {
  const previous = structuredClone(fixture);
  const next = structuredClone(fixture);
  next.memories.keeping = [];
  next.memories.fading.push(...previous.memories.keeping);
  assert.deepEqual(validateHistoryPreservation(previous, next), []);
});

test("update validator combines structural, identity and history checks", () => {
  const next = structuredClone(fixture);
  next.sheet.locked = LOCKED_RULES.slice(0, 2);
  assert.ok(validateUpdate(fixture, next).some(message => message.includes("protected rule missing")));
});

test("impossible calendar dates are rejected", () => {
  const changed = structuredClone(fixture);
  changed.journal[0].date = "2026-02-31";
  assert.ok(validateState(changed).some(message => message.startsWith("journal[0]")));
});
