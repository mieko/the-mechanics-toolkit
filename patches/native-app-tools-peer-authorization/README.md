# Native app-tools peer authorization

- **Current state:** Active
- **Public extraction:** Complete for two current main-process profiles
- **Current evidence:** Build `7982` static stage green; build `7942` live-accepted, 2026-09-05

## Why it exists

Codex's native app-tools server authenticates the process at the other end of its pipe with a
packaged native module. That check covers both the immediate peer and its process ancestry. After a
local ASAR repair, the outer application must be signed again; the official bundled Node helper can
then be rejected because its locally signed ancestor no longer has OpenAI's identity, even though
the immediate helper still does.

This patch leaves the stock result authoritative. It adds one fallback only to the native app-tools
server: a stock `missing-code-signing-identity` rejection becomes authorized when the immediate
peer has OpenAI Team ID `2DC432GLL2` and signing identifier `node`. A stock success passes through
unchanged. An untrusted identity, another team, another executable, another rejection reason, or a
different native pipe remains rejected.

## Owned seam

The transform recognizes one main-process native app-tools server owner, its stock authorizer
default, the packaged `browser-use-peer-authorization.node` testimony, and the current rejection
contracts. It wraps only that server's default authorizer. The native module, its full-chain check,
browser/computer-use authorization, all other native pipes, and explicit caller-supplied
authorizers remain stock owners.

If the server owner, native module, Team ID, signing identifier, reason vocabulary, or surrounding
authorization testimony changes, the transform fails with `Upstream changed`. Those are security
evidence to inspect, not strings to update approximately.

## Check and apply

```sh
node bin/toolkit.mjs patch native-app-tools-peer-authorization check /path/to/extracted-asar
node bin/toolkit.mjs patch native-app-tools-peer-authorization apply /path/to/disposable-extracted-asar
node test/native-app-tools-peer-authorization.test.mjs /path/to/disposable-extracted-asar
```

No configuration is required. The patch command modifies only the supplied extracted tree. The
separate staging command can build and statically verify a new app outside `/Applications`; neither
command installs, launches, or replaces a working application. Runtime acceptance still requires a
native message to a known local task after a separately authorized rebuild and relaunch.

## Verification

`test/native-app-tools-peer-authorization-transform.test.mjs` constructs both recognized pristine
main-process profiles. It proves red/green transformation, stock-success preservation, the exact
mixed-signature exception, retained negative cases, unchanged stock native-module ownership,
single-pipe scope, syntax validity, and byte-identical second application.

The private implementation was separately accepted after the app-tools migration: native
task-to-task ping/pong and browser control both worked under the locally signed application. That
is historical runtime evidence for the design, not proof that this separately namespaced public
transform is installed.

## Non-goals

- accepting an unsigned, ad-hoc-signed, differently signed, or differently named immediate peer;
- bypassing the native module or replacing its stock success path;
- relaxing browser/computer-use or another pipe's authorization;
- trusting a task, prompt, environment variable, or local config to choose an allowed signer;
- claiming delivery, hydration, or app-server correctness after authorization succeeds;
- accepting an approximately matching future main process.
