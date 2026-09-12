# Desktop platform compatibility

Codex Desktop ships the same product through different generated JavaScript profiles and very
different operating-system packages. A patch is portable only after three independent questions
are answered:

1. does its transform recognize the generated code for this exact desktop build and platform;
2. does the repaired behavior mean the same thing on that platform; and
3. can the result be repacked with honest platform integrity/provenance, then installed, launched,
   and recovered safely there?

A green answer to the first question is not evidence for the other two. Qualification should name
the desktop's **inner application version and Codex build**, operating system, architecture, package
format, and the highest gate actually exercised.

## Repository ownership map

TMTK does not carry three copies of every feature:

```text
patches/<feature>/                 shared behavior and exact generated-code transforms
patches/<feature>/profiles/        only proven platform-specific owner shapes
src/platforms/<platform>.mjs       lifecycle, process identity, dialogs, launch, and handoff
src/<platform-package>.mjs         package inspection, adoption, and rollback
src/stage-<package>.mjs            package-specific staging, integrity, and signing
qualification/<platform>.md        platform-owned live runbook and evidence contract
```

The ordinary port order is semantic first, adaptation second. One maintainer establishes the new
feature behavior and changed generated-code owners on a frontier package. Platform maintainers then
apply that exact fleet to their official packages, reusing identical profiles and adding a narrow
profile only where the bytes differ. Shared supervisor transitions stay shared; each adapter owns
only the operating-system mechanism that fulfills them. Each platform still qualifies its own
package, architecture, dialogs, installation, recovery, and live behavior before making a support
claim.

## Measured build 8378 packages

This inventory was taken on 2026-09-09 from official current packages. The working copies and
extracted vendor files lived only under the ignored `.work/` tree and are not distributed by this
repository.

| Platform package | Outer package version | Inner application | Electron | Package SHA-256 |
| --- | --- | --- | --- | --- |
| macOS ARM64 ZIP / `.app` | `26.903.61454` | `26.903.61454`, build `8378` | `42.3.0` | ZIP `28d00cdf540522bdf8f100fcfe1a64f3cda81d2a5cd8e0ae6f1f3382caae9f7f` |
| Windows x64 MSIX | `26.903.8094.0` | `26.903.61454`, build `8378` | `42.3.0` | MSIX `f8a845dd58f177fbcd71b01c7831d742fc90855e4b207ee2d8ce3ab5f9bcc30f` |
| Windows ARM64 MSIX | `26.903.8094.0` | `26.903.61454`, build `8378` | `42.3.0` | MSIX `9e69aa06823922eb0b2cd1b5cf1ed55f026a94aa8521aee572253a3ee02e9329` |
| Linux x64 DEB | `26.903.61454` | `26.903.61454`, build `8378` | `42.3.0` | DEB `2caa7df314ce37e9048359d8e6a4a78e24574a3b54d6bf510f17754b66dda775` |
| Linux ARM64 DEB | `26.903.61454` | `26.903.61454`, build `8378` | `42.3.0` | DEB `e545cd78672e1313ff3f0d377772dd4ee7444400357ca85313d732da8d7e6693` |

The Windows Store version is therefore not the Codex build. For this release, the Store advertises
`26.903.8094.0` while the bundled application's `package.json` identifies the same
`26.903.61454` / `8378` code used by macOS and Linux. Match and record the inner metadata rather
than inferring compatibility from the Store version.

Official distribution references:

