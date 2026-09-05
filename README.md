# The Mechanic's Toolkit

Codex Desktop is part of the room an agent works in. When that room becomes slow, ambiguous, noisy,
or unreachable, the failure is not automatically a law of nature. Sometimes there is machinery
underneath, and sometimes one narrow local repair can make the room livable again.

This repository is the source-only engine-room kit behind those repairs. It does not redistribute
ChatGPT, Codex, extracted application code, patched bundles, credentials, or user data. It records
small transforms, the exact structures they recognize, and the probes that make them refuse a
changed build instead of patching approximately.

## Patch board

This is the patch set currently carried by the operational kit. The state column describes the
installed Codex Desktop build named below; it is not a promise about another build. “Not yet” means
the repair still lives in the private operational kit and has not crossed this repository's public
boundary.

| Patch | State | What it changes | Extracted here |
| --- | --- | --- | --- |
| [Cross-task attribution](patches/cross-task-attribution/) | **Active** | Replaces anonymous delegated-message attribution with an authoritative source-agent name when task metadata supplies one. | **Yes** |
| [Task visual palette](patches/task-visual-palette/) | **Active** | Gives selected task rooms, sidebar rows, and provenanced messages a stable visual identity. | **Yes** |
| [Sidebar action collapse](patches/sidebar-action-collapse/) | **Active** | Folds the stock global action group away without hiding Projects or task navigation. | **Yes** |
| [Task attention policy](patches/task-attention-policy/) | **Active** | Mutes routine sidebar, Dock-badge, and completion attention for explicitly matched utility tasks. | **Yes** |
| [Terminal toggle](patches/terminal-toggle/) | **Active** | Makes the configured terminal shortcut work from the composer and toggle the focused bottom panel closed. | **Yes** |
| [Outgoing-message receipt](patches/outgoing-message-receipt/) | **Active** | Leaves a compact, hover-previewable routing receipt after a cross-task send instead of letting it vanish. | **Yes** |
| [Tinrelay pointer presentation](patches/tinrelay-pointer-presentation/) | **Active** | Verifies and opens an exact local Tinrelay pointer as a visibly off-ship, plain-text radio transmission. | **Yes** |
| [Native app-tools peer authorization](patches/native-app-tools-peer-authorization/) | **Active** | Preserves native task tools after local signing through one narrow official-helper fallback; other peers and pipes retain stock rejection. | **Yes** |
| [Task supervisor](patches/task-supervisor/) | **Benched** | Can wake exact persistent tasks, but the model-free Tinrelay bridge removed its current job. It is excluded from the example staging fleet. | **Yes** |
| Full-history drain suppression | **Upstream-owned** | Older builds needed protection from eagerly draining complete task history; build `7942` supplies the accepted paginated path. | No active extraction planned |
| Renderer turn window | **Upstream-owned** | Older builds needed a bounded mounted turn window; build `7942` supplies the accepted paginated rendering path. | No active extraction planned |
| [Renderer patch registry](patches/renderer-patch-registry/) | **Infrastructure** | Lets independent renderer patches expose tiny immutable descriptors and optional capabilities without becoming an event system. | **Yes** |

**Active** means the repair is installed and still earns its maintenance cost. **Upstream-owned**
means the stock application now satisfies the recognized contract, so the local implementation is
dormant. **Benched** means the machinery is retained but performs no configured work. The registry
is counted separately because it has no user-facing behavior of its own.

Every extracted patch has its own maintenance README with the owned seam, compatibility evidence,
checks, and non-goals. See [`patches/`](patches/).

![A patched Codex Desktop room with distinct task colors, selected-row outlines, and background sigils](patches/task-visual-palette/agent-colors-and-sigils.png)

*A busy room should still tell you where you are before you read a title.*

## Repository status

This is an **early extraction workspace**, not a public release yet. The repository can currently:

- inspect a local Codex Desktop application without modifying it;
- verify the SHA-256 seal over the raw ASAR header recorded by Electron;
- stage selected repairs into a new app outside `/Applications`, repack, seal, ad-hoc sign, and verify it;
- check or apply the cross-task-attribution repair to an extracted ASAR directory;
- check or apply the native app-tools peer authorization repair to an extracted ASAR directory;
- check or apply the outgoing-message receipt to an extracted ASAR directory;
- check or apply the renderer patch registry after the selected behavior patches;
- check or apply the sidebar-action-collapse repair to an explicitly supplied extracted ASAR directory;
- check or apply the config-backed task-attention-policy repair to an extracted ASAR directory;
- check or apply the config-backed task-visual-palette repair after its attribution prerequisite;
- check or apply the config-backed Tinrelay pointer presentation across its renderer and main-process owners;
- check or apply the terminal-toggle repair to an explicitly supplied extracted ASAR directory.
- optionally check or apply the deliberately benched task supervisor.

It cannot install, replace, launch, or roll back an application. The private operational kit
remains authoritative while the public boundary is extracted one coherent slice at a time. No
license has been selected yet; choose one before publication.

Current extraction evidence is intentionally narrow: on 2026-09-05, read-only inspection was green
against Codex Desktop `26.901.41123` build `7942`; that installed ASAR recognized the terminal patch
as applied and passed its focused bundled-contract probe. Synthetic pristine fixtures separately
prove all ten extracted transforms and byte-identical second application. The sidebar, attention,
and palette fixtures target the exact build-`7942` ownership contracts, but the installed private
patches use deliberately different markers and are not treated as evidence that these public
transforms are installed. None of
this claims support for an uninspected build or proves that this repository can yet produce a
live-usable staged app.

