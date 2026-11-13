#!/usr/bin/env node
import { createWebResearch } from "../src/research/web-reader.mjs";
import { createLocalLearningSynthesizer } from "../src/research/local-learning-synthesizer.mjs";
import { createLearningStore } from "../src/research/learning-store.mjs";
import { createAutonomousLearningEngine } from "../src/research/autonomous-learning.mjs";

const commands = new Set(["once", "watch", "status", "help"]);
const command = process.argv[2] || "help";
function help() {
  console.log([
    "GRAVES LOCAL LEARNING ENGINE v1",
    "  node scripts/run-learning.mjs once     # one bounded web study",
    "  node scripts/run-learning.mjs watch    # opt-in 90-minute loop while PC is on",
    "  node scripts/run-learning.mjs status   # private journal summary, no web access",
    "  node scripts/run-learning.mjs help",
    "",
    "Requires local Ollama running and public HTTPS web access.",
    "Only reads public sites. No model self-modification, trading, publishing, or private browsing.",
    "No service is installed. Ctrl+C stops the foreground watch loop."
  ].join("\n"));
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  if (!commands.has(command) || process.argv.length > 3) {
    throw new Error("Unknown command or arguments. Run 'node scripts/run-learning.mjs help'");
  }
  if (command === "help") { help(); return; }
  const store = createLearningStore();
  if (command === "status") {
    console.log(JSON.stringify(await store.status(), null, 2));
    return;
  }
  const engine = createAutonomousLearningEngine({
    web: createWebResearch(),
    synthesizer: createLocalLearningSynthesizer(),
    store
  });
  if (command === "once") {
    console.log(JSON.stringify(await engine.runOnce(), null, 2));
    return;
  }
  console.log("Graves' private local study loop is running: at most 1 cycle per 90 minutes, 10 attempts per UTC day.");
  console.log("New findings are PROVISIONAL research notes, not verified memory. Ctrl+C to stop.");
  // Watch has a strict bounded cadence. Network and model failures never spawn
  // additional processes or accelerate the retry schedule.
  while (true) {
    try {
      console.log(JSON.stringify(await engine.runOnce(), null, 2));
    } catch (error) {
      console.error("Research cycle failed (will retry on the next scheduled tick): " +
        String(error.message).slice(0, 240));
    }
    await delay(90 * 60 * 1000);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
