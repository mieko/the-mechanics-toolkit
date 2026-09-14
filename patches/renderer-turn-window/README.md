# Renderer turn window

**State:** Active

Older Codex Desktop builds could retain and repeatedly materialize thousands of complete native
turn containers in one mounted conversation. This patch bounded the local renderer to the newest
1,500 current and inherited-parent turns while leaving persistence, model context, older-page
loading, and full transcript export untouched.

Build `7982` added five-turn initial transport pagination, and this transform was made dormant.
Build `8881` retains that transport path, but long-lived tasks can still accumulate and repeatedly
materialize an unbounded in-memory turn list. Real build-`8881` tasks took 30–90 seconds to switch
or locked the UI during selection, so the local mounted-renderer bound is active again. Transport
pagination, explicit older-page loading, and the mounted projection are separate ownership seams.

## Owned seam

The transform owns two renderer modules:

- the derived selector that joins current and optional parent turn arrays before materialization;
- the local-conversation component's four eager UI selector calls.

The selector shares one 1,500-turn budget between current and parent tasks, keeps complete native
turn containers intact, and suppresses the unbounded history-timeline join only when the window is
active. Only mounted UI consumers receive the limit. The Markdown/transcript consumer deliberately
does not.

Build `8881` has a distinct scope-aware selector profile and four mounted UI consumers. Partial
markers, changed selector ownership, a changed consumer count, or an ambiguous asset fails closed.
The five-turn initial page, older-page action, and turn-list endpoint must remain present alongside
the mounted bound.

## Verification

```sh
node test/renderer-turn-window-transform.test.mjs
node bin/toolkit.mjs patch renderer-turn-window check /path/to/extracted-asar
node test/renderer-turn-window.test.mjs /path/to/extracted-asar
```

The fixture test proves bounded materialization, a shared parent/current budget, intact delegated
and streaming containers, accumulated-page bounding, full transcript preservation, and
byte-identical second application. The bundled-contract probe covers the historical upstream-owned
state and the active build-`8881` selector profile.

## Non-goals

- It does not truncate task storage, App Server state, model context, retained rollout data, or
  transcript export.
- It does not slice the items inside a native turn container.
- It does not replace or broaden Codex's explicit older-page transport.
- It does not claim that a 1,500-turn window fixes a single unusually large turn; items inside the
  newest turn remain intact.
