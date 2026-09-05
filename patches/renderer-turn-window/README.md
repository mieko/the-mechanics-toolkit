# Renderer turn window

**State:** Upstream-owned

Older Codex Desktop builds could retain and repeatedly materialize thousands of complete native
turn containers in one mounted conversation. This patch bounded the local renderer to the newest
1,500 current and inherited-parent turns while leaving persistence, model context, older-page
loading, and full transcript export untouched.

Current build `7982` supplies the accepted paginated renderer path itself, so this local transform
is dormant and deliberately absent from the example `enabledPatches` fleet. It remains here as a
regression repair and as executable evidence for the distinction between paginated transport and
bounded mounted rendering.

## Owned seam

The historical transform owns two renderer modules:

- the derived selector that joins current and optional parent turn arrays before materialization;
- the local-conversation component's four eager UI selector calls.

The selector shares one 1,500-turn budget between current and parent tasks, keeps complete native
turn containers intact, and suppresses the unbounded history-timeline join only when the window is
active. Only mounted UI consumers receive the limit. The Markdown/transcript consumer deliberately
does not.

Partial markers, changed selector ownership, a changed number of eager consumers, or an ambiguous
asset fails closed. Current upstream ownership is accepted only when the complete five-turn initial
page, older-page action, turn-list endpoint, and recognized selector owner remain together.

## Verification

```sh
node test/renderer-turn-window-transform.test.mjs
node bin/toolkit.mjs patch renderer-turn-window check /path/to/extracted-asar
node test/renderer-turn-window.test.mjs /path/to/extracted-asar
```

The fixture test proves bounded materialization, a shared parent/current budget, intact delegated
and streaming containers, accumulated-page bounding, full transcript preservation, and
byte-identical second application. The bundled-contract probe also recognizes the complete current
upstream renderer owner and confirms that the dormant local patch is absent.

## Non-goals

- It does not truncate task storage, App Server state, model context, retained rollout data, or
  transcript export.
- It does not slice the items inside a native turn container.
- It does not replace or broaden Codex's explicit older-page transport.
- It is retained as a regression tool, not as a claim that current Codex needs the patch.
