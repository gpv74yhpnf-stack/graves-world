const KINDS = new Set([
  "observed_fact",
  "visitor_note",
  "identity",
  "transient_state",
  "interpretation"
]);
const LIFECYCLES = new Set(["candidate", "active", "fading", "archived", "rejected"]);
const DEFAULT_POLICY = Object.freeze({
  transient_fade_after_days: 3,
  transient_archive_after_days: 14
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function daysBetween(earlier, later) {
  return Math.floor((Date.parse(later) - Date.parse(earlier)) / 86_400_000);
}

function validateMemory(memory) {
  const errors = [];
  if (!isRecord(memory)) return ["memory must be an object"];
  if (typeof memory.id !== "string" || !memory.id.trim()) errors.push("id must be a non-empty string");
  if (!KINDS.has(memory.kind)) errors.push("kind is not recognized");
  if (!LIFECYCLES.has(memory.lifecycle)) errors.push("lifecycle is not recognized");
  if (!validDate(memory.created_at)) errors.push("created_at must be a valid date-time");
  if (memory.last_supported_at !== undefined && !validDate(memory.last_supported_at)) {
    errors.push("last_supported_at must be a valid date-time when supplied");
  }
  if (!Array.isArray(memory.source_refs) || memory.source_refs.length === 0) {
    errors.push("source_refs must contain at least one provenance reference");
  } else {
    memory.source_refs.forEach((source, index) => {
      if (!isRecord(source) || !Number.isInteger(source.event_seq) || source.event_seq < 1) {
        errors.push(`source_refs[${index}].event_seq must be a positive integer`);
      }
      if (!isRecord(source) || typeof source.state_hash !== "string" || !/^[a-f0-9]{64}$/.test(source.state_hash)) {
        errors.push(`source_refs[${index}].state_hash must be a SHA-256 hex digest`);
      }
      if (!isRecord(source) || typeof source.origin !== "string" || !source.origin.trim()) {
        errors.push(`source_refs[${index}].origin must be a non-empty string`);
      }
    });
  }
  return errors;
}

/**
 * Produce reviewable lifecycle proposals. This function never mutates memory,
 * accepts candidates, deletes evidence, or appends events.
 *
 * Only explicitly classified transient_state memories may age from active to
 * fading and from fading to archived. All other kinds require explicit review.
 */
export function proposeMemoryLifecycle({ memories, asOf, policy = {} }) {
  if (!Array.isArray(memories)) throw new Error("memories must be an array");
  if (!validDate(asOf)) throw new Error("asOf must be a valid date-time");

  const settings = { ...DEFAULT_POLICY, ...policy };
  for (const [key, value] of Object.entries(settings)) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${key} must be a positive integer`);
  }
  if (settings.transient_archive_after_days <= settings.transient_fade_after_days) {
    throw new Error("transient_archive_after_days must exceed transient_fade_after_days");
  }

  const seen = new Set();
  const proposals = [];
  memories.forEach((memory, index) => {
    const errors = validateMemory(memory);
    if (errors.length) throw new Error(`memories[${index}]: ${errors.join("; ")}`);
    if (seen.has(memory.id)) throw new Error(`duplicate memory id: ${memory.id}`);
    seen.add(memory.id);

    if (memory.kind !== "transient_state" || !["active", "fading"].includes(memory.lifecycle)) return;
    const supportedAt = memory.last_supported_at ?? memory.created_at;
    const ageDays = daysBetween(supportedAt, asOf);
    if (ageDays < 0) throw new Error(`memory ${memory.id} has evidence later than asOf`);

    let target = null;
    let reason = null;
    if (memory.lifecycle === "active" && ageDays >= settings.transient_fade_after_days) {
      target = "fading";
      reason = "transient state has exceeded the configured fade interval without newer support";
    } else if (memory.lifecycle === "fading" && ageDays >= settings.transient_archive_after_days) {
      target = "archived";
      reason = "transient state has exceeded the configured archive interval without newer support";
    }
    if (target) {
      proposals.push({
        proposal_id: `lifecycle:${memory.id}:${memory.lifecycle}->${target}`,
        memory_id: memory.id,
        action: "memory.propose",
        from: memory.lifecycle,
        to: target,
        kind: memory.kind,
        age_days: ageDays,
        reason,
        source_refs: memory.source_refs.map(source => ({ ...source })),
        requires_review: true,
        executable: false
      });
    }
  });

  return {
    policy_version: 1,
    interpretation: "reviewable_lifecycle_proposals_not_memory_mutations",
    as_of: asOf,
    evaluated_count: memories.length,
    proposal_count: proposals.length,
    proposals
  };
}

export const MEMORY_KINDS = Object.freeze([...KINDS]);
export const MEMORY_LIFECYCLES = Object.freeze([...LIFECYCLES]);
export const DEFAULT_MEMORY_LIFECYCLE_POLICY = DEFAULT_POLICY;