- [Codex Desktop overview](https://learn.chatgpt.com/docs/app)
- [Windows installation](https://learn.chatgpt.com/docs/windows/windows-app)
- [Linux installation and supported package formats](https://learn.chatgpt.com/docs/linux/linux-app)

## Linux build 8881 implementation checkpoint

The current official DEBs inspected on 2026-09-11 have outer and inner version
`26.908.40834`, Codex build `8881`, and Electron `42.3.0`:

| Architecture | Untouched DEB SHA-256 | Source ASAR SHA-256 |
| --- | --- | --- |
| AMD64 | `da37b8e7bcefaaea019c478cacbe6c73ee1ddd15e0e1ebb3c7ef0a42dd818ac2` | `6c371cc96c2cf201c0777ddd54085f156efbb5347cbb21667cd8e67ec1bb36d3` |
| ARM64 | `bae5c5ca585625a116a8877dedc455e4c27ca02063ea93dbd6a0506ed6a12d31` | `a2ac9375f964d13563fd16954e6dd70426b78622f505927b718a43d5eace8251` |

The exact package layout is `/usr/bin/chatgpt` -> `../lib/chatgpt/codex-launcher`, with Desktop
at `/usr/lib/chatgpt/ChatGPT`, `resources/app.asar`, and the bundled CLI at
`resources/codex`. TMTK checks those exact owners and compares the outer DEB, Linux package
metadata, and inner ASAR identity instead of treating the launcher name as application identity.

The ARM64 package now recognizes the complete 13-patch Linux fleet: runtime JSON reload, safe-start
readiness, renderer registry, cross-task attribution, model identity guard, outgoing-message
receipts, reasoning retention, sidebar collapse, task attention policy, task visual palette,
terminal toggle, TinRelay presentation, and wait-thread roster. Shared transforms select exact
Linux build-8881 owner profiles only where the generated code differs. The macOS-only menu-title
and native app-tools authorization patches remain unsupported rather than being made to match a
platform where their owned surfaces do not exist.

The source-only `stage-deb` adapter produced and re-extracted local
`26.908.40834+tmtk1` candidates for both architectures, preserving native payloads, executable
modes, inner version/build, and all non-owned package files. The initial AMD64 package-mechanics
proof used a three-patch candidate; it is not a full-fleet claim. The final ARM64 13-patch
candidate has SHA-256
`8737719adee28bae1c0060a08799da914d1d99f26e6b636597ba7faaf88dec07` and inner ASAR SHA-256
`86caf4376a7045d1c4d43fb8367c22ef9913a22a48a68f2c99195050fa69e000`. It records its pristine
DEB hash and selected fleet in both DEB control fields and an inner receipt.

The final ARM64 candidate passed the healthy live path on Ubuntu 24.04.5 GNOME/Wayland on
2026-09-12. A genuine GPT-5.6 Luna task froze its exact task ID, catalog directory, model, reasoning
effort, and bundled-CLI ancestor. After the invoking CLI exited and the Codex databases accepted a
writer, Zenity supplied the restart choice, GNOME PolicyKit authorized the verified package,
`dpkg-query` reported `26.908.40834+tmtk1 arm64`, and the installed inner application and payload
hashes matched the candidate receipt. The directly launched Desktop process reached its private
renderer-ready marker. The preserved task reopened from Recents with its previous reasoning and
model selection intact, and no supervisor, rescue agent, or toolkit-owned terminal remained. The
application did not automatically navigate to that task, and this receipt does not qualify the
still-open per-feature live checks or controlled-failure gates in
[`qualification/linux.md`](../qualification/linux.md).

## Windows build 8881 implementation checkpoint

The Windows 11 ARM64 checkpoint uses Store package
`OpenAI.Codex_26.908.4834.0_arm64__2p2nqsd0c76g0`, whose inner application is
`26.908.40834`, Codex build `8881`, Electron `42.3.0`. Its pristine ASAR SHA-256 is
`565c348c9b736b920d08fb647a3246189d959bf10ef81905ec6b7d20dcb792aa`. The complete
13-patch Windows-supported ASAR fleet passed exact source inspection, catalog-order application,
focused probes, byte-identical second application, native payload preservation, MakeAppx
reconstruction, SignTool verification, and full re-extraction. The measured artifact also carried
the macOS-only native app-tools authorization transform; because the Windows package has no owned
native authorization module, that transform is excluded from the public Windows fleet. Windows
uses the same semantic patch owners as the frontier macOS port; only actual generated-owner and
runtime differences are platform-profiled.

The adapter also passed a complete deliberately broken supervisor cycle on Windows 11 Pro ARM64:
native WPF consent, exact invoking-CLI exit, signed MSIX installation, exact AUMID/PID activation,
three bounded repair turns in the original task, incident-scoped PowerShell closure receipts,
repair exhaustion, **Restore Known-Working**, exact task deep-link return, renderer readiness, and
absence of toolkit-owned terminals, helpers, or scheduled tasks. Exact artifacts and the remaining
cross-version rollback boundary are recorded in
[`qualification/windows.md`](../qualification/windows.md).

## What is shared

The CPU architecture does not create another JavaScript port for the packages inspected here.
Windows x64 and ARM64 each contained 8,867 ASAR files and differed in only twelve native-module
files or native build manifests. Their 20 main-process JavaScript assets, 6,990 renderer
JavaScript assets, and 208 renderer CSS assets were byte-identical. Linux x64 and ARM64 each
contained 9,023 ASAR files and differed in fourteen native-module files or manifests; all main,
renderer JavaScript, and renderer CSS assets were byte-identical.

For one desktop build, the useful patch coordinate is therefore currently:

```text
{inner desktop version, Codex build, operating-system generated-code profile}
```

Architecture still matters for native modules and bundled executables, and must remain part of
package qualification. It does not currently require separate JavaScript matchers within Windows
or within Linux.

Across operating systems, the source is partly shared and partly rebuilt:

- macOS and Linux had all 20 main-process `.vite/build` JavaScript assets byte-identical;
- Windows had 17 of 20 at the same path byte-identical, with platform-specific `main`, `bootstrap`,
  and `early-bootstrap` output;
- all three had the same 208 renderer CSS assets;
- each pair shared 1,944 byte-identical renderer JavaScript assets at the same paths, while roughly
  5,000 content-hashed renderer assets were emitted under platform-specific names.

TMTK transforms edit this already bundled and minified output. They are semantic, fail-closed
transforms—not byte offsets—and can survive changed chunk filenames or minifier identifiers when
the owned code shape is still recognized. They are not source-level universal patches, and a
matcher must never be widened merely because another platform carries the same build number.

## Build 8378 transform results

Every result below is a read-only check against a pristine extracted build-`8378` ASAR unless a
stronger gate is named.

### Windows

All fourteen currently active ASAR-scope transforms recognized the Windows x64 generated code. A
disposable copy then passed the complete transform/probe cycle for all fourteen: apply in catalog
order, syntax checks, focused behavioral probes, byte-identical reapplication, and final `applied`
checks. Because the JavaScript and CSS are byte-identical between Windows architectures, this is
also generated-code evidence for Windows ARM64.

This was **not** Windows package or live qualification. Important boundaries at that historical
build-8378 checkpoint included:

- `macos-menu-title` is deliberately macOS-only;
- native app-tools peer authorization repairs a macOS signing-chain condition and the inspected
  Windows package does not ship its `browser-use-peer-authorization.node` module;
- Tinrelay's outgoing observer still required a Windows named-pipe transport profile;
- no Windows restart-supervisor lifecycle or terminal adapter had been implemented; and
- standalone-output integration currently knows only the macOS bundle layout. Windows ships both
  native `codex.exe` and Linux `codex` binaries for WSL paths, so the required replacement set must
  be established before integration can claim to repair every Windows execution mode.

### Linux

Four active ASAR transforms recognized the Linux generated code unchanged:

- `cross-task-attribution`;
- `runtime-json-reload`;
- `native-app-tools-peer-authorization`; and
- `renderer-patch-registry`.

The native peer transform's syntactic match is not useful Linux runtime evidence; Electron's
macOS authorization module is absent. The registry is infrastructure and exposes only capabilities
that are actually installed.

Ten active transforms failed closed on the Linux profile:

- `task-visual-palette`;
- `reasoning-retention`;
- `model-identity-guard`;
- `sidebar-action-collapse`;
- `task-attention-policy`;
- `terminal-toggle`;
- `outgoing-message-receipt`;
- `wait-thread-roster`;
- `tinrelay-pointer-presentation`; and
- `safe-start-readiness`.

These failures were changed or missing renderer owners, not syntax errors after mutation. Linux
needs an explicit renderer-profile port for those patches. The x64/ARM64 identity result means one
Linux JavaScript port should cover both architectures for this exact build.

The dormant `full-history-drain-suppression` check reported `upstream-owned` on all inspected
platforms. The dormant `renderer-turn-window` and `task-supervisor` transforms did not recognize
the current pristine profiles and remain unqualified.

## Package and installation boundaries

### macOS: implemented

The current staging path copies a pristine `.app`, transforms and repacks `app.asar`, updates the
`ElectronAsarIntegrity` header hash in `Info.plist`, signs the complete candidate, verifies it, and
re-extracts it for post-pack probes. It is the qualified macOS adapter; Linux has a separate
implemented DEB adapter below.

### Windows: local signed MSIX staging and recovery implemented

Electron 42 can validate ASAR integrity on Windows by storing the ASAR header hash in an
`Integrity` / `ElectronAsar` executable resource. The inspected build-8881 `ChatGPT.exe` did not
expose that resource. The adapter inspects the optional seal and fails closed if its shape changes
rather than assuming it remains disabled.

The official MSIX does carry `AppxBlockMap.xml` and an `AppxSignature.p7x` signature over the
package. Editing only `app.asar` would invalidate that package layer even when Electron's optional
seal is absent.

The Windows stager preserves the exact package family and application identity, applies the shared
ASAR fleet, compares the native and non-owned payloads, rebuilds the block map with MakeAppx, and
signs monotonically versioned candidate and recovery packages with an explicitly trusted local
qualification certificate through SignTool. The result is a local qualification/adoption artifact,
not a Microsoft Store package or a distributable OpenAI update. The supervisor installs it only
after native consent and verifies the exact installed package, executable, ASAR, and activation PID.

The current staging command derives both outputs from one selected source package. It therefore
supports same-inner-build qualification but does not yet preserve an older installed build while
staging a newer offered build. At adoption time the supplied known-working MSIX must reproduce the
currently installed inner version, build, and ASAR and have the same package identity; a mismatch
fails before the restart dialog. This refusal is the honest current boundary, not cross-version
upgrade support.

Electron's exact platform seal formats are documented in
[ASAR Integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity).

### Linux: DEB rebuild, healthy adoption, and real-task quiescence qualified; recovery pending

Electron does not provide the macOS/Windows embedded ASAR-header validation feature on Linux. The
official DEB nevertheless carries package provenance and installs a signed APT repository for
future updates. The inspected DEB includes an embedded `_gpgorigin` OpenPGP signature and maintainer
scripts that install OpenAI's repository key and source. The adapter verifies that signature over
the raw `debian-binary`, control archive, and data archive with `gpgv` and the already-installed
trusted ChatGPT APT keyring. A transformed local DEB would no longer be the vendor package;
it must be rebuilt honestly, and a later repository update may replace it.

The DEB adapter rebuilds package metadata around the transformed ASAR, preserves executable modes
and native payload, changes the package version to `SOURCE+tmtk1`, and identifies the result as a
local TMTK rebuild. It deliberately omits the vendor package's `_gpgorigin` signature member. The
vendor repository remains configured. Apt correctly treats the same-version vendor package as
older than `SOURCE+tmtk1`, while a later higher vendor version sorts above the local repair and may
replace it. Reinstalling the pristine package for rollback is therefore an explicit verified dpkg
action rather than an ordinary same-version apt upgrade.

Supervised adoption names three roles explicitly: the rebuilt candidate, the authenticated newer
vendor DEB named by its receipt, and the authenticated package matching the currently installed
known-working application. The last two may be different builds during an upgrade. TMTK verifies
all three, copies only the candidate and rollback into the private incident before asking the
application to quit, installs through `dpkg` (using PolicyKit when not already root), verifies dpkg
identity and the installed application hashes, and retains the rollback for known-working
restoration. This keeps dpkg's ownership database truthful; TMTK never patches
`/usr/lib/chatgpt/resources/app.asar` in place.
On the qualified Desktop build, a genuine initiating task required explicit **Full Access**: the
ordinary task sandbox made `~/.codex/tmtk-rescue` read-only and invocation-scoped escalation was
unavailable. The agent must explain that requirement and its scope before asking the person to
enable it.

Only DEB packaging is implemented. Healthy ARM64 adoption, exact real-task context, and
CLI/Desktop non-overlap are qualified on the exact Ubuntu, desktop/session, and application build
above. RPM packaging,
selected live feature inspection, controlled renderer failures, terminal rescue, and known-good
restoration remain separate qualification targets; do not broaden that measured result into a
general Linux support claim.

## Porting and qualification order

For a new platform or build:

1. acquire the official package and preserve it untouched;
2. record outer package identity and inner application version/build separately;
3. compare generated assets without assuming matching chunk names;
4. run every selected transform's read-only check on a pristine extracted ASAR;
5. port only failed ownership profiles, keeping existing platform profiles intact;
6. run transforms, syntax checks, behavioral probes, and byte-identical reapplication in a
   disposable extracted tree;
7. implement and test that platform's ASAR integrity, package metadata, signature, install,
   update, and recovery adapter; and
8. perform live acceptance for the actual OS and architecture before calling the fleet qualified.

Static generated-code evidence can substantially reduce a port. It must not erase the package and
runtime gates that keep the user's working Codex recoverable.
