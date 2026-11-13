import { readEvents } from "../memory/event-log.mjs";
import { runBrainTurn } from "./orchestrator.mjs";

const MODEL_STATE_FIELDS = Object.freeze([
  "day",
  "time_of_day",
  "weather",
  "location",
  "needs",
  "sheet"
]);

function publicSnapshotContext(state) {
  const currentState = Object.fromEntries(
    MODEL_STATE_FIELDS
      .filter(field => Object.hasOwn(state, field))
      .map(field => [field, state[field]])
  );
  return { current_state: currentState, pending_offerings: [] };
}

/**
 * Run a local shadow turn from the latest imported public snapshot. This first
 * runtime intentionally excludes raw visitor events and other private notes.
 */
export async function runPrivateShadowTurn({ storeDir, model }) {
  const events = await readEvents(storeDir);
  const snapshot = events.findLast(event =>
    event.type === "mind.public_snapshot_imported" && event.payload?.state
  );
  if (!snapshot) {
    throw new Error("No imported public snapshot is available in the private event store");
  }

  const turn = await runBrainTurn({
    storeDir,
    model,
    context: publicSnapshotContext(snapshot.payload.state)
  });

  return {
    runId: turn.runId,
    snapshotUpdated: snapshot.payload.source_updated,
    proposalCount: turn.proposals.length,
    decisions: turn.decisions
  };
}
