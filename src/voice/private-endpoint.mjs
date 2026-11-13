/**
 * Only connect the public town to a private, user-controlled Graves bridge.
 * Tailscale Serve uses *.ts.net HTTPS names restricted to an authenticated
 * tailnet. This deliberately excludes Funnel, generic proxy URLs, and secrets.
 */
export function normalizePrivateBrainUrl(value) {
  if (typeof value !== "string") throw new Error("Enter the private bridge URL");
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a valid private bridge URL"); }
  if (url.username || url.password || url.search || url.hash ||
      (url.pathname !== "" && url.pathname !== "/")) {
    throw new Error("Use a URL origin only, without path, query, login or token");
  }
  const host = url.hostname.toLowerCase();
  const local = ["localhost", "127.0.0.1"].includes(host) &&
    url.protocol === "http:" &&
    (url.port === "" || url.port === "8787");
  const tailnet = host.endsWith(".ts.net") &&
    host.split(".").length >= 4 &&
    url.protocol === "https:" && !url.port;
  if (!local && !tailnet) {
    throw new Error("Use a localhost:8787 bridge or a private HTTPS Tailscale Serve URL (*.ts.net). Never use Funnel.");
  }
  return url.origin;
}
