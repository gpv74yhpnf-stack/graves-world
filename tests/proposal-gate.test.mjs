import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProposal, proposalDigest } from "../src/brain/proposal-gate.mjs";

const proposal = (action = "public_state.publish") => ({
  id: "proposal-001",
  action,
  summary: "Publish a reviewed public town update",
  payload: { location: "offering_stone", activity: "reading notes" }
});

test("low-risk allowlisted proposals are classified without approval", () => {
  const result = evaluateProposal(proposal("memory.propose"));
  assert.equal(result.decision, "allowed");
  assert.equal(result.executable, true);
});

test("publishing public state requires explicit approval", () => {
  const result = evaluateProposal(proposal());
  assert.equal(result.decision, "approval_required");
  assert.equal(result.executable, false);
});

test("approval is bound to the exact proposal payload", () => {
  const item = proposal();
  const approval = {
    proposal_hash: proposalDigest(item),
    approved_by: "operator",
    approved_at: "2026-11-12T12:00:00.000Z",
    reason: "Reviewed the proposed public text"
  };
  assert.equal(evaluateProposal(item, approval).decision, "approved");

  const changed = structuredClone(item);
  changed.payload.activity = "different public update";
  assert.equal(evaluateProposal(changed, approval).decision, "approval_required");
});

test("unknown actions are rejected rather than implicitly allowed", () => {
  const result = evaluateProposal(proposal("shell.execute"));
  assert.equal(result.decision, "rejected");
  assert.equal(result.executable, false);
});

test("malformed proposals and approval envelopes are rejected safely", () => {
  assert.equal(evaluateProposal(null).decision, "rejected");
  assert.equal(evaluateProposal({ ...proposal(), payload: [] }).decision, "rejected");

  const result = evaluateProposal(proposal(), {
    proposal_hash: "wrong",
    approved_by: "operator",
    approved_at: "yesterday",
    reason: "yes"
  });
  assert.equal(result.decision, "approval_required");
  assert.equal(result.executable, false);
});

test("external messages, purchases, merges and access changes require approval", () => {
  for (const action of [
    "visitor.reply.publish",
    "external.message.send",
    "purchase.create",
    "repository.merge",
    "access.change"
  ]) {
    assert.equal(evaluateProposal(proposal(action)).decision, "approval_required", action);
  }
});
