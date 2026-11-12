# Graves World: Brain Orchestrator Foundation v1

**Status:** Offline orchestration prototype; no provider or live inbox connected  
**Branch:** `graves-v2/brain-orchestrator-foundation`

## What it does

The orchestrator provides one controlled path for a future brain turn:

1. Accept a structured current-state snapshot and pending offerings.
2. Pass trusted character instructions separately from untrusted context.
3. Call an injected model adapter.
4. Require a JSON response containing no more than 20 proposals.
5. Evaluate each proposal using the deny-by-default approval gate.
6. Append the turn, decisions, and completion/failure records to the private event log.
7. Return proposals for review. It does not execute them.

The provider is injected as `model.generate(request)`. This keeps model choice outside the character's identity and memory.

## Adapter contract

The adapter receives:

- `trustedInstructions`: fixed character and safety instructions.
- `context`: JSON data containing `current_state` and `pending_offerings`.
- `responseFormat`: expected structured response shape.

A real adapter must keep trusted instructions in the provider's privileged system/developer channel and pass visitor content only as untrusted data. Do not concatenate visitor offerings into privileged instructions. Do not expose API keys to the model or browser.

## Proposal response

The model returns:

```json
{
  "proposals": [
    {
      "id": "proposal-001",
      "action": "memory.propose",
      "summary": "Remember the third lantern needs checking",
      "payload": {
        "text": "The third lantern on Lantern Lane goes out first."
      }
    }
  ]
}
```

Every proposal is classified independently. Low-risk allowlisted proposals may be returned as allowed; sensitive proposals remain blocked pending authenticated operator approval; unknown actions are rejected.

## Run log

The private event store records:

- `brain.turn_started`
- `brain.proposal_evaluated` for each proposal
- `brain.turn_completed` or `brain.turn_failed`

Do not place the store in this public repository. Event payloads may contain visitor content and must remain private.

## Deliberate limits

- No Ollama, Grok, OpenAI, or other provider adapter is included.
- No scheduler, HTTP server, inbox polling, or live state writer is included.
- The orchestrator does not authenticate approval envelopes or execute approved proposals.
- A failure partway through event writes can leave a partial turn; use the event sequence to identify incomplete runs.
- It does not yet validate event-specific payload schemas or perform semantic moderation.
- The context must be prepared by a trusted runtime. It must not contain secrets or unnecessary personal information.

## Next integration gate

Before this can run autonomously, the private runtime must supply an authenticated model adapter, private store directory, offering moderation, pause switch, proposal review UI, encrypted backup, and an audited executor that rechecks approvals immediately before action. The original external runner should be identified before replacing it, so existing schedules and credentials are not disrupted.
