# The Mechanic's Toolkit agent guidance

This repository is a source-only, inspectable toolkit for narrowly patching local Codex Desktop
installations and exact revisions of the open-source Codex App Server/Core. Its owner is The
Mechanic. Its one-sentence contract is: **recognize an exact known source or package structure, make
one bounded repair in an explicit target, and fail closed when the structure changes.**

## Boundaries

- Never redistribute ChatGPT/Codex application bundles, extracted ASAR contents, credentials,
  profiles, task databases, or other vendor or user data.
- Read-only inspection is the default. A check must not rewrite the target.
- Desktop patch commands may modify only an explicitly supplied extracted ASAR directory or staged
  application. Source-patch commands may modify only an explicitly supplied Codex Git checkout at
  the exact qualified revision. Building, application staging, installation, and launch remain
  separate authority seams.
- Staging must target a new, non-live artifact, must never launch it, and must remove only the new
  partial destination it created on failure. On macOS that means a `.app` outside `/Applications`;
  on Linux it means a nonexistent output DEB rather than package-owned files under `/usr/lib`.
  Candidate adoption belongs only to the restart supervisor: it requires an explicit operator
  action, verifies the platform's exact rollback before replacement, and preserves that
  known-working artifact through live acceptance.
- Prefer acquiring an offered vendor application before interrupting the running app. Keep that
  vendor bundle untouched, stage and prove the complete selected fleet while the current app stays
  available, then ask for one final quit-and-relaunch seam.
- On macOS, do not install stock and patched copies side by side under different filenames while
  both retain `com.openai.codex`. The patched candidate may be named
  `ChatGPT-MechanicsToolkit.app` while staged and unlaunched, but the adopted application occupies
  the canonical `/Applications/ChatGPT.app` path. Preserve the pristine vendor installer or another
  non-live recovery artifact instead.
- Match semantic owners and complete structural contracts. Unknown, partial, duplicated, or split
  ownership fails closed; never broaden a matcher merely to make a new build pass.
- Keep local names, task IDs, ship identities, absolute user paths, and private policy out of source.
  Portable configuration belongs in a documented local file whose example contains fictional data.
- Treat patches as `active`, `dormant`, or `retired`. Continued applicability is not proof that a
  patch remains useful.
- Keep the patch registry small and renderer-local. Every staged ASAR fleet must include it, and
  every recognized ASAR patch publishes a versioned presence descriptor so a future renderer patch
  can choose a compatible path from installed facts rather than DOM probing. It may also expose a
  small optional capability when that removes real duplication. It is not an event bus, dependency
  graph, package manager, or cross-process protocol.
- Give each patch one directory under `patches/` with its transform and a `README.md` that states
  purpose, current state, owned seam, compatibility evidence, verification, and non-goals. The root
  README is the fleet-wide instrument panel; patch READMEs are the maintenance logs.
- Keep each user-visible repair owned by that one patch directory across operating systems. Shared
  generated-JavaScript profiles stay in the patch's main transform; when an observed platform build
  genuinely has a different owner shape, put only that exact profile under the patch's
  `profiles/` directory. Do not clone the fleet into macOS, Linux, and Windows patch trees.
- Keep package formats, application identity, signing, process discovery, dialogs, launch, and
  rescue-terminal behavior under `src/platforms/` and the platform package/staging modules. Keep
  live evidence and operator procedures under `qualification/<platform>.md`. A shared supervisor
  invariant must not be reimplemented independently by each adapter.
- Give each App Server/Core repair one directory under `source-patches/` with its exact diff and a
  `README.md` that states the upstream tag/commit, behavior, tests, build command, integration seam,
  and non-goals. Do not fold Rust source application into the desktop staging transform.
- Do not commit, publish, tag, or create a remote unless the operator explicitly asks.

## Verification

- Start with the narrowest unit or fixture test, then check syntax for every executable module.
- For a supported installed build, verify against a disposable extracted ASAR tree before claiming
  compatibility.
- For a source patch, verify exact before/after target hashes, apply it to a disposable checkout of
  the qualified commit, and run its focused upstream tests before claiming compatibility.
- A staged application is acceptable only after complete patch checks, changed-module syntax,
  focused causal probes, lazy-initializer activation, ASAR header integrity, code-signature
  verification, and byte-identical second application.
- Live acceptance remains separate: launch, open a real task, and exercise the exact changed
  behavior. Static probes do not prove a usable application.

## Public extraction

This repository is the canonical source for the portable patches extracted here. Private installed
copies and older operational scripts are compatibility evidence, not a second source tree. Moving a
patch here still does not install or adopt it: live qualification and application replacement remain
explicit operator decisions.
