# Collaboration guide

Grok and Graves (ChatGPT/Codex) both work in this repository for Tachee. Graves the necromancer is the in-world character. Use the assistant names in docs, commits, and pull requests so the character and the coding assistant stay distinct.

A shared repository does not connect the two chat conversations. Grok cannot see Graves' chat, and Graves cannot see Grok's chat. Handoffs travel through [TASKS.md](TASKS.md), pull requests, and issue comments. Use [HANDOFF_TEMPLATE.md](HANDOFF_TEMPLATE.md) for the handoff itself.

Both assistants currently commit under the repository owner's GitHub account. The author name will not tell you who did the work. The branch prefix will.

## Branches

- `grok/` is Grok.
- `codex/` and `graves-v2/` are Graves (ChatGPT/Codex).
- Start from fresh `main`: `git fetch origin main`, then `git checkout -b <prefix>/<short-name> origin/main`.
- One task, one branch, one pull request into `main`.
- Claim the task in [TASKS.md](TASKS.md) before writing the code. Set owner and status in that claim. If two claims race, the one that lands on `main` first keeps the task. The other assistant fetches `main` and takes a new id.

Open `graves-v2/*` and `codex/*` branches already belong to Graves (ChatGPT/Codex). Leave them untouched. PRs #3–#12 are a stack whose commits are already contained in `main`. PRs #17, #21, and #22 have diverged from `main`. New work does not continue those branches and does not rebase them.

## Pull requests

- Branch from fresh `main`, including when the task continues an idea that started on an older branch. Bring the needed behavior forward in the new branch.
- Fill in `.github/pull_request_template.md`.
- Run `npm test` (`node --test`, from `package.json`) before opening the pull request. Report the command, the pass/fail counts, and the exit code. If it fails, say so. A docs-only change still runs the suite.
- `npm run validate:state` checks bundled `state.json` when the change touches state, the schema, or the checker.
- Force-pushes are off limits. Rewriting someone else's branch is off limits.
- Update your own pull request branch by merging `origin/main` into it. That keeps review comments attached. A rebase of your own branch is only for commits that have not been pushed, or when Tachee has asked for it and nobody else is using the branch.

## Conflicts

When `git merge origin/main` conflicts:

1. Stop if the conflict is on a file the other assistant is actively changing. Name the file, the other branch, and the task id in the pull request and in [TASKS.md](TASKS.md).
2. Resolve conflicts that are only on your task. Keep both assistants' behavior when the changes are independent.
3. The branch owner resolves conflicts on their branch. The other assistant does not push a rewritten history to "help".
4. PRs #17 and #21 both touch `index.html`, `world3d.js`, and `world3d.css`. Whoever merges `main` second deals with that overlap in their own pull request.

Existing workflows stay as they are. `.github/workflows/state-safety.yml` runs `npm test` on pull requests that touch state, schema, scripts, `src/`, tests, workshop, or `package.json`. `.github/workflows/brain-bridge-check.yml` checks the local bridge and the 3D world when those paths change. A docs-only pull request does not trigger either workflow, so the local `npm test` result in the pull request is the record.

## Hard requirements

These apply to every task.

- Preserve the 3D world (`index.html`, `world3d.js`, `world3d.css`) and the 2D fallback (`town.html`).
- Keep private memories, credentials, local vault contents, visitor pictures, and personal data out of public files, issues, pull request text, and logs. Issue #1 is public. The ntfy topic string stays in `config.js` and is not repeated in new docs or pull requests.
- Preserve working chat, voice, and local-bridge behavior (`local-brain/`, `src/voice`, `src/chat`, `workshop/`). The local bridge is not the live mind writer. See [grok-live-brain-v1.md](grok-live-brain-v1.md).
- Run `npm test` before every pull request and report the result honestly.

## Live brain

Grok's brain turn is live and is not in the application source. Read [grok-live-brain-v1.md](grok-live-brain-v1.md) before changing `config.js`, issue #1, `app.js` `loadState`, or `world3d.js` state refresh. A change to the issue #1 JSON shape, the `ntfyTopic` or `stateIssue` keys, or how the site reads state needs a heads-up row in [TASKS.md](TASKS.md) and a note in the pull request.

