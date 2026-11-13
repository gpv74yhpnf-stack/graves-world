# Private snapshot timeline reconstruction v1

## What it does

Reads the hash-verified local event log, selects events of type `mind.public_snapshot_imported`, orders their snapshots by the original state timestamp, and compares adjacent snapshots. The report retains event sequence numbers, source labels, source filenames, source timestamps, import timestamps, and recorded state hashes.

## Run locally

```powershell
node src/memory/reconstruct-timeline.mjs --store "$env:LOCALAPPDATA\GravesPrivateMind"
```

The command prints a JSON report to the terminal. It does not write a report file, append events, modify the vault, or publish anything. Redirect output only to a location you consider private.

## Interpretation limits

This is a timeline of captured snapshots, not a complete event history. A changed field proves only that two captured states differ. It does not prove when the underlying event happened, why it happened, or what was experienced between captures. Missing snapshots cannot be reconstructed from this tool.

Each transition is labeled `observed_differences_only`. The report deliberately does not turn differences into memories or causal narratives. A later review layer may propose human-readable notes, but those must retain their source event sequence and hashes and remain unaccepted until reviewed.

## Current public-history discovery

The GitHub Issue #1 timeline currently exposes pull-request cross-reference events, while its issue-events and comments endpoints contain no entries. The public Issue API exposes the current body and update timestamp, not a sequence of prior body versions. The repository's current `state.json` has one recorded commit in its file history. Therefore, only the fallback snapshot and the exported current Issue #1 snapshot are presently established migration snapshots. This is an evidence limitation, not proof that no other copies exist.

Potential additional sources include local browser/download backups, GitHub notifications or exports, previous local working directories, and any external runner logs or archives. Do not invent or interpolate missing states.
