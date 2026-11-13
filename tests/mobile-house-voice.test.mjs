import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizePrivateBrainUrl } from "../src/voice/private-endpoint.mjs";

test("mobile private connector accepts only local Graves bridge or HTTPS tailnet origin", () => {
  assert.equal(
    normalizePrivateBrainUrl("https://graves-pc.example-tailnet.ts.net/"),
    "https://graves-pc.example-tailnet.ts.net"
  );
  assert.equal(normalizePrivateBrainUrl("http://127.0.0.1:8787/"), "http://127.0.0.1:8787");
  for (const bad of [
    "https://public.example.com/",
    "http://graves-pc.example-tailnet.ts.net",
    "https://example.ts.net",
    "https://graves-pc.example-tailnet.ts.net/?key=secret",
    "https://secret@graves-pc.example-tailnet.ts.net",
    "https://graves-pc.example-tailnet.ts.net/path",
    "https://graves-pc.example-tailnet.ts.net:8080",
    "file:///etc/passwd",
    "http://192.168.1.1:8787"
  ]) {
    assert.throws(() => normalizePrivateBrainUrl(bad), /URL|private|Serve|token|origin/);
  }
});
test("house and mobile voice controls are included without modifying published mind state", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const world = await readFile(new URL("../world3d.js", import.meta.url), "utf8");
  assert.match(html, /id="p-graves_house"/);
  for (const id of ["home-speak", "home-talk", "chat-mic", "chat-voice", "brain-url", "brain-connect-button"]) {
    assert.ok(html.includes('id="' + id + '"'), "missing " + id);
  }
  assert.match(world, /function gravesHouse\(/);
  assert.match(world, /crypt\(\); gravesHouse\(\);/);
  assert.match(world, /const requestedPlace = new URLSearchParams\(location\.search\)\.get\('place'\)/);
  assert.match(world, /preserveSavedPositionForDirectVisit = true/);
  assert.match(world, /if \(directPlace === 'graves_house'\) show\('p-graves_house'\)/);
  assert.match(world, /voice\.speak\(reply\)/);
  assert.match(world, /normalizePrivateBrainUrl\(brainUrlInput.value\)/);
});
