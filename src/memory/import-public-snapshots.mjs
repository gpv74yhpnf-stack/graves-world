import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appendEvent, readEvents } from "./event-log.mjs";
import { validateCharacterInvariants, validateState } from "../../scripts/state-contract.mjs";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Import public JSON snapshots into a private event store.
 *
 * Each snapshot is preserved as an immutable migration event. Existing
 * snapshots are detected by content hash so rerunning a migration is safe.
 * This function never writes to the source snapshots or public repository.
 */
export async function importPublicMindSnapshots({ storeDir, snapshots }) {
  if (typeof storeDir !== "string" || !storeDir.trim()) {
    throw new Error("storeDir must point to a private directory outside the repository");
  }
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new Error("snapshots must be a non-empty array");
  }

  const prepared = [];
  for (const item of snapshots) {
    if (!item || typeof item.source !== "string" || !item.source.trim()) {
      throw new Error("every snapshot requires a source label");
    }
    if (typeof item.filePath !== "string" || !item.filePath.trim()) {
      throw new Error("every snapshot requires a filePath");
    }
    const filePath = path.resolve(item.filePath);
    const raw = await fs.readFile(filePath, "utf8");
    let state;
    try {
      state = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON snapshot: ${item.source}`);
    }

    const errors = [...validateState(state), ...validateCharacterInvariants(state)];
    if (errors.length) {
      throw new Error(`Snapshot rejected (${item.source}): ${errors.join("; ")}`);
    }

    prepared.push({
      source: item.source.trim(),
      source_file_name: path.basename(filePath),
      source_updated: state.updated,
      state_hash: sha256(JSON.stringify(state)),
      state
    });
  }

  prepared.sort((a, b) => Date.parse(a.source_updated) - Date.parse(b.source_updated));
  const existing = await readEvents(storeDir);
  const knownHashes = new Set(
    existing
      .filter(event => event.type === "mind.public_snapshot_imported")
      .map(event => event.payload.state_hash)
  );

  const imported = [];
  const skipped = [];
  for (const snapshot of prepared) {
    if (knownHashes.has(snapshot.state_hash)) {
      skipped.push({ source: snapshot.source, state_hash: snapshot.state_hash, reason: "already imported" });
      continue;
    }

    const event = await appendEvent({
      storeDir,
      type: "mind.public_snapshot_imported",
      occurredAt: snapshot.source_updated,
      payload: {
        migration_version: 1,
        source: snapshot.source,
        source_file_name: snapshot.source_file_name,
        source_updated: snapshot.source_updated,
        imported_at: new Date().toISOString(),
        state_hash: snapshot.state_hash,
        state: snapshot.state
      }
    });
    knownHashes.add(snapshot.state_hash);
    imported.push({
      seq: event.seq,
      source: snapshot.source,
      source_updated: snapshot.source_updated,
      state_hash: snapshot.state_hash
    });
  }

  return { imported, skipped, total_events: (await readEvents(storeDir)).length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const storeIndex = args.indexOf("--store");
  const storeDir = storeIndex >= 0 ? args[storeIndex + 1] : null;
  const snapshotArgs = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--snapshot" && args[i + 1]) {
      const spec = args[++i];
      const separator = spec.indexOf("=");
      if (separator < 1 || separator === spec.length - 1) {
        throw new Error("--snapshot format is SOURCE=FILE");
      }
      snapshotArgs.push({ source: spec.slice(0, separator), filePath: spec.slice(separator + 1) });
    }
  }

  if (!storeDir || snapshotArgs.length === 0) {
    console.error("Usage: node src/memory/import-public-snapshots.mjs --store <PRIVATE_DIR> --snapshot <SOURCE=FILE> [--snapshot <SOURCE=FILE> ...]");
    process.exitCode = 2;
  } else {
    try {
      const result = await importPublicMindSnapshots({ storeDir, snapshots: snapshotArgs });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Import failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
