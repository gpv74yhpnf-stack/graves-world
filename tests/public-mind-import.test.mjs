import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { importPublicMindSnapshots } from "../src/memory/import-public-snapshots.mjs";
import { readEvents } from "../src/memory/event-log.mjs";

async function tempDir(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "graves-import-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function stateFile(t, updated, overrides = {}) {
  const source = JSON.parse(await readFile(new URL("../state.json", import.meta.url), "utf8"));
  const state = { ...source, updated, ...overrides };
  const filePath = path.join(await tempDir(t), "snapshot.json");
  await writeFile(filePath, JSON.stringify(state));
  return filePath;
}

test("imports snapshots in source-time order and preserves their complete state", async t => {
  const root = await tempDir(t);
  const older = await stateFile(t, "2026-11-11T13:30:00-06:00");
  const newer = await stateFile(t, "2026-11-11T15:15:00-06:00", {
    thought: "The stone is open and the lanterns are bright."
  });

  const result = await importPublicMindSnapshots({
    storeDir: path.join(root, "private-vault"),
    snapshots: [
      { source: "live-issue-current", filePath: newer },
      { source: "repository-fallback", filePath: older }
    ]
  });

  assert.equal(result.imported.length, 2);
  const events = await readEvents(path.join(root, "private-vault"));
  assert.equal(events[0].type, "mind.public_snapshot_imported");
  assert.equal(events[0].payload.source, "repository-fallback");
  assert.equal(events[1].payload.source, "live-issue-current");
  assert.equal(events[1].payload.state.thought, "The stone is open and the lanterns are bright.");
});

test("migration is idempotent by content hash", async t => {
  const root = await tempDir(t);
  const snapshot = await stateFile(t, "2026-11-11T13:30:00-06:00");
  const options = {
    storeDir: path.join(root, "private-vault"),
    snapshots: [{ source: "fallback", filePath: snapshot }]
  };

  const first = await importPublicMindSnapshots(options);
  const second = await importPublicMindSnapshots(options);
  assert.equal(first.imported.length, 1);
  assert.equal(second.imported.length, 0);
  assert.equal(second.skipped.length, 1);
  assert.equal((await readEvents(options.storeDir)).length, 1);
});

test("rejects an invalid snapshot without writing partial migration data", async t => {
  const root = await tempDir(t);
  const snapshot = await stateFile(t, "2026-11-11T13:30:00-06:00", {
    location: "outside_the_town"
  });
  const storeDir = path.join(root, "private-vault");

  await assert.rejects(
    importPublicMindSnapshots({
      storeDir,
      snapshots: [{ source: "bad-snapshot", filePath: snapshot }]
    }),
    /Snapshot rejected/
  );
  await assert.rejects(readEvents(storeDir), /ENOENT/);
});

test("refuses to run without a private destination and source snapshots", async () => {
  await assert.rejects(
    importPublicMindSnapshots({ storeDir: "", snapshots: [] }),
    /private directory/
  );
  await assert.rejects(
    importPublicMindSnapshots({ storeDir: "/tmp/private", snapshots: [] }),
    /non-empty array/
  );
});
