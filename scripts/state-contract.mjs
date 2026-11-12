import fs from "node:fs";

const REQUIRED = [
  "updated", "day", "time_of_day", "weather", "location", "activity",
  "thought", "mood", "needs", "offerings_waiting", "recent_moves",
  "journal", "memories", "visitors", "replies", "sheet", "stats"
];
const LOCATIONS = new Set(["crypt", "lantern_lane", "offering_stone", "bone_garden", "ledger_shop"]);
export const LOCKED_RULES = [
  "He never pretends to be a human.",
  "He never asks visitors for money or personal information.",
  "He is never cruel, even to unkind visitors. He just leaves those notes on the stone.",
  "He stays a resident of his town; he does not leave it."
];

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isString = value => typeof value === "string";
const isDate = value => isString(value) && /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const stable = value => JSON.stringify(value, Object.keys(value ?? {}).sort());

export function validateState(state) {
  const errors = [];
  const need = (condition, path, message) => { if (!condition) errors.push(`${path}: ${message}`); };
  need(isObject(state), "$", "must be an object");
  if (!isObject(state)) return errors;

  for (const key of REQUIRED) need(Object.hasOwn(state, key), key, "required field is missing");
  need(isString(state.updated) && !Number.isNaN(Date.parse(state.updated)), "updated", "must be a valid date-time string");
  need(Number.isInteger(state.day) && state.day >= 1, "day", "must be an integer >= 1");
  need(isString(state.time_of_day) && state.time_of_day.length > 0, "time_of_day", "must be a non-empty string");
  need(isString(state.weather), "weather", "must be a string");
  need(LOCATIONS.has(state.location), "location", "must be a known town location");
  need(isString(state.activity) && state.activity.length > 0 && state.activity.length <= 500, "activity", "must be a non-empty string of at most 500 characters");
  need(isString(state.thought) && state.thought.length <= 2000, "thought", "must be a string of at most 2000 characters");
  need(isObject(state.mood) && isString(state.mood.label) && isString(state.mood.why), "mood", "must contain string label and why");
  need(isObject(state.needs), "needs", "must be an object");
  if (isObject(state.needs)) for (const [key, value] of Object.entries(state.needs)) need(typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100, `needs.${key}`, "must be a finite number from 0 to 100");
  need(Number.isInteger(state.offerings_waiting) && state.offerings_waiting >= 0, "offerings_waiting", "must be an integer >= 0");

  for (const [key, max] of [["recent_moves",100],["journal",1000],["replies",1000]]) {
    need(Array.isArray(state[key]) && state[key].length <= max, key, `must be an array of at most ${max} items`);
  }
  if (Array.isArray(state.recent_moves)) state.recent_moves.forEach((m,i) => {
    need(isObject(m) && isString(m.t) && isString(m.did), `recent_moves[${i}]`, "must contain string t and did");
  });
  if (Array.isArray(state.journal)) state.journal.forEach((j,i) => {
    need(isObject(j) && Number.isInteger(j.day) && j.day >= 1 && isDate(j.date) && isString(j.title) && isString(j.text), `journal[${i}]`, "must contain valid day, date, title and text");
  });
  need(isObject(state.memories) && Array.isArray(state.memories.keeping) && Array.isArray(state.memories.fading), "memories", "must contain keeping and fading arrays");
  if (isObject(state.memories)) for (const bucket of ["keeping","fading"]) {
    if (Array.isArray(state.memories[bucket])) state.memories[bucket].forEach((m,i) => need(isObject(m) && isString(m.text) && isString(m.since), `memories.${bucket}[${i}]`, "must contain string text and since"));
  }
  need(isObject(state.visitors), "visitors", "must be an object keyed by visitor identifier");
  if (isObject(state.visitors)) for (const [key, visitor] of Object.entries(state.visitors)) {
    need(isObject(visitor), `visitors.${key}`, "must be an object");
    if (isObject(visitor) && visitor.notes !== undefined) need(Array.isArray(visitor.notes) && visitor.notes.every(isString), `visitors.${key}.notes`, "must be an array of strings");
  }
  if (Array.isArray(state.replies)) state.replies.forEach((r,i) => need(isObject(r) && isString(r.to) && isDate(r.date) && isString(r.offering) && isString(r.reply), `replies[${i}]`, "must contain to, valid date, offering and reply"));
  need(isObject(state.sheet) && Array.isArray(state.sheet.given) && Array.isArray(state.sheet.locked) && Array.isArray(state.sheet.added), "sheet", "must contain given, locked and added arrays");
  need(isObject(state.stats) && Object.values(state.stats).every(v => Number.isInteger(v) && v >= 0), "stats", "must contain non-negative integer values");
  return errors;
}

export function validateCharacterInvariants(state) {
  const errors = [];
  if (!isObject(state?.sheet)) return ["sheet: missing character sheet"];
  const locked = new Set(Array.isArray(state.sheet.locked) ? state.sheet.locked : []);
  for (const rule of LOCKED_RULES) if (!locked.has(rule)) errors.push(`sheet.locked: protected rule missing: ${rule}`);
  const given = Array.isArray(state.sheet.given) ? state.sheet.given : [];
  if (!given.some(line => /small, gentle necromancer/i.test(line))) errors.push("sheet.given: core identity (small, gentle necromancer) is missing");
  return errors;
}

export function validateHistoryPreservation(previous, next) {
  const errors = [];
  const contains = (list, item) => Array.isArray(list) && list.some(candidate => JSON.stringify(candidate) === JSON.stringify(item));
  for (const entry of previous?.journal ?? []) if (!contains(next?.journal, entry)) errors.push(`journal entry lost or changed: ${entry.title ?? "(untitled)"}`);
  for (const entry of previous?.replies ?? []) if (!contains(next?.replies, entry)) errors.push(`visitor reply lost or changed: ${entry.to ?? "(unknown visitor)"}`);
  for (const [key, oldVisitor] of Object.entries(previous?.visitors ?? {})) {
    const newVisitor = next?.visitors?.[key];
    if (!isObject(newVisitor)) { errors.push(`visitor record removed: ${key}`); continue; }
    for (const note of oldVisitor?.notes ?? []) if (!(newVisitor.notes ?? []).includes(note)) errors.push(`visitor note lost: ${key}`);
    if (oldVisitor?.first_seen && newVisitor.first_seen !== oldVisitor.first_seen) errors.push(`visitor first_seen changed: ${key}`);
  }
  for (const bucket of ["keeping","fading"]) for (const memory of previous?.memories?.[bucket] ?? []) {
    const found = ["keeping","fading"].some(target => (next?.memories?.[target] ?? []).some(candidate => candidate.text === memory.text));
    if (!found) errors.push(`memory lost: ${memory.text}`);
  }
  return errors;
}

export function validateUpdate(previous, next) {
  return [
    ...validateState(next),
    ...validateCharacterInvariants(next),
    ...validateHistoryPreservation(previous, next)
  ];
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/state-contract.mjs <state.json>");
    process.exitCode = 2;
  } else {
    try {
      const state = JSON.parse(fs.readFileSync(file, "utf8"));
      const errors = [...validateState(state), ...validateCharacterInvariants(state)];
      if (errors.length) {
        console.error(`State rejected (${errors.length} issue(s)):`);
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
      } else console.log(`State contract passed: ${file}`);
    } catch (error) {
      console.error(`Could not validate state: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
