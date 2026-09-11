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
| ASAR raw-header integrity | Extracted, fixture-tested, and used by the build-8576 full-fleet stage | Requalify a disposable candidate from the next inspected pristine build |
| Read-only app inspection | Extracted, fixture-tested, and exercised against pristine and staged build 8576 | Record each newly accepted build |
| Safe restart and rescue | Extracted; task-catalog lookup, exit/timeout behavior, diagnostics, build-8576 healthy supervised launch and real failed-launch return green, plus build-8378 real blank-renderer rescue with strict no-overlap handoff green | Live-accept the living React recovery-page exhaustion and known-working rollback path |
| Terminal toggle | Extracted; build-8576 static stage and build-8109 live use green | Live-accept on build 8576 |
| Staging, repacking, signing | Extracted; synthetic, build-8109, build-8378, and build-8576 stages green | Requalify a disposable candidate from the next inspected pristine build |
| Native app-tools peer authorization | Extracted; three main-process profiles red/green; build-8576 static stage and build-8109 native messaging green | Live-accept on build 8576 |
| Standalone-output compaction source | Exact Codex 0.153.4 source diff, before/after hashes, focused compaction tests green, and native arm64 release binary built | Live-accept a task-message-triggered compaction boundary |
| Patched Codex binary integration | Same-version check, staged-copy hash verification, build-8576 full-fleet static stage, and app launch green | Live-accept the source repair above |
| Cross-task attribution | Extracted; build-8576 static stage and live delegated-message rendering green | Exercise unnamed-task title fallback on build 8576 |
| Outgoing send receipt | Extracted; build-8576 static stage and build-8109 live mounted persistence/restart behavior green | Live-accept restart reconstruction on build 8576 |
| Wait-thread roster | Extracted; build-8576 static stage and build-8109 names, links, colors, and multi-target behavior live-accepted | Live-accept on build 8576 |
| Runtime JSON reload | Extracted; build-8576 static stage and build-8109 live save green | Live-accept on build 8576 |
| Task palette | Extracted; build-8576 static stage and build-8109 live use green | Live-accept on build 8576 |
| Reasoning retention | Extracted; build-8576 static stage and build-8109 live use green | Live-accept on build 8576 |
| Model identity guard | Extracted; exact-task policy and locked-composer behavior; build-8576 full-fleet stage and build-8109 live acceptance green | Live-accept mismatch alarm and recovery on build 8576 |
| macOS menu title | Extracted; bundle-metadata fixture and mixed-scope staging red/green | Read `Codex` in the live macOS menu bar |
| Task attention policy | Extracted; build-8576 static stage and build-8109 live use green | Live-accept on build 8576 |
| Tinrelay presentation | Extracted as one patch; build-8576 full-fleet launch, outgoing causal order, and restart reconstruction live-accepted; shared renderer-host-bus and outgoing-order regression probes green; incoming/outgoing build-8109 surfaces live-accepted | Live later-pagination reconstruction check on build 8576 |
| Sidebar action collapse | Extracted; build-8576 static stage and build-8109 live use green | Live-accept on build 8576 |
| Patch registry | Extracted; per-realm API and build-8576 full-fleet composition green | Exercise current live capability consumers on build 8576 |
| Task supervisor | Extracted and fixture-tested; benched and excluded from the example fleet | Requalify only if a real current use returns |
| Full-history drain suppression | Extracted and fixture-tested; dormant upstream-owned | Requalify only if eager local resume draining returns |
| Renderer turn window | Extracted and fixture-tested; dormant upstream-owned | Requalify only if mounted rendering becomes unbounded again |

## Current build qualification

Codex Desktop `26.903.71938` (build `8576`) for macOS ARM64 was inspected and staged on macOS
`26.6.2` (`25G83`) from a pristine vendor update on 2026-09-10. The complete selected
desktop-package fleet—including the separately built Codex 0.153.4 binary—passed every focused
probe before and after repacking, remained byte-identical on a second application, preserved the
native package tree and executable helper, and produced a valid code signature and ASAR seal. The
rebuilt full fleet was installed and reached the healthy Codex task surface. Current regression
probes cover renderer-store capture, shared Tinrelay host-bus ownership, and outgoing-radio hoist
order; each patch's remaining live behavior is still an independent acceptance boundary where the
table says so. Build-8576 live acceptance also proved that current and previously persisted
outgoing Tinrelay presentations remain after the user request that caused them across restart.

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

`standalone-output-compaction` integrated the separately built Codex 0.153.4 source repair named
above. Private paths and user policy are intentionally absent from this public record. A subset on
the same vendor build inherits only its selected patches' exact source recognition and recorded
patch-specific evidence; it must satisfy catalog dependencies, pass staging as that subset, and
receive its own focused live checks. It is not the full-fleet composition receipt merely because it
contains fewer transforms.

The predecessor qualification remains useful evidence: the installed build `8109` launched
successfully, and the configured palette, sidebar, terminal, retained reasoning, native task
messaging, and incoming and outgoing Tinrelay presentation were exercised in live use.

## Extraction rule

A slice moves only when it has one portable owner, no personal path or identity data, a focused
probe, an explicit compatibility claim, and a failure mode that leaves the operator's working
application untouched. Until then, copying source is not adoption.
