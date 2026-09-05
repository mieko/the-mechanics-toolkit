# Runtime JSON reload

- **Current state:** Ready for staged adoption
- **Public extraction:** Complete for the standalone transform
- **Current evidence:** Build `7982` static stage green; build `7942` live-accepted, 2026-09-05

## Why it exists

Operator-owned JSON policy should not require an application restart. This patch watches the one
configured workspace's `.codex` directory and announces changes to the two active runtime files:

- `task-visual-palette.json`; and
- `task-attention-policy.json`.

Each consuming patch supplies its own acceptance callback. The callback re-reads through Codex's
existing local App Server filesystem boundary and applies the replacement only after its complete
schema and filesystem-safety checks pass. Invalid, partial, missing, oversized, or unsafe saves
leave the last-good runtime value in place.

The watcher is deliberately ignorant of either schema. It reports an exact configured filename;
the palette and attention patches remain the only authorities allowed to accept their respective
shapes.

## Owned seam

The Electron main process owns one non-persistent `fs.watch` per renderer web contents. Watching the
directory rather than either file preserves ordinary atomic-save behavior. Relevant events are
debounced and delivered over the existing Electron renderer message bus; unknown filenames never
cross the bridge. The watcher closes with its web contents.

The renderer owns a two-name acceptance registry. It serializes each consumer callback, coalesces a
change that arrives during validation into one later retry, and performs an initial callback when a
consumer registers so no save can be lost during startup.

## Configuration and application

Set `workspaceRoot` in a private toolkit config. The transform embeds that root and no policy
contents.

```sh
node bin/toolkit.mjs patch runtime-json-reload check /path/to/extracted-asar
node bin/toolkit.mjs patch runtime-json-reload apply /path/to/disposable-extracted-asar \
  --config /path/to/toolkit.local.json
node test/runtime-json-reload.test.mjs /path/to/disposable-extracted-asar
```

The synthetic transform and behavioral probes cover directory-watch filtering, atomic-save-style
rename events, debounce, serialized callbacks, startup acceptance, renderer cleanup, and
byte-identical second application. The palette and attention probes separately prove that malformed
saves retain the last-good value and complete valid saves are adopted.

## Non-goals

- accepting or interpreting either policy schema;
- watching arbitrary paths or filenames;
- hot-reloading staging configuration or compiled Tinrelay identity;
- editing policy through the Codex UI; or
- replacing the ordinary post-update port and staged-app verification pass.
