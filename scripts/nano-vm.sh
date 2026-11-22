#!/usr/bin/env bash
# Longcon demo machine: a Google Cloud VM that can run Gemini Nano in Chrome.
#
# Chrome runs Nano on CPU when the machine has >=16 GB RAM and >=4 cores, and needs
# ~22 GB free disk for the model. e2-standard-8 = 8 vCPU / 32 GB (free-trial max is 8 vCPU).
# Cost: roughly $0.27/hour while RUNNING plus a few $/month for the disk. Run `stop` when done.
#
# Run in Cloud Shell (console.cloud.google.com → the >_ icon):
#   bash nano-vm.sh create     # create VM + install desktop, Chrome, Chrome Remote Desktop
#   bash nano-vm.sh ssh        # then paste the Chrome Remote Desktop command (see docs/demo-machine.md)
#   bash nano-vm.sh stop|start|delete|status
set -euo pipefail

NAME="${NAME:-longcon-nano}"
ZONE="${ZONE:-us-central1-a}"
MACHINE="${MACHINE:-e2-standard-8}"
DISK_GB="${DISK_GB:-80}"

startup_script() {
  cat <<'STARTUP'
#!/bin/bash
set -e
[ -f /var/lib/longcon-ready ] && exit 0
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y xfce4 xfce4-goodies dbus-x11 xscreensaver fonts-noto-color-emoji wget unzip python3
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb
wget -q https://dl.google.com/linux/direct/chrome-remote-desktop_current_amd64.deb -O /tmp/crd.deb
apt-get install -y /tmp/chrome.deb /tmp/crd.deb
echo "exec /etc/X11/Xsession /usr/bin/xfce4-session" > /etc/chrome-remote-desktop-session
systemctl disable lightdm.service 2>/dev/null || true
touch /var/lib/longcon-ready
STARTUP
}

case "${1:-}" in
  create)
    gcloud services enable compute.googleapis.com
    tmp=$(mktemp); startup_script > "$tmp"
    gcloud compute instances create "$NAME" \
      --zone "$ZONE" --machine-type "$MACHINE" \
      --image-family ubuntu-2404-lts-amd64 --image-project ubuntu-os-cloud \
      --boot-disk-size "${DISK_GB}GB" --boot-disk-type pd-balanced \
      --metadata-from-file startup-script="$tmp"
    rm "$tmp"
    echo "Installing desktop + Chrome (about 5 min). Check progress with: bash $0 status"
    ;;
  status)
    gcloud compute ssh "$NAME" --zone "$ZONE" --command \
      'test -f /var/lib/longcon-ready && echo READY: $(google-chrome --version) || echo "still installing…"'
    ;;
  ssh)    gcloud compute ssh "$NAME" --zone "$ZONE" ;;
  start)  gcloud compute instances start "$NAME" --zone "$ZONE" ;;
  stop)   gcloud compute instances stop "$NAME" --zone "$ZONE" ;;
  delete) gcloud compute instances delete "$NAME" --zone "$ZONE" ;;
  *) echo "usage: $0 create|status|ssh|start|stop|delete"; exit 1 ;;
esac