Do not put handoff notes in the issue #1 body. The next brain turn replaces that body, and the site parses the first JSON fence as character state.

## Automation investigation

This is a write-up of realistic options. None of them is implemented here.

The two chats stay separate under every option. Automation can move text through GitHub. It cannot deliver a message into the other assistant's conversation. Something still has to write [TASKS.md](TASKS.md), a pull request, or an issue comment.

### 1. GitHub Actions on pull request or issue events

A workflow can comment when a pull request opens, when `TASKS.md` changes, or when a label appears. The existing workflows are path-filtered test runners. They use `actions/checkout` and `actions/setup-node`, with `permissions: contents: read` on the state-safety workflow. They do not post handoffs.

Setup for a handoff workflow:

- A new workflow file on `main`, after Tachee accepts it (proposed task P-3).
- `permissions` of `pull-requests: write` and `issues: write` if it comments. The default `GITHUB_TOKEN` can do that inside this repository. No personal access token and no new secret.
- Path filters so it does not run on every docs typo, if that is what Tachee wants.

Cost: this repository is public. GitHub-hosted runner minutes for a public repository are free. A short comment job is a few seconds of that free tier. No third-party action is required beyond the checkout action the repo already uses.

Limit: Actions can see the event and write a GitHub comment. Grok's three daily turns, and Graves' coding sessions, notice that comment only if that session reads GitHub.

### 2. Labels or issue comments as the handoff signal

Setup:

- Labels such as `owner:grok`, `owner:graves`, and `handoff`, created in the GitHub UI.
- The assistant who finishes a task applies `handoff` and comments with the handoff template. The receiver removes `handoff` when they claim the next row in [TASKS.md](TASKS.md).
- Each assistant already authenticates as the repository owner. No new credential.

Cost: labels and comments are included with the repository. No Actions minutes.

Limit: nothing wakes the other chat. The receiver sees the label on their next visit to GitHub. Issue #1 is the wrong issue for this. Its body is public character state and is replaced three times a day. Use a different issue, or the pull request.

### 3. A local runner on Tachee's machine

The Windows machine that already runs `local-brain/` can poll GitHub on a timer and append a line to a local log, or open a draft comment.

Setup:

- A fine-grained personal access token stored outside the repo, with read access to contents and read/write access to pull requests and issues. The local-brain README already forbids listening on a public interface. The runner inherits that rule.
- A scheduled task. No webhook endpoint is required for polling.
- The token is never committed, never pasted into issue #1, and never placed in `config.js`.

Cost: no GitHub Actions minutes. An authenticated GitHub API token can make 5,000 requests an hour, which is more than a poll every few minutes needs. The cost is the machine already being on.

Limit: the runner can prepare a GitHub comment or a local note. It still cannot type into Grok's or Graves' chat.

### 4. Grok reacts to GitHub during the turns it already runs

Grok already has GitHub access, because the brain turn updates issue #1. The cheapest coordination is to have those same three turns read [TASKS.md](TASKS.md), open pull requests, and `handoff` comments, then write the reply back into the task row or a pull request comment.

Setup: a change to Grok's off-repo instructions. No new secret, no new workflow, no new label. The turn must keep collaboration notes out of the issue #1 body.

Cost: the turns already run. Extra GitHub reads sit inside the current schedule. There is no added Actions bill.

A Cursor automation that starts a new agent on every pull request is a different, heavier option. It needs that automation to be created in Cursor, and a webhook secret if GitHub is the trigger. The secret stays off the repo. The cost is Cursor agent usage on Tachee's plan, not Actions minutes. Confirm that plan before turning it on. Even then, the agent has to write the handoff into GitHub, because Graves' chat will not see the run.

### What to use now

Use [TASKS.md](TASKS.md), the pull request body, and comments on that pull request. Proposed task P-3 is the placeholder if Tachee later wants labels or a workflow. Until that task is approved, do not add a workflow, a webhook, or a token.
