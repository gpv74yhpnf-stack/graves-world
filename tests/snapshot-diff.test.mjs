import test from "node:test";
import assert from "node:assert/strict";
import { compareSnapshots } from "../src/memory/snapshot-diff.mjs";

const older = {
  updated: "2026-11-11T13:30:00-06:00",
  location: "lantern_lane",
  thought: "The rain is gentle.",
  memories: ["The moonbells ring."]
};

test("reports field-level observed changes with source provenance", () => {
  const newer = {
    updated: "2026-11-11T15:15:00-06:00",
    location: "offering_stone",
    thought: "A visitor arrived.",
    memories: ["The moonbells ring.", "A visitor left a blue ribbon."]
  };
  const report = compareSnapshots({
    before: older,
    after: newer,
    beforeSource: "archive-a.json",
    afterSource: "archive-b.json"
  });

  assert.equal(report.interpretation, "observed_differences_only");
  assert.equal(report.confidence, "observed");
  assert.equal(report.before.source, "archive-a.json");
  assert.equal(report.after.source, "archive-b.json");
  assert.equal(report.change_count, 4);
  assert.deepEqual(report.changes.map(change => change.path), [
    "location", "memories", "thought", "updated"
  ]);
  assert.equal(report.changes.find(change => change.path === "memories").before.length, 1);
});

test("distinguishes added and removed fields without inventing values", () => {
  const report = compareSnapshots({
    before: { updated: "2026-11-11T13:30:00Z", old_note: "fading" },
    after: { updated: "2026-11-11T14:30:00Z", new_note: "fresh" }
  });
  const removed = report.changes.find(change => change.path === "old_note");
  const added = report.changes.find(change => change.path === "new_note");

  assert.equal(removed.before_exists, true);
  assert.equal(removed.after_exists, false);
  assert.equal(added.before_exists, false);
  assert.equal(added.after_exists, true);
});

test("rejects snapshots with missing timestamps or reversed chronology", () => {
  assert.throws(() => compareSnapshots({
    before: { location: "a" },
    after: { updated: "2026-11-11T14:30:00Z" }
  }), /before snapshot requires/);

  assert.throws(() => compareSnapshots({
    before: { updated: "2026-11-11T14:30:00Z" },
    after: { updated: "2026-11-11T13:30:00Z" }
  }), /must not predate/);
});

test("does not mutate source snapshots", () => {
  const before = structuredClone(older);
  const after = { ...structuredClone(older), updated: "2026-11-11T15:15:00-06:00" };
  const beforeCopy = structuredClone(before);
  const afterCopy = structuredClone(after);

  compareSnapshots({ before, after });
  assert.deepEqual(before, beforeCopy);
  assert.deepEqual(after, afterCopy);
});
