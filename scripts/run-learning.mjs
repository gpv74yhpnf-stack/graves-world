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
  console.log("Graves' private local study loop is running: at most one attempt per minute, 10 attempts per UTC day.");
  console.log("Notes are PROVISIONAL. Any research error STOPS the worker for diagnosis. Ctrl+C to stop.");
  // A recent local heartbeat lets the 3D Library display what the worker is
  // doing without publishing its private notes or claiming the process is alive forever.
  const intervalMs = 60 * 1000;
  let phase = "researching";
  let nextCycleAt = null;
  const tick = () => store.heartbeat({ phase, nextCycleAt }).catch(error =>
    console.error("Local heartbeat failed: " + String(error.message).slice(0, 180))
  );
  const ticker = setInterval(tick, 60 * 1000);
  try {
    while (true) {
      phase = "researching";
      await store.heartbeat({ phase, nextCycleAt });
      // Fail stop on errors. Never retry an unknown broken request unattended.
      const result = await engine.runOnce();
      console.log(JSON.stringify(result, null, 2));
      phase = "waiting";
      const next = new Date(Date.now() + intervalMs);
      if (!result.ran && result.reason === "Daily bounded research budget reached") {
        // Sleep until tomorrow instead of polling the exhausted budget.
        next.setUTCHours(24, 0, 0, 0);
      }
      nextCycleAt = next.toISOString();
      await store.heartbeat({ phase, nextCycleAt });
      await delay(Math.max(1000, next.getTime() - Date.now()));
    }
  } finally {
    clearInterval(ticker);
  }
}
main().catch(error => {
  console.error("Graves' learning worker STOPPED: " + String(error.message).slice(0, 300));
  console.error("Inspect 'npm run learning:status', fix the cause, then restart 'npm run learning:watch'.");
  process.exitCode = 1;
});
