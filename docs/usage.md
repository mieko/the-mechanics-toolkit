# Using the toolkit

The toolkit has two explicit targets: an open-source Codex checkout for App Server/Core source
patches, and a Codex Desktop application or extracted ASAR tree for package patches. Neither lane
installs, replaces, launches, or rolls back an application.

## Requirements

The current patch-staging workflow targets macOS and requires Node.js 24 LTS or a newer supported
release. The generated-code and packaging boundaries measured on Windows and Linux are recorded in
[`platform-compatibility.md`](platform-compatibility.md); transform recognition alone is not package
or live qualification. Install the pinned local Electron ASAR dependency and run the repository
checks:

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

## Restart with automatic rescue

After a candidate has been adopted with the required authority, use the safe-start supervisor from
the Codex task that should own recovery:

```sh
tmtk-restart /Applications/ChatGPT.app
```

The command arms a detached supervisor and returns immediately. On macOS, a blocking dialog offers
**Relaunch Codex** and **Cancel**. The invoking agent should finish its response without polling or
waiting; the person clicks **Relaunch Codex** after reading it. **Cancel** leaves the running
application untouched. Codex may then present its own schedules warning; the supervisor waits for
the person's answer, and cancelling that native quit also leaves the app open without starting
rescue.

Use `--prompt TEXT` to prepend incident-specific context. The generated rescue message still states
that Desktop failed, that the resumed task is in Codex CLI without native task-to-task messaging,
and where its diagnostic, supervisor, and application-output logs live.

It recovers the invoking task's stored project directory from Codex's local task catalog, ignores
the subprocess `PWD`, and opens the same task in a terminal if the application exits before healthy
renderer readiness or stays unready through the configured grace period. See
[safe restart and rescue](safe-start.md) for lifecycle, fallback configuration, private diagnostics,
and `did-codex-launch`.

## Local configuration

Copy [`toolkit.example.json`](../toolkit.example.json) to the ignored `toolkit.local.json`, or use
another private path. `enabledPatches` selects the staged fleet; the catalog applies it in
dependency-safe order regardless of array order. Any selection containing an ASAR patch must also
include `renderer-patch-registry`, which publishes the installed patch inventory and optional
cross-patch capabilities after the other transforms run.

Configuration-backed patches use these values:

- `signingIdentity` optionally names a persistent identity from the local macOS Keychain. The
  default `-` uses ad-hoc signing. A stable identity keeps the designated requirement consistent for
  permissions macOS tracks that way, but some application items add their own exact-hash or
  partition policy. Keep the certificate and private key local—only the identity name belongs in the
  ignored configuration. See [stable local signing](local-signing.md) for the trust boundary;
- `codexBinary` names a separately built App Server/Core executable when a source repair must be
  integrated into the staged desktop package;
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
`tinrelay --ship SHIP send`, with its complete body on standard input. A compatible Tinrelay
client optionally reports each accepted send to a private Unix socket configured at
`~/.config/tinrelay/SHIP/outgoing-observer.json`; Codex correlates that event with the unchanged
acceptance JSON by transmission ID. The patch keeps a bounded private presentation cache under
Codex's application-support directory so an existing task can reconstruct the same outgoing card
after an app restart. This is local presentation continuity, not a Tinrelay sent archive or proof
of remote delivery.

The observer configuration and exact event contract belong to Tinrelay. See the unified
[Tinrelay presentation patch](../patches/tinrelay-pointer-presentation/) for the Codex-side trust
boundary and verification of both directions.

## Stage a complete candidate

```sh
node bin/toolkit.mjs stage /path/to/Pristine-ChatGPT.app \
  /path/to/ChatGPT-MechanicsToolkit.app \
  --config /path/to/toolkit.local.json
```

The destination's parent must exist and the destination must not. Staging refuses `/Applications`,
never modifies or launches the source, and removes only the new destination it created if static
proof fails.

The command requires every selected patch to begin pristine, applies the fleet in dependency-safe
order, runs syntax and behavioral probes, proves byte-identical second application, preserves the
source's exact native payload and executable modes, repacks the ASAR, updates Electron's integrity
seal, signs the candidate with the configured identity (ad-hoc by default), and repeats verification
after packing.

When a selected repair includes a rebuilt App Server/Core, set `codexBinary` to the absolute path
of the verified build. The `standalone-output-compaction` desktop integration requires the vendor
and replacement executables to report the same `codex-cli` version, copies the replacement into the
candidate at `Contents/Resources/codex`, and verifies its SHA-256 before the full bundle is signed.
No compiled binary is stored in this repository.

A green result is a statically verified candidate, not permission to adopt it and not evidence of
live behavior. The candidate name is a staging convention, not a second installed application;
adoption preserves the one canonical `/Applications/ChatGPT.app` identity. See
[preparing a patched Codex update](update-workflow.md) and [staging and authority](staging.md) for
the exact boundaries.
