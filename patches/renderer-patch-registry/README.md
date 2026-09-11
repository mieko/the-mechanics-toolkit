# Renderer patch registry

- **Current state:** Infrastructure
- **Public extraction:** Complete
- **Patch-specific evidence:** Build `8690` static composition and live task-message/Tinrelay
  capability consumption green; predecessor build `8109` live composition green

## Why it exists

The registry gives every installed ASAR patch a small, inspectable identity inside the renderer.
Mere presence and version are intentional composition facts: a future patch may select one
implementation path when a compatible companion exists and another when it does not, without DOM
probing, duplicated heuristics, or assumptions about staging history. The outgoing-message receipt,
for example, may use the task palette's current color resolver when that capability is present but
must remain correct and neutral when it is not.

This patch creates one registry per renderer realm at `globalThis.__MTK_PATCH_REGISTRY__`. Each
installed patch publishes a small immutable descriptor with an integer version. A same-version
reload may refresh a closure; an incompatible replacement is rejected. There are no listeners,
events, subscriptions, lifecycle callbacks, dependency resolver, or install ordering engine.

## Owned seam

The registry bootstrap lives at the start of the unique `app-initial` module. It recognizes only
known toolkit markers across the renderer and main-process modules and places exactly one
registration in the renderer realm for each installed ASAR patch. A registration for an absent
patch, duplicate ownership, an unknown registration, or an incompatible partial state fails closed.
The registry itself is infrastructure and does not self-register. Bundle-only patches that never
touch the ASAR are outside this renderer-local inventory.

The callable capabilities currently published are
`taskVisualPalette.resolveTaskColor({taskId,title})` and
`crossTaskAttribution.resolveTaskLabel({title})`. Consumers must version-check them and preserve
their own neutral behavior when an optional collaborator or capability is missing. Other
descriptors deliberately publish presence and version only; they are not accidental package
receipts.

## Check and apply

Every staged fleet must select `renderer-patch-registry`, including a user-facing selection that
would otherwise change only bundle metadata. The registry is the common composition receipt and
future capability-discovery seam, not an optional UI feature. The staging catalog applies behavior
patches first and the registry last, so its declarations describe the completed selected tree.
When working on an extracted tree directly, follow that same order and reapply the registry after
adding or removing a patch.

```sh
node bin/toolkit.mjs patch renderer-patch-registry check /path/to/extracted-asar
node bin/toolkit.mjs patch renderer-patch-registry apply /path/to/disposable-extracted-asar
node test/renderer-patch-registry.test.mjs /path/to/disposable-extracted-asar
```

No configuration is required. The patch command modifies only the supplied extracted tree. The
separate staging command can build and statically verify a new app outside `/Applications`; neither
command installs, launches, or replaces a working application.

## Verification

`test/renderer-patch-registry-transform.test.mjs` builds a synthetic current-profile application
split across the main process, initial renderer module, and one lazy chunk. It proves complete
current-fleet discovery, exact registration ownership, descriptor immutability, version rejection,
per-realm isolation, callable capability behavior, syntax validity, and byte-identical second
application.

The equivalent private registry is green in the installed build-`7942` operational kit. That is
historical evidence for the design, not proof that this separately namespaced public transform is
installed.

## Non-goals

- ordering or applying patches;
- turning renderer patches into plugins;
- broadcasting registry changes;
- making a missing optional collaborator fatal to an otherwise independent patch;
- accepting unknown package registrations or approximately matching a future build.
