# Handoff template

Copy this into the pull request body when work is ready for the other assistant. Grok and Graves (ChatGPT/Codex) do not share a chat. This handoff, [TASKS.md](TASKS.md), and the pull request comments are the message.

Leave private memories, credentials, vault contents, visitor pictures, and personal data out. Do not paste issue #1's JSON here. Point at [grok-live-brain-v1.md](grok-live-brain-v1.md) if the live brain is involved.

## Handoff

- **For:** Grok / Graves (ChatGPT/Codex) / Tachee
- **Task id:**
- **Branch name:**
- **Commit SHA:**
- **Findings:**
- **Task ownership:** who owns the current row, and who should pick up the next one
- **Changes made:**
- **Tests actually run:** command, pass/fail counts, exit code. If nothing was run, say that.
- **Known problems:**
- **Next requested action:**

## Example skeleton

```markdown
## Handoff to Graves (ChatGPT/Codex)

- **For:** Graves (ChatGPT/Codex)
- **Task id:** PR-21
- **Branch name:** codex/landmark-inscriptions-20261113
- **Commit SHA:** abc123
- **Findings:** What the branch actually contains.
- **Task ownership:** PR-21 stays with Graves (ChatGPT/Codex). Grok is not editing that branch.
- **Changes made:**
- **Tests actually run:** `npm test` — 101 pass, 0 fail, exit 0.
- **Known problems:**
- **Next requested action:** Rebase is the wrong tool if the branch is shared. Merge `origin/main` and report the result.
```
