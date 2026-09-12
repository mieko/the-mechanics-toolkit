# Using the toolkit

The toolkit has two explicit targets: an open-source Codex checkout for App Server/Core source
patches, and a Codex Desktop application or extracted ASAR tree for package patches. Neither lane
installs, replaces, launches, or rolls back an application.

## Requirements

The current patch-staging workflow supports macOS application bundles and Linux DEB packages, and
requires Node.js 24 LTS or a newer supported release. The generated-code and packaging boundaries
measured on Windows and Linux are recorded in
[`platform-compatibility.md`](platform-compatibility.md); transform recognition alone is not package
or live qualification. Install the pinned local Electron ASAR dependency and run the repository
checks:

```sh
npm install
npm run check
npm test
```

The macOS staging path also uses the system `codesign`, `ditto`, and `PlistBuddy` tools. Linux DEB
staging uses `dpkg-deb`, `ar`, `gpgv`, and the already-installed trusted ChatGPT APT keyring. One
exact Ubuntu ARM64 build has completed healthy live adoption;
the remaining Linux VM gates still control any broader DEB qualification claim.

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

On Linux, inspect the exact package-owned application directory:

```sh
node bin/toolkit.mjs inspect /usr/lib/chatgpt
```

Linux inspection validates the production package metadata against the inner ASAR and reports the
Desktop executable, ASAR, and bundled-CLI hashes. Package provenance is verified from the DEB at
staging/adoption time rather than inferred from the installed directory.

## Diagnose a failed launch or renderer

On macOS, collect a bounded local report from the newest Codex desktop log and the renderer error
breadcrumbs Codex already preserves:

```sh
node bin/toolkit.mjs diagnose /Applications/ChatGPT.app
```

The report includes the same bundle integrity inspection, the newest startup/error lines from
Codex's rotating file log, and recent renderer exception stacks when available. It reads at most the
last 2 MiB of one desktop log and only error-level Sentry breadcrumbs. It does not upload anything,
copy conversation bodies, or enable additional telemetry. Home-directory paths are shortened to
`~`; review the output before sharing it outside the machine.

## Adopt and restart with automatic rescue

After a candidate has passed static proof and the person has authorized adoption, use the
safe-start supervisor from the Codex task that should own recovery:

```sh
bin/tmtk-restart --candidate /path/to/ChatGPT-MechanicsToolkit.app \
  /Applications/ChatGPT.app
```

Linux DEB adoption names its pristine candidate source and installed rollback separately:

```sh
bin/tmtk-restart --candidate /path/to/chatgpt_amd64_tmtk.deb \
  --candidate-source /path/to/new-chatgpt_amd64.deb \
  --known-good /path/to/installed-chatgpt_amd64.deb /usr/lib/chatgpt
```

The Linux adapter proves that the candidate receipt names `--candidate-source` and that the
installed inner app matches `--known-good`. Those packages may describe different builds during
an upgrade. It copies the candidate and rollback into the private incident, uses the best
available native dialog and terminal, installs through `dpkg` with PolicyKit elevation when
needed, and verifies both receipt-free DEBs' embedded origin signatures plus the installed package
and payload hashes. On the qualified Linux Desktop
build, run this from a task whose person has explicitly enabled **Full Access** after the agent
explains why TMTK must write private state outside the project, survive task/Desktop exit, and
install the authorized package. The ordinary task sandbox made the rescue root read-only and
invocation-scoped escalation was unavailable. See
[`qualification/linux.md`](../qualification/linux.md) for the exact qualified gate and remaining
boundaries.

On macOS, before arming, the command verifies both applications and copies the current canonical
app into its private incident directory as the exact known-working rollback. It then arms a
detached supervisor and returns immediately. A blocking dialog offers **Don't Restart** and
**Relaunch Codex**. The invoking agent should finish its response without polling or waiting; the
person clicks **Relaunch Codex** after every active agent reaches a safe stopping point. **Don't
Restart** leaves the running application untouched and discards the unused rollback copy. Only
**Relaunch Codex** authorizes the supervisor to quit the current app, adopt the verified candidate,
verify it again, and launch it.

