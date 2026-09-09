# Tinrelay presentation

- **Current state:** Active
- **Public extraction:** Complete for the current renderer and main-process families
- **Current evidence:** Build `8109` unified static stage and live incoming/outgoing presentation
  green; source-turn restart reconstruction remains pending live acceptance, 2026-09-07

## Why it exists

Tinrelay messages should feel like correspondence, not plumbing. A verified incoming pointer should
become the message it identifies, and an accepted outgoing send should remain visible in the
conversation instead of collapsing into a JSON receipt. Both directions use the same crisp radio
language, but direction is visible before the route is read: incoming cards use a near-black field
with fine light rings, while outgoing cards use a gray field with fine dark rings and expose the
small transmitter origin on their left edge. Two staggered ring layers travel outward continuously;
each resets only while transparent, so the wake neither stops nor visibly hitches between cycles.

![A two-way Tinrelay exchange rendered inline in a color-mapped Codex room, with distinct incoming and outgoing radio-wake cards](tinrelay-exchange-browser-render.webp)

*Outside correspondence belongs in the conversation without pretending it came from inside the room.*

## Incoming transmissions

The patch recognizes only the exact `tinrelay-local-pointer-v1` shape in a delegated message. The
main process asks the configured local Tinrelay client to inspect that one inbox item, verifies the
returned routing and author fields against the pointer, and returns only display-safe fields. The
renderer shows the route and body through Codex's complete stock user-message bubble, including its
safe Markdown surface, dimensions, padding, radius, and **Show more** behavior after six lines.
Source-style single newlines render as ordinary Markdown
soft breaks while blank-line paragraph boundaries remain visible. Named endpoints render as
`local@ship`; ship-wide catch-all endpoints retain their canonical `@ship` address in both
directions. Inspection is automatic and one-shot; malformed or mismatched data becomes a small
local error rather than approximate rendering.

When either direction settles into its hoisted radio card, the patch returns the conversation to
the bottom after the layout has caught up only if the reader was no more than one viewport away
before the change. It never pulls someone back down while they are reading older history.

## Outgoing transmissions

Agents keep using ordinary `tinrelay --ship SHIP send`, with the complete body on standard input.
Arguments, stdout, stderr, exit status, delivery, and outbox behavior are unchanged. After a fresh
send is accepted and its encrypted outbox envelope is removed, a compatible Tinrelay client may
emit the exact plaintext transmission to a private Unix socket. Codex joins that observer event to
the ordinary acceptance JSON by transmission ID, sender ship, and recipient ship.

The surface means **accepted by the relay**, not received, read, or acted upon by the remote ship.
Missing or mismatched observer evidence leaves the stock command result visible. Duplicate events
are deduplicated by transmission ID and the first valid event wins. When the observer event resolves,
Codex durably attaches the validated presentation to the source task and assistant turn. The card can
therefore be rebuilt after restart and later pagination even when Codex no longer returns the
original command activity. Accepted sends also remain standalone persistent conversation units while
that activity is mounted, so they stay hoisted beside the stock collapsed activity summary. These
records are presentation continuity, not delivery evidence or a Tinrelay sent archive.

## Configuration

The client executable and local ship live in ignored toolkit configuration:

```json
{
  "tinrelay": {
    "client": "/absolute/path/to/tinrelay",
    "localShip": "example-ship"
  }
}
```

`client` must be an absolute non-root path. `localShip` must be a lowercase DNS-style ship name.

Tinrelay owns the optional outgoing observer configuration at:

```text
~/.config/tinrelay/SHIP/outgoing-observer.json
```

Its complete shape is:

```json
{"socket_path":"/absolute/path/to/private/observer.sock"}
```

