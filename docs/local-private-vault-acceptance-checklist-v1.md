# Graves Private Vault: Acceptance Checklist
Do not declare the private mind authoritative until every required item is checked.

## Local installation
- [ ] Vault path is outside the public repository and public web roots.
- [ ] NTFS ACL grants access only to the intended Windows account and required system principals.
- [ ] Device Encryption/BitLocker protects the volume.
- [ ] Live Issue #1 snapshot was exported and parsed, or missing source is explicitly documented.
- [ ] Repository fallback and live snapshot imports are present with source labels and hashes.
- [ ] Re-running import skips duplicates.

## Integrity and recovery
- [ ] npm test passes on the installed branch.
- [ ] Event log verifies from genesis through the latest event.
- [ ] Encrypted backup exists on a separate device.
- [ ] Recovery key is stored separately.
- [ ] Restore to a temporary location has been tested successfully.

## Brain safety
- [ ] Model adapter runs locally or through an explicitly selected provider.
- [ ] Visitor content is isolated as untrusted data.
- [ ] Unknown actions are rejected.
- [ ] Operator approvals are authenticated server-side, not trusted from caller-supplied JSON.
- [ ] Private API binds to loopback by default and requires authentication for non-local access.
- [ ] Pause/kill switch and structured error logs exist.
- [ ] Shadow runs cannot publish or mutate the public town.

## Public projection and cutover
- [ ] Public projection contains only explicitly allowlisted fields.
- [ ] No raw visitor inbox, private notes, credentials, or event log is exposed.
- [ ] Public site reads projection without write access to the private store.
- [ ] Rate limiting, input validation, abuse controls, and retention are active.
- [ ] Rollback to the last known public snapshot is documented and tested.
- [ ] Operator explicitly approves cutover.
