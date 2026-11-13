# Graves Local Web Research v1

**Status:** Implemented as an opt-in local feature
**Surface:** Grand Library panel in the 3D world
**Runtime:** Local Graves bridge at `127.0.0.1:8787` and local Ollama

## User flow

1. Walk to the Grand Library and open its public web browser.
2. Submit a search phrase. Only that phrase goes to Bing; DuckDuckGo Lite is used if Bing does not return results.
3. Choose up to three results. The local bridge fetches each selected page over HTTPS and asks the local model to study the page text.
4. Review the findings and source links. Saving is a separate, explicit action.
5. Saved short notes can ground future local conversations. They are not added to canonical character memory, the event log, or public town state.

## Request boundaries

- Search is opt-in and uses `POST /api/research/search`.
- Page reading and model synthesis use `POST /api/research/study` with only a question and selected public URLs. No transcript or world state is included.
- The reader accepts all public HTTPS domains without a domain allowlist. It rejects credentials in URLs, alternate ports, local/single-label names, non-global IP addresses, mixed public/private DNS responses, and unsafe redirect targets. DNS results are checked and pinned for the TLS request.
- It makes GET requests only, follows at most four revalidated redirects, accepts bounded HTML/plain text, and removes scripts, forms, navigation and other non-reading elements before the local model sees the page.
- It does not use cookies, sign in, submit forms, download files, bypass paywalls, execute page scripts, or access local/private networks.
- The model receives source titles, URLs and bounded page text as untrusted evidence in a separate request. Its structured findings must cite one or more selected source IDs. No tool actions are available during this step.
- `POST /api/research/save` stores only the operator-reviewed note in `research/web-notes.jsonl` under the configured private root. No raw page text is saved. Future chat reads only this one note file, uses the latest eight entries, and marks them as untrusted references.
- The bridge remains bound to loopback and retains its browser-origin check. The hosted 3D site contains only the UI, not a search credential or a remote research proxy.

## Limitations

This is a source reader, not a full browser engine: it does not render JavaScript-only pages or log in to websites. Search and reading can fail when a provider blocks automated requests, a site requires scripts, or the page is not public HTML/plain text. The operator can open a source in their ordinary browser to inspect it.

Public web content may be inaccurate or adversarial. Graves should distinguish direct source claims from inference and uncertainty; saved notes remain citations and context, not verified canonical memories.
