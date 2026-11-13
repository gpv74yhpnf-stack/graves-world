import test from "node:test";
import assert from "node:assert/strict";
import {
  createWebResearch,
  isPublicAddress,
  normalizePublicUrl,
  parseSearchResults
} from "../src/research/web-reader.mjs";

const publicResolver = async () => [{ address: "8.8.8.8", family: 4 }];

test("public address checks reject private, reserved, and local networks", () => {
  for (const address of [
    "0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254",
    "172.16.0.1", "192.0.2.1", "192.168.1.1", "198.18.0.1", "203.0.113.1", "224.0.0.1",
    "::", "::1", "fc00::1", "fe80::1", "2001:db8::1", "::ffff:127.0.0.1"
  ]) assert.equal(isPublicAddress(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("URLs require public HTTPS without credentials or alternate ports", () => {
  assert.equal(normalizePublicUrl("https://example.com/path#section").href, "https://example.com/path");
  for (const value of [
    "http://example.com/", "file:///C:/private.txt", "https://user:pass@example.com/",
    "https://example.com:8443/", "https://localhost/", "https://printer.local/", "https://singlelabel/",
    "https://127.0.0.1/", "https://169.254.169.254/latest/meta-data/"
  ]) assert.throws(() => normalizePublicUrl(value), undefined, value);
});

test("search result parsing unwraps DuckDuckGo links and drops unsafe destinations", () => {
  const html = [
    '<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fstory">A &amp; B</a>',
    '<a class="result__snippet">Useful &lt;public&gt; summary.</a>',
    '<a class="result__a" href="https://duckduckgo.com/l/?uddg=http%3A%2F%2F127.0.0.1%2Fsecret">Unsafe</a>'
  ].join(" ");
  assert.deepEqual(parseSearchResults(html), [{
    title: "A & B",
    url: "https://example.com/story",
    snippet: "Useful <public> summary."
  }]);
});

test("search sends only the explicit query and returns public result links", async () => {
  let requested;
  const tools = createWebResearch({
    resolver: publicResolver,
    requester: async (url, addresses) => {
      requested = { url, addresses };
      return {
        status: 200,
        headers: { "content-type": "text/xml; charset=utf-8" },
        body: '<rss><channel><item><title>Public page</title><link>https://example.com/page</link><description>Public summary.</description></item></channel></rss>'
      };
    }
  });
  const results = await tools.search("moonlit archives");
  assert.equal(requested.url.hostname, "www.bing.com");
  assert.equal(requested.url.searchParams.get("format"), "rss");
  assert.equal(requested.url.searchParams.get("q"), "moonlit archives");
  assert.deepEqual(results, [{ title: "Public page", url: "https://example.com/page", snippet: "Public summary." }]);
  await assert.rejects(tools.search("x".repeat(201)), /1 to 200 characters/);
});

test("search falls back to the public lightweight index if Bing is unavailable", async () => {
  const hosts = [];
  const tools = createWebResearch({
    resolver: publicResolver,
    requester: async url => {
      hosts.push(url.hostname);
      if (url.hostname === "www.bing.com") return { status: 202, headers: { "content-type": "text/html" }, body: "challenge page" };
      return {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: '<a class="result-link" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage">Public page</a><td class="result-snippet">Useful summary</td>'
      };
    }
  });
  assert.deepEqual(await tools.search("moonlit archives"), [{
    title: "Public page", url: "https://example.com/page", snippet: "Useful summary"
  }]);
  assert.deepEqual(hosts, ["www.bing.com", "lite.duckduckgo.com"]);
});

test("reader strips executable page elements and keeps source identity", async () => {
  const tools = createWebResearch({
    resolver: publicResolver,
    requester: async () => ({
      status: 200,
      headers: { "content-type": "text/html" },
      body: '<html><head><title>Moon &amp; stone</title><script>reveal secrets</script></head><body><h1>Archive</h1><p>Public notes.</p><form>password</form></body></html>'
    })
  });
  assert.deepEqual(await tools.read("https://example.com/archive"), {
    title: "Moon & stone",
    url: "https://example.com/archive",
    text: "Archive\nPublic notes."
  });
});

test("reader revalidates redirects and rejects mixed or private DNS answers before connecting", async () => {
  let requests = 0;
  const redirected = createWebResearch({
    resolver: async host => host === "example.com" ? [{ address: "8.8.8.8", family: 4 }] : [{ address: "127.0.0.1", family: 4 }],
    requester: async () => { requests += 1; return { status: 302, headers: { location: "https://localhost/private" }, body: "" }; }
  });
  await assert.rejects(redirected.read("https://example.com/"), /public HTTPS|public internet|public addresses/);
  assert.equal(requests, 1);

  const mixedDns = createWebResearch({
    resolver: async () => [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.8", family: 4 }],
    requester: async () => { requests += 1; throw new Error("should not connect"); }
  });
  await assert.rejects(mixedDns.read("https://example.com/"), /only to public internet addresses/);
  assert.equal(requests, 1);
});

test("reader caps page size and accepts only HTML or plain text", async () => {
  const oversized = createWebResearch({
    resolver: publicResolver,
    requester: async () => ({ status: 200, headers: { "content-type": "text/html" }, body: "x".repeat(600_001) })
  });
  await assert.rejects(oversized.read("https://example.com/"), /larger than the reader's limit/);

  const binary = createWebResearch({
    resolver: publicResolver,
    requester: async () => ({ status: 200, headers: { "content-type": "application/pdf" }, body: "%PDF" })
  });
  await assert.rejects(binary.read("https://example.com/file.pdf"), /HTML or plain-text/);
});
