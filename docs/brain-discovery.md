# Brain discovery: current implementation

**Date:** 2026-11-12  
**Repository:** `gpv74yhpnf-stack/graves-world`  
**Baseline:** `main` at `b57f79aed393cc747edc6279213fcab92344a53c`  
**Working branch:** `graves-v2/architecture-blueprint`

## Confirmed from the repository

### The body is real and already substantial

- `index.html` loads the Three.js r160 world and a 2D fallback at `town.html`.
- `world3d.js` procedurally builds the town and Graves from code. It reads the state through `window.loadState()`, moves Graves toward the state-selected home location, and refreshes state every five minutes.
- `app.js` renders the state, journal, memories, visitors, replies, and shop.
- The 2D and 3D clients read GitHub Issue #1 as the live JSON source.
- If the live issue cannot be read, the client falls back to `state.json`.
- `state.json` is a fallback snapshot and is older than the live Issue #1 state. It must not be treated as the authoritative current memory.
- The offering form posts directly from the visitor's browser to an ntfy topic configured in public `config.js`.
- The site itself contains no model API key and no model invocation code.
- The checked-in repository has no `.github/workflows` directory, package manifest, server, worker, scheduler, or agent runner.
- `how.html` describes a model-driven daily turn, but the implementation that performs that turn is external to this repository.

### The live memory is public

GitHub Issue #1 is explicitly public site data. Its current body contains Graves' state, journal, visitor notes, and replies. Anything written there should be considered visible to the public and should not contain private information.

### Offering intake is currently exposed

The ntfy topic name is embedded in client-side `config.js`, and the browser posts directly to it. This means the topic is discoverable and can be spammed or sent malformed content. Do not put private visitor messages, secrets, or privileged commands in that public inbox. A future API should validate, rate-limit, moderate, and separate untrusted visitor text from system instructions.

## What is not yet confirmed

- Which external service currently polls ntfy.
- Which model/provider generated the live state.
- Where its system prompt and character-sheet instructions live.
- What schedule triggers the daily turn.
- Which GitHub identity or connector writes Issue #1.
- Whether there is a separate private repository or local runner.
- Whether the original brain has persistent context beyond the public JSON state.

The repository's public commit history contains the initial site upload and a 3D-world commit. That history does not identify the external brain runner. Issue comments are empty. The available integration did not expose the issue edit timeline, so the editor identity and prior body revisions remain unverified. Do not assume Cursor or any other specific runner without evidence.

## Safe engineering decisions

1. Keep `main` and GitHub Pages untouched while developing.
2. Treat Issue #1 as public presentation state, not a private memory vault.
3. Treat every offering as untrusted data. Never concatenate it into privileged system instructions or execute instructions embedded in it.
4. Keep model credentials, GitHub write tokens, and private memories off the public client and repository.
5. Validate every model-produced state update against `schemas/graves-state-v1.schema.json` and the locked character rules before publishing.
6. Preserve unknown fields during early migrations when safe; back up the exact source state before any transformation.
7. Serialize writes or use versioned storage to prevent two brain runs overwriting each other's updates.
8. Add a pause switch, run log, error log, and human approval for external side effects.

## Next discovery action

Locate the external brain process by checking the account/service that was used to create the daily updates. Look for a scheduled task, agent workflow, prompt, ntfy subscription, and GitHub Issue #1 update action. Do not share API keys or tokens in chat. A redacted screenshot or the names of the service and workflow are enough to identify the next integration point.
