#!/usr/bin/env node
import { realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOllamaAdapter } from "../src/brain/ollama-adapter.mjs";
import { runPrivateShadowTurn } from "../src/brain/private-shadow-runner.mjs";

const repositoryRoot = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

function defaultStorePath() {
  if (process.env.GRAVES_PRIVATE_STORE) return process.env.GRAVES_PRIVATE_STORE;
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "GravesPrivateMind");
  if (process.platform === "win32") throw new Error("LOCALAPPDATA is unavailable; set GRAVES_PRIVATE_STORE");
  return path.join(os.homedir(), ".local", "share", "GravesPrivateMind");
}

async function resolvePrivateStore(candidate) {
  const storeDir = await realpath(path.resolve(candidate));
  const relative = path.relative(repositoryRoot, storeDir);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("Private event store must resolve outside the public repository");
  }
  const info = await stat(storeDir);
  if (!info.isDirectory()) throw new Error("Private event store must be a directory");
  return storeDir;
}

try {
  const modelName = process.env.GRAVES_OLLAMA_MODEL;
  if (!modelName) throw new Error("Set GRAVES_OLLAMA_MODEL to an installed local Ollama model name");

  const storeDir = await resolvePrivateStore(defaultStorePath());
  const model = createOllamaAdapter({ model: modelName });
  const result = await runPrivateShadowTurn({ storeDir, model });

  // Proposal contents stay in the private log and are never printed here.
  console.log(JSON.stringify({
    status: "shadow_turn_completed",
    run_id: result.runId,
    snapshot_updated: result.snapshotUpdated,
    proposal_count: result.proposalCount,
    decisions: result.decisions,
    actions_executed: 0,
    public_state_changed: false
  }, null, 2));
} catch (error) {
  console.error(`Shadow turn failed: ${error.message}`);
  process.exitCode = 1;
}
