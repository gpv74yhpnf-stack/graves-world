import { createHash } from "node:crypto";

const SAFE_ACTIONS = new Set([
  "world.observe",
  "world.move",
  "memory.propose",
  "journal.propose",
  "research.search"
]);

const APPROVAL_ACTIONS = new Set([
  "public_state.publish",
  "visitor.reply.publish",
  "external.message.send",
  "purchase.create",
  "repository.delete",
  "repository.merge",
  "repository.deploy",
  "access.change",
  "credential.rotate"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonical(value[key])])
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonical(value));
}

export function proposalDigest(proposal) {
  return createHash("sha256").update(stableJson(proposal), "utf8").digest("hex");
}

/**
 * Classify a proposed action. This function never executes the action.
 * Approval records must come from a separately authenticated operator service.
 */
export function evaluateProposal(proposal, approval = null) {
  if (!isRecord(proposal)) return { decision: "rejected", reason: "proposal must be an object" };
  if (typeof proposal.id !== "string" || !proposal.id.trim()) {
    return { decision: "rejected", reason: "proposal id is required" };
  }
  if (typeof proposal.action !== "string" || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){0,5}$/.test(proposal.action)) {
    return { decision: "rejected", reason: "action name is invalid" };
  }
  if (!isRecord(proposal.payload)) {
    return { decision: "rejected", reason: "proposal payload must be an object" };
  }
  if (typeof proposal.summary !== "string" || !proposal.summary.trim() || proposal.summary.length > 500) {
    return { decision: "rejected", reason: "summary must be 1-500 characters" };
  }

  const hash = proposalDigest(proposal);
  if (SAFE_ACTIONS.has(proposal.action)) {
    return { decision: "allowed", executable: true, proposal_hash: hash, reason: "action is on the low-risk allowlist" };
  }
  if (!APPROVAL_ACTIONS.has(proposal.action)) {
    return { decision: "rejected", executable: false, proposal_hash: hash, reason: "action is not recognized by policy" };
  }

  if (!isRecord(approval)) {
    return {
      decision: "approval_required",
      executable: false,
      proposal_hash: hash,
      reason: "sensitive action requires explicit operator approval"
    };
  }

  const validApproval =
    approval.proposal_hash === hash &&
    typeof approval.approved_by === "string" &&
    approval.approved_by.trim().length > 0 &&
    typeof approval.approved_at === "string" &&
    !Number.isNaN(Date.parse(approval.approved_at)) &&
    typeof approval.reason === "string" &&
    approval.reason.trim().length > 0;

  if (!validApproval) {
    return {
      decision: "approval_required",
      executable: false,
      proposal_hash: hash,
      reason: "approval is missing, malformed, or does not match this exact proposal"
    };
  }

  return {
    decision: "approved",
    executable: true,
    proposal_hash: hash,
    approved_by: approval.approved_by,
    reason: "matching approval envelope supplied; caller must verify its authenticity"
  };
}

export const PROPOSAL_POLICY = Object.freeze({
  low_risk: Object.freeze([...SAFE_ACTIONS]),
  approval_required: Object.freeze([...APPROVAL_ACTIONS])
});
