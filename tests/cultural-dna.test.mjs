import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildCulturalIndex,
  createInfluenceProposal,
  validateCulturalEntry
} from "../src/culture/cultural-dna.mjs";

const archive = JSON.parse(await readFile(new URL("../data/cultural-archive.seed.json", import.meta.url), "utf8"));
const sample = archive.entries[0];

test("starter cultural archive validates and indexes across domains", () => {
  const index = buildCulturalIndex(archive.entries);
  assert.equal(index.schema_version, 1);
  assert.equal(index.entry_count, 5);
  assert.ok(index.domains.find(item => item.domain === "cinema").entry_ids.includes("spirited-away"));
});

test("invalid and duplicate archive records are rejected", () => {
  assert.ok(validateCulturalEntry({ ...sample, source_url: "javascript:alert(1)" }).some(error => error.startsWith("source_url:")));
  assert.throws(() => buildCulturalIndex([sample, sample]), /Duplicate cultural entry id/);
  assert.throws(() => buildCulturalIndex([{ ...sample, themes: [] }]), /Invalid cultural entry/);
});

test("influence proposal is deterministic, attributed, and non-executable", () => {
  const options = { target: "place", rationale: "Use lived-in details and practical routines to make the location feel inhabited." };
  const first = createInfluenceProposal(sample, options);
  const second = createInfluenceProposal(sample, options);
  assert.deepEqual(first, second);
  assert.equal(first.status, "proposed");
  assert.equal(first.review_required, true);
  assert.equal(first.executable, false);
  assert.equal(first.provenance.archive_id, sample.id);
  assert.match(first.creative_brief.originality_rule, /Do not reproduce/);
});

test("proposal cannot target an unsupported creative surface", () => {
  assert.throws(() => createInfluenceProposal(sample, {
    target: "public_state.publish",
    rationale: "Publish it"
  }), /target must be suggested/);
  assert.throws(() => createInfluenceProposal(sample, {
    target: "place",
    rationale: ""
  }), /rationale must be original/);
});

test("archive builder does not mutate source entries", () => {
  const before = JSON.stringify(archive.entries);
  buildCulturalIndex(archive.entries);
  assert.equal(JSON.stringify(archive.entries), before);
});
