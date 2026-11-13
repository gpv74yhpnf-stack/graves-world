import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { importPublicMindSnapshots } from "../src/memory/import-public-snapshots.mjs";
import { appendEvent, readEvents } from "../src/memory/event-log.mjs";
import { runPrivateShadowTurn } from "../src/brain/private-shadow-runner.mjs";

async function temporaryStore(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "graves-shadow-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("private shadow runner uses the latest public snapshot and excludes visitor events", async t => {
  const root = await temporaryStore(t);
  const storeDir = path.join(root, "private-vault");
  const state = JSON.parse(await readFile(new URL("../state.json", import.meta.url), "utf8"));
  const snapshotPath = path.join(root, "snapshot.json");
  await writeFile(snapshotPath, JSON.stringify(state));
  await importPublicMindSnapshots({
    storeDir,
    snapshots: [{ source: "test-fixture", filePath: snapshotPath }]
  });
  await appendEvent({
    storeDir,
    type: "visitor.offering_received",
    payload: { text: "fixture visitor text never sent to the model" }
  });

  let modelContext;
  const result = await runPrivateShadowTurn({
    storeDir,
    model: {
      name: "fixture-local-model",
      async generate(request) {
        modelContext = request.context;
        return { proposals: [] };
      }
    }
  });

  assert.equal(result.proposalCount, 0);
  assert.equal(result.snapshotUpdated, state.updated);
  assert.deepEqual(modelContext.pending_offerings, []);
  assert.deepEqual(Object.keys(modelContext.current_state).sort(), ["day", "location", "needs", "sheet", "time_of_day", "weather"].sort());
  assert.equal(modelContext.current_state.location, state.location);
  assert.equal("offerings_waiting" in modelContext.current_state, false);
  assert.equal("memories" in modelContext.current_state, false);
  assert.equal("visitors" in modelContext.current_state, false);
  assert.doesNotMatch(JSON.stringify(modelContext), /fixture visitor text/);
  assert.equal((await readEvents(storeDir)).at(-1).type, "brain.turn_completed");
});

test("private shadow runner refuses an empty event store without calling the model", async t => {
  const storeDir = await temporaryStore(t);
  let modelCalled = false;
  await assert.rejects(
    runPrivateShadowTurn({
      storeDir,
      model: { async generate() { modelCalled = true; return { proposals: [] }; } }
    }),
    /No imported public snapshot/
  );
  assert.equal(modelCalled, false);
});
