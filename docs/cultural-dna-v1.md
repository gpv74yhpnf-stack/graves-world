# Graves World Cultural DNA v1

**Status:** Foundation implementation, draft branch  
**Purpose:** Turn cultural study into attributed, original, reviewable worldbuilding proposals.

## What is included

- A typed vocabulary for cinema, visual art, poetry, literature, music, folklore, history, philosophy, craft, architecture, and ritual.
- A seed archive with five starter references and original analytical notes.
- Validation for attribution, domain, themes, techniques, world applications, status, timestamps, and optional HTTPS source references.
- A deterministic influence engine that converts one archive entry into a proposed creative brief.
- Tests for archive integrity, duplicate IDs, unsafe URLs, deterministic proposals, provenance, and non-execution.

## Cultural learning pipeline

```text
Cultural reference
  -> attributed archive record
  -> original study notes
  -> themes + techniques
  -> proposed worldbuilding brief
  -> human/operator review
  -> private experiment
  -> approved world change
  -> optional sanitized public projection
```

The current implementation covers the archive, validation, indexing, and proposal stages. It does not yet connect to a model, mutate the private event log, create town assets, or publish to the public site.

## Archive record contract

Each entry includes:
- stable `id`, `title`, `creator`, `domain`, and `era`
- original `themes`, `techniques`, `world_applications`, and `original_analysis`
- `suggested_targets` limited to supported creative surfaces
- `status` (`inbox`, `studied`, `influential`, or `retired`)
- `added_at`, optional HTTPS `source_url`, and optional `rights_note`

The archive stores bibliographic metadata and original analysis, not copied scripts, lyrics, poems, images, scenes, or distinctive protected expression. A public-domain source does not remove the need to identify the edition or translation used. Living cultural traditions require context and respect, not extraction as generic aesthetic material.

## Safety and provenance

- Every influence proposal identifies its originating archive record and creator.
- Proposals are deterministic and content-addressed.
- Proposals are always `proposed`, require review, and are never executable.
- Only targets explicitly suggested by the archive entry can be selected.
- Visitor offerings and other external text remain untrusted data; they cannot change cultural policy or system instructions.
- No cultural proposal can publish state, send messages, deploy code, or alter the live town.

## Starter references

The seed archive includes *Spirited Away*, *The Lord of the Rings*, *The Green Knight*, William Blake's *Songs of Innocence and of Experience*, and oral folklore as a broad study category. These are starting points, not a canon. Future entries should include diverse geographic and historical perspectives and distinguish a specific work from a living community tradition.

## Local validation

```bash
npm test
```

## Next milestones

1. Add a private archive-review CLI and append-only cultural events.
2. Add model-assisted analysis that returns structured themes and techniques while preserving source attribution and untrusted-input boundaries.
3. Add an Operator review interface for accepting, revising, or rejecting proposals.
4. Add private visual and narrative experiments.
5. Integrate approved assets into the town only through a separate, explicit publishing gate.
