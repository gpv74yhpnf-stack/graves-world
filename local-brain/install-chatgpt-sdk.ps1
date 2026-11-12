$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is required to retrieve the official OpenAI Sign in with ChatGPT DevKit." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is required. Install Node.js 22 or newer." }

$vendorRoot = Join-Path $env:LOCALAPPDATA "GravesPrivateMind\vendor"
$sdkRoot = Join-Path $vendorRoot "sign-in-with-chatgpt-devkit"
$packageRoot = Join-Path $sdkRoot "packages\local"

New-Item -ItemType Directory -Force -Path $vendorRoot | Out-Null

if (-not (Test-Path (Join-Path $sdkRoot ".git"))) {
  git clone --depth 1 --filter=blob:none --sparse https://github.com/openai/sign-in-with-chatgpt-devkit.git $sdkRoot
  if ($LASTEXITCODE -ne 0) { throw "Could not download the official Sign in with ChatGPT DevKit." }
  git -C $sdkRoot sparse-checkout set packages/local
  if ($LASTEXITCODE -ne 0) { throw "Could not retrieve the local SDK package." }
} else {
  git -C $sdkRoot pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw "Could not update the official DevKit checkout safely." }
}

if (-not (Test-Path (Join-Path $packageRoot "package.json"))) { throw "The official local SDK package was not found." }

Write-Host "Installing the official local SDK dependencies..."
npm install --prefix $packageRoot --workspaces=false --no-save --include=dev typescript@^7.0.2 @types/node@^24.0.0
if ($LASTEXITCODE -ne 0) { throw "SDK dependency installation failed." }

$tsconfig = '{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","lib":["ES2022","DOM","DOM.Iterable"],"strict":true,"noUncheckedIndexedAccess":true,"forceConsistentCasingInFileNames":true,"skipLibCheck":true,"esModuleInterop":true,"verbatimModuleSyntax":true,"declaration":true,"sourceMap":true,"outDir":"./dist","rootDir":"./src","types":["node"]},"include":["src/**/*.ts"]}'
Set-Content -Path (Join-Path $packageRoot "tsconfig.graves.json") -Value $tsconfig -Encoding Ascii

Write-Host "Building the official local SDK..."
& (Join-Path $packageRoot "node_modules\.bin\tsc.cmd") -p (Join-Path $packageRoot "tsconfig.graves.json")
if ($LASTEXITCODE -ne 0) { throw "The official local SDK did not build." }

Write-Host "ChatGPT connector SDK is ready in the private local vendor folder."
Write-Host "No credentials have been requested or stored yet."
