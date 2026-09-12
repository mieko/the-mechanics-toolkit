# Linux desktop qualification

This runbook qualifies one exact Linux Codex Desktop package, desktop/session, architecture, and
TMTK patch fleet. It has two conclusions that must remain separate:

- **DEB patchset qualification** proves the pristine package, local rebuild, selected transforms,
  installation, and healthy supervised launch.
- **Linux supervisor capability qualification** deliberately exercises blank-renderer and living
  React-Oops failures, rescue-terminal ownership, strict CLI/Desktop non-overlap, and known-good
  package restoration.

The DEB adapter has completed healthy supervised adoption from a real Codex task on one exact
Ubuntu ARM64 build. Selected live feature checks and the deliberate failure/recovery phase remain
open. Do not report Linux as generally qualified from that bounded result. RPM is outside this
runbook and remains unsupported.

Run from the Linux toolkit checkout. Keep the official DEB untouched, stage to a new file, and
write exact commands and results to a dated ignored receipt under `.work/qualifications/`.
Start the exact build-8881 13-patch selection from
[`toolkit.linux.example.json`](../toolkit.linux.example.json), replacing its three
operator-specific workspace/Tinrelay values in an ignored private copy.

## 1. Freeze the environment and identities

Record the full output of:

```sh
TMTK_ROOT="$(pwd -P)"
cat /etc/os-release
uname -m
printf 'desktop=%s\nsession=%s\nsession_type=%s\n' \
  "$XDG_CURRENT_DESKTOP" "$DESKTOP_SESSION" "$XDG_SESSION_TYPE"
dpkg-deb --field "$SOURCE_DEB" Package Version Architecture Maintainer Installed-Size
sha256sum "$SOURCE_DEB"
ar t "$SOURCE_DEB"
gpg --show-keys --with-colons /usr/share/keyrings/chatgpt-archive-keyring.gpg
node bin/toolkit.mjs inspect /usr/lib/chatgpt
dpkg-query --show --showformat='${Package}\t${Version}\t${Architecture}\n' chatgpt
```

The package must be `chatgpt`, its architecture must match the VM, and the installed app must match
the pristine DEB's inner version, build, ASAR hash, executable hash, and bundled-CLI hash. Record
the exact source URL or installer provenance. Staging and adoption must verify the embedded origin
signature with `gpgv` against this already-installed trusted APT keyring; `_gpgorigin` presence by
itself is not authentication. A key rotation that the installed keyring does not yet trust must
fail closed until the keyring is refreshed through an independently authenticated OpenAI
APT/vendor path. Record whether the session is X11 or Wayland; a pass
in one is not evidence for the other.

## 2. Prove the candidate statically

Install repository dependencies without changing the vendor package, then run:

```sh
npm install
npm run check
npm test
node bin/toolkit.mjs stage-deb "$SOURCE_DEB" "$CANDIDATE_DEB" --config "$CONFIG"
dpkg-deb --field "$CANDIDATE_DEB" Package Version Architecture Maintainer Installed-Size
sha256sum "$SOURCE_DEB" "$CANDIDATE_DEB"
ar t "$CANDIDATE_DEB"
```

The stage result must be `staged-deb-static-proof-green`. It must say the source was untouched,
the second application was byte-identical, post-pack probes passed, native payload was preserved,
and nothing was installed or launched. Record the outer candidate identity, inner application
version/build, ASAR hash, executable and CLI hashes, selected patches, and changed generated files.
The candidate must not contain the vendor `_gpgorigin` signature member and must identify itself as
a local TMTK rebuild.

Read-only checks for every active transform must be retained with the receipt. A transform that
does not recognize the exact Linux generated-code owner stays unsupported; do not widen matchers to
turn a red inventory row green.

## 3. Healthy supervised adoption

Start from the Desktop task being preserved. Confirm that the current installed app is healthy,
that the pristine `SOURCE_DEB` is its exact package, and that no other task will be surprised by a
restart. On the qualified Linux Desktop build, the initiating task also had to be set explicitly
to **Full Access** before arming. The ordinary **Ask for approval** sandbox made
`~/.codex/tmtk-rescue` read-only, and an invocation-scoped escalation request was rejected. Explain
to the person that TMTK needs to write private supervisor state outside the project, survive the
Desktop/task exit, and install the authorized package; never enable Full Access silently or treat
it as incidental. Re-check this product boundary on later builds rather than assuming it is
permanent. Then arm adoption:

