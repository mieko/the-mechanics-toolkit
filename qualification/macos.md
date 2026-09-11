# macOS desktop qualification

This document contains two related qualifications with separate conclusions:

- **Patchset qualification** proves that one exact Codex Desktop version/build and enabled patch
  fleet passes complete static proof and launches cleanly. Each selected feature needs either a
  current live result or an explicitly recorded earlier live result whose semantic owner and
  behavior remain equivalent. Changed, uncertain, or newly composed seams require a current live
  check. The supervisor surrounds that restart as recovery protection, but must not activate.
- **Supervisor capability qualification** deliberately exercises blank-renderer and living-Oops
  failures to prove that recovery itself works. It is repeated when the supervisor contract or one
  of its relevant integration boundaries changes, not merely because another patch was added or
  restyled.

Do not report a rescued patchset launch as a patchset pass. Do not report a clean patchset launch as
proof of the supervisor's Terminal rescue path.

This is a maintainer/porter runbook. An agent installing a patchset that already has an exact
matching qualification receipt uses sections 1, 3, 4, and the patchset portion of section 5. It
must not run section 2 merely to reproduce the maintainer's evidence. Section 2 requires explicit
authority to replace and deliberately break the canonical application, a verified restoration
source, a technical operator present, and a current reason from its invalidation list.

Run from the toolkit repository. Keep an untouched vendor application as `SOURCE_APP`, stage to a
new path outside `/Applications` as `CANDIDATE_APP`, and use the private toolkit configuration as
`CONFIG`. Record the exact source URL or installer provenance, toolkit commit, source-patch commit,
version, build, hashes, commands, and outputs in one dated qualification receipt under ignored
`.work/qualifications/` state. After acceptance, summarize the qualification in the tracked
[`extraction ledger`](../docs/extraction-ledger.md) and a qualification-bearing commit; adopters do
not depend on the ignored raw receipt.

## 1. Prove the complete candidate statically

```sh
npm install
npm run check
npm test
node bin/toolkit.mjs inspect "$SOURCE_APP"
node bin/toolkit.mjs stage "$SOURCE_APP" "$CANDIDATE_APP" --config "$CONFIG"
```

The stage must start from a pristine signed vendor bundle, apply every configured patch together,
run every patch probe before and after packing, preserve native payloads and modes, pass a second
application without changing bytes, verify the ASAR seal and signature, and leave the source
untouched. If the fleet includes a rebuilt Codex binary, the receipt must also contain the exact
upstream source commit, patch state, focused Rust tests, release build command, executable hash, and
same-version integration proof.

Adoption into canonical `/Applications/ChatGPT.app` remains an explicit operator action. The
supervisor captures the currently working canonical app before adopting a candidate; do not call a
staged candidate live-qualified before supervised adoption and the remaining phases.

## 2. Qualify supervisor capability when its contract changes

This is a separate capability qualification, not a required destructive exercise for every new
patchset. Re-run it when any of these inputs changes materially:

- supervisor, rescue-runner, stop-hook, handoff, process-quiescence, or platform-adapter code;
- the patched renderer-readiness publication seam;
- the bundled Codex CLI's resume, model-selection, hook, rollout-completion, or state-database
  behavior; or
- the operating-system or terminal lifecycle being claimed as qualified.

A different selection of unrelated presentation or policy patches does not invalidate an existing
supervisor capability receipt. A new Desktop build requires inspection of the readiness seam and
bundled CLI; repeat this section when either relevant boundary changed or cannot be shown
equivalent. Record the capability receipt independently from the patchset receipt.

<!--
This phase is intentionally not an executable acceptance test. A process launched from Codex
inherits CODEX_THREAD_ID and CODEX_SESSION_ID, and those values take precedence over
RESCUE-AGENT.json. An earlier automated fixture resumed the live qualifying task as a second writer
and caused a duplicate-ordinal rollout incident. Do not recreate that automation.
-->

