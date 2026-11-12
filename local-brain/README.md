# Graves Local Brain

This local bridge lets the hosted 3D town talk to an Ollama model running on **your own computer**. The website never receives an Ollama credential and public visitors cannot use your local bridge.

## Requirements
- Windows 10/11
- Node.js 20+
- Ollama installed and running
- A local model (default: qwen3.5:4b)

## Start it
1. Pull the model if it is not installed:
   ```powershell
   ollama pull qwen3.5:4b
   ```
2. Start the bridge from the repository root:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\local-brain\start.ps1
   ```
3. Leave that terminal open. Visit the [3D world](https://gpv74yhpnf-stack.github.io/graves-world/) on the **same computer** and press **Talk**.

The bridge listens only on 127.0.0.1:8787. Ollama is expected at 127.0.0.1:11434. To use another model, set $env:OLLAMA_MODEL before running the start script.

## What works
- In-world chat with the local Ollama model.
- Current town location and a small amount of public character state are supplied as context.
- An explicit action turns the discussion into a structured build proposal.
- Proposals are appended to %LOCALAPPDATA%\GravesPrivateMind\proposals\build-proposals.jsonl (or ~/.graves-world/proposals/ outside Windows).

## Important boundaries
- Chat history lives in the open browser tab only. Refreshing or closing the tab clears it.
- A proposal is saved locally for review. It does not edit source code, publish to GitHub, alter Graves' live mind, or change the public town.
- The private vault bootstrap currently sets Windows folder access controls; it does not itself encrypt the vault. Use Windows Device Encryption/BitLocker and an encrypted backup for stronger protection.
- The bridge binds to loopback and checks browser origins. Do not change it to listen on 0.0.0.0 or expose port 8787 to the internet.
- Visitor messages and world context are untrusted. The model cannot perform privileged actions through this bridge.
- This is the first conversation bridge, not yet a full autonomous world editor.

## Troubleshooting
- If Ollama is unavailable, open the Ollama app and run ollama list.
- If the model is missing, run ollama pull qwen3.5:4b.
- Keep the PowerShell bridge window open.
- If the browser blocks the local connection, use the official HTTPS GitHub Pages site and check that the bridge is running.
