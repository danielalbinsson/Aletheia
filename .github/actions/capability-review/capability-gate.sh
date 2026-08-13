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
#   ACK        "true" when the ack label is present
#   ACK_LABEL  PR label that acknowledges an expansion (default capability-change-ack)
#   NAME       matrix leg name, for log messages
#
# Exit: 0 = may merge, 1 = blocked.

set -uo pipefail

name="${NAME:-agent}"
diff_exit="${DIFF_EXIT:-}"
ack="${ACK:-false}"
ack_label="${ACK_LABEL:-capability-change-ack}"

if [ -z "$diff_exit" ]; then
  echo "::error::[${name}] No capability-diff result was reported. Failing closed — this usually means the diff step crashed before recording its exit code." >&2
  exit 1
fi

case "$diff_exit" in
  0)
    echo "[${name}] Authority diff passed (exit=0, acknowledged=${ack})."
    exit 0
    ;;
  1)
    if [ "$ack" != "true" ]; then
      echo "::error::[${name}] Authority-diff threshold hit. Review the report, then add the '${ack_label}' label to acknowledge and merge." >&2
      exit 1
    fi
    echo "[${name}] Authority-diff threshold hit and was acknowledged via the ${ack_label} label. Allowing merge."
    exit 0
    ;;
  *)
    echo "::error::[${name}] aletheia diff failed to run (exit ${diff_exit}). Fix the tooling failure before merging." >&2
    exit 1
    ;;
esac
