# Extraction ledger

This repository is the canonical source for the portable patches recorded below. The ledger says
what crossed the extraction boundary; it is not a promise to publish every historical experiment.

| Area | Public state | Next boundary |
| --- | --- | --- |
| ASAR raw-header integrity | Extracted, fixture-tested, and used by staging | Qualify a disposable supported-build candidate |
| Read-only app inspection | Extracted and fixture-tested | Record exact accepted builds |
| Safe restart and rescue | Extracted; task-catalog lookup, exit/timeout behavior, diagnostics, build-8378 full-fleet stage green, and live task/cwd/title resolution green | Live-accept healthy readiness and forced failure rescue on build 8378 |
| Terminal toggle | Extracted; build-8378 static stage and build-8109 live use green | Live-accept on build 8378 |
| Staging, repacking, signing | Extracted; synthetic, build-8109, and build-8378 stages green | Requalify a disposable candidate from the next inspected pristine build |
| Native app-tools peer authorization | Extracted; three main-process profiles red/green; build-8378 static stage and build-8109 native messaging green | Live-accept on build 8378 |
| Standalone-output compaction source | Exact Codex 0.153.4 source diff, before/after hashes, focused compaction tests green, and native arm64 release binary built | Live-accept a task-message-triggered compaction boundary |
| Patched Codex binary integration | Same-version check, staged-copy hash verification, build-8378 full-fleet static stage, and app launch green | Live-accept the source repair above |
| Cross-task attribution | Extracted; build-8378 static stage and build-8109 live use green | Live-accept on build 8378 |
| Outgoing send receipt | Extracted; build-8378 static stage and build-8109 live mounted persistence/restart behavior green | Live-accept restart reconstruction on build 8378 |
| Wait-thread roster | Extracted; build-8378 static stage and build-8109 names, links, colors, and multi-target behavior live-accepted | Live-accept on build 8378 |
| Runtime JSON reload | Extracted; build-8378 static stage and build-8109 live save green | Live-accept on build 8378 |
| Task palette | Extracted; build-8378 static stage and build-8109 live use green | Live-accept on build 8378 |
| Reasoning retention | Extracted; build-8378 static stage and build-8109 live use green | Live-accept on build 8378 |
| Model identity guard | Extracted; exact-task policy and locked-composer behavior; build-8378 full-fleet stage and build-8109 live acceptance green | Live-accept mismatch alarm and recovery on build 8378 |
| macOS menu title | Extracted; bundle-metadata fixture and mixed-scope staging red/green | Read `Codex` in the live macOS menu bar |
| Task attention policy | Extracted; build-8378 static stage and build-8109 live use green | Live-accept on build 8378 |
| Tinrelay presentation | Extracted as one patch; build-8378 full-fleet launch and shared renderer-host-bus regression probe green; incoming/outgoing build-8109 surfaces live-accepted | Live restart-plus-pagination check on build 8378 |
| Sidebar action collapse | Extracted; build-8378 static stage and build-8109 live use green | Live-accept on build 8378 |
| Patch registry | Extracted; per-realm API and build-8378 full-fleet composition green | Live-accept on build 8378 |
| Task supervisor | Extracted and fixture-tested; benched and excluded from the example fleet | Requalify only if a real current use returns |
| Full-history drain suppression | Extracted and fixture-tested; dormant upstream-owned | Requalify only if eager local resume draining returns |
| Renderer turn window | Extracted and fixture-tested; dormant upstream-owned | Requalify only if mounted rendering becomes unbounded again |

## Current build qualification

Codex Desktop `26.903.61454` (build `8378`) was inspected and staged from a pristine vendor update
on 2026-09-09. The complete selected desktop-package fleet—including the separately built Codex
0.153.4 binary—passed every focused probe before and after repacking,
remained byte-identical on a second application, preserved the native package tree and executable
helper, and produced a valid code signature and ASAR seal. The first installed candidate exposed a
Tinrelay composition defect: incoming and outgoing presentation had resolved different aliases for
the same renderer host bus. A causal equality probe now covers that seam. The rebuilt full fleet
was installed and reached the healthy Codex task surface; each patch's own live behavior remains an
independent acceptance boundary where the table says so.

The predecessor qualification remains useful evidence: the installed build `8109` launched
successfully, and the configured palette, sidebar, terminal, retained reasoning, native task
messaging, and incoming and outgoing Tinrelay presentation were exercised in live use.

## Extraction rule

A slice moves only when it has one portable owner, no personal path or identity data, a focused
probe, an explicit compatibility claim, and a failure mode that leaves the operator's working
application untouched. Until then, copying source is not adoption.
