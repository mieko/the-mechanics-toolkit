# Safe-start readiness

This patch gives the toolkit's restart supervisor one narrow fact: the primary Codex application
routes reached their committed renderer mount. It reuses Codex's stock trusted-renderer `ready`
event and makes the main process call Codex's existing per-launch marker writer. The stock event is
owned by the healthy `AppRoutes` mount, so an application-level error boundary does not count as a
successful start.

The marker path comes from the launch-only `CODEX_ELECTRON_DEV_RELAUNCH_MARKER_PATH` environment
variable. The toolkit creates a fresh private path for every attempt, so an old marker cannot make
a later launch look healthy. The patch does not restart Codex, choose a rescue agent, open a
terminal, or kill a wedged process; those decisions belong to `tmtk-restart`.

Every staged fleet must include this infrastructure patch. Without it, a healthy candidate cannot
produce the supervisor's acceptance signal and would be misclassified as an unready launch.

The transform is qualified on Codex Desktop `26.908.31457` (`8690`) for macOS ARM64 and
`26.908.40834` (`8881`) for Ubuntu 24.04 ARM64 and Windows 11 ARM64. It fails closed when the
app-shell owner, trusted IPC boundary, or stock marker writer changes. All qualified fleets produced
the private marker through supervised installation and reached healthy renderer readiness. The
Linux run also froze a genuine task and exact bundled-CLI ancestor before replacement; controlled
failure, terminal rescue, and known-good restoration remain separate open gates there. Windows
carried the marker through exact MSIX activation and used it to accept the final known-working
restoration after a deliberately broken candidate exhausted three repair turns.
