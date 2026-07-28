#!/usr/bin/env bash
#
# Runs `aletheia diff` and records its exit code for the gate step.
#
# Why this is a script and not inline YAML. The previous inline version was:
#
#     node bin/aletheia.mjs diff ... --fail-on elevated
#     echo "exit=$?" >> "$GITHUB_OUTPUT"
#
# GitHub Actions runs `run:` blocks under `bash -e`, so a non-zero exit from
# node aborted the script *before* the echo. Combined with
# `continue-on-error: true`, the gate step then read an empty value and treated
# it as a pass. Every PR went green, including ones that expanded authority.
# Logic that decides whether a merge is allowed belongs somewhere it can be
# tested, so it lives here and is covered by capabilityGate.test.ts.
#
# `aletheia diff` exit contract (see src/cli/aletheia.ts):
#   0 = no capability change
#   1 = fail-on threshold hit (authority expanded)
#   2 = error (no compiled manifest, build failure)
#
# This script exits 0 for both 0 and 1 — the gate step decides what to do with
# them — and propagates anything >= 2 so a tooling failure fails the job loudly
# instead of being silently reported as "no change".
#
# Usage: capability-diff.sh <command> [args...]
# Writes: exit=<code> to $GITHUB_OUTPUT when that variable is set.

set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: capability-diff.sh <command> [args...]" >&2
  exit 64
fi

"$@"
diff_exit=$?

echo "aletheia diff exited ${diff_exit}"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "exit=${diff_exit}" >> "$GITHUB_OUTPUT"
fi

if [ "$diff_exit" -gt 1 ]; then
  echo "::error::aletheia diff failed to run (exit ${diff_exit}). This is a tooling failure, not a capability change." >&2
  exit "$diff_exit"
fi

exit 0
