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
| Task palette | Extracted; config-backed build-7942 fixture red/green | Qualify with the selected renderer stack |
| Task attention policy | Extracted; config-backed build-7942 fixture red/green | Qualify with the selected renderer stack |
| Tinrelay pointer presentation | Extracted; config-backed renderer/main fixture red/green | Qualify with the selected renderer and main-process stack |
| Sidebar action collapse | Extracted; build-7942 fixture red/green | Qualify with the selected renderer stack |
| Patch registry | Extracted; per-realm API and current marker fixture green | Qualify after the selected behavior patches |
| Task supervisor | Extracted and fixture-tested; benched and excluded from the example fleet | Requalify only if a real current use returns |
| History and renderer-window performance patches | Dormant upstream-owned | Do not publish as active repairs |

## Extraction rule

A slice moves only when it has one portable owner, no personal path or identity data, a focused
probe, an explicit compatibility claim, and a failure mode that leaves the operator's working
application untouched. Until then, copying source is not adoption.
