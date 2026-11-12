import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { appendEvent, readEvents, replayEvents } from "../src/memory/event-log.mjs";

async function temporaryStore(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "graves-memory-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("appends ordered events and verifies the hash chain", async t => {
  const storeDir = await temporaryStore(t);
  const first = await appendEvent({
    storeDir,
    type: "memory.created",
    occurredAt: "2026-11-12T10:00:00.000Z",
    payload: { text: "The moonbells like humming", source: "town_observation" }
  });
  const second = await appendEvent({
    storeDir,
    type: "journal.entry_added",
    occurredAt: "2026-11-12T10:01:00.000Z",
    payload: { title: "A small discovery" }
  });

  const events = await readEvents(storeDir);
  assert.equal(first.seq, 1);
  assert.equal(second.seq, 2);
  assert.equal(events.length, 2);
  assert.equal(second.prev_hash, first.hash);
});

test("replays verified events into a caller-owned projection", async t => {
  const storeDir = await temporaryStore(t);
  await appendEvent({ storeDir, type: "memory.created", payload: { text: "Lantern three goes out first" } });
  await appendEvent({ storeDir, type: "memory.created", payload: { text: "Hum to the moonbells" } });

  const memories = await replayEvents(
    storeDir,
    (current, event) => event.type === "memory.created" ? [...current, event.payload.text] : current,
    []
  );
  assert.deepEqual(memories, ["Lantern three goes out first", "Hum to the moonbells"]);
});

test("rejects a modified event", async t => {
  const storeDir = await temporaryStore(t);
  await appendEvent({ storeDir, type: "operator.note_added", payload: { note: "original" } });
  const file = path.join(storeDir, "events.jsonl");
  const events = JSON.parse((await readFile(file, "utf8")).trim());
  events.payload.note = "silently changed";
  await writeFile(file, `${JSON.stringify(events)}\n`);

  await assert.rejects(readEvents(storeDir), /Hash mismatch/);
});

test("rejects malformed event types and oversized payloads", async t => {
  const storeDir = await temporaryStore(t);
  await assert.rejects(
    appendEvent({ storeDir, type: "SYSTEM/OVERRIDE", payload: {} }),
    /lowercase dotted event name/
  );
  await assert.rejects(
    appendEvent({ storeDir, type: "operator.note_added", payload: { text: "x".repeat(65 * 1024) } }),
    /exceeds/
  );
});

test("refuses to append when another writer holds the lock", async t => {
  const storeDir = await temporaryStore(t);
  const lockPath = path.join(storeDir, "events.lock");
  await writeFile(lockPath, "writer active");
  await assert.rejects(
    appendEvent({ storeDir, type: "operator.note_added", payload: { note: "wait" } }),
    /lock exists/
  );
});

test("rejects non-object payloads and invalid timestamps", async t => {
  const storeDir = await temporaryStore(t);
  await assert.rejects(
    appendEvent({ storeDir, type: "operator.note_added", payload: ["not", "an", "object"] }),
    /payload must be a JSON object/
  );
  await assert.rejects(
    appendEvent({ storeDir, type: "operator.note_added", payload: {}, occurredAt: "not-a-date" }),
    /valid date-time/
  );
});

test("detects a truncated final log record", async t => {
  const storeDir = await temporaryStore(t);
  await appendEvent({ storeDir, type: "operator.note_added", payload: { note: "complete" } });
  await appendEvent({ storeDir, type: "operator.note_added", payload: { note: "second" } });
  const file = path.join(storeDir, "events.jsonl");
  const raw = await readFile(file, "utf8");
  await writeFile(file, raw.slice(0, raw.lastIndexOf("\n", raw.length - 2) + 1) + "{truncated}\n");
  await assert.rejects(readEvents(storeDir), /Invalid JSON/);
});
