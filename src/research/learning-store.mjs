import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";

// Learning is kept separate from public town state and the approved memory ledger.
export function defaultLearningDirectory() {
  const root = process.env.GRAVES_PRIVATE_DIR ||
    (process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "GravesPrivateMind")
      : path.join(os.homedir(), ".graves-world"));
  return path.join(root, "learning");
}

function initialState() {
  return {
    version: 1,
    nextTopicIndex: 0,
    attempts: 0,
    successes: 0,
    dailyDate: null,
    dailyAttempts: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    followups: []
  };
}

export function createLearningStore({ directory = defaultLearningDirectory() } = {}) {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) {
    throw new Error("Learning storage requires an absolute private directory");
  }
  const statePath = path.join(directory, "state.json");
  const journalPath = path.join(directory, "provisional-findings.jsonl");
  const lockPath = path.join(directory, "learning.lock");
  const heartbeatPath = path.join(directory, "worker-heartbeat.json");

  async function setup() { await mkdir(directory, { recursive: true, mode: 0o700 }); }
  async function readState() {
    try {
      const data = JSON.parse(await readFile(statePath, "utf8"));
      if (data.version !== 1 || !Number.isSafeInteger(data.attempts)) {
        throw new Error("Invalid learning state, refusing to overwrite it");
      }
      return data;
    } catch (error) {
      if (error?.code === "ENOENT") return initialState();
      throw error;
    }
  }
  async function writeState(value) {
    await setup();
    const tmp = statePath + "." + randomUUID() + ".tmp";
    try {
      await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" });
      await rename(tmp, statePath);
    } finally {
      await unlink(tmp).catch(error => {
        if (error?.code !== "ENOENT") throw error;
      });
    }
  }
  async function record(record) {
    await setup();
    // This is deliberately not the approved research note or character memory file.
    const sanitized = { id: randomUUID(), recordedAt: new Date().toISOString(), ...record };
    const text = JSON.stringify(sanitized);
    if (Buffer.byteLength(text, "utf8") > 18_000) throw new Error("Learning record is too large");
    await appendFile(journalPath, text + "\n", { encoding: "utf8", mode: 0o600 });
    return sanitized;
  }
  async function recent(limit = 8) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new Error("Invalid recent limit");
    let size;
    try { size = (await stat(journalPath)).size; }
    catch (error) { if (error?.code === "ENOENT") return []; throw error; }
    if (size > 8_000_000) throw new Error("Research journal is full: archive it privately before continuing");
    const raw = await readFile(journalPath, "utf8");
    return raw.trim().split("\n").slice(-limit).flatMap(line => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  }
  async function heartbeat({ phase = "waiting", nextCycleAt = null } = {}) {
    if (!["waiting", "researching"].includes(phase)) throw new Error("Invalid worker phase");
    await setup();
    const tmp = heartbeatPath + "." + randomUUID() + ".tmp";
    try {
      await writeFile(tmp, JSON.stringify({
        phase, lastSeenAt: new Date().toISOString(), nextCycleAt
      }) + "\n", { flag: "wx", mode: 0o600 });
      await rename(tmp, heartbeatPath);
    } finally {
      await unlink(tmp).catch(error => {
        if (error?.code !== "ENOENT") throw error;
      });
    }
  }
  async function withLock(task) {
    await setup();
    // Fail closed on an existing lock. Never break locks automatically.
    const handle = await open(lockPath, "wx", 0o600);
    try { return await task(); }
    finally {
      await handle.close();
      await unlink(lockPath);
    }
  }
  async function status() {
    const state = await readState();
    let workerHeartbeat = null;
    try {
      const h = JSON.parse(await readFile(heartbeatPath, "utf8"));
      const ageMs = Date.now() - Date.parse(h.lastSeenAt);
      if (["waiting", "researching"].includes(h.phase) && Number.isFinite(ageMs) &&
          ageMs >= 0 && ageMs < 150_000) {
        workerHeartbeat = { phase: h.phase, lastSeenAt: h.lastSeenAt, nextCycleAt: h.nextCycleAt };
      }
    } catch {
      // No running worker is confirmed; keep the rest of the journal readable.
    }
    const records = (await recent(12)).filter(r => r.status === "provisional");
    return {
      mode: "local-provisional-learning",
      workerHeartbeat, // recent heartbeat only; never proof the process is still running.
      attempts: state.attempts,
      successes: state.successes,
      lastAttemptAt: state.lastAttemptAt,
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
      pendingFollowups: state.followups?.length ?? 0,
      latest: records.slice(-4).reverse().map(r => ({
        id: r.id, topic: r.topic, title: r.note?.title,
        overview: r.note?.overview, sources: r.note?.sources,
        findings: r.note?.findings, unknowns: r.unknowns,
        recordedAt: r.recordedAt, status: "provisional"
      }))
    };
  }
  return Object.freeze({ directory, readState, writeState, record, recent, heartbeat, withLock, status });
}
