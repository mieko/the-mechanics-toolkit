# The Mechanic's Toolkit agent guidance

This repository is a source-only, inspectable toolkit for narrowly patching local Codex Desktop
installations. Its owner is The Mechanic. Its one-sentence contract is: **recognize an exact known
Codex Desktop structure, make one bounded repair in a staged copy, and fail closed when the
structure changes.**

## Boundaries

- Never redistribute ChatGPT/Codex application bundles, extracted ASAR contents, credentials,
  profiles, task databases, or other vendor or user data.
- Read-only inspection is the default. A check must not rewrite the target.
- Patch commands may modify only an explicitly supplied extracted ASAR directory. Application
  staging and installation require separate commands and must remain separate authority seams.
- The staging command must refuse a destination inside `/Applications`, must never launch it, and
  must remove a newly created partial destination on failure. A future installation command must
  require an explicit operator action and preserve a recoverable external copy.
- Match semantic owners and complete structural contracts. Unknown, partial, duplicated, or split
  ownership fails closed; never broaden a matcher merely to make a new build pass.
- Keep local names, task IDs, ship identities, absolute user paths, and private policy out of source.
  Portable configuration belongs in a documented local file whose example contains fictional data.
- Treat patches as `active`, `dormant`, or `retired`. Continued applicability is not proof that a
  patch remains useful.
- Keep the patch registry small and renderer-local. It is discovery and optional capability access,
  not an event bus, dependency graph, package manager, or cross-process protocol.
- Give each patch one directory under `patches/` with its transform and a `README.md` that states
  purpose, current state, owned seam, compatibility evidence, verification, and non-goals. The root
  README is the fleet-wide instrument panel; patch READMEs are the maintenance logs.
- Do not commit, publish, tag, or create a remote unless the operator explicitly asks.

## Verification

- Start with the narrowest unit or fixture test, then check syntax for every executable module.
- For a supported installed build, verify against a disposable extracted ASAR tree before claiming
  compatibility.
- A staged application is acceptable only after complete patch checks, changed-module syntax,
  focused causal probes, lazy-initializer activation, ASAR header integrity, code-signature
  verification, and byte-identical second application.
- Live acceptance remains separate: launch, open a real task, and exercise the exact changed
  behavior. Static probes do not prove a usable application.

## Public extraction

The current private kit remains the operational source until each patch is deliberately extracted,
stripped of ship-local assumptions, tested here, and adopted back through an explicit transition.
Copying a file into this repository does not transfer operational authority or make the public
version canonical.
