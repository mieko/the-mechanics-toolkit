# Windows qualification

Windows qualification separates generated-code compatibility, signed MSIX construction, and a
live supervised replacement. A green static stage does not imply that the package was installed or
launched.

## Current ARM64 checkpoint

The current checkpoint uses Windows 11 Pro ARM64 25H2, OS build `26200`, and the installed official
package `OpenAI.Codex_26.908.4834.0_arm64__2p2nqsd0c76g0`. Its outer package version is
`26.908.4834.0`; the inner application is Desktop `26.908.40834`, Codex build `8881`, Electron
`42.3.0`. The AppUserModelID is `OpenAI.Codex_2p2nqsd0c76g0!App`.

The installed ASAR SHA-256 is
`565c348c9b736b920d08fb647a3246189d959bf10ef81905ec6b7d20dcb792aa`. Direct PE-resource
inspection found no `Integrity` / `ElectronAsar` resource in `ChatGPT.exe`; the signed MSIX block
map is therefore the package's ASAR integrity boundary for this build.

The measured qualification artifact staged 14 ASAR transforms, including the macOS-only native
app-tools authorization transform. The inspected Windows package has no native authorization
module for that transform to repair, so the supported Windows fleet and public example contain the
remaining 13 patches. The measured candidate is
`OpenAI.Codex_26.908.4834.4_arm64__2p2nqsd0c76g0`, with package SHA-256
`c65df444d002c5ea0cb7a0a475ed21a0831b6cfafbd1dbc35ced58f48f8671cb` and ASAR SHA-256
`81683240a58ba64edb58603473687f681ea54b05fd2088dcf234602e1ad50a2d`. The separately rebuilt
pristine recovery package is `OpenAI.Codex_26.908.4834.5_arm64__2p2nqsd0c76g0`, with package
SHA-256 `19047bb27506e6d435d8a720710b6bb4b061499566f15d8a733092ae2b723b3a` and the original ASAR
hash.

The static gate verified exact source identity, pristine patch checks, catalog-order application,
changed targets, syntax, focused probes, byte-identical second application, native-ASAR payload
preservation, MakeAppx reconstruction, SignTool signatures, exact same-family package identities,
full re-extraction, whole-tree equality, post-pack probes, and a final source reinspection. It did
not install or launch either package.

## Live supervisor receipt

The complete broken-application recovery path passed on the same Windows 11 ARM64 guest on
2026-09-12. A genuine GPT-5.6 Luna task armed the supervisor from a healthy, locally signed `.11`
package. After native WPF consent, TMTK observed the exact invoking CLI exit, installed the
deliberately broken `.12` candidate, and observed each exact activated Desktop PID exit before
renderer readiness. The same task completed three bounded automatic repair turns; every turn
produced its exact Stop receipt, closed its owned PowerShell surface, and released the Codex state
databases before the next launch.

After repair exhaustion, **Restore Known-Working** installed the separately preserved `.13`
package, launched the exact task deep link, reached the private renderer-ready marker, and returned
to the original task with its Luna Light model and Full Access selection intact. No rescue terminal,
supervisor helper, or `TMTK-*` scheduled task remained. The broken `.12` MSIX SHA-256 was
`2edc2e68fd67dc90f5328183b10567e73b9ff7752a06502abb4906c9758e2fe8`; its ASAR SHA-256 was
`0076ef03f4b496b0400764ee7066264d38d4777700c86059e9bd1c4569937f2f`. The restored `.13` MSIX
SHA-256 was `cf26021cb0b766e6b1b38d2433d4380088457a82bf8635b1b3fcf1bad4b66259`; its healthy patched
ASAR SHA-256 was `81683240a58ba64edb58603473687f681ea54b05fd2088dcf234602e1ad50a2d`.

This is same-inner-build supervisor-capability evidence. The known-working package was manually
preserved from the application that was actually installed and working. The current `stage-msix`
command creates both outputs from one selected source package, so it does not yet prove the stronger
ordinary-upgrade promise of preserving an older installed build while staging a newer offered
build. Candidate preparation compares the supplied recovery package with the installed inner
version, build, ASAR, package family, publisher, and architecture and fails before restart when they
do not match; do not describe that refusal as cross-version upgrade support.

## Staging

Start from [`../toolkit.windows.example.json`](../toolkit.windows.example.json), replacing every
placeholder with the exact local qualification value. Run staging on Windows with absolute paths to
the installed package root, output MSIX files, toolkit config, MakeAppx, SignTool, and a trusted code-signing certificate. The package versions in
the config must be four-part MSIX versions newer than the installed package; the known-good version
must also be newer than the candidate.

```powershell
node bin/toolkit.mjs stage-msix `
  $InstalledPackageRoot `
  $CandidateMsix `
  $KnownGoodMsix `
  --config $ToolkitConfig
```

This is a local qualification and adoption route, not a distributable OpenAI update. TMTK retains
the official package family and publisher identity while signing the rebuilt packages with an
explicitly trusted qualification certificate. It does not claim Microsoft Store provenance.

The standalone-output source repair is not part of this ASAR checkpoint. The official Windows
package contains both native `app/resources/codex.exe` and WSL `app/resources/codex`; selecting
that repair requires separately built, same-version replacements for both files. The Windows
stager rejects a partial replacement set.

## Live supervised replacement

The live gate must be initiated by a real Codex task whose environment and local task database
provide its exact task ID, project directory, model, and reasoning effort:

```powershell
node bin/tmtk-restart `
  --candidate $CandidateMsix `
  --known-good $KnownGoodMsix `
  -- $InstalledPackageRoot
```

Record the branded native consent choice, exact Desktop and invoking-CLI shutdown, writable Codex
state databases, installed package identity and hashes, exact AUMID activation, renderer-readiness
marker, restored task context, and final visible application state. A failure must preserve the
incident state and either enter the owned PowerShell rescue line or restore the independently
verified higher-version known-good package. Never weaken identity, version, signing, or readiness
checks merely to make adoption proceed.

## Qualification-only UI Automation

[`windows/ui-snapshot.ps1`](windows/ui-snapshot.ps1),
[`windows/ui-automation.ps1`](windows/ui-automation.ps1), and
[`windows/run-ui-automation.ps1`](windows/run-ui-automation.ps1) use Windows UI Automation to
inspect or invoke one exact control under an exact PID, window, and optional document. They are
test-laboratory helpers, not runtime dependencies. They do not scan by broad process name and their
receipts record text length and SHA-256 rather than prompt contents.