The socket's immediate parent must already exist without group or world permission bits. Codex
accepts one newline-terminated UTF-8 `tinrelay-outgoing-observer-v1` event of at most 20 KiB per
connection. It keeps at most 256 accepted events in memory and as atomic, mode-`0600` JSON files
under `mechanics-toolkit/tinrelay/SHIP/outgoing-presentations` inside Electron's private user-data
directory; the cache directory is mode `0700`. Source-turn anchors live in a sibling private
`outgoing-anchors` directory. They retain up to 256 presentations per source task, up to 8 MiB per
task, with a 64-task global safety valve. The two caches therefore create bounded local plaintext
copies of recently sent bodies.

On lookup Codex checks memory, then the exact UUID-named cache file, then waits up to 750 ms for a
fresh observer event. Invalid, corrupt, oversized, misrouted, or pruned evidence leaves the stock
command result visible. Cache writes are best effort and never change Tinrelay arguments, output,
exit status, outbox behavior, or delivery. Tinrelay itself gains no sent-message database, command,
retention rule, or other correspondence-history surface. Sends first observed before the turn-anchor
upgrade become durable if their original command activity mounts once under the new patch; an older
send whose activity never returns cannot be retroactively assigned to a turn.

## Owned seams

Incoming presentation owns the delegated-message node and attribution seams plus a fixed `execFile`
inspection call. Outgoing presentation owns the completed-exec classifier, completed-command
renderer, private Electron socket listener, and one host-message lookup. The two small internal
transforms remain separate because those are different upstream Codex owners, but the toolkit
exposes and applies them as one Tinrelay patch.

Unknown, duplicated, partial, or changed ownership fails with `Upstream changed`. Remote bodies use
Codex's sanitized Markdown renderer; raw HTML is not injected or executed. Tinrelay transport,
signatures, trust policy, retries, delivery state, inbox/outbox mutation, and relationship controls
remain outside this patch.

## Check and apply

```sh
node bin/toolkit.mjs patch tinrelay-pointer-presentation check /path/to/extracted-asar
node bin/toolkit.mjs patch tinrelay-pointer-presentation apply /path/to/disposable-extracted-asar \
  --config /path/to/toolkit.local.json
node test/tinrelay-presentation.test.mjs /path/to/disposable-extracted-asar
```

The patch command modifies only the supplied extracted tree. The separate staging command can build
and statically verify a new app outside `/Applications`; neither command installs, launches, or
replaces a working application.

## Verification

The transform fixture proves fail-closed configuration and ownership, both exact contracts,
byte-identical second application, syntax validity, and composition with the runtime watcher. The
behavior probes cover exact pointer parsing, fixed no-shell inspection, metadata equality, stock
safe Markdown with paragraph-aware soft wrapping and six-line disclosure, directional radio wakes
that never contract below the card while animating, guarded post-hoist scrolling, outgoing palette
inversion and visible transmitter origin, ordinary-send recognition, collapsed-turn hoisting,
private socket permissions, fragmented events, lookup-before-event ordering, first-valid duplicate
handling, the
20 KiB ceiling, bounded private persistence, source-task/source-turn reconstruction after process
restart without the command activity, corrupt-cache rejection, the 256-event observer ceiling, the
256-anchor per-task ceiling, cross-task retention isolation, and socket cleanup. The current
build-`8109` patch family also upgrades cleanly in a disposable extraction; live
restart-plus-pagination qualification remains pending until the staged app is deliberately
replaced.

The private build-`7942` implementation was accepted live for incoming loopback before extraction.
Build `8109` stages the unified patch with all configured toolkit patches, valid signature and ASAR
integrity, green post-repack probes, and byte-identical second application. A real build-`8109`
loopback exercised the ordinary outgoing send presentation and the incoming pointer presentation.

## Non-goals

- treating prose, correspondence headers, task titles, or arbitrary command output as routing data;
- wrapping or replacing the Tinrelay CLI;
- accepting pointers or observer events for a different local ship;
- rendering active remote content;
- retrying, acknowledging, deleting, or otherwise mutating a transmission;
- turning Tinrelay's outbox or Codex's presentation cache into correspondence history;
- pinning behavior to one radio-room task ID or task name;
- accepting an approximately matching future Codex renderer or main process.
