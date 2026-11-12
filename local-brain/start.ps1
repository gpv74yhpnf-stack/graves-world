$ErrorActionPreference = "Stop"
if (-not $env:OLLAMA_MODEL) { $env:OLLAMA_MODEL = "qwen3.5:4b" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required. Install Node.js 20 or newer." }
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { throw "Ollama is required. Install it and make sure it is running." }
Write-Host "Checking for model $env:OLLAMA_MODEL ..."
ollama list
Write-Host "Starting Graves local brain. Keep this window open while using the 3D world."
node "$PSScriptRoot\server.mjs"
