import { createHash } from "node:crypto";
import { normalizePublicUrl } from "./web-reader.mjs";
import { cleanResearchNote } from "./private-notes.mjs";

// A deliberately broad, auditable curriculum. Later follow-up questions are
// generated from evidence but cannot run commands or change this policy.
export const DEFAULT_LEARNING_TOPICS = Object.freeze([
  "What are the current evidence-based limits of small local language models?",
  "How do historians evaluate and reconcile conflicting primary sources?",
  "Which fundamental physics principles help explain energy conversion?",
  "How does evolutionary biology use multiple kinds of evidence?",
  "How do mechanical engineers test the safety and fatigue of structures?",
  "What do contemporary scientific sources say about sustainable agriculture?",
  "What can comparative literature teach us about narrative structure?",
  "How have painting, sculpture and architecture influenced one another?",
  "What explains musical harmony and cultural variation in music?",
  "How do economists distinguish correlation, causation and market uncertainty?",
  "What methods do researchers use to recognize misinformation online?",
  "How do computer scientists measure reliability and software security?",
  "What are practical advances and open questions in astronomy and cosmology?",
  "What have philosophers argued about knowledge, ethics and uncertainty?",
  "How do scientific experiments account for bias and replication?",
  "What principles support accessibility and inclusive interface design?"
]);

const MAX_DAILY_ATTEMPTS = 10;
const MIN_GAP_MS = 60 * 1000;
function cleanedFollowups(raw, currentQuestion) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 2).filter(q => typeof q === "string")
    .map(q => q.replace(/[\r\n\t]/g, " ").trim().slice(0, 160))
    .filter(q =>
      q.length >= 16 && q.length <= 160 &&
      /[?]$/.test(q) &&
      q.toLowerCase() !== currentQuestion.toLowerCase() &&
      !/https?:\/\/|[<>]|password|api.key|secret.key|access.token/i.test(q)
    );
}
function topicChoice(state, topics) {
  const followups = Array.isArray(state.followups) ? state.followups : [];
  // Keep a broad systematic curriculum; occasional self-generated questions
  // are allowed one quarter of the time, not unbounded recursive browsing.
  if (state.attempts % 4 === 3 && followups.length) {
    return { query: followups.shift(), nextTopicIndex: state.nextTopicIndex, fromFollowup: true };
  }
  const nextIndex = Math.max(0, state.nextTopicIndex % topics.length);
  return {
    query: topics[nextIndex],
    nextTopicIndex: (nextIndex + 1) % topics.length,
    fromFollowup: false
  };
}
function boundedUnknowns(values) {
  return Array.isArray(values) ? values.slice(0, 4)
    .filter(s => typeof s === "string" && s.trim())
    .map(s => s.trim().slice(0, 400)) : [];
}
function domainKey(value) {
  return new URL(value).hostname;
}
function fingerprint(query, sources) {
  return createHash("sha256")
    .update(JSON.stringify({ query, sources: sources.map(s => ({ url: s.url, text: s.text })) }))
    .digest("hex");
}

export function createAutonomousLearningEngine({
  web, synthesizer, store,
  topics = DEFAULT_LEARNING_TOPICS,
  now = () => new Date()
}) {
  if (!web || typeof web.search !== "function" || typeof web.read !== "function" ||
      !synthesizer || typeof synthesizer.synthesize !== "function" ||
      !store || typeof store.withLock !== "function" ||
      !Array.isArray(topics) || !topics.length || topics.length > 100 ||
      topics.some(q => typeof q !== "string" || !q.trim() || q.length > 200)) {
    throw new Error("Invalid autonomous learning dependencies or topic queue");
  }

  async function runOnce() {
    return store.withLock(async () => {
      const state = await store.readState();
      const current = now();
      if (!(current instanceof Date) || !Number.isFinite(current.getTime())) throw new Error("Invalid clock");
      const utcDay = current.toISOString().slice(0, 10);
      if (state.dailyDate !== utcDay) {
        state.dailyDate = utcDay;
        state.dailyAttempts = 0;
      }
      if (state.dailyAttempts >= MAX_DAILY_ATTEMPTS) {
        return { ran: false, reason: "Daily bounded research budget reached", nextStep: "Retry after the UTC day changes" };
      }
      if (state.lastAttemptAt &&
          current.getTime() - Date.parse(state.lastAttemptAt) < MIN_GAP_MS) {
        return { ran: false, reason: "Research cooldown: the last cycle was too recent" };
      }
      const choice = topicChoice(state, topics);
      state.followups = Array.isArray(state.followups) ? state.followups : [];
      state.nextTopicIndex = choice.nextTopicIndex;
      state.attempts += 1;
      state.dailyAttempts += 1;
      state.lastAttemptAt = current.toISOString();
      // Commit budget BEFORE external reads so crashing cannot bypass limits.
      await store.writeState(state);
      try {
        const results = await web.search(choice.query);
        if (!Array.isArray(results)) throw new Error("Web search failed to return results");
        const sources = [];
        const seen = new Set();
        for (const candidate of results.slice(0, 8)) {
          if (sources.length >= 3) break;
          let url;
          try { url = normalizePublicUrl(candidate?.url).href; }
          catch { continue; }
          if (seen.has(domainKey(url))) continue;
          try {
            const page = await web.read(url);
            const safeUrl = normalizePublicUrl(page.url).href;
            if (seen.has(domainKey(safeUrl))) continue;
            if (typeof page.text !== "string" || page.text.trim().length < 300) continue;
            seen.add(domainKey(safeUrl));
            sources.push({
              title: String(page.title || "Public page").slice(0, 240),
              url: safeUrl, text: page.text.slice(0, 8000)
            });
          } catch {
            // Skip unreadable pages; never retry them rapidly.
          }
        }
        if (sources.length < 2) throw new Error("Fewer than two independent readable public source hosts");
        const digest = fingerprint(choice.query, sources);
        if ((await store.recent(25)).some(record => record.digest === digest)) {
          return { ran: true, saved: false, topic: choice.query, reason: "Unchanged research evidence already recorded" };
        }
        const draft = await synthesizer.synthesize({ topic: choice.query, sources });
        const note = cleanResearchNote({
          title: draft?.title, overview: draft?.overview,
          findings: draft?.findings,
          sources: sources.map(({ title, url }) => ({ title, url }))
        });
        if (!note.findings.length) throw new Error("No source-cited findings were produced");
        const unknowns = boundedUnknowns(draft.unknowns);
        const followups = cleanedFollowups(draft.followups, choice.query);
        const existing = new Set([choice.query.toLowerCase(), ...state.followups.map(x => x.toLowerCase())]);
        for (const q of followups) {
          if (state.followups.length >= 10) break;
          if (!existing.has(q.toLowerCase())) {
            state.followups.push(q);
            existing.add(q.toLowerCase());
          }
        }
        const record = await store.record({
          status: "provisional",
          topic: choice.query,
          fromFollowup: choice.fromFollowup,
          digest,
          note, unknowns,
          caveat: "Unreviewed model synthesis. Sources are not verified claims; never treat this as canonical memory."
        });
        state.successes += 1;
        state.lastSuccessAt = current.toISOString();
        state.lastError = null;
        await store.writeState(state);
        return { ran: true, saved: true, id: record.id, topic: choice.query,
          sourceCount: sources.length, findings: note.findings.length };
      } catch (error) {
        state.lastError = String(error?.message || "Unknown research failure").slice(0, 240);
        await store.record({ status: "failed", topic: choice.query, error: state.lastError });
        await store.writeState(state);
        throw error;
      }
    });
  }

  return Object.freeze({ runOnce, status: () => store.status() });
}
