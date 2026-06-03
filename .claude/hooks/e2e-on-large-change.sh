#!/bin/sh
# e2e-on-large-change.sh — Claude Code Stop-hook guard.
#
# Runs the READ-ONLY public Playwright smoke (npm run test:e2e:public) after a
# *large* local change to app source. NEVER runs the forms/admin specs — those
# do real DB inserts. Safe no-op until the E2E suite + Playwright exist here.
#
# Opt out:   export E2E_HOOK_DISABLE=1     |    touch .claude/.e2e-hook-off
# Tune:      E2E_HOOK_THRESHOLD  changed app files to trigger (default 3)
#            E2E_HOOK_COOLDOWN   seconds between runs (default 600)
#            E2E_HOOK_BASE_URL   default prod; set http://localhost:4321 to test
#                                un-deployed changes against `npm run dev`
#            E2E_HOOK_DRYRUN=1   report the decision, don't run Playwright
set -eu

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT" 2>/dev/null || exit 0

[ -n "${E2E_HOOK_DISABLE:-}" ] && exit 0
[ -f "$ROOT/.claude/.e2e-hook-off" ] && exit 0
[ -d "$ROOT/e2e" ] || exit 0
[ -x "$ROOT/node_modules/.bin/playwright" ] || exit 0

# Changed app-source files (modified/added/untracked), restricted to app dirs.
CHANGED="$(git status --porcelain -- \
  src/pages src/components src/layouts src/lib src/styles \
  astro.config.mjs astro.config.ts astro.config.js 2>/dev/null | awk '{print $NF}')"
COUNT="$(printf '%s\n' "$CHANGED" | grep -c . 2>/dev/null || true)"
[ "${COUNT:-0}" -lt "${E2E_HOOK_THRESHOLD:-3}" ] && exit 0

# Debounce: skip identical change-set, and respect a cooldown between runs.
STATE="$ROOT/.claude/.e2e-hook-state"
SIG="$(git rev-parse HEAD 2>/dev/null || echo none):$(printf '%s\n' "$CHANGED" | sort | shasum 2>/dev/null | awk '{print $1}')"
NOW="$(date +%s)"
COOLDOWN="${E2E_HOOK_COOLDOWN:-600}"
if [ -f "$STATE" ]; then
  LAST_SIG="$(sed -n '1p' "$STATE" 2>/dev/null || true)"
  LAST_TS="$(sed -n '2p' "$STATE" 2>/dev/null || true)"
  [ "$SIG" = "$LAST_SIG" ] && exit 0
  if [ -n "$LAST_TS" ] && [ "$((NOW - ${LAST_TS:-0}))" -lt "$COOLDOWN" ]; then exit 0; fi
fi
mkdir -p "$ROOT/.claude"
printf '%s\n%s\n' "$SIG" "$NOW" > "$STATE"

if [ -n "${E2E_HOOK_DRYRUN:-}" ]; then
  echo "[e2e-hook dry-run] $COUNT changed app file(s) -> would run: npx playwright test e2e/public"
  exit 0
fi

OUT="$(BASE_URL="${E2E_HOOK_BASE_URL:-https://kitchen-directory.vercel.app}" \
  npx playwright test e2e/public --reporter=line 2>&1 | tail -5 || true)"

if printf '%s\n' "$OUT" | grep -qiE '[0-9]+ failed'; then
  echo "E2E public smoke FAILED after a large local change ($COUNT app file(s) modified):"
  echo "$OUT"
  exit 2   # asyncRewake: surfaces this back to the agent/user; success is silent
fi
exit 0
