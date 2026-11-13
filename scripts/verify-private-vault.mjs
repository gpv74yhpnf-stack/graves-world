#!/usr/bin/env node
import path from "node:path";
import { readEvents } from "../src/memory/event-log.mjs";

function readStorePath(argv) {
  const index = argv.indexOf("--store");
  if (index >= 0) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("--store requires a directory path");
    }
    return path.resolve(value);
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    throw new Error("LOCALAPPDATA is unavailable; pass --store <PRIVATE_DIRECTORY>");
  }
  return path.join(localAppData, "GravesPrivateMind");
}

try {
  const storeDir = readStorePath(process.argv.slice(2));
  // readEvents validates every JSONL record, sequence number, previous-hash
  // link, and SHA-256 event hash from genesis to the final record.
  const events = await readEvents(storeDir);
  const last = events.at(-1) ?? null;

  const report = {
    verification: "passed",
    store_directory: storeDir,
    event_count: events.length,
    first_sequence: events[0]?.seq ?? null,
    last_sequence: last?.seq ?? null,
    last_event_type: last?.type ?? null,
    last_event_hash: last?.hash ?? null,
    imported_snapshots: events
      .filter(event => event.type === "mind.public_snapshot_imported")
      .map(event => ({
        sequence: event.seq,
        source: event.payload.source,
        source_updated: event.payload.source_updated,
        state_hash: event.payload.state_hash
      }))
  };

  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    verification: "failed",
    error: error.message
  }, null, 2));
  process.exitCode = 1;
}
