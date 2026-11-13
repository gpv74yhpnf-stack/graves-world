import test from "node:test";
import assert from "node:assert/strict";
import { createWorkWatch, WORK_WATCH_STEPS } from "../src/workshop/work-watch.mjs";

test("work watch exposes only a fixed, sanitized list of progress labels", () => {
  const watch = createWorkWatch({ now: () => "2026-11-13T12:00:00.000Z" });
  const snapshot = watch.snapshot();
  assert.deepEqual(snapshot.steps.map(({ id, label, status }) => ({ id, label, status })), [
    { id: "town", label: "Shape the living town", status: "complete" },
    { id: "research", label: "Build Graves’ local research desk", status: "complete" },
    { id: "voice", label: "Add streaming voice and text chat", status: "active" },
    { id: "checks", label: "Check the finished build", status: "queued" },
    { id: "live", label: "Bring the build to the live world", status: "queued" }
  ]);
  assert.equal(snapshot.completed, 2);
  assert.equal(snapshot.total, WORK_WATCH_STEPS.length);
  assert.equal(JSON.stringify(snapshot).includes("private"), false);
});

test("work watch accepts known status changes only and updates its timestamp", () => {
  let current = "2026-11-13T12:00:00.000Z";
  const watch = createWorkWatch({ now: () => current });
  current = "2026-11-13T12:01:00.000Z";
  const next = watch.update("voice", "complete");
  assert.equal(next.updated_at, current);
  assert.equal(next.steps.find(step => step.id === "voice").status, "complete");
  assert.throws(() => watch.update("voice", "raw user prompt"), /Invalid work status/);
  assert.throws(() => watch.update("visitor-submission", "active"), /Unknown work step/);
});