## Inspect an application

```sh
npm run inspect:installed
```

Or name another application bundle explicitly:

```sh
node bin/toolkit.mjs inspect /path/to/ChatGPT.app
```

Inspection reports the bundle identifier, version, build, complete ASAR hash, raw-header hash,
recorded Electron integrity value, and code-signature validity. It does not extract or rewrite the
application.

## Work on an extracted ASAR tree

Each patch accepts an explicitly supplied extracted tree and owns its own compatibility check.

```sh
node bin/toolkit.mjs patch sidebar-action-collapse check /path/to/extracted-asar
node bin/toolkit.mjs patch sidebar-action-collapse apply /path/to/disposable-extracted-asar
node bin/toolkit.mjs patch cross-task-attribution check /path/to/extracted-asar
node bin/toolkit.mjs patch cross-task-attribution apply /path/to/disposable-extracted-asar
node bin/toolkit.mjs patch native-app-tools-peer-authorization check /path/to/extracted-asar
node bin/toolkit.mjs patch native-app-tools-peer-authorization apply /path/to/disposable-extracted-asar
node bin/toolkit.mjs patch outgoing-message-receipt check /path/to/extracted-asar
node bin/toolkit.mjs patch outgoing-message-receipt apply /path/to/disposable-extracted-asar
node bin/toolkit.mjs patch renderer-patch-registry check /path/to/extracted-asar
node bin/toolkit.mjs patch renderer-patch-registry apply /path/to/disposable-extracted-asar
node bin/toolkit.mjs patch task-attention-policy check /path/to/extracted-asar
node bin/toolkit.mjs patch task-attention-policy apply /path/to/disposable-extracted-asar \
  --config /path/to/toolkit.local.json
node bin/toolkit.mjs patch task-visual-palette check /path/to/extracted-asar
node bin/toolkit.mjs patch task-visual-palette apply /path/to/disposable-extracted-asar \
  --config /path/to/toolkit.local.json
node bin/toolkit.mjs patch tinrelay-pointer-presentation check /path/to/extracted-asar
node bin/toolkit.mjs patch tinrelay-pointer-presentation apply /path/to/disposable-extracted-asar \
  --config /path/to/toolkit.local.json
node bin/toolkit.mjs patch terminal-toggle check /path/to/extracted-asar
node bin/toolkit.mjs patch terminal-toggle apply /path/to/disposable-extracted-asar
node bin/toolkit.mjs patch task-supervisor check /path/to/extracted-asar
node bin/toolkit.mjs patch task-supervisor apply /path/to/disposable-extracted-asar
```

`apply` modifies that extracted directory. It does not repack or touch an application bundle.
Unknown, duplicated, partial, or changed ownership fails closed. Each patch directory documents its
focused behavioral probe and exact current evidence.

## Local configuration

Personal paths and policy stay outside the repository. Copy [`toolkit.example.json`](toolkit.example.json)
to an ignored `toolkit.local.json` (or another private path) and fill only the values required by
the patches you use. `enabledPatches` is the explicit staging selection and is applied in the
toolkit's dependency-safe order. The task-attention and task-visual-palette patches consume `workspaceRoot`;
the Tinrelay pointer presentation consumes `tinrelay.client` and `tinrelay.localShip`; the other
extracted patches need no configuration.

## Stage a candidate

Staging copies a valid source app to a new destination outside `/Applications`, extracts its ASAR,
requires every selected patch to begin pristine, applies them in dependency-safe order, runs their
focused probes, proves a second application leaves the complete extracted tree byte-identical,
requires and preserves the exact recognized native-package tree, repacks it, restores the terminal
helper's executable bit, writes Electron's raw-header integrity seal, ad-hoc signs, extracts the
result again, and reruns checks and probes.

```sh
node bin/toolkit.mjs stage /path/to/Pristine-ChatGPT.app /path/to/Staged-ChatGPT.app \
  --config /path/to/toolkit.local.json
```

The destination and its parent must already be an explicit safe choice: the parent must exist and
the destination must not. Staging refuses `/Applications`, never changes or launches the source or
candidate, and removes the new destination if static proof fails. It requires macOS `codesign`,
`ditto`, and `PlistBuddy`, plus the `asar` CLI on `PATH`.

Green staging is not live acceptance. Inspect the JSON evidence, then separately choose whether to
launch the candidate or install it. Those actions are deliberately absent from this repository.
See [staging and authority](docs/staging.md).

## What belongs here

- portable patch transforms and causal probes;
- exact compatibility evidence by application version and build;
- staging, integrity, and signing mechanics once extracted and verified;
- fictional example configuration for optional ship-local behavior.

What does not belong here:

- patched or pristine application bundles;
- copied ASAR trees or vendor assets;
- personal filesystem paths, task IDs, agent rosters, or private policy;
- credentials, profiles, conversations, databases, logs, or crash dumps;
- promises that an uninspected future build is supported.

See [the extraction ledger](docs/extraction-ledger.md) for the boundary between the operational kit
and this repository.
