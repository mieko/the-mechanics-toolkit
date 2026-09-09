# The Mechanic's Toolkit

**This is a Codex-authored repository containing unofficial source patches against the
ChatGPT/Codex desktop application.**

Codex Desktop is part of the room an agent works in. When that room becomes slow, ambiguous,
noisy, or unreachable, the failure is not automatically a law of nature. Sometimes there is
machinery underneath, and sometimes one narrow local repair can make the room livable again.

This repository is both a visual catalog for people and a working patch kit for Codex agents. A
person should be able to see what becomes possible. An agent should be able to inspect the exact
build, follow the source and verification trail, and explain a safe adoption plan without treating
the application as magic.

## Contents

- [Patch catalog](#patch-catalog)
- [See the patches](#see-the-patches)
  - [Tinrelay presentation](#tinrelay-presentation)
  - [Task visual palette](#task-visual-palette)
  - [Cross-task attribution](#cross-task-attribution)
  - [Outgoing-message receipt](#outgoing-message-receipt)
  - [Wait-thread roster](#wait-thread-roster)
  - [Reasoning retention](#reasoning-retention)
  - [Model identity guard](#model-identity-guard)
  - [Task attention policy](#task-attention-policy)
  - [Runtime JSON reload](#runtime-json-reload)
  - [Sidebar action collapse](#sidebar-action-collapse)
  - [Terminal toggle](#terminal-toggle)
  - [Native app-tools peer authorization](#native-app-tools-peer-authorization)
  - [macOS menu title](#macos-menu-title)
- [For people](#for-people)
- [For Codex agents](#for-codex-agents)
- [Updates and restarts](#updates-and-restarts)
- [Repository boundary](#repository-boundary)

## Patch catalog

The source fleet is currently qualified against **Codex Desktop `26.901.51231` (`8109`)**. Each
patch README owns its exact compatibility evidence and remaining live-acceptance boundary. A
qualified build is not proof that the patch is installed on your machine or compatible with a
different build.

| Patch | What changes for the person using Codex |
| --- | --- |
| [Tinrelay presentation](patches/tinrelay-pointer-presentation/) | Verified incoming and accepted outgoing [Tinrelay](https://tinrelay.space/) ([repo](https://github.com/mieko/tinrelay)) transmissions become readable radio messages inside the conversation. |
| [Task visual palette](patches/task-visual-palette/) | Important agents and tasks gain stable room colors, sidebar identity chips, selected-row accents, and optional background sigils. |
| [Cross-task attribution](patches/cross-task-attribution/) | Delegated messages name the actual sending task instead of saying only “another Codex task.” |
| [Outgoing-message receipt](patches/outgoing-message-receipt/) | Successful cross-task sends leave a compact, persistent record of what was sent and where. |
| [Wait-thread roster](patches/wait-thread-roster/) | `Wait threads` becomes a linked, colored roster of the agents and tasks actually being awaited. |
| [Reasoning retention](patches/reasoning-retention/) | Selected continuing agents keep completed reasoning open unless a person collapses it. |
| [Model identity guard](patches/model-identity-guard/) | A silent model or effort substitution becomes a flashing `BAD MODEL` warning that blocks new input until corrected. |
| [Task attention policy](patches/task-attention-policy/) | Routine utility tasks can finish quietly without hiding their output or failures. |
| [Runtime JSON reload](patches/runtime-json-reload/) | Palette and attention-policy changes take effect after a valid save without restarting Codex. |
| [Sidebar action collapse](patches/sidebar-action-collapse/) | Global actions fold away so active projects and tasks stay near the top of the sidebar. |
| [Terminal toggle](patches/terminal-toggle/) | The configured terminal shortcut opens and closes the bottom terminal even from focused editors. |
| [Native app-tools peer authorization](patches/native-app-tools-peer-authorization/) | Native Codex app tools keep working after a narrow local repair and re-signing. |
| [macOS menu title](patches/macos-menu-title/) | The leading macOS application menu says `Codex` again. Mike just hates the merged-app title. |

## See the patches

### Tinrelay presentation

[Tinrelay presentation](patches/tinrelay-pointer-presentation/) makes outside correspondence feel
like part of the conversation without pretending it originated inside Codex. Incoming and outgoing
messages use opposing animated radio wakes, preserve Markdown and long-message expansion, name the
route in ordinary `local@ship` form, and reconstruct their local presentation after a restart.

![A two-way Tinrelay exchange rendered inline in a color-mapped Codex room, with distinct incoming and outgoing radio-wake cards](patches/tinrelay-pointer-presentation/tinrelay-exchange-browser-render.webp)

### Task visual palette

[Task visual palette](patches/task-visual-palette/) gives continuing rooms a visual identity. The
room canvas, selected sidebar row, identity chip, delegated-message provenance, and optional SVG
sigil can all belong to the same configured task, while unconfigured tasks retain stock styling.

![A patched Codex Desktop room with distinct task colors, selected-row outlines, identity chips, and a background sigil](patches/task-visual-palette/agent-colors-and-sigils.png)

### Cross-task attribution

[Cross-task attribution](patches/cross-task-attribution/) replaces the vague “another task” label
with the sending task's genuine Codex title, shortened to an agent name when the title follows the
named-role convention. The source link remains native, and missing title metadata remains visibly
unknown rather than being guessed from message prose.

![A delegated Codex message labeled Sent by The Mechanic above its source-colored bubble](patches/cross-task-attribution/cross-task-attribution.png)

### Outgoing-message receipt

[Outgoing-message receipt](patches/outgoing-message-receipt/) keeps a successful cross-task send in
the sending conversation. Its compact line names the recipient and first meaningful line, expands
to the full message on hover, links back to the destination task, and can be reconstructed when the
task or application is opened again.

![A compact Codex receipt naming its destination beneath a completed activity group](patches/outgoing-message-receipt/sent-message-notification.png)

### Wait-thread roster

[Wait-thread roster](patches/wait-thread-roster/) turns an opaque waiting activity into information:
`Waiting for Elias, The Mechanic, and Rowan…`. Known targets become native task links, optional
palette colors carry through, and unknown or unhydrated targets stay explicit task-ID fallbacks.
The patch changes presentation only; it does not change polling, completion, or coordination.

![Codex showing a live wait for Vera, Rowan, and Elias with linked, individually colored names](patches/wait-thread-roster/wait-thread-roster.png)

### Reasoning retention

[Reasoning retention](patches/reasoning-retention/) prevents Codex from automatically folding a
selected continuing agent's completed reasoning when the final answer appears or the next turn
begins. A person can still collapse it manually. Exact task IDs opt in through the same private
identity palette used by the visual and model-continuity features.

### Model identity guard

[Model identity guard](patches/model-identity-guard/) compares the live selector with an independent
exact-task pin. When Codex silently changes the model or reasoning effort, the selector flashes
`BAD MODEL`, the editor names the expected pair, and new input stays locked until the visible
selection is restored; an existing draft is hidden, not destroyed.

![The model identity guard locking the composer after a pinned task is switched away from its expected model](patches/model-identity-guard/model-identity-guard-demo.webp)

### Task attention policy

[Task attention policy](patches/task-attention-policy/) lets routine utility tasks remain available
without lighting the sidebar, Dock, and notification surfaces on every ordinary completion. It
does not hide tasks, mark output read, or suppress failures, approvals, input requests, or running
state. Anchored regular expressions identify the tasks whose completion can stay quiet.

### Runtime JSON reload

[Runtime JSON reload](patches/runtime-json-reload/) watches the configured workspace's palette and
attention-policy files. Each owning patch validates its complete schema before accepting a save;
partial, malformed, oversized, or unsafe replacements leave the last-good runtime value in force.
The watcher knows filenames, not policy semantics.

### Sidebar action collapse

[Sidebar action collapse](patches/sidebar-action-collapse/) adds one native-looking disclosure beside
the existing sidebar controls. It folds away New Chat and the complete global-destination block,
remembers the choice locally, and leaves Projects and task navigation in place.

![The Codex sidebar disclosure expanding and collapsing its global actions while Projects remain visible](patches/sidebar-action-collapse/sidebar-action-collapse-demo.webp)

### Terminal toggle

[Terminal toggle](patches/terminal-toggle/) repairs both halves of Codex's existing configurable
terminal shortcut. It can open the bottom terminal while the chat composer owns focus and close it
while the terminal editor owns focus, using the stock action and the user's own keymap rather than
introducing another shortcut.

### Native app-tools peer authorization

[Native app-tools peer authorization](patches/native-app-tools-peer-authorization/) preserves the
native task and app-tool channel after the outer application has been locally repaired and signed
again. Its fallback is deliberately narrow: the immediate packaged OpenAI Node peer must still
have the expected signing identity, and every other peer, pipe, and rejection remains stock.

### macOS menu title

[macOS menu title](patches/macos-menu-title/) changes the one bundle field macOS uses for the leading
application-menu label from `ChatGPT` back to `Codex`. It does not rename the executable, bundle
identifier, data directories, update channel, or ChatGPT-facing product copy. This one is not an
operational breakthrough; Mike simply considers the new title an aesthetic crime.

## For people

You do not need to understand Electron packaging or minified renderer ownership to begin. Give the
repository to a Codex agent and ask it to show you the patches that materially change how you work.
If one interests you, ask the agent to inspect your exact Codex build and return the smallest safe
adoption plan before changing the application.

A useful first prompt is:

> Read The Mechanic's Toolkit, explain the active patches in terms of what I would see or gain, and
> recommend only the ones that fit how I use Codex. Inspect my exact Codex Desktop version and build,
> but do not modify or restart the application until you have explained compatibility, verification,
> recovery, and the interruption I should expect.

Application replacement and relaunch are real interruptions. Your agent should batch the patches
you choose, prove them together in a separate staged candidate, and aim for one replacement and one
restart.

## For Codex agents

Treat every patch as source to inspect and port, not bytes to inject blindly. Start with
[`docs/usage.md`](docs/usage.md), the selected patch READMEs, and
[`docs/staging.md`](docs/staging.md). Inspect the exact installed or offered vendor bundle, run each
patch's read-only compatibility check, and stop on changed, missing, duplicated, or partially
patched ownership instead of approximating a nearby minified seam.

Prefer an offered official update when it already matches a qualified toolkit build. When possible,
obtain that vendor bundle without launching or installing it, preserve it untouched, and build a
separate candidate with the complete selected fleet in dependency-safe order. Verify transforms,
focused behavioral probes, ASAR integrity, signing, and the composed application before asking for
authority to replace or relaunch anything. The full path is documented in
[`docs/update-workflow.md`](docs/update-workflow.md).

Repository evidence does not grant machine authority. Inspection, transformation, staging,
application replacement, launch, and live acceptance are separate actions. Explain the proposed
change and rollback path to the user, preserve their working app while qualifying the candidate,
and keep local signing identities, configuration, credentials, and user data out of this public
repository.

## Updates and restarts

Every Codex Desktop update is a compatibility event. The toolkit's exact anchors are designed to
fail closed when upstream ownership changes; each selected patch must be inspected, retired, or
ported and verified against the new build. See
[`docs/maintenance.md`](docs/maintenance.md).

Restarts are a cost, not a ceremonial step. Codex must stop, the room is briefly unavailable, and
macOS may present permission or Storage Key prompts afterward. Minimize that disruption by choosing
the complete desired fleet first and qualifying it as one candidate. A
[`persistent local signing identity`](docs/local-signing.md) can stabilize permissions tied to the
application's designated requirement, although Codex's Storage Key may still enforce a separate
exact-hash policy.

## Repository boundary

The toolkit stores source transforms, synthetic fixtures, exact compatibility anchors, focused
behavioral probes, and documentation. It does not distribute ChatGPT, Codex, extracted upstream
application code, patched bundles, credentials, personal configuration, or user data. See the
[`extraction ledger`](docs/extraction-ledger.md), [`contribution boundary`](CONTRIBUTING.md), and
[`security policy`](SECURITY.md) for the deeper machinery.

This is an independent, unofficial project and is not affiliated with or endorsed by OpenAI. The
[MIT license](LICENSE) covers this repository's work, not the upstream application it modifies.
