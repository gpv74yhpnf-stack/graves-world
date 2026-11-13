const STEP_LIST = [
  { id: "town", label: "Shape the living town" },
  { id: "research", label: "Build Graves’ local research desk" },
  { id: "voice", label: "Add streaming voice and text chat" },
  { id: "checks", label: "Check the finished build" },
  { id: "live", label: "Bring the build to the live world" }
];

const ALLOWED_STATUSES = new Set(["queued", "active", "complete"]);

export const WORK_WATCH_STEPS = Object.freeze(STEP_LIST.map(step => Object.freeze({ ...step })));

export function createWorkWatch({ now = () => new Date().toISOString() } = {}) {
  const states = new Map(STEP_LIST.map(({ id }) => [id, "queued"]));
  for (const id of ["town", "research"]) states.set(id, "complete");
  states.set("voice", "active");
  let updatedAt = now();

  function snapshot() {
    const steps = STEP_LIST.map(step => ({ ...step, status: states.get(step.id) }));
    return {
      updated_at: updatedAt,
      completed: steps.filter(step => step.status === "complete").length,
      total: steps.length,
      steps
    };
  }

  return {
    snapshot,
    update(id, status) {
      if (!states.has(id)) throw new Error("Unknown work step.");
      if (!ALLOWED_STATUSES.has(status)) throw new Error("Invalid work status.");
      states.set(id, status);
      updatedAt = now();
      return snapshot();
    }
  };
}
