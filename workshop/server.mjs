import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildFeed } from "../src/workshop/github-feed.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = "gpv74yhpnf-stack/graves-world";
const BRANCH = "graves-v2/workshop-live-feed";
const PORT = Number(process.env.GRAVES_WORKSHOP_PORT || 4317);
const POLL_MS = 120_000;
const METADATA_POLL_MS = 15 * 60_000;
let lastMetadataAt = 0;
let cachedMetadata = { commits: [], pulls: [], workflowRuns: [] };
const clients = new Set();
let snapshot = {
  repository: REPO, branch: BRANCH, generated_at: null,
  source: "GitHub public repository API", read_only: true,
  items: [], status: "starting", last_attempt_at: null, error: null
};

async function githubJson(endpoint) {
  const response = await fetch(`https://api.github.com/repos/${REPO}/${endpoint}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Graves-Workshop-Live-Feed" },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`GitHub API returned HTTP ${response.status} for ${endpoint}`);
  return response.json();
}

async function refresh() {
  const attempted = new Date().toISOString();
  const refreshMetadata = Date.now() - lastMetadataAt >= METADATA_POLL_MS;
  const tasks = [
    githubJson("events?per_page=30"),
    ...(refreshMetadata ? [
      githubJson(\`commits?sha=\${encodeURIComponent(BRANCH)}&per_page=20\`),
      githubJson("pulls?state=all&sort=updated&direction=desc&per_page=20"),
      githubJson("actions/runs?per_page=15")
    ] : [])
  ];
  const results = await Promise.allSettled(tasks);
  const errors = results.flatMap((result, index) => result.status === "rejected"
    ? [\`GitHub source \${index + 1}: \${String(result.reason?.message ?? "unavailable").slice(0, 100)}\`]
    : []);
  const eventResult = results[0];
  if (eventResult.status === "fulfilled") {
    const metadataResults = refreshMetadata ? results.slice(1) : [];
    if (refreshMetadata) {
      if (metadataResults[0]?.status === "fulfilled") cachedMetadata.commits = metadataResults[0].value;
      if (metadataResults[1]?.status === "fulfilled") cachedMetadata.pulls = metadataResults[1].value;
      if (metadataResults[2]?.status === "fulfilled") cachedMetadata.workflowRuns = metadataResults[2].value.workflow_runs ?? [];
      if (metadataResults.some(result => result.status === "fulfilled")) lastMetadataAt = Date.now();
    }
    const feed = buildFeed({
      events: eventResult.value,
      commits: cachedMetadata.commits,
      pulls: cachedMetadata.pulls,
      workflowRuns: cachedMetadata.workflowRuns,
      now: new Date().toISOString()
    });
    snapshot = {
      ...feed,
      status: errors.length ? "partial" : "connected",
      last_attempt_at: attempted,
      error: errors.length ? errors.join("; ").slice(0, 240) : null
    };
  } else if (snapshot.generated_at) {
    snapshot = {
      ...snapshot,
      status: "stale",
      last_attempt_at: attempted,
      error: String(eventResult.reason?.message ?? "GitHub events unavailable").slice(0, 240)
    };
  } else {
    snapshot = {
      ...snapshot,
      status: "offline",
      last_attempt_at: attempted,
      error: errors.join("; ").slice(0, 240) || "GitHub sources unavailable"
    };
  }
  broadcast();
}

function broadcast() {
  const data = `event: feed\ndata: ${JSON.stringify(snapshot)}\n\n`;
  for (const client of clients) {
    try { client.write(data); } catch { clients.delete(client); }
  }
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(value));
}

const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/workshop.css", ["workshop.css", "text/css; charset=utf-8"]],
  ["/workshop.js", ["workshop.js", "text/javascript; charset=utf-8"]]
]);

const server = http.createServer(async (req, res) => {
  const host = String(req.headers.host ?? "").toLowerCase();
  const remote = req.socket.remoteAddress ?? "";
  const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  if (!loopback || ![`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`].includes(host)) {
    return sendJson(res, 403, { error: "Local Workshop access only." });
  }

  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method !== "GET") return sendJson(res, 405, { error: "Read-only feed. Only GET is supported." });

  if (url.pathname === "/api/health") {
    return sendJson(res, 200, {
      service: "graves-workshop-live-feed", status: snapshot.status,
      read_only: true, branch: BRANCH, last_updated: snapshot.generated_at,
      last_attempt_at: snapshot.last_attempt_at, error: snapshot.error
    });
  }
  if (url.pathname === "/api/feed") return sendJson(res, 200, snapshot);
  if (url.pathname === "/api/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.write(`event: feed\ndata: ${JSON.stringify(snapshot)}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  const file = staticFiles.get(url.pathname);
  if (!file) return sendJson(res, 404, { error: "Not found." });
  try {
    const body = await readFile(path.join(ROOT, file[0]));
    res.writeHead(200, { "Content-Type": file[1], "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    sendJson(res, 500, { error: "Workshop asset unavailable." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Graves Workshop Live Feed: http://127.0.0.1:${PORT}`);
  console.log("Read-only mode. No GitHub token, private vault access, or write routes.");
  refresh();
  setInterval(refresh, POLL_MS).unref();
});

process.on("SIGINT", () => {
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
});
