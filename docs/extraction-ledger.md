# Extraction ledger

This repository is the canonical source for the portable patches recorded below. The ledger says
what crossed the extraction boundary and is the public fleet-wide qualification record: current
static and live evidence, explicitly carried earlier live evidence, and the next useful evidence
boundary. A next boundary strengthens or refreshes the record; it is not automatically a blocker to
the qualified build named below. Raw maintainer logs and receipts remain ignored local evidence.
Patch READMEs retain patch-specific behavioral evidence without duplicating this fast-changing
record. This ledger is not a promise to publish every historical experiment.

| Area | Public state | Next evidence boundary |
| --- | --- | --- |
| ASAR raw-header integrity | Extracted, fixture-tested, and used by the build-8690 full-fleet stage | Record the next accepted build |
| Read-only app inspection | Extracted, fixture-tested, and exercised against pristine and staged build 8690 | Record the next accepted build |
| Safe restart and rescue | Extracted; build-8690 candidate adoption and healthy renderer-ready launch green with exact bundle/CLI identity and no overlapping task runtime; build-8576 real failed-launch return and build-8378 real blank-renderer rescue also green | Living React recovery-page exhaustion and known-working rollback remain separate capability evidence |
| Terminal toggle | Extracted; build-8690 static stage and build-8109 live use green | Live-accept on build 8690 |
| Staging, repacking, signing | Extracted; synthetic, build-8109, build-8378, build-8576, and build-8690 stages green; build-8690 installed signature, ASAR seal, and healthy launch green | Record the next accepted build |
| Native app-tools peer authorization | Extracted; four main-process profiles red/green; build-8690 native task messaging in both directions green | Record the next accepted build |
| Standalone-output compaction source | Exact Codex 0.154.0-alpha.6.1 source diff, before/after hashes, focused compaction tests green, and native arm64 release binary built | Live-accept a task-message-triggered compaction boundary |
| Patched Codex binary integration | Same-version check, staged-copy hash verification, build-8690 full-fleet stage, healthy launch, and native messaging green | Live-accept the task-message-triggered compaction boundary above |
| Cross-task attribution | Extracted; build-8690 named delegated-message rendering green; build-8576 named and unnamed rendering green | Exercise unnamed attribution on build 8690 |
| Outgoing send receipt | Extracted; build-8690 causal-order probe and live task-message rendering green; build-8576 restart reconstruction green | Exercise restart reconstruction on build 8690 |
| Wait-thread roster | Extracted; build-8690 static stage and build-8109 names, links, colors, and multi-target behavior live-accepted | Live-accept on build 8690 |
| Runtime JSON reload | Extracted; build-8690 static stage and build-8109 live save green | Live-accept on build 8690 |
| Task palette | Extracted; build-8690 static stage and build-8109 live use green | Live-accept on build 8690 |
| Reasoning retention | Extracted; build-8690 static stage and build-8109 live use green | Live-accept on build 8690 |
| Model identity guard | Extracted; exact-task policy and locked-composer behavior; build-8690 full-fleet stage and build-8109 live acceptance green | Live-accept mismatch alarm and recovery on build 8690 |
| macOS menu title | Extracted; bundle-metadata fixture and mixed-scope staging red/green | Read `Codex` in the live macOS menu bar |
| Task attention policy | Extracted; build-8690 static stage and build-8109 live use green | Live-accept on build 8690 |
| Tinrelay presentation | Extracted as one patch; build-8690 shared-bus, outgoing-order, restart, and pagination probes plus live incoming/outgoing loopback rendering green; build-8576 restart reconstruction live-accepted | Exercise later-pagination reconstruction on build 8690 |
| Sidebar action collapse | Extracted; build-8690 static stage and build-8109 live use green | Live-accept on build 8690 |
| Patch registry | Extracted; per-realm API, build-8690 full-fleet composition, and current live task-message/Tinrelay consumers green | Record the next accepted build |
| Task supervisor | Extracted and fixture-tested; benched and excluded from the example fleet | Requalify only if a real current use returns |
| Full-history drain suppression | Extracted and fixture-tested; dormant upstream-owned | Requalify only if eager local resume draining returns |
| Renderer turn window | Extracted and fixture-tested; dormant upstream-owned | Requalify only if mounted rendering becomes unbounded again |

## Current build qualification

Codex Desktop `26.908.31457` (build `8690`) for macOS ARM64 was inspected and staged on macOS
`26.6.2` (`25G83`) from a pristine vendor update on 2026-09-11. The complete selected
desktop-package fleet—including the separately built Codex 0.154.0-alpha.6.1 binary—passed every
focused probe before and after repacking, remained byte-identical on a second application,
preserved the native package tree and executable helper, and produced a valid code signature and
ASAR seal. The accepted ASAR SHA-256 is
`8ec57a6bc67ca41a2dfe3f79980c2120b2d4da5122d7c353bc6d847e312cc12b`. The supervisor installed that
exact candidate at the canonical path, proved its signature and ASAR seal, observed real renderer
readiness, and returned to the originating task without an overlapping CLI writer. Native
task-to-task messages then rendered in both directions, and a real same-ship Tinrelay loopback
rendered both outgoing and incoming. Build-8690 regression probes additionally cover the split
renderer message bus, renderer-store capture, outgoing-radio hoist order, restart/pagination
persistence, and composed registry ownership. Build `8690` is therefore the current qualified
fleet; the table keeps narrower live boundaries visible where they would strengthen rather than
redefine this qualification.

The qualified desktop fleet was staged with these exact package patches:

```json
[
  "cross-task-attribution",
  "runtime-json-reload",
  "task-visual-palette",
  "reasoning-retention",
  "model-identity-guard",
  "macos-menu-title",
  "standalone-output-compaction",
  "sidebar-action-collapse",
  "task-attention-policy",
  "terminal-toggle",
  "outgoing-message-receipt",
  "wait-thread-roster",
  "tinrelay-pointer-presentation",
  "native-app-tools-peer-authorization",
  "renderer-patch-registry",
  "safe-start-readiness"
]
```

`standalone-output-compaction` integrated the separately built Codex 0.154.0-alpha.6.1 source repair named
above. Private paths and user policy are intentionally absent from this public record. A subset on
the same vendor build inherits only its selected patches' exact source recognition and recorded
patch-specific evidence; it must satisfy catalog dependencies, pass staging as that subset, and
receive its own focused live checks. It is not the full-fleet composition receipt merely because it
contains fewer transforms.

The predecessor qualifications remain useful evidence. Build `8576` launched with the complete
fleet and supplied the live evidence named above. Build `8109` launched successfully, and the
configured palette, sidebar, terminal, retained reasoning, native task messaging, and incoming and
outgoing Tinrelay presentation were exercised in live use.

## Extraction rule

A slice moves only when it has one portable owner, no personal path or identity data, a focused
probe, an explicit compatibility claim, and a failure mode that leaves the operator's working
application untouched. Until then, copying source is not adoption.
