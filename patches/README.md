# Patches

Each patch owns one directory. Its `README.md` is the maintenance log: what human problem the patch
solves, which application seam it owns, how it fails when upstream changes, what evidence supports
its current state, and how to check it without touching a working application.

A patch directory is not a plugin contract. The toolkit keeps an explicit, small list of the
repairs it actually carries; adding a directory does not dynamically discover or activate code.

The root [patch board](../README.md#patch-board) is the current whole-kit view.
