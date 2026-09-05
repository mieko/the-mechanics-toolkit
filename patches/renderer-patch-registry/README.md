# Renderer patch registry

- **Current state:** Infrastructure
- **Public extraction:** Complete
- **Current evidence:** Codex Desktop `26.901.41123`, build `7942`, inspected 2026-09-05

## Why it exists

Independent renderer patches occasionally need one tiny, explicit point of cooperation. The
outgoing-message receipt, for example, may use the task palette's current color resolver when that
capability is present, but must remain correct and neutral when it is not.

This patch creates one registry per renderer realm at `globalThis.__MTK_PATCH_REGISTRY__`. Each
installed patch publishes a small immutable descriptor with an integer version. A same-version
reload may refresh a closure; an incompatible replacement is rejected. There are no listeners,
events, subscriptions, lifecycle callbacks, dependency resolver, or install ordering engine.

## Owned seam

The registry bootstrap lives at the start of the unique `app-initial` module. It recognizes only
known toolkit markers and places exactly one registration beside each owning implementation. A
registration for an absent patch, duplicate ownership, an unknown registration, or an incompatible
partial state fails closed.

The only callable capability currently published is
`taskVisualPalette.resolveTaskColor({taskId,title})`. Consumers must version-check it and preserve
their own neutral behavior when the registry or capability is missing.

## Check and apply

Apply the selected behavior patches first, then apply the registry. Reapply it after adding or
removing a patch so its declarations match the extracted tree.

```sh
node bin/toolkit.mjs patch renderer-patch-registry check /path/to/extracted-asar
node bin/toolkit.mjs patch renderer-patch-registry apply /path/to/disposable-extracted-asar
node test/renderer-patch-registry.test.mjs /path/to/disposable-extracted-asar
```

No configuration is required. The toolkit does not yet repack, sign, install, launch, or replace an
application.

## Verification

`test/renderer-patch-registry-transform.test.mjs` builds a synthetic current-profile renderer split
between the initial module and one lazy chunk. It proves discovery, exact registration ownership,
descriptor immutability, version rejection, per-realm isolation, palette capability behavior,
syntax validity, and byte-identical second application.

The equivalent private registry is green in the installed build-`7942` operational kit. That is
historical evidence for the design, not proof that this separately namespaced public transform is
installed.

## Non-goals

- ordering or applying patches;
- turning renderer patches into plugins;
- broadcasting registry changes;
- making a missing dependency fatal to an otherwise independent patch;
- accepting unknown package registrations or approximately matching a future build.
