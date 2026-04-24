#!/usr/bin/env bash
# scripts/ci-audit.sh — Run the UX audit in CI mode (non-interactive).
#
# Usage:
#   ./scripts/ci-audit.sh                  # Full audit
#   ./scripts/ci-audit.sh --changed-only   # Only files changed vs main
#
# Exit codes:
#   0 — no blocker findings
#   1 — at least one blocker finding
#   2 — audit failed to run (environment issue)

set -euo pipefail

REPORT_JSON="audit-report.json"
REPORT_MD="audit-report.md"

# 1. Determine scope
if [[ "${1:-}" == "--changed-only" ]]; then
  SCOPE=$(git diff --name-only "${GITHUB_BASE_REF:-main}"...HEAD \
    | grep -E '\.(tsx|ts|jsx|js|css|json)$' \
    | tr '\n' ' ' || true)
  if [[ -z "${SCOPE// }" ]]; then
    echo "No relevant files changed. Skipping audit."
    echo '{"run_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","scope":[],"summary":{"blocker":0,"major":0,"minor":0,"info":0},"ci_should_fail":false,"findings":[]}' > "$REPORT_JSON"
    exit 0
  fi
  PROMPT="Use the ux-orchestrator subagent to audit these files: $SCOPE"
else
  PROMPT="Use the ux-orchestrator subagent to audit the full front-end under src/, app/, components/, and pages/."
fi

# 2. Run Claude Code in headless mode (--print = non-interactive, exits after first turn)
echo "Running UX audit..."
claude --print --dangerously-skip-permissions "$PROMPT" > /dev/null

# 3. Check that the JSON report exists
if [[ ! -f "$REPORT_JSON" ]]; then
  echo "ERROR: audit did not produce $REPORT_JSON"
  exit 2
fi

# 4. Parse and decide
BLOCKERS=$(jq -r '.summary.blocker' "$REPORT_JSON")
MAJORS=$(jq -r '.summary.major' "$REPORT_JSON")
MINORS=$(jq -r '.summary.minor' "$REPORT_JSON")
CI_FAIL=$(jq -r '.ci_should_fail' "$REPORT_JSON")

echo ""
echo "======================================"
echo " UX Audit Summary"
echo "======================================"
echo " Blockers: $BLOCKERS"
echo " Majors:   $MAJORS"
echo " Minors:   $MINORS"
echo "======================================"
echo ""

if [[ "$CI_FAIL" == "true" ]]; then
  echo "FAIL — $BLOCKERS blocker finding(s). See $REPORT_MD for details."
  exit 1
fi

echo "PASS — no blocker findings."
exit 0
