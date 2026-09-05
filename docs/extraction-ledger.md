# Extraction ledger

This repository is the canonical source for the portable patches recorded below. The ledger says
what crossed the extraction boundary; it is not a promise to publish every historical experiment.

| Area | Public state | Next boundary |
| --- | --- | --- |
| ASAR raw-header integrity | Extracted, fixture-tested, and used by staging | Qualify a disposable supported-build candidate |
| Read-only app inspection | Extracted and fixture-tested | Record exact accepted builds |
| Terminal toggle | Extracted; fixture red/green and installed build 7942 green | Qualify through the staged patch runner |
| Staging, repacking, signing | Extracted; signed synthetic app red/green | Qualify a disposable candidate from an inspected pristine build |
| Native app-tools peer authorization | Extracted; two current main-process profiles red/green | Runtime native-message acceptance after staged qualification |
| Cross-task attribution | Extracted; current renderer-family fixture red/green | Qualify with the selected renderer stack |
| Outgoing send receipt | Extracted; current renderer-family fixture red/green | Qualify with the selected renderer stack |
| Runtime JSON reload | Extracted; build-7942 renderer/main fixture and consumer acceptance red/green | Stage, adopt, and verify one valid and one rejected live save |
| Task palette | Extracted; config-backed build-7942 fixture red/green | Qualify with the selected renderer stack |
| Reasoning retention | Extracted; exact-task build-7942 fixture red/green | Live configured completion and manual-collapse check |
| macOS menu title | Extracted; bundle-metadata fixture and mixed-scope staging red/green | Read `Codex` in the live macOS menu bar |
| Task attention policy | Extracted; config-backed build-7942 fixture red/green | Qualify with the selected renderer stack |
| Tinrelay pointer presentation | Extracted; config-backed renderer/main fixture red/green | Qualify with the selected renderer and main-process stack |
| Sidebar action collapse | Extracted; build-7942 fixture red/green | Qualify with the selected renderer stack |
| Patch registry | Extracted; per-realm API and current marker fixture green | Qualify after the selected behavior patches |
| Task supervisor | Extracted and fixture-tested; benched and excluded from the example fleet | Requalify only if a real current use returns |
| Full-history drain suppression | Extracted and fixture-tested; dormant upstream-owned | Requalify only if eager local resume draining returns |
| Renderer turn window | Extracted and fixture-tested; dormant upstream-owned | Requalify only if mounted rendering becomes unbounded again |

## Current build qualification

Codex Desktop `26.901.41600` (build `7982`) was inspected from the signed vendor archive on
2026-09-05. Its pristine ASAR SHA-256 is
`077cc65356aeae34c5d8b4de0b4cc383f6fb137ed1d69a9b3dfe69ffafa058ab`.

The complete example fleet began pristine, applied without matcher changes, passed every focused
probe before and after repacking, remained byte-identical on a second application, preserved the
native package tree and executable helper, and produced valid ad-hoc and persistent-local-identity
signatures with the same valid ASAR seal.
The two dormant history checks still recognized complete upstream ownership. The benched task
supervisor also applied idempotently and passed its focused probe after its required dependencies.
Build `7982` is installed but has not yet been restarted and live-accepted, so build `7942` remains
the latest live-accepted build.

## Extraction rule

A slice moves only when it has one portable owner, no personal path or identity data, a focused
probe, an explicit compatibility claim, and a failure mode that leaves the operator's working
application untouched. Until then, copying source is not adoption.