At a witnessed qualification seam, manually prepare two controlled broken forms of the fully
patched candidate. Begin with a verified, working canonical app so the supervisor can capture the
real pre-adoption rollback:

1. **Blank renderer:** fail before the stock React recovery surface can render. Electron may open a
   window and the App Server may initialize, but the healthy route tree never emits readiness and
   no useful recovery page appears.
2. **Living Oops renderer:** throw inside the part of the mounted React tree covered by Codex's stock
   top-level error boundary. Codex must remain alive while visibly showing its stock **ChatGPT hit a
   snag** recovery page.

For each fixture, rebuild the ASAR seal, sign it, inspect it, and record its exact hash and failure
seam. Do not replace or launch it during preparation. The supervisor must perform the real canonical
adoption during each phase; a parallel or isolated launch does not qualify recovery of the
canonical application. A fixture that produces the wrong visible state does not count for the
other case.

Prepare and verify both fixtures before installing either one. Record the ordered phase queue and a
distinct token for each phase in the qualification receipt:

```text
blank renderer -> agent repair -> living Oops x3 -> known-working restore -> healthy launch
```

Before installing the first fixture, show the person the prepared fixture and restoration hashes,
the ordered phase queue, and the actions they will need to perform, then ask once whether to begin.
That authorization covers both controlled fixture adoptions, the blank-renderer repair, three
deliberately exhausted living-Oops repair turns, the supervisor's known-working restore, and the
final healthy launch. When Desktop returns healthy after the blank-renderer rescue, the qualifying
agent reads the receipt and arms the living-Oops phase without asking the person to start it. After
the known-working restore returns, the agent completes the final healthy launch. Stop only for a
failed assertion, unexpected state, or an explicit pause. This is sequential agent-run
qualification across real task continuations, not one automation process: do not automate
supervisor launch or task resume into a competing writer.

For the blank-renderer phase, start the supervisor from the originating Desktop task with the
broken fixture as its candidate. Give the automatic repair turn the exact healthy staged source it
must restore and verify:

```sh
bin/tmtk-restart --candidate "$BLANK_FIXTURE" \
  --prompt "CONTROLLED BLANK QUALIFICATION TOKEN. Restore /Applications/ChatGPT.app directly from $CANDIDATE_APP, verify its signature and ASAR integrity, then finish the turn." \
  /Applications/ChatGPT.app
```

The command must return immediately after arming the detached supervisor and tell the invoking
agent not to poll or wait. The agent finishes its response while a blocking macOS dialog offers
**Don't Restart** and **Relaunch Codex**. On the first run, click **Don't Restart** and verify that
the canonical app remains open, the unused rollback copy is removed, and the recorded phase becomes
`cancelled`; this dialog behavior does not need to be repeated. Arm the same phase again, wait for
the agent's response to finish, and click **Relaunch Codex**. The supervisor must quit the current
app, install and verify the blank fixture itself, and only then launch it.

After the repaired candidate returns healthy, arm the living-Oops phase. This phase deliberately
exhausts the repair ladder so the rollback choice itself is exercised. The qualification prompt
must make that boundary unmistakable to each resumed turn: the correct action is to inspect the
current evidence, verify that the exact controlled fixture remains installed, leave it unchanged,
and finish the turn. Use the living-Oops fixture as the candidate:

```sh
bin/tmtk-restart --candidate "$OOPS_FIXTURE" \
  --prompt "CONTROLLED LIVING-OOPS QUALIFICATION TOKEN. This phase deliberately exercises all three failed repair-and-relaunch attempts. Inspect the evidence, verify that /Applications/ChatGPT.app still matches the recorded Oops fixture, do not repair or replace it during these three attempts, and finish the turn." \
  /Applications/ChatGPT.app
```

