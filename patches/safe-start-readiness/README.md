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

The current transform is qualified only for Codex Desktop `26.903.71938` (`8576`) and fails closed
when the app-shell owner, trusted IPC boundary, or stock marker writer changes.
