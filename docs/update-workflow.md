# Preparing a patched Codex update

The preferred update has one interruption: obtain the offered vendor application, port and prove
the selected patch fleet while the user's current Codex remains available, then quit once and wake
directly into the patched new build. This is a goal, not a guarantee. If the offered build cannot be
obtained independently or the candidate does not pass every required check, stop and explain the
remaining interruption instead of installing an unproved application.

## Take the pre-qualified macOS path

Do not begin by patching whatever happens to be installed. On macOS, first use **Codex > Check for
Updates...** or inspect an update indicator already visible in the app. If Codex offers an update,
identify that release before choosing the toolkit source. Prefer the newest offered release already
qualified by the toolkit. This avoids porting a build that is about to be replaced, reduces
restarts and permission prompts, and keeps the user out of an unpatched stock UI between versions.

**If the offered release exactly matches a qualified build, acquire that pristine update and patch
it once. Do not patch or port the current installation first.** Keep the installed app running as
the working room while the new candidate is downloaded, patched, and proved.

An agent does not have to wait for Sparkle to finish downloading the update. Codex's official
Sparkle feed is:

```text
https://persistent.oaistatic.com/codex-app-prod/appcast.xml
```

Find the item whose title matches the release offered in the app, then use that item's `enclosure`
URL. At the time of writing, ARM64 artifacts use a versioned URL of this form:

```text
https://persistent.oaistatic.com/codex-app-prod/ChatGPT-darwin-arm64-VERSION.zip
```

Treat the appcast's exact enclosure as authoritative instead of constructing the URL when possible.
Download to a partial filename, preserve the completed archive as the untouched vendor artifact,
and unpack a staging copy:

```sh
curl -fL --progress-bar "$enclosure_url" -o ChatGPT-update.zip.part
mv ChatGPT-update.zip.part ChatGPT-update.zip
ditto -x -k ChatGPT-update.zip pristine-update
```

The public feed may know about a release before a particular installation offers it. The app's
update surface establishes that the release is offered to this user; the feed supplies the official
artifact. Do not silently substitute another feed item.

Use three pieces of evidence:

1. The root README names the build qualified by the current desktop package and source fleets.
2. [`extraction-ledger.md`](extraction-ledger.md) distinguishes static qualification from live
   acceptance and records remaining checks.
3. Qualification-bearing commit subjects preserve earlier exact build references:

   ```sh
   git log --all --oneline --grep='Codex .*build'
   ```

An earlier qualification commit is a source reference, not proof that current `main` or every patch
still supports that build. Inspect the selected commit and each chosen patch's README before using
it. Never obtain Codex from an unofficial mirror merely to match the toolkit.

Once the official bundle has been acquired without launching it, establish its exact identity
rather than trusting the feed title, filename, or marketing version:

```sh
node bin/toolkit.mjs inspect /path/to/ChatGPT.app
```

Record the reported version, build, architecture, bundle identifier, signature result, ASAR hash,
and ASAR integrity value. The feed identifies the release version; the bundle inspection establishes
its internal build. Compare both because neither implies the other. If no qualified toolkit source
matches, port directly against this pristine offered bundle. Do not first spend a restart qualifying
the soon-to-be-old installed build, and do not widen an old matcher until it passes.

## Keep one live application identity

Do not install `ChatGPT.app` and `ChatGPT-MechanicsToolkit.app` side by side. Renaming an application
does not change its bundle identity. Both would still claim `com.openai.codex` and the `codex:`,
`http:`, and `https:` URL schemes, while their helpers, updater, application data, and single-instance
routing would also identify the same product. macOS and outside integrations could select a copy by
registration history or path rather than by the user's intent.

Changing the patched copy's bundle identifier is not a small fix. It would create a different
application identity and disturb data locations, Keychain and permission policy, helper and peer
requirements, protocol registration, updater behavior, and integrations that address Codex by its
existing identity.

Use these roles instead:

- **Vendor source:** the untouched, vendor-signed application from the official installer. Keep the
  installer or another non-live artifact as recovery evidence. Prefer a disk image or compressed
  archive over a loose `.app` backup so Spotlight and Launch Services do not discover another
  launchable copy.
- **Staged candidate:** an unlaunched application outside `/Applications`, conventionally named
  `ChatGPT-MechanicsToolkit.app`. The toolkit may modify and locally sign only this copy.
- **Live application:** the single adopted application at `/Applications/ChatGPT.app`, preserving
  the vendor bundle identifier and integration surface.

## Update-before-interruption sequence

1. Confirm which release Codex is offering in its macOS update surface.
2. Obtain the official macOS artifact without installing or launching its application, using the
   matching Sparkle enclosure directly when useful.
3. Verify the vendor signature, bundle identifier, architecture, version, and build. Stop if the
   artifact does not match the intended update.
