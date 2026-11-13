# State safety foundation v1

> **Update (2026-11-13).** The live writer is identified in [grok-live-brain-v1.md](grok-live-brain-v1.md). The checker in this document is still not wired into that writer's publish step. The original limits below stay as written.

**Status:** Development-only groundwork  
**Branch:** `graves-v2/state-safety-foundation`  
**Scope:** Offline validation and regression tests. No live state, site, inbox, credentials, or external service is changed.

## Added

- `schemas/graves-state-v1.schema.json` remains the descriptive JSON Schema contract.
- `scripts/state-contract.mjs` adds dependency-free runtime checks for the current state shape and locked character rules.
- `validateHistoryPreservation(previous, next)` checks that journal entries and replies remain, visitor records and their notes are retained, and memories remain represented even if moved from keeping to fading.
- `tests/state-contract.test.mjs` covers the current bundled fallback, protected rules, invalid fields, and history preservation.
- `npm test` runs the tests using Node's built-in test runner. No third-party package is required.
- `npm run validate:state` checks the bundled fallback state.

## Deliberate limits

1. This first guard is not a full JSON Schema 2020-12 implementation. It checks the critical compatibility contract in executable code; the schema remains the fuller reference.
2. The test fixture is the repository's bundled `state.json`, which is known to be older than public Issue #1. It is not treated as canonical live memory.
3. The guard is not yet wired into a production writer because the external brain and its write path have not been identified.
4. It does not sanitize or make public visitor content private. GitHub Issue #1 remains public.
5. No automated backup, transactional store, pause switch, API boundary, or offering moderation service is created by this change.

## Before any live migration

- Export and checksum the exact current Issue #1 body.
- Run validation against that exact snapshot, without posting it anywhere else.
- Compare the proposed state to the snapshot with history-preservation checks.
- Verify locked rules and identity invariants.
- Write to a private staging store first.
- Require explicit approval before publishing any migrated state to the public issue.

## Local verification

Requires Node.js 20 or newer (Node 18.17+ may also work for the built-in test runner and `structuredClone`).

```sh
npm test
npm run validate:state
```