```sh
bin/tmtk-restart --candidate "$CANDIDATE_DEB" \
  --candidate-source "$SOURCE_DEB" \
  --known-good "$SOURCE_DEB" /usr/lib/chatgpt
```

After the command says the supervisor is armed, finish the invoking turn. The operator clicks
**Relaunch Codex** in the selected native dialog. Record which backend was used (`kdialog`,
`zenity`, or `yad`) and whether its affirmative and cancellation labels were correct.

The receipt must prove:

1. the exact invoking bundled CLI ancestor was frozen before Desktop quit;
2. the exact `/usr/lib/chatgpt/ChatGPT` process quit and no name-based process kill occurred;
3. the state databases accepted a writer before package installation;
4. PolicyKit authorized `dpkg --install`, or the supervisor was already root;
5. `dpkg-query` reports the local candidate version and architecture;
6. the installed app matches the candidate's inner version/build and three payload hashes;
7. the directly launched Desktop process reached the one-use renderer readiness marker; and
8. the selected live patch surfaces behave as their patch READMEs require.

Record `/proc/PID/exe` for the launched main process. A green static probe does not substitute for
the selected feature checks in the real renderer.

## 4. Qualify supervisor failures when its Linux contract changes

This phase deliberately installs broken packages. It requires an operator present, explicit
authorization for the complete ordered exercise, the already-verified pristine DEB, and two
controlled candidate DEBs whose failure seams and hashes are recorded before either is installed:

```text
blank renderer -> agent repair -> living Oops x3 -> known-good restore -> healthy launch
```

The blank fixture must fail before the stock React recovery surface can render. The living-Oops
fixture must remain alive while visibly showing Codex's stock **ChatGPT hit a snag** page. Each
fixture must be a complete local DEB with a valid TMTK receipt naming the same pristine source, not
an in-place edit under `/usr/lib/chatgpt`.

For each phase, arm `tmtk-restart` with `--candidate BROKEN_DEB`,
`--candidate-source "$SOURCE_DEB"`, and `--known-good "$SOURCE_DEB"`. These controlled fixtures
are same-build replacements, so the one pristine DEB truthfully fills both vendor-package roles.
Record the incident token and state transitions. The evidence must show:

- early exit or missed readiness opens the selected Linux terminal emulator in the recorded
  project;
- the rescue terminal runs the exact bundled CLI and the same task/model/reasoning selection;
- automatic repair attempts finish through the matching Stop receipt and durable task-complete
  event;
- the rescue process exits before Desktop relaunch, with no interval in which the same task is
  live in both the CLI and Desktop;
- the emulator's `--wait` or equivalent process returns when the rescue command ends and no
  toolkit-owned terminal remains;
- three exhausted living-Oops repairs offer the native **Restore Known-Working** choice;
- restoration re-verifies and installs the private `known-good.deb` through dpkg;
- `dpkg-query` and the installed inner hashes return exactly to the pristine package; and
- the restored vendor app either emits readiness or remains cleanly alive through the documented
  ten-second pre-marker fallback, followed by a separately recorded healthy patched launch.

An unexpected password prompt, missing PolicyKit agent, terminal that cannot wait for its command,
unverified diagnostic path, package-script failure, process overlap, or application identity drift
is a failed qualification, not an instruction to weaken the adapter.

## 5. Diagnostics, cleanup, and update behavior

For every induced failure, retain the bounded diagnostic JSON, supervisor log, app standard I/O
log, selected desktop log excerpt, and renderer error evidence. The Ubuntu intake established
desktop logs at `~/.local/state/codex/logs` and renderer error state at
`~/.config/Codex/sentry/scope_v3.json`; verify those same owners on every newly qualified
distribution and application build.

After restoration, record:

```sh
dpkg-query --show --showformat='${Package}\t${Version}\t${Architecture}\n' chatgpt
apt-cache policy chatgpt
find "$HOME/.codex/tmtk-rescue" -maxdepth 2 \
  \( -name 'known-good.deb' -o -name 'candidate.deb' -o -name 'known-good.app' \) -print
```

The newest adoption may retain one private candidate/known-good pair for recovery. A later adoption
must remove only older toolkit-owned package or app payloads while preserving incident metadata
and operator-owned `.work` files. Confirm that the vendor APT repository remains configured and
record which available future version would supersede the local `SOURCE+tmtk1` build. Do not run a
system upgrade merely to manufacture that evidence.

Publish only a concise tracked summary tied to a qualification-bearing commit. Keep the raw VM
receipt private and ignored. Name every remaining boundary, including untested desktop/session,
architecture, RPM packaging, and transforms that still fail closed.
