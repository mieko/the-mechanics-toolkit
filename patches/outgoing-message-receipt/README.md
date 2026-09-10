# Outgoing-message receipt

- **Current state:** Active
- **Public extraction:** Complete for the current renderer family
- **Patch-specific evidence:** Build `8109` live mounted behavior and disposable acknowledged
  persistence/restart probes green; live restart reconstruction pending, 2026-09-07

## Why it exists

A successful cross-task send should not disappear from the sending conversation. Without a local
receipt, a human has to remember where the message went, reconstruct its first line, or open the
other task to confirm which route was used.

This patch keeps the send activity visible as a compact left-aligned receipt: direction arrow,
current send state, recipient, and the first meaningful line. Hovering opens the complete message
through Codex's stock interactive hover and user-message formatter. Clicking the recipient follows
Codex's stock task route. When the task palette publishes a compatible registry capability, only
the recipient label borrows a contrast-safe light- or dark-theme form of its color; otherwise the
receipt remains neutral.

After the send tool reports success, a bounded private presentation cache records the call ID,
source task and turn, destination, and message text. The assistant-turn renderer reattaches that
receipt after reload or restart, and it remains visible when the surrounding activity group is
collapsed. This is still not a delivery ledger: the card reports the send tool's successful return,
not independent receipt or reading by the destination.

![A compact Codex receipt naming its destination beneath a completed activity group](sent-message-notification.png)

*A successful send leaves a visible local trace instead of disappearing.*

## Owned seam

The transform recognizes one `send_message_to_thread` renderer, its conversation and assistant-turn
owners, the Electron message handler, the stock collapsed-activity persistence classifier and
projection, the current task selector and local/remote task keys, the native interactive diff-hover
owner, the recipient user-message formatter, and the exact stock CSS tokens it uses.

The send renderer, conversation renderer, and Electron main bundle are rewritten. The task store,
message formatter, stylesheet, navigation bridge, and hover component remain stock owners imported
by the receipt. Missing, duplicated, partial, or changed ownership fails with `Upstream changed`.

The main process stores up to 256 single-line JSON records per source task beneath Codex's
`userData` directory in `mechanics-toolkit/task-message-receipts`. Each source task has a hashed,
private bucket, so opening one task reads only its own receipts and a busy task cannot evict another
task's history. Buckets are also limited to 8 MiB and the 64 most recently active source-task
buckets, providing a generous global safety ceiling. Existing flat-cache records migrate lazily on
the first patched launch. Directories are mode `0700`, records are mode `0600`, writes are atomic
and first-call-ID-wins, and invalid, oversized, corrupt, or mismatched records are ignored. Removing
the root directory forgets only these local presentation receipts.

## Check and apply

```sh
node bin/toolkit.mjs patch outgoing-message-receipt check /path/to/extracted-asar
node bin/toolkit.mjs patch outgoing-message-receipt apply /path/to/disposable-extracted-asar
node test/outgoing-message-receipt.test.mjs /path/to/disposable-extracted-asar
```

No configuration is required. Apply the renderer patch registry after this patch if package
descriptors and optional task-palette color are wanted. The patch command modifies only the supplied
extracted tree. The separate staging command can build and statically verify a new app outside
`/Applications`; neither command installs, launches, or replaces a working application.

## Verification

`test/outgoing-message-receipt-transform.test.mjs` constructs a synthetic pristine current-family
renderer and main-process bundle. It proves red/green transformation, source-owner preservation,
collapsed visibility, stock hover and formatter use, safe neutral fallback, optional palette
capability, click-through routing, the renderer-to-main acknowledgment round trip, private cache
permissions, restart reconstruction, flat-cache migration, first-write identity, corrupt-record
rejection, independent per-task count and byte
bounds, the global task-bucket ceiling, syntax validity, and byte-identical second application.

The private build-`7942` implementation was separately accepted in live use before extraction:
the receipt stayed visible after collapsed activity, used recipient colors when available, opened
the target task, and exposed the full sent message on hover. That is historical evidence for the
design, not proof that this separately namespaced public transform is installed.

## Non-goals

- replacing delivery acknowledgments or proving receipt by the destination;
- parsing the prompt to infer a recipient;
- retaining an unbounded or authoritative message archive;
- changing task routing, hydration, or send semantics;
- requiring the task palette or renderer registry;
- accepting an approximately matching future renderer.