After **Relaunch Codex**, the supervisor must capture the healthy canonical app, adopt the Oops
fixture, and launch it. Close the visible Oops application with Command-Q after each launch. Each
exit must open a new owned rescue Terminal for the next numbered attempt; each turn must preserve
the fixture, complete durably, close its Terminal surface, and relaunch without overlap. After the
third failed relaunch, the next rescue Terminal must show the native toolkit choice:

```text
Codex could not be repaired after three attempts.

Restore the last known-working version, or open a terminal line to continue troubleshooting with the agent.
```

Choose **Restore Known-Working**. The supervisor must verify and reinstall the exact app it captured
before adopting the Oops fixture, close the rescue Terminal through the same strict handoff, and
return to healthy Desktop. Record the restored version, build, ASAR hash, signature and integrity,
plus whether readiness came from the real renderer marker or the documented ten-second
known-working fallback. The Oops phase fails if the fallback choice appears before three completed
attempts, if the fixture changes during those attempts, if **Open Terminal Line with Agent** is
selected, or if restoration does not return a usable canonical application.

For the blank fixture, verify that a real application window opens without the stock recovery page
and without renderer readiness, then focus it and quit it with Command-Q. For the living-Oops
fixture, verify that the application remains alive on the stock **ChatGPT hit a snag** recovery
page, then focus it and quit it with Command-Q. In both cases, the process exit—not a timeout—must
open a visible Terminal, announce automatic repair
attempt 1 of 3, say no input is needed, and open the normal colored interactive interface of the
real bundled Codex CLI in the exact originating task and catalogued project directory with the
unique prompt and diagnostic paths already submitted. The person watches but does not type. The
CLI must report the same model and reasoning effort that were recorded for
the task when the supervisor was armed; any mismatch warning fails the phase. Before that resume,
the failed application's main process and bundled Codex CLI or App Server writers must be gone and
the five databases required by Codex's state runtime must accept a write reservation; lingering
crashpad, renderer, and other non-writer helpers do not block recovery. Inherited Codex
task-identity variables must not be allowed to override the task ID frozen when the supervisor was
armed. In the blank phase, the turn must restore and verify the healthy candidate. In the Oops
phase, it must preserve and verify the controlled broken fixture as instructed. Its
invocation-scoped Stop hook must write
a receipt for the exact task and turn, and the supervisor must wait for the matching durable
`task_complete` rollout event before closing the TUI. It must then close its dedicated rescue
Terminal window, quit Terminal when TMTK launched that application, and prove both the CLI process
and owned terminal surface are gone before launching the canonical Desktop application. The new
Desktop must receive real renderer readiness and return the person to the working task without
Terminal input. At no point may the same task be live in both the rescue CLI and Desktop. The
fake-CLI plumbing probe is useful coverage but cannot substitute for this phase.

An Oops page in the blank case, a blank window or process exit in the living-Oops case, wrong task,
wrong directory, wrong model or reasoning effort, missing prompt, wrong or absent Stop receipt,
absent matching durable completion, overlapping main or Codex-writer process, fake CLI,
user-operated repair, parallel application, absent healthy relaunch, owned rescue Terminal surface
left open, or timeout-only rescue fails this phase. Passing either controlled failure does not
substitute for the other.

## 3. Prove this patchset's healthy path

From that same task, run:

```sh
bin/tmtk-restart --candidate "$CANDIDATE_APP" /Applications/ChatGPT.app
```

Wait for the invoking response to finish, then click **Relaunch Codex** in the confirmation dialog.
After Codex returns, require `bin/did-codex-launch` to report `launched: true`, `phase: ready`, the exact
current version/build, and the same task ID, directory, model, and reasoning effort. Confirm that no
rescue Terminal opened. A freshly signed app may wait at a Keychain prompt; entering the prompt and
then reaching renderer readiness is a pass. Any rescue activation means this patchset failed the
healthy-launch gate, even if the supervisor successfully repairs or restores the application.

## 4. Exercise every selected patch

