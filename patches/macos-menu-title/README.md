# macOS menu title

- **Current state:** Active
- **Public extraction:** Complete
- **Current evidence:** Build `7982` static stage green; build `7942` live-accepted, 2026-09-05

## Why it exists

Codex Desktop can use the Codex icon while macOS still labels its application menu `ChatGPT`. That
small contradiction is present in every room because macOS places the application name at the
leading edge of the menu bar.

This patch restores that one visible label to `Codex`.

## Owned seam

The packaged application already identifies its product as Codex internally, and its native menu
uses Electron's standard macOS application-menu role. macOS takes the visible application-menu
title from `CFBundleName` in `Contents/Info.plist`; build `7942` sets that key to `ChatGPT`.

The transform changes only `CFBundleName` to `Codex`. It deliberately leaves the bundle identifier,
executable, display name, data directories, update channel, and all ChatGPT-facing copy untouched.
If any of those recognized bundle facts or the original title changes, the patch refuses to apply.

## Check and apply

Unlike renderer patches, this transform targets a staged `.app` bundle:

```sh
node bin/toolkit.mjs patch macos-menu-title check /path/to/Staged-ChatGPT.app
node bin/toolkit.mjs patch macos-menu-title apply /path/to/Staged-ChatGPT.app
node test/macos-menu-title.test.mjs /path/to/Staged-ChatGPT.app
```

The normal `stage` command applies it only to the new candidate before the candidate is signed. It
does not alter the source or install the result.

## Verification

`test/macos-menu-title-transform.test.mjs` proves the exact `ChatGPT` to `Codex` transition, preserves
the surrounding bundle identity, rejects unrecognized names and bundle shapes, and requires a
byte-identical second application. The staged-app test proves that a mixed ASAR and bundle patch
fleet is signed and retains valid Electron ASAR integrity.

Live acceptance passed on 2026-09-05: the installed build launched, displayed `Codex` as the leading
macOS menu, and retained the selected renderer patch fleet.

## Non-goals

- renaming the `.app`, executable, process, bundle identifier, or application-support directory;
- changing ChatGPT product copy or account language;
- changing the Dock icon or Finder display name;
- disabling updates or altering signing policy.
