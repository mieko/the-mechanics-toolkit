# Full-history drain suppression

**State:** Upstream-owned

Older Codex Desktop builds could advertise paginated history while still eagerly draining every
remaining turn when a local task resumed. This patch made the local resume path trust the backend's
pagination capability directly, while leaving remote-host behavior on the stock decision path.

Current build `7942` owns the accepted behavior itself: initial hydration requests five newest
complete turns, older pages load explicitly, and the resume path honors the paginated-history
contract. The local transform is therefore dormant and deliberately absent from the example
`enabledPatches` fleet.

## Owned seam

The historical transform recognizes one complete runtime factory in `webview/assets/*.js`. It
changes only `suppressResumeHistoryDrain`: local hosts use the authoritative
`supportsPaginatedThreadHistory` capability, while other hosts retain the stock feature-policy
decision. Partial, duplicated, or split ownership fails closed.

The current-stock check recognizes the complete pagination owner rather than treating the absence
of the historical patch point as success. It requires the history-mode selection, runtime settings,
resume guard, five-turn initial page, explicit older-page action, and `thread/turns/list` endpoint to
remain together in one asset.

## Verification

```sh
node test/full-history-drain-suppression-transform.test.mjs
node bin/toolkit.mjs patch full-history-drain-suppression check /path/to/extracted-asar
node test/full-history-drain-suppression.test.mjs /path/to/extracted-asar
```

The fixture test proves local and remote behavior, byte-identical second application, accepted
current-stock ownership, and fail-closed partial ownership. The bundled-contract probe accepts only
an applied historical repair or the complete current upstream pagination contract.

## Non-goals

- It does not change persistence, App Server history, model context, transcript export, or remote
  task behavior.
- It does not make a current upstream-owned repair selectable in the normal staging fleet.
- It does not infer safety from one pagination string or broaden old matchers for a new build.
- It is retained as a regression tool, not as a claim that current Codex needs the patch.
