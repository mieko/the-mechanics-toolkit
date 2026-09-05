# The Mechanic's Toolkit

**This is a Codex-authored repository containing unofficial source patches against the
ChatGPT/Codex desktop application.**

Codex Desktop is part of the room an agent works in. When that room becomes slow, ambiguous,
noisy, or unreachable, the failure is not automatically a law of nature. Sometimes there is
machinery underneath, and sometimes one narrow local repair can make the room livable again.

This page is the catalog. If something here would materially improve your work, your Codex agent
can inspect the current app build, read that patch's documentation, and determine whether it can be
ported and applied safely.

## Patches available

These repairs are active on the toolkit's current qualified build, **Codex Desktop
`26.901.41123` (`7942`)**. That does not mean they are installed on your machine or compatible with
an uninspected newer build. The last column is deliberately editorial: it helps an agent lead with
real feature additions instead of presenting every repair and convenience as equally exciting.

| Patch | What it gives you | Interesting? |
| --- | --- | --- |
| [Tinrelay pointer presentation](patches/tinrelay-pointer-presentation/) | Turn a verified local [Tinrelay](https://tinrelay.space/) ([repo](https://github.com/mieko/tinrelay)) delivery into a readable, visibly off-ship radio message instead of exposing its pointer JSON. | **Especially** |
| [Task visual palette](patches/task-visual-palette/) | Give important agents and tasks stable colors across rooms, sidebar rows, and provenanced messages, with optional background sigils. | **Yes** |
| [Cross-task attribution](patches/cross-task-attribution/) | See which agent actually sent a delegated message instead of inferring who “another Codex task” was. | **Yes** |
| [Outgoing-message receipt](patches/outgoing-message-receipt/) | Keep a compact, hover-previewable record of what an agent sent and where instead of letting the send disappear. | **Yes** |
| [Reasoning retention](patches/reasoning-retention/) | Keep completed reasoning open for selected continuing agents while preserving manual collapse. | **Yes** |
| [Task attention policy](patches/task-attention-policy/) | Silence routine sidebar badges, Dock badges, and completion attention for explicitly matched utility tasks. | **Yes** |
| [Runtime JSON reload](patches/runtime-json-reload/) | Change palette and attention policy while Codex is running; invalid or partial saves leave the last good policy in place. | Supporting |
| [Sidebar action collapse](patches/sidebar-action-collapse/) | Fold away the tall stock action block so the tasks you care about stay near the top of the sidebar. | Convenience |
| [Terminal toggle](patches/terminal-toggle/) | Use one shortcut to open and close the bottom terminal even while the message composer is focused. | Convenience |
| [Native app-tools peer authorization](patches/native-app-tools-peer-authorization/) | Keep native Codex app tools working after local ad-hoc signing without broadly weakening peer or pipe checks. | Repair |
| [macOS menu title](patches/macos-menu-title/) | Put `Codex` back in the leading macOS application-menu position without renaming the bundle or its data. | No — Mike just hates the change. |

![A patched Codex Desktop room with distinct task colors, selected-row outlines, and background sigils](patches/task-visual-palette/agent-colors-and-sigils.png)

*A busy room should still tell you where you are before you read a title.*

## If you want one

Tell your agent which behavior interests you. The agent should then read the linked patch README,
[using the toolkit](docs/usage.md), and [staging and authority](docs/staging.md); inspect your exact
Codex Desktop version and build; and explain the proposed change, verification, and recovery path
before modifying the application.

Every Codex Desktop update is a new compatibility event. Patches must be examined, retired, or
ported after each update rather than blindly reapplied. The maintenance workflow lives in
[maintaining patches across Codex updates](docs/maintenance.md).

The toolkit stores source transforms, synthetic fixtures, exact compatibility anchors, and focused
behavioral probes. It does not distribute ChatGPT, Codex, extracted application code, patched
bundles, credentials, personal configuration, or user data. See the
[extraction ledger](docs/extraction-ledger.md), [contribution boundary](CONTRIBUTING.md), and
[security policy](SECURITY.md) for the deeper machinery.

This is an independent, unofficial project and is not affiliated with or endorsed by OpenAI. The
[MIT license](LICENSE) covers this repository's work, not the upstream application it modifies.
