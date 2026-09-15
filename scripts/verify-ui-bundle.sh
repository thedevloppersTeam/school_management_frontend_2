#!/usr/bin/env bash
# Verification script for CPMSL UI audit agents bundle.
# Run from the bundle root after extraction.

set -e

echo "=== Vérification de l'intégrité du bundle UI ==="
echo ""

ok=0
ko=0

check_file() {
  local f="$1"
  if [ -f "$f" ]; then
    size=$(wc -c < "$f" | tr -d ' ')
    printf "  ✓ %-55s (%s bytes)\n" "$f" "$size"
    ok=$((ok+1))
  else
    printf "  ✗ %-55s MANQUANT\n" "$f"
    ko=$((ko+1))
  fi
}

echo "--- Fichiers critiques ---"
for f in \
  README.md \
  CLAUDE-UI-ADDENDUM.md \
  .claude/commands/audit-ui.md \
  .github/workflows/ui-audit.yml \
  docs/ui/README.md \
  docs/ui/design-tokens.md \
  docs/ui/visual-hierarchy.md \
  docs/ui/component-patterns.md \
  docs/ui/a11y-checklist.md \
  docs/ui/visual-states.md \
  docs/ui/responsive-rules.md
do
  check_file "$f"
done

echo ""
echo "--- Agents Claude Code ---"
for agent in \
  ui-design-tokens-auditor \
  ui-visual-hierarchy-auditor \
  ui-component-consistency-auditor \
  ui-accessibility-auditor \
  ui-visual-states-auditor \
  ui-responsive-auditor \
  ui-orchestrator
do
  f=".claude/agents/${agent}.md"
  if [ -f "$f" ]; then
    if head -1 "$f" | grep -q "^---$"; then
      # Verify mandatory YAML keys
      if grep -q "^name: " "$f" && grep -q "^description: " "$f" && grep -q "^tools: " "$f" && grep -q "^model: " "$f"; then
        printf "  ✓ %-35s (YAML OK)\n" "$agent"
        ok=$((ok+1))
      else
        printf "  ⚠ %-35s (YAML incomplet)\n" "$agent"
        ko=$((ko+1))
      fi
    else
      printf "  ⚠ %-35s (pas de frontmatter)\n" "$agent"
      ko=$((ko+1))
    fi
  else
    printf "  ✗ %-35s MANQUANT\n" "$agent"
    ko=$((ko+1))
  fi
done

echo ""
echo "--- Totaux ---"
echo "  Fichiers OK    : $ok"
echo "  Fichiers KO    : $ko"
echo "  Fichiers total : $(find . -type f -not -path './.git/*' | wc -l | tr -d ' ')"
echo "  Dossiers total : $(find . -type d -not -path './.git*' | wc -l | tr -d ' ')"

echo ""
if [ "$ko" -eq 0 ]; then
  echo "✅ Bundle UI complet et intègre."
  exit 0
else
  echo "❌ Bundle UI incomplet — $ko fichier(s) manquant(s) ou malformé(s)."
  exit 1
fi
