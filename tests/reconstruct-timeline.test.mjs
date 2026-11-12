import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { appendEvent } from "../src/memory/event-log.mjs";
import { reconstructSnapshotTimeline } from "../src/memory/reconstruct-timeline.mjs";

async function withStore(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "graves-timeline-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function snapshot(updated, thought, location) {
  return { updated, thought, location, memories: { keeping: [] } };
}

test("reconstructs ordered transitions from imported snapshots only", async () => {
  await withStore(async storeDir => {
    await appendEvent({
      storeDir,
      type: "mind.public_snapshot_imported",
      occurredAt: "2026-11-11T15:00:00Z",
      payload: {
        source: "later-copy",
        source_file_name: "later.json",
        source_updated: "2026-11-11T15:00:00Z",
        imported_at: "2026-11-12T00:00:00Z",
        state_hash: "b".repeat(64),
        state: snapshot("2026-11-11T15:00:00Z", "Visitor arrived.", "offering_stone")
      }
    });
    await appendEvent({
      storeDir,
      type: "mind.public_snapshot_imported",
      occurredAt: "2026-11-11T13:00:00Z",
      payload: {
        source: "earlier-copy",
        source_file_name: "earlier.json",
        source_updated: "2026-11-11T13:00:00Z",
        imported_at: "2026-11-12T00:00:00Z",
        state_hash: "a".repeat(64),
        state: snapshot("2026-11-11T13:00:00Z", "Waiting for visitors.", "lantern_lane")
      }
    });

    const report = await reconstructSnapshotTimeline({ storeDir });
    assert.equal(report.snapshot_count, 2);
    assert.equal(report.transition_count, 1);
    assert.deepEqual(report.snapshots.map(item => item.source), ["earlier-copy", "later-copy"]);
    assert.equal(report.transitions[0].comparison.interpretation, "observed_differences_only");
    assert.deepEqual(
      report.transitions[0].comparison.changes.map(change => change.path),
      ["location", "thought", "updated"]
    );
  });
});

test("returns an empty timeline when no public snapshots were imported", async () => {
  await withStore(async storeDir => {
    const report = await reconstructSnapshotTimeline({ storeDir });
    assert.equal(report.snapshot_count, 0);
    assert.equal(report.transition_count, 0);
    assert.deepEqual(report.transitions, []);
  });
});

test("does not mutate the event log", async () => {
  await withStore(async storeDir => {
    await appendEvent({
      storeDir,
      type: "mind.public_snapshot_imported",
      payload: {
        source: "only-copy",
        source_updated: "2026-11-11T13:00:00Z",
        state_hash: "c".repeat(64),
        state: snapshot("2026-11-11T13:00:00Z", "A quiet day.", "crypt")
      }
    });
    const logPath = path.join(storeDir, "events.jsonl");
    const before = await readFile(logPath, "utf8");
    await reconstructSnapshotTimeline({ storeDir });
    const after = await readFile(logPath, "utf8");
    assert.equal(after, before);
  });
});
