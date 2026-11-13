import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPrivateResearchNotes, cleanResearchNote } from "../src/research/private-notes.mjs";

const note = {
  title: "A quiet archive",
  overview: "Several public pages describe how small archives make room for curiosity.",
  findings: [{ text: "A subject index helps readers find useful ideas.", source_ids: [1] }],
  sources: [{ title: "Public archive guide", url: "https://example.com/archive#contents" }]
};

test("research notes require public HTTPS citations and valid source references", () => {
  const clean = cleanResearchNote(note);
  assert.equal(clean.sources[0].url, "https://example.com/archive");
  assert.throws(() => cleanResearchNote({ ...note, sources: [{ title: "Local", url: "http://127.0.0.1/private" }] }), /public HTTPS/);
  assert.throws(() => cleanResearchNote({ ...note, findings: [{ text: "Uncited claim", source_ids: [9] }] }), /cite a selected source/);
});

test("private notes are saved separately and returned as bounded untrusted reference material", async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "graves-web-notes-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createPrivateResearchNotes({ directory });
  assert.deepEqual(await store.recent(), []);
  const saved = await store.save(note);
  assert.match(saved.id, /^[0-9a-f-]{36}$/i);
  assert.equal(saved.sources[0].url, "https://example.com/archive");
  assert.deepEqual(await store.recent(), [{
    title: note.title,
    overview: note.overview,
    findings: note.findings,
    sources: [{ title: "Public archive guide", url: "https://example.com/archive" }]
  }]);
  await appendFile(path.join(directory, "web-notes.jsonl"), "not-json\n");
  assert.equal((await store.recent()).length, 1, "one damaged line does not hide earlier saved notes");
  const raw = await readFile(path.join(directory, "web-notes.jsonl"), "utf8");
  assert.match(raw, /A quiet archive/);
  assert.doesNotMatch(raw, /private memory|conversation transcript/i);
});
