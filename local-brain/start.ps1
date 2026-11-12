$ErrorActionPreference = "Stop"
if (-not $env:OLLAMA_MODEL) { $env:OLLAMA_MODEL = "qwen3.5:4b" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required. Install Node.js 22 or newer." }
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { throw "Ollama is required. Install it and make sure it is running." }
Write-Host "Checking for model $env:OLLAMA_MODEL ..."
ollama list
Write-Host "Starting Graves local brain and private 3D workshop."
Write-Host "Open http://127.0.0.1:8787/ in this browser on this computer."
Write-Host "For ChatGPT account mode, run local-brain\install-chatgpt-sdk.ps1 once before connecting."
node "$PSScriptRoot\server.mjs"
