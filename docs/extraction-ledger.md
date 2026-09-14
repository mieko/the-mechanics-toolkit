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
| ASAR raw-header integrity | Extracted, fixture-tested, and used by the build-8881 full-fleet stage | Record the next accepted build |
| Read-only app inspection | Extracted, fixture-tested, and exercised against pristine and staged build 8881 | Record the next accepted build |
| Safe restart and rescue | Extracted; build-8881 healthy candidate adoption and renderer readiness green on macOS and Ubuntu ARM64 with exact package/CLI identity and no overlapping task runtime; build-8576 real failed-launch return and build-8378 real blank-renderer rescue also green on macOS | Linux controlled-failure recovery, plus living React recovery-page exhaustion and known-working rollback, remain separate capability evidence |
| Terminal toggle | Extracted; build-8881 static stage and current live use green | Record the next accepted build |
| Staging, repacking, package integrity | Extracted; macOS synthetic and build-8109/8378/8576/8690/8881 stages green; Linux build-8881 DEB origin verification and ARM64 full-fleet rebuild green; both build-8881 candidates completed healthy installation and launch | Record the next accepted build |
| Native app-tools peer authorization | Extracted; current main-process profile red/green; build-8881 native task messaging in both directions green | Record the next accepted build |
| Standalone-output compaction source | Exact Codex 0.154.0-alpha.6.2 source diff, before/after hashes, focused compaction tests green, and native arm64 release binary built | Live-accept a task-message-triggered compaction boundary |
| Patched Codex binary integration | Same-version check, staged-copy hash verification, build-8881 full-fleet stage, healthy launch, and native messaging green | Live-accept the task-message-triggered compaction boundary above |
| Cross-task attribution | Extracted; build-8881 named delegated-message rendering green; build-8576 named and unnamed rendering green | Exercise unnamed attribution on build 8881 |
| Outgoing send receipt | Extracted; build-8881 causal-order probe and live task-message rendering green; build-8576 restart reconstruction green | Exercise restart reconstruction on build 8881 |
| Wait-thread roster | Extracted; build-8881 names, links, colors, and multi-target behavior live-accepted | Record the next accepted build |
| Runtime JSON reload | Extracted; build-8881 static stage and build-8109 live save green | Live-accept on build 8881 |
| Task palette | Extracted; build-8881 static stage and current live chips, room colors, and background marks green | Live-accept JSON reload across both room and sidebar surfaces |
| Reasoning retention | Extracted; build-8881 static stage and build-8109 live use green | Live-accept on build 8881 |
| Model identity guard | Extracted; exact-task policy and locked-composer behavior; build-8881 full-fleet stage and current live protection green | Exercise the Dictate false-alarm regression specifically |
| macOS menu title | Extracted; bundle-metadata fixture, mixed-scope staging red/green, and build-8881 live menu bar green | Record the next accepted build |
| Task attention policy | Extracted; build-8881 static stage and live mute behavior green | Record the next accepted build |
| Tinrelay presentation | Extracted as one patch; build-8881 shared-bus, outgoing-order, restart, and pagination probes plus live incoming/outgoing loopback rendering green; build-8576 restart reconstruction live-accepted | Exercise later-pagination reconstruction on build 8881 |
| Sidebar action collapse | Extracted; build-8881 static stage and live use green | Record the next accepted build |
| Patch registry | Extracted; per-realm API, build-8881 full-fleet composition, and current live task-message/Tinrelay consumers green | Record the next accepted build |
| Task supervisor | Extracted and fixture-tested; benched and excluded from the example fleet | Requalify only if a real current use returns |
| Full-history drain suppression | Extracted and fixture-tested; dormant upstream-owned | Requalify only if eager local resume draining returns |
| Renderer turn window | Reactivated after real build-8881 tasks took 30–90 seconds to switch; current scope-aware selector port and pristine-ASAR probes green | Live-accept task switching with the 1,500-turn mounted window |

## Current build qualification

Codex Desktop `26.908.40834` (build `8881`) for macOS ARM64 was inspected and staged on macOS
`26.6.2` (`25G83`) from a pristine vendor update, then re-staged and adopted with the current
17-patch fleet on 2026-09-14. The complete selected
desktop-package fleet—including the separately built Codex 0.154.0-alpha.6.2 binary—passed every
focused probe before and after repacking, remained byte-identical on a second application,
preserved the native package tree and executable helper, and produced a valid code signature and
ASAR seal. The accepted ASAR SHA-256 is
`93fd2edeeac84d892f6ccefa06ee69230b609e0df38c5d0080233865fb647948`. The supervisor installed that
exact candidate at the canonical path, proved its signature and ASAR seal, observed real renderer
readiness, and returned to the originating task without an overlapping CLI writer. Native
task-to-task messages rendered in both directions, a wait roster named its real tasks, and an
explicitly addressed same-ship Tinrelay loopback rendered and reached routed state. Live use also
accepted sidebar collapse, task-palette chips/room colors/background marks, model protection, the
macOS menu title, and terminal toggle. Build-8881 regression probes additionally cover the split
renderer message bus, renderer-store capture, outgoing-radio hoist order, restart/pagination
persistence, and composed registry ownership. Build `8881` is therefore the current qualified
fleet; the table keeps narrower live boundaries visible where they would strengthen rather than
redefine this qualification.

The Linux DEB adapter has a narrower build-`8881` qualification on Ubuntu 24.04.5 ARM64. Its exact
13-patch ASAR fleet passed source-signature verification, staging, repacking, second application,
native-payload preservation, supervised installation, exact invoking-CLI exit, and real renderer
readiness. The genuine Luna task reopened from Recents with its model and reasoning selection, and
no supervisor, rescue agent, or toolkit-owned terminal remained. This proves healthy adoption and
real-task CLI/Desktop non-overlap for that recorded environment; controlled blank/Oops recovery,
exhaustion and known-good restoration, and per-feature Linux live checks remain open. Exact package
hashes and runbook boundaries are recorded in
[platform compatibility](platform-compatibility.md#linux-build-8881-implementation-checkpoint) and
[Linux qualification](../qualification/linux.md).

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

`standalone-output-compaction` integrated the separately built Codex 0.154.0-alpha.6.2 source repair named
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
