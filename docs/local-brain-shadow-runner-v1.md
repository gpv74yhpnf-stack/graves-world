# Local Brain Shadow Runner v1

The shadow runner connects the proposal-only orchestrator to Ollama on the same
computer. It reads the latest imported public snapshot from the private event
store and writes its run and proposal records back to that store.

It does not poll visitor inboxes, pass raw visitor submissions to the model,
execute proposals, write public state, or print proposal contents. It refuses
to use a store inside the repository. The Ollama adapter permits only HTTP
loopback URLs and sends fixed trusted instructions in a separate system
message from the serialized context.
Thinking output is disabled and the generated response is capped at 2,048
tokens to keep the shadow run focused on structured proposals. The model sees
only day, time, weather, location, needs, and character-sheet fields from the
snapshot. It does not receive snapshot memories, visitor records, pending
offerings, journal entries, or thoughts. Ollama is constrained to at most three
short memory or journal proposals.

## Requirements

- Node.js 20 or newer.
- Ollama installed and running locally.
- A local model already installed in Ollama.
- An initialized private event store containing a validated
  `mind.public_snapshot_imported` event.

Set the model name in PowerShell and start a shadow turn:

```powershell
$env:GRAVES_OLLAMA_MODEL = "your-installed-model"
npm run brain:shadow
```

The default store is `%LOCALAPPDATA%\GravesPrivateMind` on Windows. To use a
different private store, set `GRAVES_PRIVATE_STORE` to an existing directory
outside the repository. The runner validates the event hash chain before
choosing the most recently imported snapshot. It writes only private brain-run
events and reports counts, never proposal text.

This is an initial shadow runtime. It uses the public snapshot already imported
into the private store as its context. It intentionally has no visitor inbox,
private-note retrieval, approval service, or action executor. A shadow run
cannot update the authoritative private mind or public town state.
