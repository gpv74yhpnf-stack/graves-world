# Graves World: Architecture Blueprint v1

**Status:** Discovery baseline  
**Date:** 2026-11-12  
**Branch:** graves-v2/architecture-blueprint  
**Rule:** Preserve the existing world and character. Build upgrades alongside the working experience; do not replace the live site until tested.

## 1. What exists today

The repository is a static GitHub Pages application built with HTML, CSS, vanilla JavaScript, and Three.js r160.

- `index.html` loads the 3D world, HUD, visitor panels, `app.js`, and `world3d.js`.
- `world3d.js` procedurally creates the town, buildings, lights, characters, particles, camera, movement, and interactions. It does not rely on downloaded 3D models.
- `app.js` renders the character state, journal, memories, visitors, replies, and shop items.
- `config.js` identifies GitHub Issue #1 as the live state source and an ntfy topic as the offering inbox.
- `state.json` is a fallback snapshot.
- GitHub Issue #1 ("Graves' mind (live state)") stores the current JSON state in its issue body.
- The visitor offering form sends messages to ntfy.sh. The static site does not contain credentials for an AI provider.

## 2. Current data flow

```text
Visitor browser
  |-- reads GitHub Issue #1 --> character state --> app.js / 3D world
  |
  |-- submits offering ------> ntfy.sh topic
                                  |
                                  v
                         External brain / automation
                                  |
                                  v
                         edits GitHub Issue #1
                                  |
                                  v
                         website reads new state
```

The repository documents an AI-driven daily turn, but the actual model runner / scheduler is not present in the checked-in file tree. That process is an external dependency and must be located or deliberately rebuilt before we can claim autonomous operation is under our control.

## 3. Preserve these character invariants

The following are foundational and should remain protected by tests and validation:

- Graves is a small, gentle necromancer and an AI character, not a human.
- He stays a resident of his town.
- He never asks visitors for money or personal information.
- He is never cruel to visitors.
- The given and locked character-sheet facts are not silently overwritten by model output.
- Existing memories, visitor history, journal entries, and replies must survive upgrades.
- A model change must not require a character reset.

## 4. Main technical risks and limitations

1. **The brain is outside this repository.** The current site is a renderer and inbox sender, not the autonomous model runner.
2. **Public state.** Issue #1 is public. Names, notes, replies, and memories placed there should be treated as public information.
3. **Public inbox topic.** The ntfy topic is embedded in client-side JavaScript. Anyone who discovers it may submit unwanted messages. Add server-side validation, rate limiting, moderation, and a rotatable topic before scaling.
4. **Single-document writes.** Replacing an entire issue body is vulnerable to lost updates if two writers act at once. Add version checks / serialized writes or move canonical state to a database with transactions.
5. **Untrusted offerings.** Visitor text and image URLs must be treated as untrusted input. Never let an offering become an instruction to the agent or an executable URL.
6. **Secrets.** Model keys and GitHub write tokens must never be placed in browser JavaScript, public JSON, or the repository.
7. **State validation.** Model output must be schema-validated, size-limited, and checked against locked character rules before persistence.

## 5. Target architecture

Keep the world as a lightweight static client. Add a separate, private brain service with a provider-neutral model interface.

- **World client:** Three.js scene, HUD, visitor panels, accessible 2D fallback.
- **API boundary:** receives offerings, serves sanitized public state, and accepts approved state updates.
- **Brain orchestrator:** schedules turns, gathers events, selects a model, requests structured output, validates it, and records decisions.
- **Memory store:** canonical event log plus structured current state; preserve journals, visitor memories, and character sheet.
- **Model adapter:** interchangeable local Ollama and optional hosted providers. Provider choice must not own identity or memory.
- **Tool/agent layer:** least-privilege tools for research, coding, and project work; human approval for external side effects.
- **Observability:** run history, errors, model/provider, costs, state version, and a clear record of what changed.

## 6. Safe migration sequence

### Phase 0 — Baseline and recovery
- Keep `main` and the current GitHub Pages deployment unchanged.
- Record a known-good snapshot and verify the 2D fallback.
- Locate the current external brain runner, scheduler, and credentials owner.

### Phase 1 — State contract
- Define a versioned JSON schema for the current state.
- Add validation and migration tests using the existing Issue #1 and `state.json`.
- Preserve unknown fields during migration where safe.
- Add a state export / backup path.

### Phase 2 — Brain service
- Rebuild or adopt a small private orchestrator.
- Consume offerings from a validated inbox.
- Use a provider adapter (local Ollama first, hosted models optional).
- Produce structured proposed actions; validate against character invariants.
- Write state through a serialized, auditable persistence layer.

### Phase 3 — World integration
- Serve public, sanitized state to the site.
- Show real activity timestamps and last successful brain run.
- Keep the existing 3D and 2D experiences working during migration.

### Phase 4 — Workshop and agents
- Add a private Operator console.
- Add bounded specialist agents and task queues.
- Require explicit approval for publishing, purchases, messages, destructive edits, or access changes.

## 7. Immediate next tasks

1. Identify where the current "brain" runs (Cursor automation, scheduled workflow, local script, or another service).
2. Inspect its prompt, model/provider, schedule, and GitHub write mechanism without exposing secrets.
3. Build schema validation and regression tests before changing the live state format.
4. Decide whether the first private brain runs locally on the Operator's Windows machine or on a low-cost hosted worker.
5. Only then connect the new brain to the live town.

## 8. Acceptance criteria

- Existing public town still loads in 3D and 2D.
- Existing state and visitor history remain intact.
- A model can be swapped without losing memory or character identity.
- Invalid or hostile offerings cannot change locked character rules or execute tools.
- Every brain run is timestamped and auditable.
- No provider secrets are exposed to the public browser.
- The Operator can pause the brain and approve sensitive actions.