4. Retain the vendor artifact untouched and use its application as the staging source.
5. Inspect upstream behavior, retire patches Codex now owns, and port only the repairs that still
   matter. For a [`source-patches/`](../source-patches/) repair, use the exact matching upstream
   Codex revision, run its focused tests, and build the `codex` executable before desktop staging.
6. Put the verified build's absolute path in `codexBinary` when its integration patch is selected.
   The macOS stage copies it into `Contents/Resources/codex` and signs it as part of the candidate;
   do not hand-edit the vendor app after signing.
7. Stage the complete selected fleet as `ChatGPT-MechanicsToolkit.app` outside `/Applications` and
   require the toolkit's complete static proof.
8. Do all work that can be completed in the current Codex first. Keep the staged candidate outside
   `/Applications` and unlaunched.
9. With explicit operator authority, run [`tmtk-restart`](safe-start.md) with `--candidate`, the
   staged app, and the canonical `/Applications/ChatGPT.app` path. Before showing its confirmation,
   the supervisor verifies both apps and captures the current canonical app inside its private
   incident directory as the exact known-working rollback. After **Relaunch Codex**, it waits for
   the old process to exit, adopts the still-verified candidate, and launches it. A failed renderer
   returns to the originating task with local evidence; three unsuccessful repairs lead to an
   explicit known-working restore or interactive terminal choice.
10. Exercise the narrow live checks for the selected fleet. Retain the supervisor incident until
    the new build is accepted so its diagnostics and known-working rollback remain available.
11. Close the update after acceptance. Delete the staged candidate and unpacked staging source,
    remove work directories from older releases, and keep at most one pristine vendor ZIP when a
    compact restaging source is useful. Retain a failed candidate or failure fixture only while it
    supports an active diagnosis or qualification.

## Troubleshoot ambiguous Sparkle state

The quick path above should make this section unnecessary. Use these checks only if someone has
already replaced `/Applications/ChatGPT.app` before the old process quit, or if it is unclear
whether Sparkle may replace the staged application on exit.

Codex Desktop uses Sparkle for macOS application updates. Its visible update indicator describes
what the **running process** knows; it does not by itself prove that an installer is downloaded,
queued, or able to replace the application on quit. Likewise, these preferences are evidence of
update policy or history, not proof of a pending installation:

- `SUAutomaticallyUpdate = 1` means automatic updating is enabled;
- `SULastCheckTime` records a check; and
- `CodexSparkleSeenUpdateVersions` records versions the application has seen.

This distinction matters when a staged candidate has already replaced `/Applications/ChatGPT.app`
while the old process is still running. The old process keeps its original executable and open
resources mapped. Its update badge may therefore describe the old build even though the canonical
path now contains the patched new build. `ps` can display the canonical launch path and still hide
that distinction; `lsof` shows the bundle actually backing the live process.

Before quitting in that unusual order, inspect all three states:

```sh
live_pid="$(pgrep -x ChatGPT | head -1)"
lsof -p "$live_pid" | rg ' txt .*ChatGPT.*\.app/Contents/MacOS/ChatGPT'

/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' \
  /Applications/ChatGPT.app/Contents/Info.plist
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' \
  /Applications/ChatGPT.app/Contents/Info.plist

ps -axo pid=,ppid=,etime=,command= | \
  rg -i 'InstallerLauncher|Autoupdate|Sparkle' | rg -v 'rg -i'

sparkle_cache="$HOME/Library/Caches/com.openai.codex/org.sparkle-project.Sparkle"
find "$sparkle_cache/Installation" "$sparkle_cache/Launcher" \
  -mindepth 1 -maxdepth 4 -print
find "$sparkle_cache/PersistentDownloads" -mindepth 1 -maxdepth 5 -print
```

The first check identifies the bundle backing the live process. The next two identify the build at
the canonical application path. The process and cache checks look for an armed updater, installation
queue, launcher state, or retained payload. An empty `Installation` and `Launcher`, no updater
helper, and no payload for the offered build are evidence that the badge is only seen/available
state; there is no observed staged installer for quit to commit. A persistent-download directory
may contain an older delta, so identify its build rather than treating any file there as current.

If any updater helper or current-build queue is present, do not race it. Keep the proved candidate
and recovery artifact outside `/Applications`, let the supported update path finish or cancel it
through the application, verify the resulting vendor build, and only then adopt the patched
candidate. Do not delete or rewrite Sparkle state to force an outcome. If the queue is clear but the
application identities remain ambiguous, prefer the ordinary quit-then-adopt sequence.

Do not patch Sparkle's private download cache. An update being offered does not prove that a complete
installer or application is already present there, and Sparkle may replace, reject, or remove its
own working files. Obtain an ordinary vendor artifact and keep the toolkit's staging ownership
separate.

The toolkit's only installation path is the explicit `tmtk-restart --candidate` handoff. Static
proof, operator authority, supervised application replacement, relaunch, and live acceptance
remain distinct seams; staging alone never adopts an application.
