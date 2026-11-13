import { appendFile, chmod, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizePublicUrl } from "./web-reader.mjs";

const MAX_FILE_BYTES = 1_000_000;

function boundedText(value, max, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim().slice(0, max);
}

export function cleanResearchNote(input) {
  const sources = Array.isArray(input?.sources)
    ? input.sources.slice(0, 3).map(source => ({
      title: boundedText(source?.title, 240, "Source title"),
      url: normalizePublicUrl(source?.url).href
    }))
    : [];
  if (!sources.length) throw new Error("At least one source is required.");

  const findings = Array.isArray(input?.findings)
    ? input.findings.slice(0, 6).map(item => {
      const text = boundedText(item?.text, 600, "Finding");
      const source_ids = Array.isArray(item?.source_ids)
        ? [...new Set(item.source_ids.filter(id => Number.isSafeInteger(id) && id >= 1 && id <= sources.length))].slice(0, 3)
        : [];
      if (!source_ids.length) throw new Error("Every finding must cite a selected source.");
      return { text, source_ids };
    })
    : [];

  return {
    title: boundedText(input?.title, 200, "Research title"),
    overview: boundedText(input?.overview, 1600, "Research overview"),
    findings,
    sources
  };
}

export function createPrivateResearchNotes({ directory, platform = process.platform } = {}) {
  if (typeof directory !== "string" || !directory.trim()) throw new Error("A private research directory is required.");
  const file = path.join(directory, "web-notes.jsonl");

  return Object.freeze({
    async save(input) {
      const note = { id: randomUUID(), saved_at: new Date().toISOString(), ...cleanResearchNote(input) };
      await mkdir(directory, { recursive: true });
      if (platform !== "win32") await chmod(directory, 0o700);
      await appendFile(file, JSON.stringify(note) + "\n", { encoding: "utf8", mode: 0o600 });
      if (platform !== "win32") await chmod(file, 0o600);
      return note;
    },
    async recent(limit = 8) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("limit must be between 1 and 20");
      let raw;
      try {
        raw = await readFile(file, "utf8");
      } catch (error) {
        if (error?.code === "ENOENT") return [];
        throw error;
      }
      if (Buffer.byteLength(raw, "utf8") > MAX_FILE_BYTES) return [];
      const notes = [];
      for (const line of raw.trim().split("\n").slice(-limit)) {
        try {
          const note = JSON.parse(line);
          const clean = cleanResearchNote(note);
          notes.push({ title: clean.title, overview: clean.overview, findings: clean.findings, sources: clean.sources });
        } catch {
          // Keep reading later valid entries if one line was manually damaged.
        }
      }
      return notes;
    }
  });
}
