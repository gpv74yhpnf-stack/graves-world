# Snapshot reconstruction v1

## Purpose

The public town has snapshots, not a complete autobiography. This tool compares two JSON snapshots and reports exactly which fields differ. It does not decide what Graves felt, intended, learned, or remembered.

## Run locally

Use copies of snapshots stored in the private vault or another private folder:

```powershell
node src/memory/snapshot-diff.mjs --before "C:\path\older.json" --after "C:\path\newer.json"
```

The report includes each source label, source timestamp, SHA-256 digest, and a sorted list of changed paths. Added and removed fields are represented explicitly. Arrays are compared as whole values because index-by-index comparison can falsely imply that an item retained the same identity.

## Evidence rules

- `observed_differences_only` means the report is descriptive, not causal.
- `confidence: observed` means the difference is directly present in the supplied snapshots. It is not a confidence score about an interpretation.
- Source labels are caller-supplied provenance and must be checked against the original archive.
- Timestamps order the snapshots; they do not prove when an underlying event happened.
- Missing snapshots remain missing. No interpolation or synthetic memories are created.
- This tool is read-only. It does not append events, update memories, publish state, or modify source files.
- Compare only snapshots that have already passed the state contract when using them for migration.

## Next reconstruction step

A human-reviewed reconciliation layer can group repeated field changes into candidate timeline notes. Those notes should retain source hashes and timestamps and remain proposals until explicitly accepted into the private memory store.
