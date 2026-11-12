[CmdletBinding()]
param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$VaultPath = (Join-Path $env:LOCALAPPDATA "GravesPrivateMind"),
  [switch]$SkipLiveIssue
)
$ErrorActionPreference = "Stop"
function Assert-OutsideRepository([string]$Candidate, [string]$Repo) {
  $candidateFull = [IO.Path]::GetFullPath($Candidate).TrimEnd('\')
  $repoFull = [IO.Path]::GetFullPath($Repo).TrimEnd('\')
  if ($candidateFull.Equals($repoFull, [StringComparison]::OrdinalIgnoreCase) -or $candidateFull.StartsWith($repoFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "Vault path must be outside the public repository."
  }
}
if (-not (Test-Path -LiteralPath $RepositoryRoot -PathType Container)) { throw "RepositoryRoot does not exist: $RepositoryRoot" }
$RepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
Assert-OutsideRepository $VaultPath $RepositoryRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js 20+ was not found. Install Node.js and retry." }
$nodeVersion = (& node --version).Trim()
if ($LASTEXITCODE -ne 0) { throw "Could not run Node.js." }
New-Item -ItemType Directory -Force -Path $VaultPath | Out-Null
$VaultPath = (Resolve-Path -LiteralPath $VaultPath).Path
Assert-OutsideRepository $VaultPath $RepositoryRoot
# Restrict inherited NTFS access to the current Windows account.
# This is access control, not encryption. Enable BitLocker/device encryption separately.
$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = Get-Acl -LiteralPath $VaultPath
$acl.SetAccessRuleProtection($true, $false)
foreach ($existingRule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($existingRule) }
$rule = New-Object Security.AccessControl.FileSystemAccessRule(
  $currentSid,
  [Security.AccessControl.FileSystemRights]::FullControl,
  ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),
  [Security.AccessControl.PropagationFlags]::None,
  [Security.AccessControl.AccessControlType]::Allow
)
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $VaultPath -AclObject $acl
$exports = Join-Path $VaultPath "imports"
New-Item -ItemType Directory -Force -Path $exports | Out-Null
$issueExport = Join-Path $exports "issue-1-current.json"
$repoSnapshot = Join-Path $RepositoryRoot "state.json"
if (-not (Test-Path -LiteralPath $repoSnapshot -PathType Leaf)) { throw "Expected fallback snapshot not found: $repoSnapshot" }
$snapshotArgs = @("--store", $VaultPath, "--snapshot", "repository-fallback=$repoSnapshot")
if (-not $SkipLiveIssue) {
  Write-Host "Retrieving current public Issue #1 snapshot..."
  $headers = @{ "User-Agent" = "Graves-Private-Mind-Migration"; "Accept" = "application/vnd.github+json" }
  $issue = Invoke-RestMethod -Uri "https://api.github.com/repos/gpv74yhpnf-stack/graves-world/issues/1" -Headers $headers
  if (-not $issue.body) { throw "Issue #1 returned an empty body. Nothing was imported." }
  $bodyText = [string]$issue.body
  # Issue #1 is explanatory Markdown followed by a fenced JSON state block.
  # Extract the fenced block rather than parsing the entire Markdown body.
  $fenceMatches = [regex]::Matches($bodyText, '(?s)\x60{3}(?:json)?\s*(.*?)\s*\x60{3}')
  if ($fenceMatches.Count -gt 0) {
    $jsonText = $fenceMatches[$fenceMatches.Count - 1].Groups[1].Value.Trim()
  } else {
    $jsonText = $bodyText.Trim()
  }
  try { $stateObject = $jsonText | ConvertFrom-Json -ErrorAction Stop }
  catch { throw "Could not parse a JSON state snapshot from Issue #1. No live snapshot was imported. Inspect the issue body manually." }
  if (-not $stateObject.updated -or -not $stateObject.sheet -or -not $stateObject.needs -or -not $stateObject.memories) {
    throw "Issue #1 JSON is missing expected Graves state fields (updated, sheet, needs, memories). Nothing was imported."
  }
  [IO.File]::WriteAllText($issueExport, $jsonText, (New-Object System.Text.UTF8Encoding($false)))
  Push-Location $RepositoryRoot
  try {
    & node "scripts/state-contract.mjs" $issueExport
    if ($LASTEXITCODE -ne 0) { throw "Issue #1 snapshot failed the Graves state contract. Nothing was imported." }
  } finally { Pop-Location }
  $snapshotArgs += @("--snapshot", "live-issue-current=$issueExport")
} else {
  Write-Warning "Skipped live Issue #1 export. Only repository state.json will be imported."
}
Write-Host "Importing validated snapshots into the private local event store..."
Push-Location $RepositoryRoot
try {
  & node "src/memory/import-public-snapshots.mjs" @snapshotArgs
  if ($LASTEXITCODE -ne 0) { throw "Snapshot import failed with exit code $LASTEXITCODE." }
} finally { Pop-Location }
$log = Join-Path $VaultPath "events.jsonl"
if (-not (Test-Path -LiteralPath $log -PathType Leaf)) { throw "Import reported success but event log was not found." }
Write-Host ""
Write-Host "Private vault initialized: $VaultPath" -ForegroundColor Green
Write-Host "Node: $nodeVersion"
Write-Host "Event log: $log"
Write-Host "Live snapshot export: $(if (Test-Path $issueExport) { $issueExport } else { 'not requested' })"
Write-Warning "The vault is access-controlled, not encrypted by this script. Confirm BitLocker/device encryption and create a separate encrypted backup before treating it as authoritative."
