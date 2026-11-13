const cleanText = (value, max = 180) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

function safeGitHubUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

function item({ id, kind, title, detail, timestamp, url, status = "info" }) {
  const parsed = Date.parse(timestamp ?? "");
  return {
    id: cleanText(id, 240) || `${kind}:${cleanText(title, 80)}:${timestamp ?? ""}`,
    kind: cleanText(kind, 40),
    title: cleanText(title, 180) || "Repository activity",
    detail: cleanText(detail, 220),
    timestamp: Number.isFinite(parsed) ? new Date(parsed).toISOString() : null,
    url: safeGitHubUrl(url),
    status
  };
}

export function normalizeRepositoryEvents(events = []) {
  return events.flatMap(event => {
    const actor = cleanText(event.actor?.login, 60);
    const repo = cleanText(event.repo?.name, 100);
    const payload = event.payload ?? {};
    const common = { timestamp: event.created_at, id: event.id };
    switch (event.type) {
      case "PushEvent": {
        const branch = cleanText(String(payload.ref ?? "").replace(/^refs\/heads\//, ""), 100);
        const commits = Array.isArray(payload.commits) ? payload.commits : [];
        const message = commits.length ? cleanText(commits[0]?.message, 160) : "Repository push";
        return [item({ ...common, kind: "push", title: `Push to ${branch || "branch"}`, detail: [actor, message].filter(Boolean).join(" · "), url: `https://github.com/${repo}/commits/${encodeURIComponent(branch)}`, status: "success" })];
      }
      case "PullRequestEvent": {
        const pr = payload.pull_request ?? {};
        const number = Number(pr.number ?? payload.number);
        return [item({ ...common, id: `pr:${number}:${event.id}`, kind: "pull_request", title: cleanText(pr.title, 160) || "Pull request activity", detail: [payload.action, actor, pr.draft ? "draft" : null].filter(Boolean).join(" · "), url: pr.html_url, status: payload.action === "closed" && pr.merged ? "success" : "info" })];
      }
      case "IssuesEvent": {
        const issue = payload.issue ?? {};
        return [item({ ...common, kind: "issue", title: cleanText(issue.title, 160) || "Issue activity", detail: [payload.action, actor, issue.number ? `#${issue.number}` : null].filter(Boolean).join(" · "), url: issue.html_url })];
      }
      case "IssueCommentEvent": {
        const issue = payload.issue ?? {};
        return [item({ ...common, kind: "comment", title: "Public issue comment", detail: [actor, issue.number ? `on #${issue.number}` : null].filter(Boolean).join(" · "), url: issue.html_url })];
      }
      case "CreateEvent":
        return [item({ ...common, kind: "branch", title: `Created ${cleanText(payload.ref_type, 30) || "repository ref"}`, detail: [actor, cleanText(payload.ref, 100)].filter(Boolean).join(" · "), url: `https://github.com/${repo}/tree/${encodeURIComponent(cleanText(payload.ref, 100))}` })];
      case "ReleaseEvent":
        return [item({ ...common, kind: "release", title: "Release activity", detail: [actor, cleanText(payload.action, 40)].filter(Boolean).join(" · "), url: payload.release?.html_url, status: "warning" })];
      default:
        return [];
    }
  });
}

export function normalizeCommits(commits = []) {
  return commits.map(commit => item({
    id: `commit:${commit.sha}`,
    kind: "commit",
    title: cleanText(commit.commit?.message?.split("\n")[0], 160) || "Commit",
    detail: [cleanText(commit.commit?.author?.name, 60), commit.sha?.slice(0, 8)].filter(Boolean).join(" · "),
    timestamp: commit.commit?.author?.date ?? commit.commit?.committer?.date,
    url: commit.html_url,
    status: "success"
  }));
}

export function normalizePullRequests(pulls = []) {
  return pulls.map(pr => item({
    id: `pull:${pr.number}`,
    kind: "pull_request",
    title: `#${pr.number} ${cleanText(pr.title, 150)}`,
    detail: [pr.state, pr.draft ? "draft" : "open for review", cleanText(pr.head?.ref, 70)].filter(Boolean).join(" · "),
    timestamp: pr.updated_at,
    url: pr.html_url,
    status: pr.state === "closed" && pr.merged_at ? "success" : "info"
  }));
}

export function normalizeWorkflowRuns(runs = []) {
  return runs.map(run => item({
    id: `workflow:${run.id}`,
    kind: "workflow",
    title: cleanText(run.name, 150) || "GitHub Actions run",
    detail: [run.status, run.conclusion, run.head_branch].filter(Boolean).join(" · "),
    timestamp: run.updated_at ?? run.created_at,
    url: run.html_url,
    status: run.conclusion === "success" ? "success" : run.conclusion === "failure" ? "danger" : "warning"
  }));
}

export function buildFeed({ events = [], commits = [], pulls = [], workflowRuns = [], now = new Date().toISOString() } = {}) {
  const items = [
    ...normalizeRepositoryEvents(events),
    ...normalizeCommits(commits),
    ...normalizePullRequests(pulls),
    ...normalizeWorkflowRuns(workflowRuns)
  ];
  const unique = new Map();
  for (const entry of items) if (!unique.has(entry.id)) unique.set(entry.id, entry);
  return {
    repository: "gpv74yhpnf-stack/graves-world",
    branch: "graves-v2/workshop-live-feed",
    generated_at: new Date(now).toISOString(),
    source: "GitHub public repository API",
    read_only: true,
    items: [...unique.values()]
      .sort((a, b) => (Date.parse(b.timestamp ?? "") || 0) - (Date.parse(a.timestamp ?? "") || 0))
      .slice(0, 60)
  };
}
