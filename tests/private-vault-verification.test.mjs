import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { appendEvent } from "../src/memory/event-log.mjs";

const verifier = path.resolve("scripts/verify-private-vault.mjs");

async function withStore(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "graves-vault-verify-"));
  const store = path.join(root, "private-store");
  try {
    await run(store);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function execute(store) {
  return spawnSync(process.execPath, [verifier, "--store", store], {
    encoding: "utf8"
  });
}

test("verifier reports a valid event chain and snapshot metadata", async () => {
  await withStore(async store => {
    await appendEvent({
      storeDir: store,
      type: "mind.public_snapshot_imported",
      occurredAt: "2026-11-11T13:30:00-06:00",
      payload: {
        source: "repository-fallback",
        source_updated: "2026-11-11T13:30:00-06:00",
        state_hash: "a".repeat(64),
        state: { private_test_fixture: true }
      }
    });
    await appendEvent({
      storeDir: store,
      type: "operator.note_added",
      payload: { note: "second event" }
    });

    const result = execute(store);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.verification, "passed");
    assert.equal(report.event_count, 2);
    assert.equal(report.first_sequence, 1);
    assert.equal(report.last_sequence, 2);
    assert.equal(report.imported_snapshots.length, 1);
    assert.equal(report.imported_snapshots[0].source, "repository-fallback");
    assert.equal(result.stdout.includes("private_test_fixture"), false);
  });
});

test("verifier fails closed when an event has been modified", async () => {
  await withStore(async store => {
    await appendEvent({
      storeDir: store,
      type: "operator.note_added",
      payload: { note: "original" }
    });
    const logPath = path.join(store, "events.jsonl");
    const raw = await readFile(logPath, "utf8");
    const tampered = raw.replace('"original"', '"tampered"');
    await writeFile(logPath, tampered, "utf8");

    const result = execute(store);
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stderr);
    assert.equal(report.verification, "failed");
    assert.match(report.error, /Hash mismatch/);
  });
});

test("verifier fails closed for a broken sequence or malformed log", async () => {
  await withStore(async store => {
    await mkdir(store, { recursive: true });
    await writeFile(path.join(store, "events.jsonl"), '{"seq":2}\n', "utf8");
    const result = execute(store);
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stderr);
    assert.equal(report.verification, "failed");
    assert.match(report.error, /Invalid JSON|Unsupported event version|Sequence mismatch/);
  });
});
