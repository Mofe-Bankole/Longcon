#!/usr/bin/env bash
# Build the public demo (no debug token) and deploy it to Firebase Hosting.
# First time: npx firebase-tools login
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm --filter @longcon/web exec vite build --mode hosting
# Guard: your personal App Check debug token (.env.local) must never ship in the public build.
tok=$(grep -E '^VITE_APPCHECK_DEBUG_TOKEN=' .env.local 2>/dev/null | cut -d= -f2- || true)
if [ -n "$tok" ] && [ "$tok" != "true" ] && grep -rqF "$tok" apps/web/dist; then
  echo "ABORT: your personal debug token is in apps/web/dist. Not deploying." >&2
  exit 1
fi
# Fallback (reCAPTCHA unavailable): a SEPARATE, revocable token named for the public demo may ship,
# only when it is set in .env.hosting.local (gitignored) AND LONGCON_PUBLIC_TOKEN=1 is passed.
pub=$(grep -E '^VITE_APPCHECK_DEBUG_TOKEN=' .env.hosting.local 2>/dev/null | cut -d= -f2- || true)
if [ -n "$pub" ]; then
  if [ "${LONGCON_PUBLIC_TOKEN:-}" != "1" ]; then
    echo "ABORT: .env.hosting.local sets a public demo token. Re-run with LONGCON_PUBLIC_TOKEN=1 to ship it on purpose." >&2
    exit 1
  fi
  if [ "$pub" = "$tok" ] || [ "$pub" = "true" ]; then
    echo "ABORT: the public demo token must be a separate token, not your personal one or 'true'." >&2
    exit 1
  fi
  echo "NOTE: shipping the public demo App Check token. Revoke it in Firebase after judging." >&2
fi
npx --yes firebase-tools@14 deploy --only hosting
