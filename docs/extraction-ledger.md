# Extraction ledger

The private kit remains the operational source. This ledger says what has actually crossed the
public boundary; it is not a promise to extract every historical patch.

| Area | Public state | Next boundary |
| --- | --- | --- |
| ASAR raw-header integrity | Extracted and fixture-tested | Use from the staged repack owner |
| Read-only app inspection | Extracted and fixture-tested | Record exact accepted builds |
| Terminal toggle | Extracted; fixture red/green and installed build 7942 green | Integrate with the staged patch runner |
| Staging, repacking, signing | Not extracted | Separate generic packaging from patch selection |
| Native app-tools peer authorization | Not extracted | Security review, then include with signing support |
| Cross-task attribution and send receipts | Not extracted | Separate independent patches from optional palette use |
| Task palette | Not extracted | Replace private owner roots and crew data with local config |
| Task attention policy | Extracted; config-backed build-7942 fixture red/green | Integrate with the staged patch runner |
| Tinrelay pointer presentation | Not extracted | Make client path and local ship explicit configuration |
| Sidebar action collapse | Extracted; build-7942 fixture red/green | Integrate with the staged patch runner |
| Patch registry | Not extracted | Rename private package markers without adding dependencies |
| Task supervisor | Benched | Retain privately unless a real current use returns |
| History and renderer-window performance patches | Dormant upstream-owned | Do not publish as active repairs |

## Extraction rule

A slice moves only when it has one portable owner, no personal path or identity data, a focused
probe, an explicit compatibility claim, and a failure mode that leaves the operator's working
application untouched. Until then, copying source is not adoption.
