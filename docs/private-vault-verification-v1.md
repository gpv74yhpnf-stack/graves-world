# Private Vault Verification

Run this after bootstrap and after any restore operation. The verifier reads the complete event log using the same validation path as the memory engine. It checks JSONL parsing, contiguous sequence numbers, genesis linkage, previous-event hashes, and each SHA-256 event hash.

From the repository root in PowerShell:

```powershell
node scripts/verify-private-vault.mjs
```

The default store is `%LOCALAPPDATA%\GravesPrivateMind`. To verify a copied or restored vault:

```powershell
node scripts/verify-private-vault.mjs --store "D:\GravesBackup\GravesPrivateMind"
```

A successful report has `"verification": "passed"` and summarizes event metadata plus imported snapshot source labels and hashes. It deliberately does not print the private state payloads.

A failed report exits with code 1. Preserve the original vault and investigate the reported error; do not edit or truncate `events.jsonl` to make verification pass.

This verifies integrity consistency, not authenticity or encryption. The hash chain is not signed, and a person with write access could rebuild it. Keep device encryption, an independently encrypted backup, and a tested restore as separate acceptance requirements.
