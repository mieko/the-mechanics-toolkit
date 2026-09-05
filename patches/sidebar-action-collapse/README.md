# Sidebar action collapse

- **Current state:** Active
- **Public extraction:** Complete for the standalone transform
- **Current evidence:** Codex Desktop `26.901.41123`, build `7942`, inspected 2026-09-05

## Why it exists

Codex places New Chat and a growing family of global destinations above Projects and task
navigation. Those actions are useful, but leaving all of them permanently expanded spends the most
valuable vertical space in the sidebar and pushes active work down the screen.

This patch adds one native-looking disclosure beside the existing sidebar header controls. When
collapsed, it hides New Chat and the complete stock global-destination family while preserving
Projects and task navigation. The choice persists locally and follows the renderer across windows.

![The Codex sidebar with its global actions collapsed while Projects and colored task rows remain visible](sidebar-collapse.png)

*The chrome folds away; the work stays where your eyes expect it.*

## Owned seam

The transform recognizes one complete sidebar owner: its React cache allocation, navigation
projection, header controls, New Chat row, and memo dependencies. It adds one local-storage-backed
state hook and an inline-SVG disclosure button, projects global destinations through that state,
and includes the state in the owner's existing memo cache.

The storage key is toolkit-owned and contains no ship, user, task, or filesystem identity. If an
expected owner is missing, duplicated, partially patched, or structurally changed, the transform
stops with `Upstream changed` instead of borrowing a nearby minified binding or making an
approximate edit.

## Check and apply

Both commands require an already extracted, disposable ASAR tree. `check` is read-only; `apply`
modifies only the directory supplied on the command line.

```sh
node bin/toolkit.mjs patch sidebar-action-collapse check /path/to/extracted-asar
node bin/toolkit.mjs patch sidebar-action-collapse apply /path/to/disposable-extracted-asar
node test/sidebar-action-collapse.test.mjs /path/to/disposable-extracted-asar
```

The toolkit does not yet repack, sign, install, launch, or replace an application.

## Verification

`test/sidebar-action-collapse-transform.test.mjs` creates a synthetic pristine build-`7942`
sidebar owner, proves red-to-green transformation, runs the behavioral bundled-contract probe, and
proves a byte-identical second application. The current installed build was inspected while this
slice was extracted, but its private operational markers intentionally do not count as proof that
this separately namespaced public transform is installed.

Older exact ownership profiles remain in the transform because they were part of the operational
source. This extraction makes no fresh compatibility claim for those builds.

## Non-goals

- hiding Projects or task navigation;
- turning every sidebar item into configurable policy;
- changing Codex's navigation destinations;
- patching an application bundle in place;
- accepting an approximately matching future build.
