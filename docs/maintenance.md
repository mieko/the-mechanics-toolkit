# Maintaining patches across Codex updates

Codex Desktop updates replace the packaged implementation that these transforms recognize. Treat
every new version and build as unsupported until the selected patch fleet has been examined against
it.

For each carried patch:

1. inspect the current upstream owner and the behavior visible to the user;
2. retire the local implementation when upstream now satisfies its contract;
3. port the transform and refresh its exact anchors when the repair is still needed;
4. stop when ownership moved and the new seam is not yet understood;
5. run focused probes and the complete selected fleet against a pristine staged copy;
6. perform narrow live checks before treating the rebuilt application as accepted.

Do not loosen an anchor until it happens to match or treat a green transform as proof of behavior.
Compatibility evidence belongs in the patch README and [extraction ledger](extraction-ledger.md),
including the exact application version and build that were inspected.

State words in the maintenance records are dispositions, not marketing promises:

- **Active** — the repair still earns its cost on the current qualified build;
- **Benched** — retained machinery has no configured job;
- **Upstream-owned** — stock Codex now satisfies the accepted contract, so the local transform is
  dormant;
- **Infrastructure** — a supporting seam with no user-facing behavior of its own.

An upstream-owned patch is useful history and a regression oracle, not part of the default staging
fleet. A benched patch should remain excluded until a real job justifies reactivating it.
