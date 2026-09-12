# Codex Desktop package patches

Each patch owns one directory. Its `README.md` is the maintenance log: what human problem the patch
solves, which application seam it owns, how it fails when upstream changes, what evidence supports
its current state, and how to check it without touching a working application.

A patch directory is not a plugin contract. The toolkit keeps an explicit, small list of the
repairs it actually carries; adding a directory does not dynamically discover or activate code.

The patch directory also remains the feature's owner across operating systems. Most Codex renderer
code is shared closely enough that one exact generated-code profile can serve more than one
platform. Keep that profile in the main transform. If an inspected package proves that one platform
has a different minified owner, add only that narrow variant under `profiles/` in the same feature
directory—for example, `profiles/linux.mjs`. Do not create parallel macOS, Linux, and Windows patch
fleets, and do not add empty platform profiles in anticipation of divergence.

Platform packaging and lifecycle are separate from feature semantics. Application identity,
repacking, signing, installation, process discovery, native dialogs, launch, and rescue-terminal
handoff belong to [`src/platforms/`](../src/platforms/) and the adjacent platform package modules.
Platform-specific live evidence belongs under [`qualification/`](../qualification/).

This directory owns the packaged desktop application: extracted ASAR JavaScript, bundle metadata,
and explicit staged-app integration. Repairs to the open-source Rust App Server/Core live in the
separate [`source-patches/`](../source-patches/) catalog. A built Rust binary may enter this lane as
an explicit staging input, but building it is not a desktop-package patch.

The root [desktop package board](../README.md#codex-desktop-package-patches) is the current
whole-kit view.
