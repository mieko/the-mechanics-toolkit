# Extraction ledger

This repository is the canonical source for the portable patches recorded below. The ledger says
what crossed the extraction boundary; it is not a promise to publish every historical experiment.

| Area | Public state | Next boundary |
| --- | --- | --- |
| ASAR raw-header integrity | Extracted, fixture-tested, and used by staging | Qualify a disposable supported-build candidate |
| Read-only app inspection | Extracted and fixture-tested | Record exact accepted builds |
| Terminal toggle | Extracted; fixture red/green and installed build 8109 green | Requalify after the next Codex update |
| Staging, repacking, signing | Extracted; synthetic and build-8109 stages green | Requalify a disposable candidate from the next inspected pristine build |
| Native app-tools peer authorization | Extracted; two main-process profiles red/green; build-8109 native messaging green | Requalify after the next Codex update |
| Cross-task attribution | Extracted; current renderer-family fixture and build-8109 live use green | Requalify after the next Codex update |
| Outgoing send receipt | Extracted; build-8109 live mounted behavior and disposable acknowledged persistence/restart probes green | Live-accept restart reconstruction, then requalify after the next Codex update |
| Wait-thread roster | Extracted; build-8109 names, spacing, links, colors, and multi-target behavior live-accepted | Requalify after the next Codex update |
| Runtime JSON reload | Extracted; renderer/main fixture and build-8109 live save green | Requalify after the next Codex update |
| Task palette | Extracted; config-backed fixture and build-8109 live use green | Requalify after the next Codex update |
| Reasoning retention | Extracted; exact-task fixture and build-8109 live use green | Requalify after the next Codex update |
| macOS menu title | Extracted; bundle-metadata fixture and mixed-scope staging red/green | Read `Codex` in the live macOS menu bar |
| Task attention policy | Extracted; config-backed fixture and build-8109 live use green | Requalify after the next Codex update |
| Tinrelay presentation | Extracted as one patch; incoming/outgoing build-8109 surfaces live-accepted; persistence-gated source-turn pagination is statically green | Live restart-plus-pagination check, then requalify after the next Codex or Tinrelay observer-contract change |
| Sidebar action collapse | Extracted; fixture and build-8109 live use green | Requalify after the next Codex update |
| Patch registry | Extracted; per-realm API, current marker fixture, and build-8109 composition green | Requalify after the next Codex update |
| Task supervisor | Extracted and fixture-tested; benched and excluded from the example fleet | Requalify only if a real current use returns |
| Full-history drain suppression | Extracted and fixture-tested; dormant upstream-owned | Requalify only if eager local resume draining returns |
| Renderer turn window | Extracted and fixture-tested; dormant upstream-owned | Requalify only if mounted rendering becomes unbounded again |

## Current build qualification

Codex Desktop `26.901.51231` (build `8109`) was inspected and staged from a pristine vendor update
on 2026-09-07. The complete selected fleet applied without broadening a matcher, passed every
focused probe before and after repacking, remained byte-identical on a second application,
preserved the native package tree and executable helper, and produced a valid code signature and
ASAR seal.

The resulting installed application launched successfully; the configured palette, sidebar,
terminal, retained reasoning, native task messaging, and incoming and outgoing Tinrelay
presentation were exercised in live use.

## Extraction rule

A slice moves only when it has one portable owner, no personal path or identity data, a focused
probe, an explicit compatibility claim, and a failure mode that leaves the operator's working
application untouched. Until then, copying source is not adoption.