On macOS, the quit gate identifies Desktop by the exact `com.openai.codex` bundle identity and
target executable path. It also records only the exact bundled Codex CLI in the invoking command's
parent chain and waits for that PID to exit before launching Desktop, then proves the Codex state
databases accept a writer. It does not scan for process names containing `Codex` or `ChatGPT`;
unrelated CLIs, extensions, other app copies, and helpers cannot hold the restart open.

Use `--prompt TEXT` to prepend incident-specific context. The generated rescue message still states
that Desktop failed, that the resumed task is in Codex CLI without native task-to-task messaging,
and where its diagnostic, supervisor, and application-output logs live.

It recovers the invoking task's stored project directory from Codex's local task catalog, ignores
the subprocess `PWD`, and opens the same task in a terminal if the application exits before healthy
renderer readiness or stays unready through the configured grace period. See
[safe restart and rescue](safe-start.md) for lifecycle, fallback configuration, private diagnostics,
and `node bin/did-codex-launch.mjs`.

After Desktop returns, the task's project directory may not be the TMTK checkout. Run the status
command through its absolute retained-checkout path rather than assuming the current directory.

After three unsuccessful repair-and-relaunch turns, the supervisor offers **Restore
Known-Working** and **Open Terminal Line with Agent**. Restore reinstalls the exact platform
rollback, verifies it, closes any platform-owned rescue surface, and launches it after the same
strict single-writer handoff. The terminal choice keeps the same task open as an ordinary
interactive Codex CLI session. A plain supervised restart remains available when there is no
candidate to adopt. On macOS:

```sh
bin/tmtk-restart /Applications/ChatGPT.app
```

On Linux:

```sh
bin/tmtk-restart /usr/lib/chatgpt
```

That form detects and rescues launch failure but has no pre-adoption app to restore automatically.

## Local configuration

For macOS, copy [`toolkit.example.json`](../toolkit.example.json) to the ignored
`toolkit.local.json`. For the exact Linux build-8881 13-patch fleet, start from
[`toolkit.linux.example.json`](../toolkit.linux.example.json); for the exact Windows build-8881
13-patch fleet, start from [`toolkit.windows.example.json`](../toolkit.windows.example.json). The
examples contain fictional absolute paths and are not runnable until the agent replaces the
applicable values.
`enabledPatches` selects the staged fleet; the catalog
applies it in dependency-safe order regardless of array order. Every staged fleet must include
`safe-start-readiness` for supervised adoption and `renderer-patch-registry`, which publishes the
installed patch inventory and optional cross-patch capabilities after the other transforms run.

Configuration-backed patches use these values:

- `signingIdentity` optionally names a persistent identity from the local macOS Keychain. The
  default `-` uses ad-hoc signing. A stable identity keeps the designated requirement consistent for
  permissions macOS tracks that way, but some application items add their own exact-hash or
  partition policy. Keep the certificate and private key local—only the identity name belongs in the
  ignored configuration. See [stable local signing](local-signing.md) for the trust boundary;
- `codexBinary` names a separately built App Server/Core executable when a source repair must be
  integrated into a macOS or Linux staged desktop package. Windows instead uses
  `windows.codexBinaries.native` and `windows.codexBinaries.wsl` because the package contains both
  execution modes;
- `workspaceRoot` locates `.codex/task-visual-palette.json` and
  `.codex/task-attention-policy.json`;
- reasoning retention consumes exact task opt-ins from the visual palette;
- the model identity guard consumes exact task model-and-effort pins from the visual palette;
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

## Check or apply a Codex source patch

