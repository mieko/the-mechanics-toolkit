# Cross-task attribution

- **Current state:** Active
- **Public extraction:** Complete for the current renderer family
- **Current evidence:** Codex Desktop `26.901.41123`, build `7942`, inspected 2026-09-05

## Why it exists

A message arriving from another task should say who sent it. Stock Codex renders a generic
“another task” label even though the delegated-message record already carries the source task ID
and preserves click-through to it. That forces a human to infer identity from prose or open the
link—precisely when several agents may be coordinating at once.

This patch resolves the source task through Codex's own renderer store and replaces the generic
label with the name before a title's ` — ` separator. If authoritative metadata is missing it keeps
the stock generic label. It never parses message prose as identity. The retained label helper can
also render `Project/Task title` when an older renderer profile supplies project metadata, but the
current build-`7942` profile does not claim that metadata path.

The patch also applies Codex's existing muted semantic accent only to the delegated user-message
bubble. It does not tint the whole turn, dim text, or remove the source-task link.

## Owned seam

The transform recognizes one delegated-message renderer owner, its wrapper, its user-message bubble,
and the stock ESM exports for the renderer store, scope, and title atom. It imports those existing
owners into the lazy chunk and adjusts the exact memo-cache dependencies that consume the new label
and style prop.

Missing, duplicated, partial, or changed owners stop with `Upstream changed`. The transform does not
inject a second state store, private selector initialization, or a title registry.

## Check and apply

```sh
node bin/toolkit.mjs patch cross-task-attribution check /path/to/extracted-asar
node bin/toolkit.mjs patch cross-task-attribution apply /path/to/disposable-extracted-asar
node test/cross-task-attribution.test.mjs /path/to/disposable-extracted-asar
```

No configuration is required. The toolkit does not yet repack, sign, install, launch, or replace an
application.

## Verification

`test/cross-task-attribution-transform.test.mjs` builds a synthetic pristine renderer graph with
stock ESM ownership and exact current lazy-chunk seams. It proves the red/green transform, source
name extraction, stock-store ownership, generic fallback color, preserved click-through,
bubble-only styling, untouched dependency owners, syntax validity, and byte-identical second
application.

The palette transform fixture applies this public patch first, then proves that palette provenance
composition still works. The private build-`7942` implementation was separately accepted in live
use before extraction, including correct named labels, generic fallback, colors, and source-task
navigation.

## Non-goals

- deriving identity from message text or correspondence headers;
- inventing a sender when source metadata is absent;
- changing routing, delivery, or task hydration;
- recoloring ordinary local user messages;
- replacing the task visual palette;
- accepting an approximately matching future renderer.