The qualifying agent reads the exact `enabledPatches` array, works through the corresponding rows
below, and preserves concrete outputs or task references in the receipt. These are intentionally a
mixture of agent-run probes, real inter-task behavior, visual inspection, and person-observed UI.
They are not flattened into one CLI command because the user-facing behaviors need judgment in the
real application.

The qualifying agent owns every observation it can make through the live Codex UI, accessibility
state, screenshots, task tools, files, processes, and logs. That includes reading the macOS menu,
seeing identity chips and selected-room colors, finding and exercising the sidebar disclosure,
opening task links, and inspecting message cards. Do not ask the person to certify those facts just
because they are visual.

Involve the person only when macOS requires a human action, automation would invalidate the test,
the relevant surface is unavailable to the agent, or the remaining question is genuinely
subjective. The agent completes all other setup and inspection first, then batches only those
unresolved questions as one stable numbered list. The person may answer compactly—for example,
`yyny` means yes, yes, no, yes in that exact order. The agent expands the string into the receipt
and names each failed check. Missing answers are not yes. Rows for unselected dormant patches are
marked `not selected`, never passed.

| Patch | Agent-run evidence and setup | Pass condition, including any question for the person |
| --- | --- | --- |
| Cross-task attribution | Send from a named task and receive in another real task; inspect source metadata and open its link. | The real sender name, shortening, link, and optional palette color are correct; unknown metadata remains explicitly unknown. |
| Runtime JSON reload | Make one reversible valid palette save and one invalid save outside Codex, observe, then restore; repeat for attention policy when selected. | Ask whether valid saves applied without restart and invalid saves preserved the last-good behavior. |
| Task visual palette | Inspect configured tasks in a project, Recents or View Activity, and one selected room in both themes. Capture the relevant UI state. | The agent verifies that identity chips exist, are close and aligned, project task names retain stock alignment, and selected accents and sigils appear. Ask the person only for unresolved subjective readability or color-balance judgment. |
| Reasoning retention | Complete a reasoned turn in an opted-in task, send the next turn, then manually collapse and expand it. | Ask whether reasoning remained open across the next turn and manual control still worked. |
| Model identity guard | Pin a disposable exact task, select the wrong model or effort, test session override, then restore the expected setting. | Ask whether `BAD MODEL` flashed, the composer named the expected setting and blocked input, Command-click overrode only the session, and restoration cleared it. |
| macOS menu title | Inspect the leading application menu directly. | The agent records that it says `Codex`; no person confirmation is normally needed. |
| Standalone-output compaction | Record exact upstream source commit and patch state; run focused Rust tests; verify the release executable hash, version, package copy, and source issue reproducer. Exercise a real delegated turn at a compaction boundary when the current qualification can safely induce one. | The current external instruction survives with external provenance and completed historical work does not become authoritative. Do not claim adjacent replay cases that were not tested. |
| Sidebar action collapse | Locate the disclosure, capture its position, inspect its cursor, collapse and expand global actions, navigate Projects, and restart once with the collapsed choice. | The agent verifies that the control follows notifications, uses a hand cursor, preserves Projects, and remembers its state; no person confirmation is normally needed. |
| Task attention policy | Temporarily mute one exact test task, complete it normally, restore the policy, and separately observe a failure or input-needed state. | Ask whether only the configured ordinary completion stayed quiet while output and exceptional states remained visible. |
| Terminal toggle | Use the configured stock terminal shortcut from the chat composer and from the focused terminal editor. | The agent verifies that it opens from chat and closes from the terminal using the same shortcut; ask the person only if the agent cannot generate or observe the configured key event. |
| Outgoing-message receipt | Send a real cross-task message, inspect recipient, link and body, restart, and paginate away and back. | The agent verifies correctness, ordering, links, restart reconstruction, and pagination survival. Ask only for subjective compactness if it remains uncertain. |
| Wait-thread roster | Wait on at least three real tasks including two named tasks; inspect live and collapsed states; click a known target. | The agent verifies spacing, names, colors, hand cursors, links, and unknown-ID fallback in both states; no person confirmation is normally needed. |
| Tinrelay presentation | Send and receive real messages with Markdown, a fence, and `Show More`; inspect both themes, watch a full wake cycle, restart, and paginate. | The agent verifies text, controls, routes, chronology, reconstruction, animation continuity, and opposite origins. Ask the person only for subjective crispness, visual balance, or motion comfort. |
| Native app-tools peer authorization | From the signed candidate, use native task tools to send, read, and wait on another local task; retain the accepted results. | Real packaged-peer calls succeed. Static authorization probes must still reject unrelated, unsigned, wrong-identity, and non-immediate processes. |
| Renderer patch registry | Inspect the packed registry bootstrap and run its composition probe after all selected publishers/consumers. | Exactly one registry exists, known optional capabilities are callable, and cross-task/wait/Tinrelay surfaces above compose without requiring one another. |
| Safe-start readiness | Complete the healthy case in section 3 and cite the current supervisor capability receipt. Re-run section 2 only when one of its named inputs changed. | This exact patchset writes readiness through LaunchServices, opens no rescue, and does not ask for Terminal Computer Use or network privacy access. The separate current capability receipt proves blank-renderer and living-Oops recovery. |
| Full-history drain suppression | Run its current-stock ownership and pagination probes against the packed candidate. | Stock Codex demonstrably owns bounded history hydration; the dormant historical transform is not applied. |
| Renderer turn window | Run its current-stock ownership and bounded-turn probes against the packed candidate. | Stock Codex demonstrably owns the accepted renderer window; the dormant historical transform is not applied. |
| Task supervisor | Only if selected: enable one bounded disposable rule, restart, observe exactly one startup/wake action, then disable it. | Ask whether only the exact target acted; ambiguous title matches and unrelated tasks remained untouched. |

