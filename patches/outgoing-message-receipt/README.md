# Outgoing-message receipt

- **Current state:** Active
- **Public extraction:** Complete for the current renderer family
- **Current evidence:** Codex Desktop `26.901.41123`, build `7942`, inspected 2026-09-05

## Why it exists

A successful cross-task send should not disappear from the sending conversation. Without a local
receipt, a human has to remember where the message went, reconstruct its first line, or open the
other task to confirm which route was used.

This patch keeps the send activity visible as a compact left-aligned receipt: direction arrow,
current send state, recipient, and the first meaningful line. Hovering opens the complete message
through Codex's stock interactive hover and user-message formatter. Clicking the recipient follows
Codex's stock task route. When the task palette publishes a compatible registry capability, only
the recipient label borrows its color; otherwise the receipt remains neutral.

The receipt persists while the conversation is mounted and remains visible when the surrounding
activity group is collapsed. It is not a durable delivery ledger and makes no claim beyond the
send tool's own completion state.

![A compact Codex receipt naming its destination beneath a completed activity group](../../docs/images/sent-message-notification.png)

*A successful send leaves a visible local trace instead of disappearing.*

## Owned seam

The transform recognizes one `send_message_to_thread` renderer, the stock collapsed-activity
persistence classifier and projection, the current task selector and local/remote task keys, the
native interactive diff-hover owner, the recipient user-message formatter, and the exact stock CSS
tokens it uses.

Only the send renderer file is rewritten. The task store, activity owner, message formatter,
stylesheet, navigation bridge, and hover component remain stock owners imported by the receipt.
Missing, duplicated, partial, or changed ownership fails with `Upstream changed`.

## Check and apply

```sh
node bin/toolkit.mjs patch outgoing-message-receipt check /path/to/extracted-asar
node bin/toolkit.mjs patch outgoing-message-receipt apply /path/to/disposable-extracted-asar
node test/outgoing-message-receipt.test.mjs /path/to/disposable-extracted-asar
```

No configuration is required. Apply the renderer patch registry after this patch if package
descriptors and optional task-palette color are wanted. The toolkit does not yet repack, sign,
install, launch, or replace an application.

## Verification

`test/outgoing-message-receipt-transform.test.mjs` constructs a synthetic pristine current-family
renderer split across the send owner, task/hover owner, collapsed-activity owner, formatter,
formatter consumer, and stylesheet. It proves red/green transformation, source-owner preservation,
collapsed visibility, stock hover and formatter use, safe neutral fallback, optional palette
capability, click-through routing, syntax validity, and byte-identical second application.

The private build-`7942` implementation was separately accepted in live use before extraction:
the receipt stayed visible after collapsed activity, used recipient colors when available, opened
the target task, and exposed the full sent message on hover. That is historical evidence for the
design, not proof that this separately namespaced public transform is installed.

## Non-goals

- replacing delivery acknowledgments or proving receipt by the destination;
- parsing the prompt to infer a recipient;
- retaining an independent message archive across reloads;
- changing task routing, hydration, or send semantics;
- requiring the task palette or renderer registry;
- accepting an approximately matching future renderer.
