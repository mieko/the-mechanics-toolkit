# Staging and authority

The staging command builds evidence, not permission. It creates a new, disposable candidate and
does not install, replace, launch, publish, or deploy it.

## Inputs

- a valid `com.openai.codex` source bundle whose code signature and Electron ASAR-header seal pass;
- a nonexistent destination outside `/Applications`, under an existing directory;
- an ignored toolkit config with a nonempty, duplicate-free `enabledPatches` list;
- `asar` on `PATH` and the macOS system tools `codesign`, `ditto`, and `PlistBuddy`.

Configuration-backed patches read their ordinary sections from the same file. The palette requires
cross-task attribution in the selection. Patch order comes from the toolkit catalog, not from array
order, so the renderer registry always sees the completed selected surface.

## Static proof

The source is inspected before copying and again before success returns. Inside the new candidate,
the command:

1. requires each selected transform to report `needs-apply`;
2. applies every selected transform and requires `applied`;
3. syntax-checks all declared changed JavaScript modules;
4. runs every selected patch's focused behavioral probe;
5. applies the transforms again and compares every extracted file, symlink, and mode;
6. requires the exact recognized native-package set, preserves its complete tree, repacks it, and
   verifies the node-pty helper is executable;
7. updates Electron's raw ASAR-header SHA-256 value and ad-hoc signs the candidate;
8. verifies bundle identity, version/build preservation, integrity, and signature;
9. extracts the packed result and reruns patch checks, syntax checks, and behavioral probes.

Failure removes only the new destination that this invocation created. The source is never a write
target. A green result says `staged-static-proof-green`, `liveAppTouched: false`, and `launched:
false` because runtime behavior remains deliberately unclaimed.

## Next seam

Launching the candidate is a separate operator decision. Installing it over `/Applications` is a
different and more consequential decision that also needs an external recovery copy. Neither is
implied by a successful stage, and neither command exists here yet.
