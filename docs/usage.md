# Using the toolkit

The toolkit inspects and transforms an explicitly supplied Codex Desktop application or extracted
ASAR tree. It does not install, replace, launch, or roll back an application.

## Requirements

The current workflow targets macOS and requires Node.js 22.12 or newer. Install the pinned local
Electron ASAR dependency and run the repository checks:

```sh
npm install
npm run check
npm test
```

The macOS staging path also uses the system `codesign`, `ditto`, and `PlistBuddy` tools.

## Inspect an application

Inspect the installed application without modifying it:

```sh
npm run inspect:installed
```

Or name another bundle explicitly:

```sh
node bin/toolkit.mjs inspect /path/to/ChatGPT.app
```

Inspection reports bundle identity, version and build, complete ASAR SHA-256, Electron's raw-header
integrity value, and code-signature validity.

## Local configuration

Copy [`toolkit.example.json`](../toolkit.example.json) to the ignored `toolkit.local.json`, or use
another private path. `enabledPatches` selects the staged fleet; the catalog applies it in
dependency-safe order regardless of array order.

Configuration-backed patches use these values:

- `workspaceRoot` locates `.codex/task-visual-palette.json` and
  `.codex/task-attention-policy.json`;
- reasoning retention consumes exact task opt-ins from the visual palette;
- `tinrelay.client` and `tinrelay.localShip` identify the local Tinrelay boundary.

The toolkit configuration itself is staging input and is not watched. In an adopted build, the
palette and attention-policy files are runtime-reloadable. Each owning patch accepts only a
complete valid replacement and otherwise keeps its last-good value.

## Check or apply one patch

Every patch accepts an explicit target and owns its own compatibility check:

```sh
node bin/toolkit.mjs patch PATCH-NAME check /path/to/target
node bin/toolkit.mjs patch PATCH-NAME apply /path/to/disposable-target \
  --config /path/to/toolkit.local.json
```

Most targets are extracted ASAR directories. `macos-menu-title` instead targets a staged
application bundle. Configuration-free patches do not need `--config`. Unknown, duplicated,
partial, or changed ownership fails closed; the patch's own README gives its exact current target,
probe, and configuration needs.

Applying a patch to an extracted directory does not repack it or touch an application bundle.

## Stage a complete candidate

```sh
node bin/toolkit.mjs stage /path/to/Pristine-ChatGPT.app /path/to/Staged-ChatGPT.app \
  --config /path/to/toolkit.local.json
```

The destination's parent must exist and the destination must not. Staging refuses `/Applications`,
never modifies or launches the source, and removes only the new destination it created if static
proof fails.

The command requires every selected patch to begin pristine, applies the fleet in dependency-safe
order, runs syntax and behavioral probes, proves byte-identical second application, preserves the
source's exact native payload and executable modes, repacks the ASAR, updates Electron's integrity
seal, ad-hoc signs the candidate, and repeats verification after packing.

A green result is a statically verified candidate, not permission to adopt it and not evidence of
live behavior. See [staging and authority](staging.md) for the exact proof boundary.
