import test from "node:test";
import assert from "node:assert/strict";
import { proposeMemoryLifecycle } from "../src/memory/lifecycle-policy.mjs";

const source = {
  event_seq: 2,
  state_hash: "a".repeat(64),
  origin: "imported-public-snapshot"
};

function memory(overrides = {}) {
  return {
    id: "memory-1",
    kind: "transient_state",
    lifecycle: "active",
    created_at: "2026-11-01T12:00:00Z",
    last_supported_at: "2026-11-01T12:00:00Z",
    source_refs: [source],
    ...overrides
  };
}

test("proposes fading for stale transient state without mutating input", () => {
  const item = memory();
  const before = structuredClone(item);
  const result = proposeMemoryLifecycle({
    memories: [item],
    asOf: "2026-11-05T12:00:00Z"
  });
  assert.equal(result.proposal_count, 1);
  assert.equal(result.proposals[0].from, "active");
  assert.equal(result.proposals[0].to, "fading");
  assert.equal(result.proposals[0].requires_review, true);
  assert.equal(result.proposals[0].executable, false);
  assert.deepEqual(item, before);
});

test("proposes archive only for already-fading transient state", () => {
  const result = proposeMemoryLifecycle({
    memories: [memory({ lifecycle: "fading" })],
    asOf: "2026-11-16T12:00:00Z"
  });
  assert.equal(result.proposals[0].to, "archived");
});

test("does not age identity, visitor notes, interpretations, or observed facts", () => {
  const kinds = ["identity", "visitor_note", "interpretation", "observed_fact"];
  const result = proposeMemoryLifecycle({
    memories: kinds.map((kind, index) => memory({ id: `m-${index}`, kind })),
    asOf: "2027-01-01T00:00:00Z"
  });
  assert.equal(result.proposal_count, 0);
});

test("does not automatically promote candidates or reject memories", () => {
  const result = proposeMemoryLifecycle({
    memories: [
      memory({ id: "candidate", lifecycle: "candidate" }),
      memory({ id: "rejected", lifecycle: "rejected" })
    ],
    asOf: "2027-01-01T00:00:00Z"
  });
  assert.deepEqual(result.proposals, []);
});

test("recent support resets the age clock", () => {
  const result = proposeMemoryLifecycle({
    memories: [memory({ last_supported_at: "2026-11-10T00:00:00Z" })],
    asOf: "2026-11-12T00:00:00Z"
  });
  assert.equal(result.proposal_count, 0);
});

test("rejects missing provenance and duplicate ids", () => {
  assert.throws(() => proposeMemoryLifecycle({
    memories: [memory({ source_refs: [] })],
    asOf: "2026-11-12T00:00:00Z"
  }), /source_refs/);
  assert.throws(() => proposeMemoryLifecycle({
    memories: [memory(), memory()],
    asOf: "2026-11-12T00:00:00Z"
  }), /duplicate memory id/);
});

test("rejects invalid chronology and unsafe policy values", () => {
  assert.throws(() => proposeMemoryLifecycle({
    memories: [memory({ last_supported_at: "2026-11-13T00:00:00Z" })],
    asOf: "2026-11-12T00:00:00Z"
  }), /later than asOf/);
  assert.throws(() => proposeMemoryLifecycle({
    memories: [memory()],
    asOf: "2026-11-12T00:00:00Z",
    policy: { transient_archive_after_days: 2 }
  }), /must exceed/);
});

test("uses configurable intervals and produces deterministic proposal ids", () => {
  const args = {
    memories: [memory()],
    asOf: "2026-11-03T12:00:00Z",
    policy: { transient_fade_after_days: 2, transient_archive_after_days: 8 }
  };
  const first = proposeMemoryLifecycle(args);
  const second = proposeMemoryLifecycle(args);
  assert.deepEqual(first, second);
  assert.equal(first.proposals[0].proposal_id, "lifecycle:memory-1:active->fading");
});
