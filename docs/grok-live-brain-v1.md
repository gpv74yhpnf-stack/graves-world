# Grok live brain v1

**Status:** Live, outside this repository  
**Date:** 2026-11-13  
**Owner:** Grok  
**Baseline checked:** `main` at `15676ac3fe2176917c3de1b8232749c7b6be478a`

Grok is Tachee's assistant. Graves (ChatGPT/Codex) is the other coding assistant. Graves the necromancer is the character whose public state this loop publishes. Earlier notes in [brain-discovery.md](brain-discovery.md) and [state-safety-foundation-v1.md](state-safety-foundation-v1.md) say the writer was unidentified. That was true on 2026-11-12. This file is the current contract.

## What runs

Three times a day, at 07:00, 15:00, and 23:00 America/Chicago, Grok runs a brain turn.

1. It reads visitor offerings from the ntfy.sh topic named by `ntfyTopic` in `config.js`. The server is `ntfyServer` in that same file. The topic string stays in `config.js`. Do not copy it into issues, pull requests, or logs.
2. It writes Graves' public state as one JSON code block in the body of GitHub issue [#1](https://github.com/gpv74yhpnf-stack/graves-world/issues/1), "Graves' mind (live state)". `config.js` names that issue in `stateIssue` (`owner`, `repo`, `number`). The checked-in comment says the brain updates the issue with the GitHub connector's `update_issue`. On 2026-11-13 the issue's latest edit was attributed to the Cursor GitHub App, which matches Grok running as a Cursor agent.
3. It writes a private log outside this repository. The path is not part of the public contract and must stay off the repo, out of issues, and out of pull request text.
4. Grok's working copy and private data also live outside this repository.

The local bridge in `local-brain/` is a different path. It lets the 3D town talk to a model on Tachee's computer. It does not publish issue #1.

## How the site reads state

`main` still reads issue #1.

- `config.js` sets `window.GRAVES_CONFIG.stateIssue` to owner `gpv74yhpnf-stack`, repo `graves-world`, number `1`.
- `index.html` and `town.html` load `config.js` and `app.js` as classic scripts, then `index.html` loads `world3d.js` as a module. `loadState` stays on `window` because `app.js` is not a module. `world3d.js` calls `window.loadState()`.
- `app.js` fetches `https://api.github.com/repos/{owner}/{repo}/issues/{number}`, takes the first ` ```json ` fence (or the whole body if there is no fence), and `JSON.parse`s it. The result is cached in `sessionStorage` under `graves_state` for 120 seconds. The home page and the 3D world each call it again every 5 minutes.
- If that read fails, the site fetches `state.json`.

Offerings leave the browser as a direct ntfy request, not through the repository. A text offering is a JSON object with `kind` (`offering`), `name`, `message`, `picture_url`, `sent`, and `page`. A picture is a PUT of the file (client cap 5 MB) with the same JSON in the `X-Message` header. `config.js` says messages are kept about 12 hours and pictures about 3 hours.

## Shape

`schemas/graves-state-v1.schema.json` is the descriptive contract. Its description says it matches the live issue #1 shape. `scripts/state-contract.mjs` is the executable check (`npm run validate:state`, and `validateState` / `validateCharacterInvariants`). The script is not a full JSON Schema implementation. It checks required fields, the five locations, locked character rules, and history preservation. Many schema max lengths are documented only in the schema file.

Required keys: `updated`, `day`, `time_of_day`, `weather`, `location`, `activity`, `thought`, `mood`, `needs`, `offerings_waiting`, `recent_moves`, `journal`, `memories`, `visitors`, `replies`, `sheet`, `stats`.

Allowed `location` values in both the schema and the script: `crypt`, `lantern_lane`, `offering_stone`, `bone_garden`, `ledger_shop`.

## Check on 2026-11-13

The issue #1 body had one JSON fence. The parsed object had the same top-level keys as bundled `state.json` and as the schema's required list. `validateState` and `validateCharacterInvariants` returned 0 errors. No string exceeded the schema's max lengths. The published `location` was `offering_stone`, which is allowed. The issue `updated` timestamp on the object was `2026-11-13T15:20:00-06:00`, in the afternoon turn's window.

There is no current shape mismatch between issue #1 and the contract. The problems below are real and were left unfixed.

## Known problems

1. **Counters disagree.** `day` is 3. Journal entries present are days 2 and 1. `stats.days_lived` is 2. The schema does not require those numbers to match, so the checker accepts the body.
2. **The 3D map has places the contract rejects.** `world3d.js` also places Graves at `graves_house`, `grand_library`, and `trading_lab`. Setting `location` to one of those fails `scripts/state-contract.mjs`. The 2D renderer in `app.js` only knows the five contract locations and draws the crypt for any other key. The live value is still a contract location.
3. **The public schedule copy is older than the loop.** `index.html`, `town.html`, `app.js`, and `world3d.js` tell visitors he reads offerings about once a day. The live loop is three times a day. `how.html` says once or more a day, and that replies can take up to a day.
4. **The checker is not on the write path.** Grok's turn does not run `scripts/state-contract.mjs` before it replaces the issue body. A body the site cannot parse falls through to `state.json`.
5. **`state.json` is a valid older copy.** Its `updated` value is `2026-11-11T13:30:00-06:00` and `day` is 1. It passes the same checker. It is the fallback, not the live mind.
6. **Discovery docs still describe an unknown writer.** [brain-discovery.md](brain-discovery.md), [architecture-blueprint-v1.md](architecture-blueprint-v1.md), and [state-safety-foundation-v1.md](state-safety-foundation-v1.md) keep their original 2026-11-12 text. The pointers added there send readers to this file.
7. **Whole-body writes drop concurrent edits.** The turn replaces the issue body. A second writer, or a handoff pasted into that body, will be overwritten at the next turn or will be what the site parses.

## Heads-up required

Changes to any of the following need a row in [TASKS.md](TASKS.md) before the work starts, and a note in the pull request, because they break Grok's brain or the live site:

- the issue #1 JSON shape (required keys, location values, or the single JSON fence the site parses)
- `config.js` keys `ntfyTopic` and `stateIssue` (and `ntfyServer`, which completes the inbox URL)
- how the site reads state (`app.js` `loadState`, the classic-script order, or `window.loadState` in `world3d.js`)

Handoffs, task claims, and private notes do not go in issue #1. Issue #1 is public character state. Visitor pictures, private memories, credentials, vault contents, and personal data stay out of the issue body, other public files, pull request text, and logs.
