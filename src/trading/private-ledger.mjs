import { appendFile, mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Runtime artifacts stay outside the public repository and website.
export function privateTradingDir() {
  const root = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "GravesPrivateMind")
    : path.join(os.homedir(), ".graves-world");
  return path.join(root, "trading");
}
async function ensureDir(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
}
function stateFile(dir) {
  return path.join(dir, "paper-risk.json");
}
export async function readRiskState(dir = privateTradingDir()) {
  try {
    return JSON.parse(await readFile(stateFile(dir), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error("No paper risk baseline. Run paper-status before order previews or submissions.");
    }
    throw error;
  }
}
export async function writeRiskState(value, dir = privateTradingDir()) {
  await ensureDir(dir);
  const file = stateFile(dir);
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temp, JSON.stringify({
      peakEquity: value.peakEquity,
      killSwitch: value.killSwitch,
      checkedAt: value.checkedAt
    }, null, 2), { mode: 0o600, flag: "wx" });
    await rename(temp, file);
  } finally {
    await unlink(temp).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
export async function updatePeakEquity(equity, dir = privateTradingDir()) {
  const number = Number(equity);
  if (!Number.isFinite(number) || number <= 0) throw new Error("Invalid equity for paper risk baseline");
  let previous = null;
  try {
    previous = await readRiskState(dir);
  } catch (error) {
    if (!String(error.message).includes("No paper risk baseline")) throw error;
  }
  const next = {
    peakEquity: Math.max(Number(previous?.peakEquity) || 0, number),
    killSwitch: previous?.killSwitch ?? false,
    checkedAt: new Date().toISOString()
  };
  await writeRiskState(next, dir);
  return next;
}
export async function setPaperKillSwitch(engaged, dir = privateTradingDir()) {
  const previous = await readRiskState(dir);
  const next = { ...previous, killSwitch: Boolean(engaged), checkedAt: new Date().toISOString() };
  await writeRiskState(next, dir);
  return next;
}
export async function appendResearchRecord(record, dir = privateTradingDir()) {
  await ensureDir(dir);
  // Callers pass metrics and model parameters only, never account credentials.
  await appendFile(path.join(dir, "experiments.jsonl"),
    JSON.stringify({ recordedAt: new Date().toISOString(), ...record }) + "\n",
    { encoding: "utf8", mode: 0o600 });
}
export async function withPaperOrderLock(callback, dir = privateTradingDir()) {
  await ensureDir(dir);
  // Fail closed on a stale lock rather than risk concurrent simulated submissions.
  const lockFile = path.join(dir, "paper-order.lock");
  const handle = await open(lockFile, "wx", 0o600);
  try {
    return await callback();
  } finally {
    await handle.close();
    await unlink(lockFile);
  }
}
