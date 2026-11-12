import { createHash } from "node:crypto";

export const CULTURAL_DOMAINS = Object.freeze([
  "cinema", "visual_art", "poetry", "literature", "music",
  "folklore", "history", "philosophy", "craft", "architecture", "ritual"
]);
export const WORLD_TARGETS = Object.freeze([
  "place", "character", "custom", "story_seed", "visual_motif",
  "soundscape", "object", "festival", "language"
]);
export const ARCHIVE_STATUSES = Object.freeze(["inbox", "studied", "influential", "retired"]);

const domainSet = new Set(CULTURAL_DOMAINS);
const targetSet = new Set(WORLD_TARGETS);
const statusSet = new Set(ARCHIVE_STATUSES);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = value => typeof value === "string" && value.trim().length > 0;
const uniqueTextList = value => Array.isArray(value) && value.length > 0 &&
  value.every(item => isText(item) && item.length <= 160) &&
  new Set(value).size === value.length;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value)), "utf8").digest("hex");
}

/**
 * Cultural entries store bibliographic metadata and original analysis, not
 * copied scripts, lyrics, poems, images, or other protected source material.
 */
export function validateCulturalEntry(entry) {
  const errors = [];
  const need = (condition, field, message) => { if (!condition) errors.push(`${field}: ${message}`); };
  need(isRecord(entry), "$", "must be an object");
  if (!isRecord(entry)) return errors;

  need(typeof entry.id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id), "id", "must be a lowercase slug");
  need(isText(entry.title) && entry.title.length <= 200, "title", "must be 1-200 characters");
  need(isText(entry.creator) && entry.creator.length <= 200, "creator", "must be 1-200 characters");
  need(domainSet.has(entry.domain), "domain", "must be a supported cultural domain");
  need(isText(entry.era) && entry.era.length <= 100, "era", "must be a short era or year label");
  need(uniqueTextList(entry.themes), "themes", "must be a non-empty list of unique short strings");
  need(uniqueTextList(entry.techniques), "techniques", "must be a non-empty list of unique short strings");
  need(uniqueTextList(entry.world_applications), "world_applications", "must be a non-empty list of unique short strings");
  need(Array.isArray(entry.suggested_targets) && entry.suggested_targets.length > 0 &&
    entry.suggested_targets.every(target => targetSet.has(target)) &&
    new Set(entry.suggested_targets).size === entry.suggested_targets.length,
    "suggested_targets", "must contain unique supported world targets");
  need(isText(entry.original_analysis) && entry.original_analysis.length <= 1200,
    "original_analysis", "must be original analysis of at most 1200 characters");
  need(statusSet.has(entry.status), "status", "must be inbox, studied, influential, or retired");
  need(isText(entry.added_at) && !Number.isNaN(Date.parse(entry.added_at)), "added_at", "must be a valid date-time");
  if (entry.source_url !== undefined && entry.source_url !== null) {
    let parsed;
    try { parsed = new URL(entry.source_url); } catch { /* invalid below */ }
    need(parsed?.protocol === "https:", "source_url", "must be an HTTPS source reference");
  }
  if (entry.rights_note !== undefined) {
    need(isText(entry.rights_note) && entry.rights_note.length <= 300, "rights_note", "must be a short rights/provenance note");
  }
  return errors;
}

/**
 * Convert a validated cultural reference into a reviewable worldbuilding
 * proposal. This is deliberately deterministic: it does not copy source
 * expression, infer author intent, execute actions, or publish anything.
 */
export function createInfluenceProposal(entry, { target, rationale } = {}) {
  const errors = validateCulturalEntry(entry);
  if (errors.length) throw new Error(`Invalid cultural entry: ${errors.join("; ")}`);
  if (!targetSet.has(target) || !entry.suggested_targets.includes(target)) {
    throw new Error("target must be suggested by the cultural entry");
  }
  if (!isText(rationale) || rationale.length > 500) {
    throw new Error("rationale must be original text of 1-500 characters");
  }

  const basis = {
    archive_id: entry.id,
    title: entry.title,
    creator: entry.creator,
    domain: entry.domain,
    target,
    themes: [...entry.themes],
    techniques: [...entry.techniques],
    world_application: entry.world_applications[0],
    rationale: rationale.trim(),
    source_url: entry.source_url ?? null
  };
  const hash = digest(basis);
  return {
    id: `culture-${hash.slice(0, 16)}`,
    type: "worldbuilding.influence_proposed",
    status: "proposed",
    review_required: true,
    executable: false,
    proposal_hash: hash,
    provenance: { archive_id: entry.id, title: entry.title, creator: entry.creator, domain: entry.domain, source_url: entry.source_url ?? null },
    creative_brief: {
      target,
      themes: basis.themes,
      techniques: basis.techniques,
      world_application: basis.world_application,
      rationale: basis.rationale,
      originality_rule: "Create new expression. Do not reproduce protected dialogue, lyrics, poems, scenes, characters, designs, or distinctive passages."
    }
  };
}

export function buildCulturalIndex(entries) {
  if (!Array.isArray(entries)) throw new Error("entries must be an array");
  const seen = new Set();
  for (const entry of entries) {
    const errors = validateCulturalEntry(entry);
    if (errors.length) throw new Error(`Invalid cultural entry: ${errors.join("; ")}`);
    if (seen.has(entry.id)) throw new Error(`Duplicate cultural entry id: ${entry.id}`);
    seen.add(entry.id);
  }
  return {
    schema_version: 1,
    entry_count: entries.length,
    domains: CULTURAL_DOMAINS.map(domain => ({
      domain,
      entry_ids: entries.filter(entry => entry.domain === domain && entry.status !== "retired").map(entry => entry.id)
    })),
    entries: entries.map(entry => ({ ...entry }))
  };
}
