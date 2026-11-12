# Graves Workshop Live Feed v1

**Status:** Local read-only prototype  
**Branch:** `graves-v2/workshop-live-feed`  
**Runtime:** Node.js 20+ recommended; no third-party packages required.

## Run locally

From the repository root:

```powershell
npm run workshop
```

Open http://127.0.0.1:4317. Stop the server with Ctrl+C. Set `GRAVES_WORKSHOP_PORT` only if the server's host allowlist is updated to match.

## What it displays

The local service polls the public GitHub API about every 30 seconds for repository events, commits on this development branch, pull requests, and Actions runs. The browser receives snapshots over Server-Sent Events (SSE), with a simple HTTP snapshot endpoint as a fallback.

## Security boundary

- Binds only to IPv4 loopback (127.0.0.1).
- Allows only localhost host headers on the configured port.
- GET-only routes; no write, merge, issue, deployment, or state mutation endpoint.
- Uses unauthenticated public GitHub metadata. No token, model key, private vault path, or visitor offering body is read.
- Projects a narrow allowlist of event metadata. Comment bodies, issue bodies, and raw API payloads are not forwarded.
- Browser rendering uses text nodes, not HTML injection.
- Content Security Policy restricts scripts, styles, and connections to this local origin.
- GitHub API rate limits or outages leave the last successful snapshot visible as stale; errors are shown without discarding cached items.

This is an observability prototype, not an authenticated operator console. It does not control or pause the external brain. A true operator pause switch must be implemented inside the private runtime and must fail closed.

## Next gates

1. Add branch-aware GitHub webhook ingestion with signature verification, durable event IDs, replay protection, and no public write surface.
2. Add authenticated private-runtime health and run records without exposing the private event payloads.
3. Add a real pause control only after the runtime's authoritative execution boundary is located and tested.
4. Add encrypted backup/restore status and a proposal approval queue.
5. Keep public state projection explicit, allowlisted, and separately approved.

## Validation

```powershell
npm test
npm run validate:state
```
