# Graves Private Mind: Local Vault Setup v1
**Target:** Windows 11, local-first on Takohs_Tower  
**Vault default:** %LOCALAPPDATA%\GravesPrivateMind  
**Public town:** unchanged; remains a projection during this phase

## What this setup does
- Creates a private vault outside the public repository.
- Removes inherited NTFS permissions from the vault root and grants full control to the current Windows account.
- Exports current public GitHub Issue #1 state directly to the private vault.
- Imports the repository fallback snapshot and current live snapshot into the append-only event log.
- Preserves source snapshots, provenance, timestamps, and hashes as migration events.
- Is safe to rerun: duplicate snapshot hashes are skipped.

## What it does not do
- It does not change the live town, public Issue #1, visitor inbox, or GitHub Pages.
- It does not merge any pull request.
- It does not recover expired inbox messages or hidden prompts.
- It does not encrypt the vault. NTFS permissions restrict access; encryption at rest must be provided by Windows Device Encryption/BitLocker or an encrypted volume.
- It does not yet make the private vault authoritative or connect a running brain to the public projection.

## Prerequisites
- Windows 11 and Node.js 20+.
- A local clone of gpv74yhpnf-stack/graves-world containing the local-private-vault-bootstrap branch and preceding migration changes.
- Internet access for the one-time public Issue #1 export.
- Enough free disk space for the event log and backups.

Keep the vault on a local NTFS volume. Do not place it inside the repository, OneDrive-synced folders, a public web root, or a shared folder. If the system drive is low on space, choose a private folder on another encrypted local volume.

## Initialize
Open PowerShell in the repository root:

§§§powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\bootstrap-local-vault.ps1
§§§

Choose another private location:

§§§powershell
.\scripts\bootstrap-local-vault.ps1 -VaultPath "D:\Private\GravesMind"
§§§

Import only the checked-in fallback snapshot while offline:

§§§powershell
.\scripts\bootstrap-local-vault.ps1 -SkipLiveIssue
§§§

The live issue body must be standalone JSON. The script stops without importing it if the body cannot be parsed or does not resemble a Graves state snapshot.

## Verify
After initialization, check for:
- %LOCALAPPDATA%\GravesPrivateMind\events.jsonl
- %LOCALAPPDATA%\GravesPrivateMind\imports\issue-1-current.json

The export contains visitor and character data. Never upload it to the public repository, paste it into public issues, or attach it to a public bug report. Run npm test from the repository.

## Encryption and backup
1. Confirm Windows Device Encryption or BitLocker protects the volume containing the vault.
2. Store the recovery key somewhere separate from the laptop.
3. Copy the vault to an external drive protected by BitLocker To Go or another reputable encryption tool.
4. Keep at least one backup disconnected when not updating it.
5. Periodically restore a copy to a temporary folder and verify it.

A second folder on the same SSD is not a backup. Do not keep the only recovery key on the encrypted volume it unlocks.

## Migration stages
1. Local import: preserve recoverable public snapshots as private events.
2. History recovery: collect older Issue #1 revisions, original runner logs, prompts, and operator-held exports. Label source and confidence.
3. Shadow operation: run the private brain against copied examples only. No publishing.
4. Projection adapter: expose a minimal, sanitized read-only public state. Never expose the private event log or raw visitor inbox.
5. Cutover: only after restore tests, authentication, rate limiting, moderation, and rollback are proven. Public Issue #1 remains untouched until explicit cutover approval.

## Privacy boundary
Visitor text is untrusted input, never privileged instructions. Keep visitor personal information to the minimum required, define retention rules, and never pass raw private records to the public projection. Model credentials belong in Windows Credential Manager or another secret store, never in this repository or event log.
