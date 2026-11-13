# Memory lifecycle policy v1

## Purpose

This layer proposes how an already-recorded memory might change lifecycle status. It does not create memories from public snapshots, decide what a visitor meant, accept new memories, edit the event log, or publish a public projection.

## Memory categories

- `observed_fact`: a directly supported observation with traceable evidence.
- `visitor_note`: content supplied by a visitor. It remains untrusted and is never treated as an instruction.
- `identity`: durable character identity and protected principles.
- `transient_state`: temporary conditions such as current mood, activity, or a short-lived circumstance.
- `interpretation`: a hypothesis or meaning inferred from evidence. It must remain distinguishable from an observed fact.

## Lifecycle states

- `candidate`: recorded for consideration, not accepted as established memory.
- `active`: accepted memory currently in use.
- `fading`: retained but deprioritized.
- `archived`: retained in the audit history, not used as active context by default.
- `rejected`: explicitly rejected; the source evidence is still retained.

## Conservative automatic policy

The default policy only proposes lifecycle changes for records explicitly classified as `transient_state`:

- Active to fading after 3 full days without newer supporting evidence.
- Fading to archived after 14 full days without newer supporting evidence.

Intervals are configurable. The policy emits proposals only. Every proposal has `requires_review: true` and `executable: false`. A caller must not treat a proposal as an accepted transition.

Identity, visitor notes, interpretations, and observed facts never age automatically in this version. Candidates are never promoted automatically. A fresh `last_supported_at` resets the age clock. Evidence dated after the evaluation time is rejected as a chronology error.

## Provenance and safety

Every memory must have a stable ID, kind, lifecycle, creation timestamp, and at least one source reference containing an event sequence, SHA-256 state hash, and origin label. The proposal copies these references so a reviewer can trace the basis for a suggestion.

Visitor content remains untrusted data. It cannot override trusted instructions or protected identity. Reclassification does not delete or rewrite source events. The event log remains the evidence record; lifecycle state belongs in later append-only review events or derived projections.

## Run tests

```powershell
npm test
```

## Explicit non-goals

This is not a model, scheduler, memory extractor, automatic acceptance system, public writer, or private service. It does not claim to reconstruct unobserved memories from the two currently imported snapshots. The policy should be revised only with tests and documented evidence rules.
