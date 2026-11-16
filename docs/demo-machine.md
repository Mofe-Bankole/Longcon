# Demo machine (Gemini Nano on a Google Cloud VM)

Neither team laptop can run Gemini Nano, so on-device testing and the demo recording
happen on a Google Cloud free-trial VM, viewed through Chrome Remote Desktop.

## 1. Create the VM (about 10 min)
1. Start a free trial at https://cloud.google.com/free. A card is needed for verification, but you are not charged during the trial.
2. Open https://console.cloud.google.com, create a project (e.g. `longcon-demo`), and select it.
3. Click the **>_** (Cloud Shell) icon at the top right. Upload `scripts/nano-vm.sh` (⋮ menu → Upload) and run:
   ```
   bash nano-vm.sh create
   bash nano-vm.sh status   # repeat until it says READY
   ```

## 2. Connect with Chrome Remote Desktop
1. On your own laptop, open https://remotedesktop.google.com/headless → Begin → Next → Authorize.
2. Copy the **Debian Linux** command it shows.
3. In Cloud Shell: `bash nano-vm.sh ssh`, paste that command, and pick a 6-digit PIN.
4. Open https://remotedesktop.google.com/access. `longcon-nano` appears; connect with the PIN.

## 3. Turn on Gemini Nano in the VM's Chrome
1. Open Chrome in the remote desktop and go to `chrome://flags`:
   - **Prompt API for Gemini Nano** → *Enabled*
   - **Prompt API for Gemini Nano with Multimodal Input** → *Enabled*
   - **Enables optimization guide on device** → *Enabled BypassPerfRequirement*
2. Relaunch Chrome. Open `chrome://on-device-internals` and check the model status. The first download takes several minutes.
3. Sanity check in DevTools: `await LanguageModel.availability()` should eventually return `"available"`.

## 4. Load Longcon
- Web: open the hosted URL (or `pnpm dev:web` on the VM).
- Extension: copy `apps/extension/dist` to the VM → `chrome://extensions` → Developer mode → **Load unpacked**.
- In the spike panel, click **Prepare on-device model**, then **Tag message**. It should report `route: "on_device"`.

## Cost control
`bash nano-vm.sh stop` whenever you are not testing or recording. A stopped VM only bills for the disk.
