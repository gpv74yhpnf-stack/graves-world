import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";

const PRIMARY_SEARCH_ENDPOINT = "https://www.bing.com/search";
const FALLBACK_SEARCH_ENDPOINT = "https://lite.duckduckgo.com/lite/";
const MAX_HTML_BYTES = 600_000;
const MAX_PAGE_TEXT = 12_000;
const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 15_000;
const SEARCH_RESULTS_LIMIT = 8;

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".test", ".invalid", ".onion"];

function ipv4IsPublic(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function ipv6Groups(address) {
  let value = address.toLowerCase();
  if (value.includes(".")) {
    const colon = value.lastIndexOf(":");
    const ipv4 = value.slice(colon + 1);
    if (!ipv4IsPublic(ipv4)) return null;
    const [a, b, c, d] = ipv4.split(".").map(Number);
    value = `${value.slice(0, colon)}:${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right].map(part => Number.parseInt(part || "0", 16));
  return groups.length === 8 && groups.every(part => Number.isInteger(part) && part >= 0 && part <= 0xffff) ? groups : null;
}

export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return ipv4IsPublic(address);
  if (family !== 6 || address.includes("%")) return false;
  const groups = ipv6Groups(address);
  if (!groups) return false;
  const mapped = groups.slice(0, 5).every(part => part === 0) && groups[5] === 0xffff;
  if (mapped) {
    return ipv4IsPublic(`${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`);
  }
  // Research is limited to globally routed unicast space. Exclude documentation,
  // transition, and IETF special-purpose ranges even when they look routable.
  if ((groups[0] & 0xe000) !== 0x2000) return false;
  if (groups[0] === 0x2001 && (groups[1] <= 0x01ff || groups[1] === 0x0db8)) return false; // IETF special use and documentation
  if (groups[0] === 0x2002) return false; // 6to4 embeds another address
  if (groups[0] === 0x3fff && groups[1] <= 0x0fff) return false; // documentation prefix
  return true;
}

function bareHostname(hostname) {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

export function normalizePublicUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete public HTTPS web address.");
  }
  const hostname = bareHostname(url.hostname).toLowerCase().replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    !hostname ||
    (!isIP(hostname) && !hostname.includes(".")) ||
    url.username ||
    url.password ||
    url.port ||
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))
  ) {
    throw new Error("Only public HTTPS web pages can be read.");
  }
  if (!isIP(hostname)) url.hostname = hostname;
  if (isIP(hostname) && !isPublicAddress(hostname)) {
    throw new Error("That address is not on the public internet.");
  }
  url.hash = "";
  return url;
}

async function resolvePublicAddresses(hostname, resolver) {
  const bare = bareHostname(hostname);
  if (isIP(bare)) {
    if (!isPublicAddress(bare)) throw new Error("That address is not on the public internet.");
    return [{ address: bare, family: isIP(bare) }];
  }
  let records;
  try {
    records = await resolver(bare, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not resolve that public website.");
  }
  if (!Array.isArray(records) || !records.length || records.some(record => !isPublicAddress(record.address))) {
    throw new Error("That website does not resolve only to public internet addresses.");
  }
  return records;
}

function requestHtml(url, addresses) {
  return new Promise((resolve, reject) => {
    const host = bareHostname(url.hostname);
    const safeLookup = (_hostname, options, callback) => {
      if (options?.all) callback(null, addresses);
      else {
        const picked = addresses[0];
        callback(null, picked.address, picked.family);
      }
    };
    const request = https.request(url, {
      method: "GET",
      agent: false,
      lookup: safeLookup,
      servername: isIP(host) ? undefined : host,
      headers: {
        "user-agent": "GravesWorldLocalResearch/1.0 (+public-web-reading)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
        "accept-encoding": "identity"
      }
    }, response => {
      const chunks = [];
      let byteLength = 0;
      const declaredLength = Number(response.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
        request.destroy(new Error("That page is larger than the reader's limit."));
        return;
      }
      response.on("data", chunk => {
        byteLength += chunk.length;
        if (byteLength > MAX_HTML_BYTES) {
          request.destroy(new Error("That page is larger than the reader's limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8")
      }));
      response.on("error", reject);
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("The page took too long to answer.")));
    request.on("error", reject);
    request.end();
  });
}

async function readHtml(value, { resolver, requester, allowFeed = false }) {
  let url = normalizePublicUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const addresses = await resolvePublicAddresses(url.hostname, resolver);
    const response = await requester(url, addresses);
    const location = response.headers?.location;
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      if (redirects === MAX_REDIRECTS) throw new Error("That page redirected too many times.");
      let next;
      try { next = new URL(location, url); } catch { throw new Error("That page returned an invalid redirect."); }
      url = normalizePublicUrl(next.href);
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`The page returned HTTP ${response.status}.`);
    const contentType = String(response.headers?.["content-type"] ?? "").toLowerCase();
    const htmlType = /^text\/(html|plain)|^application\/xhtml\+xml/.test(contentType);
    const feedType = allowFeed && /^(text\/xml|application\/(rss\+xml|xml))/.test(contentType);
    if (!htmlType && !feedType) {
      throw new Error("The reader only opens public HTML or plain-text pages.");
    }
    if (typeof response.body !== "string" || Buffer.byteLength(response.body, "utf8") > MAX_HTML_BYTES) {
      throw new Error("That page is larger than the reader's limit.");
    }
    return { url: url.href, html: response.body };
  }
  throw new Error("Could not read that page.");
}

function decodeEntities(text) {
  return String(text).replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
    if (!entity.startsWith("#")) return named[entity.toLowerCase()] ?? match;
    const code = entity[1]?.toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : " ";
  });
}

function readableText(html, maxLength = MAX_PAGE_TEXT) {
  const text = decodeEntities(String(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|canvas|iframe|form|nav|header|footer|template|button|select|textarea|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/article|\/section|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " "));
  return text.replace(/[\t\f\v ]+/g, " ").replace(/\r/g, "").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

function pageTitle(html) {
  const match = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = match ? readableText(match[1], 240) : "Untitled page";
  return title || "Untitled page";
}

function attribute(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "") : "";
}

function unwrapSearchUrl(href, base = FALLBACK_SEARCH_ENDPOINT) {
  try {
    const url = new URL(href, base);
    if ((url.hostname === "duckduckgo.com" || url.hostname === "html.duckduckgo.com") && url.pathname === "/l/") {
      return url.searchParams.get("uddg") ?? "";
    }
    return url.href;
  } catch {
    return "";
  }
}

export function parseSearchResults(html) {
  if (/<item\b[\s>]/i.test(String(html))) {
    const results = [];
    for (const item of String(html).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)) {
      const field = name => item[1].match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, "i"))?.[1] ?? "";
      const url = unwrapSearchUrl(field("link"), PRIMARY_SEARCH_ENDPOINT);
      let safeUrl;
      try { safeUrl = normalizePublicUrl(url).href; } catch { continue; }
      if (results.some(result => result.url === safeUrl)) continue;
      results.push({ title: readableText(field("title"), 240) || "Untitled result", url: safeUrl, snippet: readableText(field("description"), 500) });
      if (results.length >= SEARCH_RESULTS_LIMIT) break;
    }
    return results;
  }

  const results = [];
  const patterns = [
    /<a\b([^>]*\bclass\s*=\s*(?:"[^"]*\bresult__a\b[^"]*"|'[^']*\bresult__a\b[^']*')[^>]*)>([\s\S]*?)<\/a\s*>/gi,
    /<a\b([^>]*\bclass\s*=\s*(?:"[^"]*\bresult-link\b[^"]*"|'[^']*\bresult-link\b[^']*')[^>]*)>([\s\S]*?)<\/a\s*>/gi
  ];
  const matches = patterns.flatMap(pattern => [...String(html).matchAll(pattern)]).sort((a, b) => a.index - b.index);
  for (const match of matches) {
    const url = unwrapSearchUrl(attribute(match[1], "href"));
    let safeUrl;
    try { safeUrl = normalizePublicUrl(url).href; } catch { continue; }
    if (results.some(item => item.url === safeUrl)) continue;
    const rest = String(html).slice(match.index + match[0].length, match.index + match[0].length + 2400);
    const snippetMatch = rest.match(/<(a|div|td)\b([^>]*\bclass\s*=\s*(?:"[^"]*\b(result__snippet|result-snippet)\b[^"]*"|'[^']*\b(result__snippet|result-snippet)\b[^']*')[^>]*)>([\s\S]*?)<\/\1\s*>/i);
    results.push({
      title: readableText(match[2], 240) || "Untitled result",
      url: safeUrl,
      snippet: snippetMatch ? readableText(snippetMatch[5], 500) : ""
    });
    if (results.length >= SEARCH_RESULTS_LIMIT) break;
  }
  return results;
}

export function createWebResearch({ resolver = dnsLookup, requester = requestHtml } = {}) {
  if (typeof resolver !== "function" || typeof requester !== "function") {
    throw new Error("resolver and requester must be functions");
  }
  return Object.freeze({
    async search(query) {
      if (typeof query !== "string" || !query.trim() || query.trim().length > 200) {
        throw new Error("Enter a search phrase from 1 to 200 characters.");
      }
      const providers = [
        { endpoint: PRIMARY_SEARCH_ENDPOINT, params: { format: "rss", q: query.trim() }, allowFeed: true },
        { endpoint: FALLBACK_SEARCH_ENDPOINT, params: { q: query.trim() }, allowFeed: false }
      ];
      for (const provider of providers) {
        try {
          const endpoint = new URL(provider.endpoint);
          for (const [key, value] of Object.entries(provider.params)) endpoint.searchParams.set(key, value);
          const { html } = await readHtml(endpoint.href, { resolver, requester, allowFeed: provider.allowFeed });
          const results = parseSearchResults(html);
          if (results.length) return results;
        } catch {
          // Search providers can change or rate-limit this local reader; use the public fallback.
        }
      }
      throw new Error("Public search services are temporarily unavailable. Try again later.");
    },
    async read(value) {
      const { url, html } = await readHtml(value, { resolver, requester });
      return { title: pageTitle(html), url, text: readableText(html) };
    }
  });
}
