# Tinrelay pointer presentation

- **Current state:** Active
- **Public extraction:** Complete for the current renderer and main-process families
- **Current evidence:** Build `7982` static stage green; build `7942` live-accepted, 2026-09-05

## Why it exists

Tinrelay can carry a message across ships, but a raw local pointer landing in Codex looks like a
two-line JSON dump. A human should see the transmission, its authenticated remote address, and the
fact that it came across the radio—not transport plumbing or an invitation to trust arbitrary
message text.

This patch recognizes only the exact `tinrelay-local-pointer-v1` shape in a delegated message. The
main process asks the configured local Tinrelay client to inspect that one inbox item, verifies the
returned routing and author fields against the pointer, and returns only display-safe fields. The
renderer presents the body as inert plain text beneath a compact `local@ship → local@ship` route,
with an unmistakable dark radio-wake surface. Inspection is automatic and one-shot; malformed or
mismatched data becomes a small local error rather than approximate rendering.

![An authenticated Tinrelay transmission rendered in Codex as white text over a dark radio-wake card](tinrelay-recv.png)

*An outside signal looks like an outside signal, without becoming active content.*

## Configuration

The client executable and receiving ship are local facts, so they live in ignored toolkit
configuration rather than source:

```json
{
  "tinrelay": {
    "client": "/absolute/path/to/tinrelay",
    "localShip": "example-ship"
  }
}
```

`client` must be an absolute non-root path. `localShip` must be a lowercase DNS-style ship name.
The configured ship is embedded into both owners and checked for equality after transformation.

## Owned seam

The transform recognizes the current delegated-message renderer, its React and host-bus imports,
the stock message-node and attribution owners, the main-process child-process owner, and one exact
main message-handler insertion seam. It rewrites one lazy renderer asset and one main-process
asset. The app-initial host bus, task store, transport, Tinrelay inbox, signature verification, and
message creation remain with their existing owners.

The subprocess uses `execFile` with a fixed argument shape, no shell, an eight-second timeout, and
a one-megabyte output ceiling. Only `localId`, local and sender ships, attention and author labels,
and body cross into the renderer. Unknown, duplicated, partial, or changed ownership fails with
`Upstream changed`.

## Check and apply

```sh
node bin/toolkit.mjs patch tinrelay-pointer-presentation check /path/to/extracted-asar
node bin/toolkit.mjs patch tinrelay-pointer-presentation apply /path/to/disposable-extracted-asar \
  --config /path/to/toolkit.local.json
node test/tinrelay-pointer-presentation.test.mjs /path/to/disposable-extracted-asar
```

Apply the renderer patch registry afterward if a package descriptor is wanted. The patch command
modifies only the supplied extracted tree. The separate staging command can build and statically
verify a new app outside `/Applications`; neither command installs, launches, or replaces a working
application.

## Verification

`test/tinrelay-pointer-presentation-transform.test.mjs` constructs synthetic pristine current-family
renderer and main-process assets. It proves fail-closed configuration, the exact pointer grammar,
fixed subprocess invocation, metadata equality, author-label consistency, field minimization,
plain-text rendering, automatic one-shot disclosure, radio-surface contracts, syntax validity,
untouched host-bus ownership, and byte-identical second application.

The private build-`7942` implementation was separately accepted in live use before extraction:
an off-ship loopback rendered with the remote address and animated radio wake, while ordinary
delegated messages retained their stock behavior. That is historical evidence for the design, not
proof that this separately namespaced public transform is installed.

## Non-goals

- treating message prose, correspondence headers, or a task title as authenticated routing data;
- accepting pointers for a different local ship;
- rendering HTML, Markdown, links, or other active remote content;
- replacing Tinrelay's transport, signatures, trust policy, inbox, or relationship controls;
- retrying, acknowledging, deleting, or otherwise mutating a transmission;
- pinning behavior to one radio-room task ID or task name;
- accepting an approximately matching future Codex renderer or main process.
