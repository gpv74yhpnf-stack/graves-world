# Graves World: Public Mind Reconstruction v1

**Status:** Evidence inventory and migration tooling  
**Branch:** `graves-v2/public-mind-reconstruction`

## Objective

Move Graves' canonical identity, memory, state, and history into a private store that we control. The public town should become a read-only projection plus a carefully mediated visitor interface. Public GitHub Issue #1 must no longer be the only authoritative copy.

This is a reconstruction, not a claim that hidden prompts or unobserved internal reasoning can be recovered. Every recovered fact should retain its source and confidence.

## Evidence recovered so far

| Evidence | What it tells us | Confidence / limitation |
|---|---|---|
| Public GitHub Issue #1, current JSON body | Current state snapshot: identity, locked rules, needs, activity, recent moves, journal, memory buckets, visitor records, replies, and counters | High for the published snapshot; only one point in time |
| Repository `state.json` | Earlier fallback snapshot from the same first day, before the first visitor history was added | High for that file's contents; it is not the live state |
| Public `how.html` | Describes a daily or more frequent language-model turn, 1-3 actions, fresh writing, state updates, nightly character-sheet additions, and gradual memory fading | High as published design intent; does not reveal the actual prompt or implementation |
| Public `config.js` | Identifies Issue #1 as the live state source and a public ntfy topic as the visitor inbox; comments describe short inbox/media retention | High for the published configuration; does not identify the process polling the inbox |
| Public `app.js` and `index.html` | Browser reads Issue #1, falls back to `state.json`, renders journal/memories/visitors/replies, and submits offerings directly to ntfy | High for the visible site behavior |
| Public `sheet.html` and `memories.html` | Confirms the intended distinction between initial character identity, locked rules, self-added traits, kept memories, fading memories, and visitor records | High for published design intent |

## Character core recovered

- Small, gentle necromancer living in a crypt in a tiny underworld town.
- Face remains hidden under the hood; two soft green lights are visible.
- Loves lanterns, moss, coin ledgers, and moonbells.
- Curious about living visitors; plain, kind, slightly dry, and hopeful.
- Cares for the Ledger Shop, which supplies lantern oil.
- Remains a resident of the town.
- Four locked rules are stored in the character sheet and validated by the state contract.

## Behavioral model recovered

Published design says the model chooses what Graves does, why he does it, his dialogue, journal writing, and self-added character-sheet notes. It chooses one to three actions in a turn. The locked character-sheet rules, town locations, and privacy/safety constraints are outside the model's authority.

Memory behavior is explicitly divided into:
- `keeping`: retained memories;
- `fading`: memories that may gradually be forgotten;
- visitor records: recognition and short notes about returning visitors;
- journal: dated narrative history;
- recent moves: short-term activity trace.

These should become distinct private records/projections rather than one mutable JSON blob.

## Known unknowns

- Exact model/provider and model version.
- Original system/developer prompt and any hidden policy text.
- Actual runner, hosting environment, schedule, retry behavior, and credentials.
- Whether the public Issue #1 edit history contains earlier full snapshots not present in the repository fallback.
- Full contents of expired ntfy messages and media.
- Whether the original runner had additional private state or external memory.
- Precise rules for memory scoring, decay, selection, and self-authored character-sheet additions.

Do not fill these gaps with invented facts. Recover them from source history, the original runner, backups, or operator-provided exports if available.

## Important operational finding

The public site submits visitor offerings directly to a topic configured in public JavaScript. The repository's own configuration comments describe short retention for inbox messages and images. That makes the public inbox a transport mechanism, not a durable memory database. It should not remain the sole record of visitor history.

A private replacement should:
1. accept offerings through an authenticated or abuse-resistant API;
2. validate and rate-limit submissions;
3. preserve accepted events in the private event log;
4. moderate and classify visitor content before it enters model context;
5. store only necessary visitor information with retention controls;
6. generate public replies only through the approval/publishing boundary.

## Migration tool

`src/memory/import-public-snapshots.mjs` imports supplied JSON snapshots into a private event store as `mind.public_snapshot_imported` events.

- It validates the full state contract and protected character identity.
- It records source label, source filename, source timestamp, and content hash.
- It sorts snapshots by their own `updated` timestamp.
- It skips duplicate content hashes, making repeat imports safe.
- It never modifies the source file or public GitHub Issue.
- It stores the complete state payload, including visitor records. Therefore the destination must be private and must never be inside the public repository.

Example:

```sh
node src/memory/import-public-snapshots.mjs \
  --store "/private/graves-vault" \
  --snapshot "repository-fallback=./state.json" \
  --snapshot "live-issue-current=./exports/issue-1-current.json"
```

The current live issue JSON must first be exported to a local file by the operator or a private authenticated migration service. Do not commit that export to Git.

## Reconstruction plan

1. Import every recoverable snapshot into the private vault.
2. Recover older issue revisions and any external-runner logs/backups where available.
3. Convert snapshot-to-snapshot differences into candidate events, preserving the original snapshots as evidence.
4. Reconstruct character rules, memory lifecycle, turn cadence, and action patterns with explicit confidence labels.
5. Run a shadow brain against copied visitor examples; compare outputs without publishing.
6. Make the private vault authoritative only after restore tests and a verified backup.
7. Change the public site to read a sanitized projection from the private service.
8. Retire public Issue #1 as the source of truth only after the new pipeline has been tested and rollback is available.

## Safety

No live state, public inbox, GitHub Issue #1, site behavior, credentials, or external services are changed by this migration tooling. Do not merge or activate this branch until the private destination and backup procedure are configured.
