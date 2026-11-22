#!/usr/bin/env bash
# Build the web spike + extension with your .env.local and zip them for the Nano VM.
# The zip contains your App Check debug token baked into the JS: share it only privately
# (e.g. your own Google Drive), never in the repo or a public link.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm --filter @longcon/web build
pnpm --filter @longcon/extension build
rm -rf .vm-bundle longcon-vm.zip
mkdir -p .vm-bundle
cp -r apps/web/dist .vm-bundle/web
cp -r apps/extension/dist .vm-bundle/extension
cat > .vm-bundle/serve-web.sh <<'SERVE'
#!/usr/bin/env bash
# Serves the web spike on http://localhost:5173 (localhost counts as a secure context for the Prompt API).
cd "$(dirname "$0")/web" && python3 -m http.server 5173 --bind 127.0.0.1
SERVE
chmod +x .vm-bundle/serve-web.sh
python3 -c "import shutil; shutil.make_archive('longcon-vm', 'zip', '.vm-bundle')"
rm -rf .vm-bundle
echo "Built $(pwd)/longcon-vm.zip"
