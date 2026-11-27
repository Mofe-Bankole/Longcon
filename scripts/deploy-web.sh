#!/usr/bin/env bash
# Build the public demo (no debug token) and deploy it to Firebase Hosting.
# First time: npx firebase-tools login
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm --filter @longcon/web exec vite build --mode hosting
# Guard: the App Check debug token must never ship in the public build.
tok=$(grep -E '^VITE_APPCHECK_DEBUG_TOKEN=' .env.local 2>/dev/null | cut -d= -f2- || true)
if [ -n "$tok" ] && [ "$tok" != "true" ] && grep -rqF "$tok" apps/web/dist; then
  echo "ABORT: the debug token is in apps/web/dist. Not deploying." >&2
  exit 1
fi
if grep -rqE 'FIREBASE_APPCHECK_DEBUG_TOKEN.{0,40}(true|[0-9a-f]{8}-[0-9a-f]{4})' apps/web/dist; then
  echo "ABORT: debug mode looks enabled in apps/web/dist. Not deploying." >&2
  exit 1
fi
npx --yes firebase-tools@14 deploy --only hosting
