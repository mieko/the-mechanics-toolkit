# Staging and authority

The staging command builds evidence, not permission. It creates a new, disposable candidate and
does not install, replace, launch, publish, or deploy it.

## macOS inputs

- a valid `com.openai.codex` source bundle whose code signature and Electron ASAR-header seal pass;
- a nonexistent destination outside `/Applications`, under an existing directory;
- an ignored toolkit config with a nonempty, duplicate-free `enabledPatches` list;
- when a source repair is selected, an absolute `codexBinary` path to the separately built and
  verified same-version executable;
- dependencies installed with `npm install`, including the pinned repository-local Electron ASAR
  tool, plus the macOS system tools `codesign`, `ditto`, and `PlistBuddy`.

Linux DEB inputs and tools are specified in [Linux DEB staging and adoption](#linux-deb-staging-and-adoption).

Configuration-backed patches read their ordinary sections from the same file. The palette requires
cross-task attribution in the selection. Patch order comes from the toolkit catalog, not from array
order. Every staged fleet must include `safe-start-readiness`, because the adoption supervisor
accepts a candidate only after that trusted renderer signal, and `renderer-patch-registry`, which
runs after the behavior transforms and records the completed selected surface. These are staging
infrastructure, including when the user-facing selection would otherwise change only bundle
metadata.

The staging command does not apply Rust source patches or build Codex. Follow the selected entry in
[`source-patches/`](../source-patches/) first. Its compiled result becomes a package input only
through the explicit `codexBinary` configuration; the integration transform places it at
`Contents/Resources/codex` before the candidate is signed.

For an offered update, prefer the untouched application from the official vendor installer as the
source. The running installed application may remain open throughout staging. A staged candidate
may be named `ChatGPT-MechanicsToolkit.app`, but it stays outside `/Applications` and unlaunched; it
is not a second live application. See [preparing a patched Codex update](update-workflow.md).

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
7. on macOS, updates Electron's raw ASAR-header SHA-256 value and signs the candidate with the
   configured identity (ad-hoc by default); on Linux, writes explicit local-rebuild control fields
   and a receipt without claiming the vendor signature;
8. verifies the platform package identity and version/build preservation, plus the macOS integrity
   seal and signature where applicable;
9. extracts the packed result and reruns patch checks, syntax checks, and behavioral probes.

Failure removes only the new destination that this invocation created. The source is never a write
target. A green result says `staged-static-proof-green`, `liveAppTouched: false`, and `launched:
false` because runtime behavior remains deliberately unclaimed.

## Next seam

Launching the candidate is a separate operator decision. After explicit authority, the macOS
supervisor can own the adoption boundary:

```sh
bin/tmtk-restart --candidate /path/to/ChatGPT-MechanicsToolkit.app \
  /Applications/ChatGPT.app
```

It verifies the candidate and current app, captures the current app as a private known-working
rollback, and does not replace anything until the person clicks **Relaunch Codex**. Do not retain a
separately named live copy with the same bundle identifier. Neither adoption nor launch is implied
by a successful stage.

### Linux DEB staging and adoption

Linux DEB staging uses the same config and selected-patch contract, but its inputs and output are
packages rather than application directories:

```sh
node bin/toolkit.mjs stage-deb /path/to/chatgpt_amd64.deb \
  /path/to/chatgpt_amd64_tmtk.deb --config "$CONFIG"
```

The command requires `dpkg-deb`, `ar`, `gpgv`, the trusted ChatGPT APT keyring at
`/usr/share/keyrings/chatgpt-archive-keyring.gpg`, an authenticated official `chatgpt` DEB, and a
nonexistent destination. Before extraction for mutation, it verifies the DEB's embedded
`_gpgorigin` signature over its raw archive members against that already-installed APT keyring. It
then extracts the package without installing it. It accepts ASAR-scope patches only, preserves the
unpacked native tree and all non-owned package payloads, writes an explicit TMTK package receipt,
and rebuilds a local `SOURCE+tmtk1` DEB. The source stays byte-identical. A green
`staged-deb-static-proof-green` result still means `installed: false` and `launched: false`.
If a future official package is signed by a key absent from the currently trusted keyring, staging
fails closed. Refresh that trust only through OpenAI's authenticated APT/vendor acquisition path;
TMTK does not import a key from the package it is trying to authenticate and has no bypass flag.

Supervised Linux adoption names the candidate's pristine source separately from the rollback that
matches the currently installed application:

```sh
bin/tmtk-restart --candidate /path/to/chatgpt_amd64_tmtk.deb \
  --candidate-source /path/to/new-chatgpt_amd64.deb \
  --known-good /path/to/installed-chatgpt_amd64.deb /usr/lib/chatgpt
```

Both receipt-free DEBs must pass the same embedded-signature check against the trusted APT keyring.
The candidate receipt must identify `--candidate-source` by version, architecture, and SHA-256, and
the currently installed inner application must match `--known-good`. The source and rollback may
be different releases during an ordinary upgrade. TMTK copies the candidate and rollback into its
private incident before the restart dialog. Installation and restoration use `dpkg`,
with PolicyKit elevation for an ordinary desktop user, followed by exact package and inner-app
verification. A future higher version from the vendor APT repository may replace the local rebuild.
RPM staging is not implemented.

The staging command removes its own extracted-ASAR scratch tree on both success and failure. The
explicit destination candidate remains operator-owned. The restart supervisor bounds its private
storage to one full known-working application by pruning only superseded toolkit-owned rollback
payloads when the next candidate adoption captures a newer baseline. Maintainer-created `.work`
trees are evidence benches, not an automatic cache; keep only the pristine input, current candidate,
and deliberate failure fixtures still needed for qualification. After live acceptance, delete the
candidate and unpacked source, remove prior-release work, and retain at most one pristine vendor ZIP
if another staging pass may be useful.