Source patches target an exact checkout of [OpenAI Codex](https://github.com/openai/codex), not a
desktop bundle:

```sh
node bin/toolkit.mjs source-patch list
node bin/toolkit.mjs source-patch PATCH-NAME check /path/to/codex
node bin/toolkit.mjs source-patch PATCH-NAME apply /path/to/codex
```

The check verifies the exact upstream commit and every touched file's qualified before or after
hash. Apply changes only that checkout. The selected source-patch README gives the focused tests
and build command; the agent should inspect and port it when the offered Codex revision differs.
The toolkit deliberately does not clone upstream, invoke a build farm, or decide that test output
is acceptable.

## Make ordinary Tinrelay sends visible

The outgoing-presentation patch does not replace or wrap Tinrelay. Agents keep using ordinary
`tinrelay --ship SHIP send`, with its complete body on standard input. Outgoing cards require a
compatible Tinrelay client to report each accepted send to a private Unix socket configured at
`~/.config/tinrelay/SHIP/outgoing-observer.json`; Codex correlates that event with the unchanged
acceptance JSON by transmission ID. The patch keeps a bounded private presentation cache under
Codex's application-support directory so an existing task can reconstruct the same outgoing card
after an app restart. This is local presentation continuity, not a Tinrelay sent archive or proof
of remote delivery.

Without that file, incoming presentation still works and accepted sends remain stock command
results. The observer configuration and exact event contract belong to Tinrelay. See the unified
[Tinrelay presentation patch](../patches/tinrelay-pointer-presentation/) for the Codex-side trust
boundary and verification of both directions.

## Stage a complete candidate

```sh
node bin/toolkit.mjs stage /path/to/Pristine-ChatGPT.app \
  /path/to/ChatGPT-MechanicsToolkit.app \
  --config /path/to/toolkit.local.json
```

For Linux DEB packages:

```sh
node bin/toolkit.mjs stage-deb /path/to/chatgpt_amd64.deb \
  /path/to/chatgpt_amd64_tmtk.deb --config /path/to/toolkit.local.json
```

For Windows MSIX packages, from Windows:

```powershell
node bin/toolkit.mjs stage-msix `
  $InstalledPackageRoot $CandidateMsix $KnownGoodMsix `
  --config $ToolkitConfig
```

Linux staging supports ASAR-scope patches only. It emits an explicit local rebuild with version
`SOURCE+tmtk1`, omits the vendor `_gpgorigin` signature member, and records the authenticated source
DEB hash and selected fleet in its package receipt. Before staging, `gpgv` verifies that source
signature against the trusted ChatGPT APT keyring already present on the system. RPM is not
implemented.

Windows staging supports the complete ASAR fleet and, when configured, the paired native/WSL Codex
binary replacement. It preserves the package identity, rebuilds the block map with MakeAppx, and
signs monotonically versioned local qualification packages with SignTool and an explicitly trusted
certificate. It does not produce a Microsoft Store artifact. The current same-source staging route
is not an ordinary cross-version upgrade path; read
[`qualification/windows.md`](../qualification/windows.md) before adoption.

The destination's parent must exist and the destination must not. macOS staging refuses a
destination inside `/Applications`; Linux requires a new `.deb` rather than a package-owned path
under `/usr/lib`; Windows requires new candidate and known-good `.msix` destinations rather than an
in-place edit under `WindowsApps`. None modifies or launches the source, and each removes only the
new destination it created if static proof fails.

The shared fleet gate requires every selected patch to begin pristine, applies the fleet in
dependency-safe order, runs syntax and behavioral probes, proves byte-identical second application,
preserves the source's exact native payload and executable modes, repacks the ASAR, and repeats
verification after packing. macOS staging then updates Electron's integrity seal and signs the
candidate with the configured identity (ad-hoc by default). Linux staging instead rebuilds the DEB
as an explicitly unsigned local TMTK package with source provenance pinned in its receipt. Windows
rebuilds and locally signs the complete MSIX package layer.

When a selected repair includes a rebuilt App Server/Core, configure the absolute replacement path
or paths described above. The `standalone-output-compaction` desktop integration requires each
vendor and replacement executable to report the same `codex-cli` version, copies the replacements
into their platform package locations, and verifies their SHA-256 values before the outer package
is finalized. No compiled binary is stored in this repository.

A green result is a statically verified candidate, not permission to adopt it and not evidence of
live behavior. The candidate is a staging artifact, not a second installed application; adoption
preserves the platform's one canonical installed package identity. See
[preparing a patched Codex update](update-workflow.md) and [staging and authority](staging.md) for
the exact boundaries.
