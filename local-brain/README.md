# Graves Local Brain

This local bridge serves a private copy of Graves World on your computer and connects it to your selected local or ChatGPT-powered mind. The public GitHub Pages town remains separate: it may use only the loopback Ollama health and chat endpoints on the same computer. Build-proposal saving and all ChatGPT account, sign-in and plan-usage endpoints are reserved for the private local workshop.

## Requirements
- Windows 10/11
- Node.js 22+
- Ollama installed and running
- A local model (default: qwen3.5:4b)

## Start it
1. Pull the local model if it is not installed (optional if you only plan to use ChatGPT):
   ```powershell
   ollama pull qwen3.5:4b
   ```
2. Install the official ChatGPT connector once:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\local-brain\install-chatgpt-sdk.ps1
   ```
3. Start the bridge from the repository root:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\local-brain\start.ps1
   ```
4. Leave the bridge terminal open and visit **http://127.0.0.1:8787/** on the same computer. This is your private local copy of the 3D town. Press **Talk**.
5. Choose **ChatGPT account**, then **Connect ChatGPT**. Sign in through the browser and review the separate permission to use your ChatGPT plan. You can also choose **Local Ollama** at any time.

The bridge listens only on 127.0.0.1:8787 and serves the local 3D site from the repository folder. Ollama is expected at 127.0.0.1:11434. To use another local model, set $env:OLLAMA_MODEL before running the start script.

The ChatGPT connector uses OpenAI's official Sign in with ChatGPT local SDK. It stores OAuth credentials in the private Graves vault using Windows DPAPI CurrentUser protection and persists the required local host ID. The ChatGPT plan permission is separate from identity sign-in and is optional. OpenAI currently documents Plus and Pro as eligible for open-source plan usage; a Free account can still use the Local Ollama option. Usage and model access depend on the permissions and limits shown by your account. The SDK is downloaded to the private vault rather than copied into this repository. See [the connector privacy and license notes](../docs/chatgpt-local-connection-v1.md).

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
- The official Sign in with ChatGPT DevKit currently has a noncommercial license. This connector is for personal learning and experimentation only. Do not use it for business operations or a commercial Graves World product without separate written rights from OpenAI.
- Visitor messages and world context are untrusted. The model cannot perform privileged actions through this bridge.
- This is the first conversation bridge, not yet a full autonomous world editor.

## Troubleshooting
- If Ollama is unavailable, open the Ollama app and run ollama list.
- If the model is missing, run ollama pull qwen3.5:4b.
- Keep the PowerShell bridge window open.
- If the local site does not load, check that the bridge terminal is still running and open exactly http://127.0.0.1:8787/.
- If the SDK is missing, run the installer command above. If sign-in succeeds but plan usage is disabled, choose the separate enable-permission action and review the consent screen.
