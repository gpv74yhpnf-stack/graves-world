import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const LOG_NAME = "events.jsonl";
const LOCK_NAME = "events.lock";
const MAX_EVENT_BYTES = 64 * 1024;
const EVENT_TYPE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){0,5}$/;
const GENESIS = "0".repeat(64);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonical(value[key])])
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonical(value));
}

function eventHash(eventWithoutHash) {
  return createHash("sha256").update(stableJson(eventWithoutHash), "utf8").digest("hex");
}

function validateEnvelope(event, expectedSeq, expectedPreviousHash) {
  if (!isRecord(event)) throw new Error("Event must be a JSON object");
  if (event.version !== 1) throw new Error("Unsupported event version");
  if (event.seq !== expectedSeq) throw new Error(`Sequence mismatch at event ${expectedSeq}`);
  if (typeof event.id !== "string" || !event.id) throw new Error("Event id is missing");
  if (typeof event.occurred_at !== "string" || Number.isNaN(Date.parse(event.occurred_at))) {
    throw new Error(`Invalid occurred_at at event ${expectedSeq}`);
  }
  if (typeof event.type !== "string" || !EVENT_TYPE.test(event.type)) {
    throw new Error(`Invalid event type at event ${expectedSeq}`);
  }
  if (!isRecord(event.payload)) throw new Error(`Payload must be an object at event ${expectedSeq}`);
  if (event.prev_hash !== expectedPreviousHash) throw new Error(`Broken hash link at event ${expectedSeq}`);

  const { hash, ...body } = event;
  if (typeof hash !== "string" || hash !== eventHash(body)) {
    throw new Error(`Hash mismatch at event ${expectedSeq}`);
  }
}

async function readLogFile(filePath) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  if (!raw) return [];
  const lines = raw.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const events = [];
  let previousHash = GENESIS;
  for (let index = 0; index < lines.length; index += 1) {
    let event;
    try {
      event = JSON.parse(lines[index]);
    } catch {
      throw new Error(`Invalid JSON on event log line ${index + 1}`);
    }
    validateEnvelope(event, index + 1, previousHash);
    events.push(event);
    previousHash = event.hash;
  }
  return events;
}

async function acquireLock(lockPath) {
  try {
    return await fs.open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("Memory log is busy (lock exists); do not delete the lock until the writer is confirmed stopped");
    }
    throw error;
  }
}

async function withLock(lockPath, action) {
  const lock = await acquireLock(lockPath);
  try {
    await lock.writeFile(`pid=${process.pid}\nstarted=${new Date().toISOString()}\n`);
    await lock.sync();
    return await action();
  } finally {
    await lock.close();
    await fs.unlink(lockPath).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

/**
 * Read and verify the complete append-only event log.
 * The directory is expected to be private and outside the public repository.
 */
export async function readEvents(storeDir) {
  const directory = path.resolve(storeDir);
  return readLogFile(path.join(directory, LOG_NAME));
}

/**
 * Append one event under an exclusive lock. This is a local single-host store,
 * not a distributed database. A hash chain detects edits but is not a signature
 * and cannot prevent an attacker with write access from rebuilding the chain.
 */
export async function appendEvent({ storeDir, type, payload, occurredAt = new Date().toISOString() }) {
  if (typeof type !== "string" || !EVENT_TYPE.test(type)) {
    throw new Error("type must be a lowercase dotted event name");
  }
  if (!isRecord(payload)) throw new Error("payload must be a JSON object");
  if (typeof occurredAt !== "string" || Number.isNaN(Date.parse(occurredAt))) {
    throw new Error("occurredAt must be a valid date-time string");
  }

  const serializedPayload = stableJson(payload);
  if (Buffer.byteLength(serializedPayload, "utf8") > MAX_EVENT_BYTES) {
    throw new Error(`payload exceeds ${MAX_EVENT_BYTES} bytes`);
  }

  const directory = path.resolve(storeDir);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  const logPath = path.join(directory, LOG_NAME);
  const lockPath = path.join(directory, LOCK_NAME);

  return withLock(lockPath, async () => {
    const events = await readLogFile(logPath);
    const previous = events.at(-1);
    const body = {
      version: 1,
      seq: events.length + 1,
      id: randomUUID(),
      occurred_at: occurredAt,
      type,
      payload: JSON.parse(serializedPayload),
      prev_hash: previous?.hash ?? GENESIS
    };
    const event = { ...body, hash: eventHash(body) };
    const line = `${JSON.stringify(event)}\n`;
    if (Buffer.byteLength(line, "utf8") > MAX_EVENT_BYTES + 2048) {
      throw new Error("event envelope exceeds maximum size");
    }

    const handle = await fs.open(logPath, "a", 0o600);
    try {
      await handle.chmod(0o600);
      await handle.writeFile(line, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return event;
  });
}

/** Rebuild a caller-defined projection without mutating the source log. */
export async function replayEvents(storeDir, reducer, initialState) {
  if (typeof reducer !== "function") throw new Error("reducer must be a function");
  const events = await readEvents(storeDir);
  return events.reduce((state, event) => reducer(state, event), initialState);
}

export const MEMORY_EVENT_TYPES = Object.freeze([
  "visitor.offering_received",
  "visitor.reply_published",
  "memory.created",
  "memory.reclassified",
  "journal.entry_added",
  "character.turn_completed",
  "world.action_recorded",
  "operator.note_added"
]);
