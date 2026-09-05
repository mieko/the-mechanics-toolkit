# Terminal toggle

- **Current state:** Active
- **Public extraction:** Complete for the standalone transform
- **Current evidence:** Build `7982` static stage green; build `7942` live-accepted, 2026-09-05

## Why it exists

Codex already has a configurable terminal command and a stock action that toggles the bottom
terminal panel. The shipped shortcut boundary did not let that command fire while the chat composer
or terminal editable owned focus. In practice, the terminal shortcut could open the panel from some
places but could not reliably behave like a toggle from the two places where it mattered.

This patch makes the configured terminal shortcut do both halves of its job:

- from the chat composer, open the terminal;
- from the focused terminal, close the bottom panel through Codex's stock toggle action.

It does not add or hard-code a key combination. The user's configured keymap remains the authority.

## Owned seam

The transform recognizes one complete `app-initial` ownership profile:

1. the existing `toggleTerminal` command descriptor;
2. the existing configurable hotkey dispatcher;
3. the editable-focus permission decision; and
4. the stock terminal toggle action.

It makes two changes:

- gives `toggleTerminal` application-wide shortcut scope;
- permits that command while an editable surface owns focus.

The terminal action itself is not replaced. If any required owner is missing, duplicated, split, or
only partially patched, the transform stops with `Upstream changed` instead of guessing.

## Check and apply

Both commands require an already extracted, disposable ASAR tree. `check` is read-only; `apply`
modifies only the directory supplied on the command line.

```sh
node bin/toolkit.mjs patch terminal-toggle check /path/to/extracted-asar
node bin/toolkit.mjs patch terminal-toggle apply /path/to/disposable-extracted-asar
node test/terminal-toggle.test.mjs /path/to/disposable-extracted-asar
```

The patch command modifies only the supplied extracted tree. The separate staging command can build
and statically verify a new app outside `/Applications`; neither command installs, launches, or
replaces a working application.

## Verification

The repository carries two complementary probes:

- `test/terminal-toggle-transform.test.mjs` creates a synthetic pristine owner, proves red→green
  transformation, runs the behavioral bundled-contract probe, and proves a byte-identical second
  application;
- `test/terminal-toggle.test.mjs` inspects a real extracted bundle and proves that the configured
  accelerator still reaches Codex's stock terminal action without a hard-coded shortcut.

On 2026-09-05, the installed build `7942` was extracted to a temporary directory. The transform
recognized it as already applied, and the real bundled-contract probe returned green. Older
ownership profiles remain in the transform because they were part of the operational source, but
this public extraction does not make a fresh compatibility claim for those builds.

## Non-goals

- inventing a terminal implementation;
- replacing the stock terminal action or focus handoff;
- changing the default shortcut;
- patching an application bundle in place;
- accepting an approximately matching future build.
