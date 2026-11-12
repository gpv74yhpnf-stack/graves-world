const timeline = document.querySelector("#timeline");
const statusText = document.querySelector("#feed-status");
const updatedText = document.querySelector("#feed-updated");
const connectionLabel = document.querySelector("#connection-label");
const liveDot = document.querySelector("#live-dot");
const notice = document.querySelector("#feed-notice");
const count = document.querySelector("#item-count");

function setConnection(status, error = null) {
  const online = status === "connected";
  liveDot.className = `live-dot ${online ? "online" : status === "offline" ? "offline" : ""}`;
  statusText.textContent = status.toUpperCase();
  connectionLabel.textContent = online ? "LIVE REPOSITORY FEED" : status === "stale" ? "FEED STALE · RETRYING" : "CONNECTING TO REPOSITORY";
  notice.className = error ? "notice error" : "notice";
  notice.textContent = error || (online ? "Streaming public repository activity. New snapshots arrive about every 30 seconds." : "Waiting for a verified public repository snapshot…");
}

function relativeTime(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Time unavailable";
  return date.toLocaleString();
}

function renderFeed(feed) {
  setConnection(feed.status ?? "connected", feed.error ?? null);
  updatedText.textContent = feed.generated_at ? `Updated ${relativeTime(feed.generated_at)}` : "Waiting for first snapshot";
  const items = Array.isArray(feed.items) ? feed.items : [];
  count.textContent = `${items.length} events`;
  timeline.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No public activity in the current window. The workshop is quiet.";
    timeline.append(empty);
    return;
  }
  for (const item of items) {
    const li = document.createElement("li");
    li.dataset.status = item.status ?? "info";
    const top = document.createElement("div");
    top.className = "event-top";
    const title = document.createElement(item.url ? "a" : "span");
    title.className = "event-title";
    title.textContent = item.title;
    if (item.url) {
      title.href = item.url;
      title.target = "_blank";
      title.rel = "noopener noreferrer";
    }
    const kind = document.createElement("span");
    kind.className = "event-kind";
    kind.textContent = item.kind;
    const time = document.createElement("time");
    time.className = "event-time";
    time.textContent = relativeTime(item.timestamp);
    if (item.timestamp) time.dateTime = item.timestamp;
    top.append(title, kind, time);
    const detail = document.createElement("div");
    detail.className = "event-detail";
    detail.textContent = item.detail;
    li.append(top, detail);
    timeline.append(li);
  }
}

async function loadSnapshot() {
  try {
    const response = await fetch("/api/feed", { cache: "no-store" });
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
    renderFeed(await response.json());
  } catch (error) {
    setConnection("offline", error.message);
  }
}

const stream = new EventSource("/api/stream");
stream.addEventListener("feed", event => {
  try { renderFeed(JSON.parse(event.data)); }
  catch { setConnection("stale", "The feed sent an unreadable update. Reconnecting."); }
});
stream.onerror = () => {
  setConnection("stale", "Live stream interrupted. The browser will reconnect automatically.");
};

document.querySelector("#refresh-button").addEventListener("click", loadSnapshot);
loadSnapshot();
setInterval(() => {
  if (stream.readyState !== EventSource.OPEN) loadSnapshot();
}, 45_000);
