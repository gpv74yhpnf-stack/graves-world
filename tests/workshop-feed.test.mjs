import test from "node:test";
import assert from "node:assert/strict";
import { buildFeed, normalizeRepositoryEvents } from "../src/workshop/github-feed.mjs";

test("feed contains public activity metadata and a fixed read-only contract", () => {
  const feed = buildFeed({
    events: [{ id: "evt-1", type: "PushEvent", created_at: "2026-11-12T12:00:00Z", actor: { login: "operator" }, repo: { name: "gpv74yhpnf-stack/graves-world" }, payload: { ref: "refs/heads/graves-v2/example", commits: [{ message: "Add safe feed" }] } }],
    commits: [{ sha: "1234567890", html_url: "https://github.com/gpv74yhpnf-stack/graves-world/commit/1234567890", commit: { message: "Add tests\nMore detail", author: { name: "operator", date: "2026-11-12T12:01:00Z" } } }],
    now: "2026-11-12T12:02:00Z"
  });
  assert.equal(feed.read_only, true);
  assert.equal(feed.source, "GitHub public repository API");
  assert.equal(feed.items.length, 2);
  assert.equal(feed.items[0].kind, "commit");
});

test("unknown event types are ignored", () => {
  assert.deepEqual(normalizeRepositoryEvents([{ id: "x", type: "WatchEvent" }]), []);
});

test("feed strips control characters and rejects non-GitHub links", () => {
  const [entry] = normalizeRepositoryEvents([{
    id: "evt-2", type: "IssuesEvent", created_at: "2026-11-12T12:00:00Z",
    actor: { login: "someone\n<script>" }, payload: { action: "opened", issue: { title: "New issue", number: 12, html_url: "https://evil.example/steal" } }
  }]);
  assert.equal(entry.url, null);
  assert.equal(entry.detail.includes("\n"), false);
  assert.equal(entry.detail.includes("<script>"), true);
});

test("invalid timestamps become null and items remain display-only", () => {
  const feed = buildFeed({ pulls: [{ number: 5, title: "PR", state: "open", updated_at: "not-a-date", html_url: "https://github.com/gpv74yhpnf-stack/graves-world/pull/5" }] });
  assert.equal(feed.items[0].timestamp, null);
  assert.equal(feed.items[0].url, "https://github.com/gpv74yhpnf-stack/graves-world/pull/5");
  assert.equal("payload" in feed.items[0], false);
});
