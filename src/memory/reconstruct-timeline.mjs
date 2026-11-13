import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readEvents } from "./event-log.mjs";
import { compareSnapshots } from "./snapshot-diff.mjs";

/**
 * Reconstruct an evidence-only timeline from already-imported public snapshots.
 * This function never writes to the event store or changes source snapshots.
 */
export async function reconstructSnapshotTimeline({ storeDir }) {
  if (typeof storeDir !== "string" || !storeDir.trim()) {
    throw new Error("storeDir must identify the private event store");
  }
  const events = await readEvents(storeDir);
  const snapshots = events
    .filter(event => event.type === "mind.public_snapshot_imported")
    .map(event => {
      const payload = event.payload;
      if (!payload || typeof payload !== "object" || !payload.state) {
        throw new Error(`Imported snapshot event ${event.seq} has no state payload`);
      }
      return {
        seq: event.seq,
        source: payload.source ?? "unspecified",
        source_file_name: payload.source_file_name ?? null,
        source_updated: payload.source_updated ?? payload.state.updated,
        imported_at: payload.imported_at ?? null,
        state_hash: payload.state_hash ?? null,
        state: payload.state
      };
    })
    .sort((a, b) => {
      const timeDifference = Date.parse(a.source_updated) - Date.parse(b.source_updated);
      return timeDifference || a.seq - b.seq;
    });

  const transitions = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    const before = snapshots[index - 1];
    const after = snapshots[index];
    const comparison = compareSnapshots({
      before: before.state,
      after: after.state,
      beforeSource: `${before.source} (event ${before.seq})`,
      afterSource: `${after.source} (event ${after.seq})`
    });
    transitions.push({
      from_event_seq: before.seq,
      to_event_seq: after.seq,
      comparison
    });
  }

  return {
    report_version: 1,
    interpretation: "observed_snapshot_timeline_not_event_history",
    source_of_truth: "validated_imported_snapshots_in_hash_chained_event_log",
    snapshot_count: snapshots.length,
    transition_count: transitions.length,
    snapshots: snapshots.map(({ state, ...metadata }) => metadata),
    transitions
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const storeIndex = args.indexOf("--store");
  const storeDir = storeIndex >= 0 ? args[storeIndex + 1] : null;
  if (!storeDir || storeDir.startsWith("--")) {
    console.error("Usage: node src/memory/reconstruct-timeline.mjs --store <PRIVATE_DIR>");
    process.exitCode = 2;
  } else {
    try {
      const report = await reconstructSnapshotTimeline({ storeDir: path.resolve(storeDir) });
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      console.error(`Timeline reconstruction failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