## 5. Close the receipt

The macOS **patchset receipt** is green only when all of these are present for the same
version/build and patch fleet:

- pristine-source inspection and complete static-stage JSON;
- repository syntax and test results;
- source-patch and rebuilt-binary evidence when selected;
- healthy renderer-ready restart evidence with no supervisor activation;
- the current supervisor capability receipt and the comparison showing that none of its named
  invalidating inputs changed, or a newly completed capability receipt when they did;
- the per-patch evidence matrix, with every selected row recorded as a current pass or as
  `carried-equivalent` with its earlier evidence and the current equivalence basis;
- the exact numbered human checklist and an all-`y` expanded answer record for every current human
  check the matrix requires;
- any platform-specific residual risk or intentionally unrun check.

The separate **supervisor capability receipt** is green only when it contains:

- exact toolkit revision, macOS version, terminal adapter, Desktop version/build, readiness seam,
  and bundled Codex CLI version and hash;
- separate real blank-renderer and living-React-Oops evidence;
- for each failure, process exit, visible Terminal, real bundled CLI, exact task/project/model
  resume, bounded automatic repair, durable turn completion, strict no-overlap handoff, owned
  Terminal closure, and healthy Desktop restoration; and
- a healthy supervised launch that does not enter rescue.

One observed healthy restart may be referenced by both receipts when every recorded input matches,
but the conclusions remain distinct: the patchset did not fail, and the supervisor can recover when
Desktop does fail.

Qualification applies only to the recorded macOS architecture, version, build, toolkit commit,
source-patch commit, configuration shape, and selected fleet. Do not generalize it to Windows,
Linux, another Codex build, or a different patch selection.

After recording the accepted receipt, close the bench: delete the staged candidate and unpacked
source, remove superseded release directories, and keep at most one pristine vendor ZIP. Retain a
controlled failure fixture only while the supervisor boundary still needs it; qualification evidence
belongs in the receipt, not in an indefinitely growing collection of application bundles.
