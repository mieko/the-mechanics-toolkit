# Maintaining patches across Codex updates

Codex Desktop updates replace the packaged implementation that its transforms recognize and may
also change the bundled open-source Codex revision. Treat every new version and build as unsupported
until the selected desktop and source patch fleets have been examined against it.

When the vendor artifact for an offered update is available, perform this work before interrupting
the current Codex. Keep the vendor artifact untouched, stage the patched candidate outside
`/Applications`, and defer the one quit-and-relaunch seam until static proof is complete. Follow
[preparing a patched Codex update](update-workflow.md); do not install a second live application
with the same bundle identity.

For each carried patch, first identify whether its owner is the desktop package under `patches/` or
the App Server/Core source under `source-patches/`. A source repair may require both a new Rust port
and its stable desktop binary-integration step.

Then:

1. inspect the current upstream owner and the behavior visible to the user;
2. retire the local implementation when upstream now satisfies its contract;
3. port the transform and refresh its exact anchors when the repair is still needed;
4. stop when ownership moved and the new seam is not yet understood;
5. for source patches, run the focused Rust tests and build the exact bundled CLI version;
6. run focused probes and the complete selected desktop fleet against a pristine staged copy;
7. perform narrow live checks before treating the rebuilt application as accepted.

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
