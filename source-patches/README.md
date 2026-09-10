# Codex source patches

This catalog changes the open-source Codex App Server/Core source and produces a new `codex`
binary. It is separate from [`patches/`](../patches/), which transforms an extracted or staged
Codex Desktop application package.

Source patches are pinned to an exact upstream tag, commit, and before/after file hashes. The CLI
refuses a different revision, a partial application, or locally changed target bytes. Applying one
changes only the explicitly supplied Codex checkout; it does not build a binary, touch Codex
Desktop, install an application, or restart anything.

Each source-patch README owns its build and focused-test procedure. A resulting binary crosses into
the desktop-package lane only when the operator supplies it as `codexBinary` and enables the
corresponding package integration during staging.

```sh
node bin/toolkit.mjs source-patch list
node bin/toolkit.mjs source-patch standalone-output-compaction check /path/to/codex
node bin/toolkit.mjs source-patch standalone-output-compaction apply /path/to/codex
```

The root [source patch board](../README.md#codex-app-server-and-core-source-patches) is the current
whole-kit view.
