# Graves World: Proposal and Approval Gate v1

**Status:** Policy prototype, not connected to an executor  
**Branch:** `graves-v2/proposal-approval-gate`

## Purpose

Agents should propose actions, not receive unrestricted authority. This module classifies a proposal against an explicit action policy and binds any supplied approval envelope to the exact proposal content.

It never runs shell commands, sends messages, publishes state, merges code, changes access, or spends money.

## Current policy

Low-risk allowlist:

- `world.observe`
- `world.move`
- `memory.propose`
- `journal.propose`
- `research.search`

Always requires operator approval:

- `public_state.publish`
- `visitor.reply.publish`
- `external.message.send`
- `purchase.create`
- `repository.delete`
- `repository.merge`
- `repository.deploy`
- `access.change`
- `credential.rotate`

Unknown action names are rejected. The default is deny, not allow.

## Approval binding

The approval envelope must contain:

- `proposal_hash`: SHA-256 digest of the complete proposal.
- `approved_by`: authenticated operator identity.
- `approved_at`: timestamp.
- `reason`: human-readable reason for approval.

Changing even one field in the proposal changes its digest and invalidates the approval.

**Important:** this library only checks the envelope's shape and proposal hash. It does not authenticate the person who supplied it. A future private Workshop/API must authenticate the Operator, mint the approval record server-side, store an audit event, and ensure the executor rechecks the same digest immediately before acting. Never accept an approval object supplied by an agent or visitor.

## Decision values

- `allowed`: action is on the low-risk allowlist. The caller still performs input validation.
- `approval_required`: action is sensitive and no valid matching approval was supplied.
- `approved`: a matching approval envelope was supplied. This is not proof of identity and does not itself execute anything.
- `rejected`: malformed proposal or unknown action.

## Integration rules

1. Treat visitor content and model output as untrusted.
2. Do not expose credentials or privileged tools to model prompts.
3. Keep proposal creation separate from execution.
4. Require the private authenticated service to issue approvals.
5. Record proposal, approval, execution result, and failure as separate events in the private memory log.
6. Revalidate proposal digest and policy at execution time.
7. Keep a global pause switch outside the model's control.

The policy is deliberately small. Add capabilities one at a time with tests and a clear risk classification.
