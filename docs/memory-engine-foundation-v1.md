# Graves World: Memory Engine Foundation v1

**Status:** Prototype library, not connected to the live town  
**Branch:** `graves-v2/memory-engine-foundation`

## What this adds

The memory engine starts with an append-only local event log:

- Every event has a sequence number, UUID, timestamp, type, JSON payload, and previous-event hash.
- Each event is SHA-256 chained to the prior event.
- Reads verify the complete chain before returning events.
- Appends use an exclusive lock file and fsync the appended record.
- A reducer can replay verified events into a projection without mutating the source log.
- No database, model provider, network service, or runtime dependency is required.

The module is intentionally a storage primitive. It does not decide what Graves should remember, generate journal prose, or let model output write directly to the town's public state.

## Privacy boundary

**Do not put the event log or its payloads in this public repository.** The runtime store directory must live outside the Git checkout, with filesystem access limited to the local service account. Treat visitor messages, names, personal details, and uploaded media as untrusted and potentially sensitive. The public Issue #1 remains a presentation surface, not the private memory vault.

A future API should store only what is necessary, apply retention rules, and produce an explicit sanitized public projection. Never expose raw event payloads or secrets to the browser.

## Event contract

Current suggested event names:

- `visitor.offering_received`
- `visitor.reply_published`
- `memory.created`
- `memory.reclassified`
- `journal.entry_added`
- `character.turn_completed`
- `world.action_recorded`
- `operator.note_added`

Payloads are plain JSON objects. Event type names are descriptive labels, not permissions. A later orchestrator must authorize each action separately and must never interpret visitor text as system instructions.

## Local use

Requires Node.js 20+.

```js
import { appendEvent, readEvents, replayEvents } from "./src/memory/event-log.mjs";

const storeDir = process.env.GRAVES_PRIVATE_STORE;
if (!storeDir) throw new Error("Set GRAVES_PRIVATE_STORE to a private directory");

await appendEvent({
  storeDir,
  type: "memory.created",
  payload: { text: "The third lantern on Lantern Lane goes out first." }
});

const events = await readEvents(storeDir);
console.log(`Verified ${events.length} events`);

const memoryTexts = await replayEvents(
  storeDir,
  (current, event) => event.type === "memory.created"
    ? [...current, event.payload.text]
    : current,
  []
);
```

Run the test suite with:

```sh
npm test
```

## Guarantees and limits

- The hash chain detects accidental corruption and edits that do not also rebuild later hashes.
- It is **not** a digital signature, encryption, backup, distributed lock, or defense against an attacker who can rewrite the whole store.
- The lock is for one local filesystem and one host. A crashed process may leave a lock file. Inspect the process and log before removing a stale lock; the library deliberately does not break locks automatically.
- There is no compaction, retention, encryption-at-rest, multi-process recovery, or transactional public-state publisher yet.
- Event payload size is capped at 64 KiB. The log is append-only through this API, but an administrator with filesystem access can still alter it.

## Next integration gate

Before connecting a brain runner:

1. Choose the private host and account that owns the store directory.
2. Add encrypted backups and a tested restore procedure.
3. Add a schema per event type and validate payloads before append.
4. Build deterministic projections for current state, memory, and journal.
5. Add a proposal/approval layer before any public Issue #1 update.
6. Add retention and deletion workflows for visitor data.
7. Exercise crash recovery and concurrent-writer tests on the intended host.

Until those gates exist, this module must not be wired to the live visitor inbox or public state.
