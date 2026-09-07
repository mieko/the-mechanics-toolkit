# Wait-thread roster

- **State:** Active
- **Current evidence:** Build `8109` disposable extracted-tree transform and focused probes green,
  2026-09-07; live single- and three-target names, grammar, order, palette colors, and navigation
  green in active, expanded, and completed summaries
- **Owned seam:** The renderer entry for the `codex_app.wait_threads` activity item

## What it changes

Codex normally renders a wait as the opaque tool label `Wait threads`. This patch renders the
actual bounded target roster instead: `Waiting for Elias, The Mechanic, and Rowan…` while active,
then `Waited for …` when complete.

When a target task is present in Codex's renderer store, its title becomes a link to that task. A
title such as `The Mechanic — Engine Rooms and Escape Hatches` is shortened to `The Mechanic`.
Unknown or unhydrated targets—including anything not represented in Codex's renderer task
store—remain explicit `Task 0123abcd…` fallbacks rather than receiving invented names or links.
While a wait is active, Codex's stock shimmer is limited to the words `Waiting for`; it does not
repaint the linked names and wash out their palette colors.

## Composition

The patch works by itself. If the renderer patch registry and task visual palette are also active,
resolved names inherit their configured task colors. If cross-task attribution is registered, the
roster uses its shared title-shortening capability. Missing, incompatible, or failing optional
capabilities fall back locally without hiding the wait.

The patch does not change wait targets, polling, cursors, completion, timeout behavior, task
hydration, or agent coordination. It adds no persistence and does not make an unknown task look
known.

## Verification

```sh
node bin/toolkit.mjs patch wait-thread-roster check /path/to/extracted-asar
node bin/toolkit.mjs patch wait-thread-roster apply /path/to/extracted-asar
node test/wait-thread-roster.test.mjs /path/to/extracted-asar
```

The transform requires one exact app-control renderer owner, its stock task metadata selectors,
its existing task-navigation path, and no upstream `wait_threads` renderer. Ambiguous, partial, or
new native ownership fails closed.
