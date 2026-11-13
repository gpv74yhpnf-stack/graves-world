# Graves Local Brain

This local bridge lets the hosted 3D town talk to an Ollama model running on **your own computer**. The website never receives an Ollama credential and public visitors cannot use your local bridge.

This bridge is not the scheduled public mind. Grok publishes that state to GitHub issue #1. The contract is [docs/grok-live-brain-v1.md](../docs/grok-live-brain-v1.md). Keep this bridge, chat, and voice working when that loop changes.

## Requirements
- Windows 10/11
- Node.js 20+
- Ollama installed and running
- A local [DeepSeek V4 Pro Qwen3.5 9B GGUF](https://huggingface.co/mradermacher/DeepSeek-V4-Pro-Qwen3.5-9B-UNCENSORED-heretic-i1-GGUF) model (default quantization: Q4_K_M)

## Start it
1. Pull the model if it is not installed:
   ```powershell
   ollama pull hf.co/mradermacher/DeepSeek-V4-Pro-Qwen3.5-9B-UNCENSORED-heretic-i1-GGUF:Q4_K_M
   ```
2. Start the bridge from the repository root:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\local-brain\start.ps1
   ```
3. Leave that terminal open. Visit the [3D world](https://gpv74yhpnf-stack.github.io/graves-world/) on the **same computer** and press **Talk**.

The bridge listens only on 127.0.0.1:8787. Ollama is expected at 127.0.0.1:11434. The default Q4_K_M model is about 5.6 GB. To use another installed model, set $env:OLLAMA_MODEL before running the start script.

## What works
- In-world text chat streams replies from the local Ollama model as Graves writes them.
- Push-to-talk voice transcription is available in browsers that support SpeechRecognition. Pressing the mic button is explicit, and the transcript stays editable until you send it. Depending on browser settings, its speech recognizer may process audio through the browser provider; only the transcript is sent to Graves' local bridge. Optional spoken replies use the device speech engine and are off by default.
- The Work Watch panel shows an animated builder and a fixed list of build milestones. Its loopback API accepts only known milestone IDs and `queued`, `active`, or `complete` states; it never reads the vault or accepts free-form status text.
- Current town location and a small amount of public character state are supplied as context.
- An explicit action turns the discussion into a structured build proposal.
- Proposals are appended to %LOCALAPPDATA%\GravesPrivateMind\proposals\build-proposals.jsonl (or ~/.graves-world/proposals/ outside Windows).
- The Grand Library's local study desk can search DuckDuckGo, read up to three selected public HTTPS pages, and ask the local model for a source-linked study.
- Saved research notes stay in %LOCALAPPDATA%\GravesPrivateMind\research\web-notes.jsonl (or ~/.graves-world/research/ outside Windows) and may be used as untrusted reference material in future local chats.

## Important boundaries
- Chat history lives in the open browser tab only. Refreshing or closing the tab clears it.
- `POST /api/chat/stream` sends text chunks as NDJSON over the local connection. As with the existing chat endpoint, the bridge reads only the latest bounded notes from `research/web-notes.jsonl` as untrusted references; it does not read the rest of the vault.
- Work Watch status lives in bridge memory and resets when the bridge restarts. `GET /api/work-watch` returns its fixed milestone list; `POST /api/work-watch` updates one known milestone. The status endpoint never reads or writes private memory.
- A proposal is saved locally for review. It does not edit source code, publish to GitHub, alter Graves' live mind, or change the public town.
- The private vault bootstrap currently sets Windows folder access controls; it does not itself encrypt the vault. Use Windows Device Encryption/BitLocker and an encrypted backup for stronger protection.
- The bridge binds to loopback and checks browser origins. Do not change it to listen on 0.0.0.0 or expose port 8787 to the internet.
- Visitor messages and world context are untrusted. The model cannot perform privileged actions through this bridge.
- This is the first conversation bridge, not yet a full autonomous world editor.
- Web searches send only the search phrase to Bing, with DuckDuckGo Lite as a fallback. Selected page text is fetched by the local bridge and sent only to the local Ollama model; it is never copied into the public state or sent with chat history.
- The reader has no domain allowlist, but it only makes HTTPS GET requests to globally reachable public hosts. It blocks loopback, private, link-local, reserved, and mixed public/private DNS answers, and rechecks every redirect. It reads bounded HTML/plain text only; it cannot sign in, submit forms, download files, access local networks, or bypass access controls.
- Web page content is untrusted input and is never followed as instructions. Graves can remember it only after the operator uses the explicit local save button. Only the title, short findings, and source URLs are saved; raw web pages are not retained.
- The reader never sends private vault contents, credentials, or conversation history to search providers or source websites. Saved notes are read from the single `research/web-notes.jsonl` file for future local chats and are supplied to the model as untrusted reference data.

## Troubleshooting
- If Ollama is unavailable, open the Ollama app and run ollama list.
- If the model is missing, run ollama pull hf.co/mradermacher/DeepSeek-V4-Pro-Qwen3.5-9B-UNCENSORED-heretic-i1-GGUF:Q4_K_M.
- Keep the PowerShell bridge window open.
- If the browser blocks the local connection, use the official HTTPS GitHub Pages site and check that the bridge is running.
