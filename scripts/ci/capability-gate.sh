#!/usr/bin/env bash
#
# Decides whether a capability change is allowed to merge.
#
# Fails CLOSED. Any result it cannot interpret — empty, non-numeric, or an
# error code — blocks the merge. The version this replaces failed *open*: it
# compared an empty string against "1", which is false, so a missing diff
# result read as "no capability change" and passed.
#
# For a tool whose entire promise is "it never presents a guess as a fact",
# the gate must refuse to guess that silence means safety.
#
# Inputs (environment):
#   DIFF_EXIT  exit code from capability-diff.sh — required
#   ACK        "true" when the capability-change-ack label is present
#   NAME       matrix leg name, for log messages
#
# Exit: 0 = may merge, 1 = blocked.

set -uo pipefail

name="${NAME:-agent}"
diff_exit="${DIFF_EXIT:-}"
ack="${ACK:-false}"

if [ -z "$diff_exit" ]; then
  echo "::error::[${name}] No capability-diff result was reported. Failing closed — this usually means the diff step crashed before recording its exit code." >&2
  exit 1
fi

case "$diff_exit" in
  *[!0-9]*)
    echo "::error::[${name}] Unexpected capability-diff result '${diff_exit}'. Failing closed." >&2
    exit 1
    ;;
esac

if [ "$diff_exit" -gt 1 ]; then
  echo "::error::[${name}] aletheia diff failed to run (exit ${diff_exit}). Fix the tooling failure before merging." >&2
  exit 1
fi

if [ "$diff_exit" -eq 1 ] && [ "$ack" != "true" ]; then
  echo "::error::[${name}] Agent authority expanded. Review the capability diff, then add the 'capability-change-ack' label to acknowledge and merge." >&2
  exit 1
fi

if [ "$diff_exit" -eq 1 ]; then
  echo "[${name}] Authority expanded and was acknowledged via the capability-change-ack label. Allowing merge."
  exit 0
fi

echo "[${name}] Capability review passed — no capability change (exit=${diff_exit}, acknowledged=${ack})."
exit 0
