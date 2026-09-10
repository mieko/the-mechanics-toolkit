# Codex Desktop package patches

Each patch owns one directory. Its `README.md` is the maintenance log: what human problem the patch
solves, which application seam it owns, how it fails when upstream changes, what evidence supports
its current state, and how to check it without touching a working application.

A patch directory is not a plugin contract. The toolkit keeps an explicit, small list of the
repairs it actually carries; adding a directory does not dynamically discover or activate code.

This directory owns the packaged desktop application: extracted ASAR JavaScript, bundle metadata,
and explicit staged-app integration. Repairs to the open-source Rust App Server/Core live in the
separate [`source-patches/`](../source-patches/) catalog. A built Rust binary may enter this lane as
an explicit staging input, but building it is not a desktop-package patch.

The root [desktop package board](../README.md#codex-desktop-package-patches) is the current
whole-kit view.
