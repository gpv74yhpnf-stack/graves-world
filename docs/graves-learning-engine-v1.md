# Graves Autonomous Learning Engine v1

**Status:** experimental, optional local worker (not running until started on the owner's PC).
**Foundation:** the guarded local public HTTPS research reader and Grand Library desk
merged from PR #26. This research worker is a separate optional feature.

## What "learning" means here

Graves can repeatedly search **public web pages**, read bounded source text,
compare two or three different source hosts, ask a local Ollama model for
source-cited findings, and save those **provisional** findings in the private
local research journal. New follow-up questions provide bounded curiosity.
Later local conversations can consult the latest three draft studies as clearly
marked *unverified reference material*.

This is **retrieval and persistent research**, not automatic training of the
base model's weights, independent sentience, an indiscriminate crawler, or
proof that the web content is accurate. Sources can disagree or be wrong.

The 3D Grand Library's **Open Graves' Learning Journal** button displays
counts, recent provisional notes, source links and uncertainties when the
local bridge is connected. No notes are published to GitHub Pages or Issue #1.

## Starting on Windows

From a separate worktree after this stacked build is available:

    cd C:\Users\sande\graves-world
    git fetch origin
    git worktree add --detach ..\graves-world-learning origin/graves-v2/autonomous-learning-engine-v1
    cd ..\graves-world-learning

Make sure **Ollama** is running and `qwen3.5:4b` is installed.

Run a single research experiment:

    npm run learning:once

Inspect what was saved:

    npm run learning:status

Run the opt-in local learning loop, while the terminal and PC remain on:

    npm run learning:watch

Press **Ctrl+C** to stop it.

You may also start your local Graves bridge from this separate learning
worktree (only if port 8787 is free):

    powershell -ExecutionPolicy Bypass -File .\local-brain\start.ps1

Open the 3D world **on the same computer** and go to Grand Library →
**Open Graves' Learning Journal**. On your phone, you will need a separately
authorized private connection to your PC for private journal access.
The public GitHub Pages version alone does not run the worker.

## Safety, pace and costs

- Local public-web search uses Bing public RSS first and DuckDuckGo Lite as
  fallback. Queries are sent to these providers. The model remains local.
- Web pages are GET-only HTTPS documents, with private-network and unsafe
  redirect checks, response size limits, DNS pinning and no script execution.
  No account sign-in, cookies, arbitrary code execution, credential requests,
  paywall bypass, or privately hosted sources.
- One research attempt every **90 minutes while watch mode is running**,
  and at most **10 attempts per UTC day** even when manually invoked.
  The core engine enforces a minimum 30-minute gap between attempts.
- Each cycle examines no more than eight search results, reads at most three
  useful public pages from different hostnames and makes at most one local
  Ollama synthesis call, with a 120-second timeout. Search-provider rate
  limits and site permissions still apply.
- 16 broad study questions form the default curriculum. Every fourth
  research attempt may follow a short model-suggested question. The queue
  is bounded to 10 suggestions, and web text cannot change source-code
  policies or trigger tool execution.
- Stored notes have citations to exact page URLs and a separate uncertainty
  field; they are never automatically promoted into trusted character memory.
- On success, only short structured findings, sources and uncertainties are
  stored. Raw page text is not journaled. The worker never publishes source
  text to the public world.
- Research quality is not measured by sheer pages read. The journal counts
  successful notes and records failures and limits. Multiple distinct hosts
  are not necessarily independent, reliable sources.
- The worker cannot place orders, edit files beyond its own private learning
  journal, modify model weights, run shell commands on behalf of webpages,
  merge PRs, or automatically approve any research as canonical.
- No separate paid research or inference API is required. Electricity,
  machine resources and any network/service provider fees remain possible.

## Private storage

Under `%LOCALAPPDATA%\GravesPrivateMind\learning` on Windows, or
`~/.graves-world/learning` elsewhere:

- `state.json`: topic cursor, daily research quota, last attempt and
  suggested follow-up questions
- `provisional-findings.jsonl`: bounded source-linked results and failures
- `learning.lock`: fail-closed single-run guard
- `worker-heartbeat.json`: recent status and planned next cycle for the 3D panel

The 3D panel considers only a heartbeat less than 150 seconds old to be recent.
A recent heartbeat is not proof the worker is still alive; stopping it will cause
this indicator to expire. The research journal is capped at 8 MB pending private archiving. The worker
does not delete or truncate existing notes automatically. Apply the existing
Windows vault ACL bootstrap and, ideally, disk encryption; these files
are not automatically encrypted by this module. If a crash leaves a lock,
inspect the running processes before manually clearing it.

## Tests

    npm test
    npm run validate:state

No real website connection or Ollama model response is verified by automated
unit tests. Use `learning:once` to verify the live network and local model.

## Later extensions

- Better per-source trust/reputation indicators and contradiction flags.
- Topic scheduling based on source quality, unanswered questions and recent
  usefulness rather than only a rotating curriculum.
- Browser-rendered sources via a dedicated sandbox where permitted.
- An explicit human review/promote workflow and private provenance search.
- More reliable persistent service supervision, opt-in notifications and
  periodic metrics in the 3D Library.

The public mind's character identity, locked values, offering inbox,
and GitHub publication flow remain unchanged.
