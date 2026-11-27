# Moses: demo lead (Nano machine)

**You're in charge of the demos.** Every on-device shot in the video, the benchmark run, and the final demo
recordings happen on your PC. Mofe writes the script and narration, and Stephen edits.

Welcome to Longcon. Your PC (RTX 2070, 16 GB) is one of the few machines on the team that can run
**Gemini Nano** on-device, so it's where we prove Longcon's core claim: **messages are checked privately
on the device, not in the cloud.** You own three things: the on-device test, the benchmark run, and demo footage.

Contact: Mofe (lead). If anything fails, send the **exact error text** and a screenshot. Don't work around it.

**What you'll receive from Mofe privately (never via GitHub):** `longcon-vm.zip`. It contains a test key
(App Check debug token) issued just for your PC. Don't share it, and delete it after each session.

---

## Task 1: one-time setup (~30 min, mostly waiting)
1. Update Chrome (Settings → About Chrome). Make sure there's **≥ 22 GB free** on C:.
2. Create a separate Chrome profile for Longcon (profile icon → Add → *Continue without an account*).
3. In that profile, open `chrome://flags` and set:
   - **Prompt API for Gemini Nano** → Enabled
   - **Prompt API for Gemini Nano with Multimodal Input** → Enabled
   - **Enables optimization guide on device** → Enabled
   
   Then click **Relaunch**.
4. Open `chrome://on-device-internals` and wait for the model to download.
   Check: F12 → Console → `await LanguageModel.availability()` returns `"available"`.
5. Send Mofe a screenshot of `chrome://on-device-internals` (model status) and `chrome://gpu` (top section).

## Task 2: the on-device test (M0)
1. Unzip `longcon-vm.zip`. Open `chrome://extensions` → **Developer mode** → **Load unpacked** → choose the `extension` folder.
2. Pin Longcon (puzzle icon) → click it → the side panel opens.
3. Click **1. Prepare on-device model**. Leave **Allow cloud fallback** **unticked** → **2. Tag message**.
   **Pass = `route: "on_device"`.** Screenshot it.
4. Latency table: for each of the 5 sample messages, record `latencyMs` with the box **unticked** (on-device)
   and **ticked** (cloud). Run each one twice; the first run is slower.

   | Sample | on_device ms (run 1 / run 2) | in_cloud ms (run 1 / run 2) | tactics found |
   |---|---|---|---|

## Task 3: the benchmark run (when Mofe sends the new zip)
A **Run benchmark** button will run 6 test conversations (~330 messages) through Nano and the cloud and
download a `results.json`. Keep the PC plugged in, close games and heavy apps, and don't use Chrome during the run.
Send Mofe the file.

## Task 4: demo footage
**Follow the shot list in [`video.md`](video.md)** (it replaces the short list below).

Record with **Win + Alt + R** (Xbox Game Bar), at 1080p, with notifications off (Focus assist on).
- The side panel checking a message on-device. Hold still for 2 seconds on the result.
- `chrome://on-device-internals` showing the model is ready (proof shot for the video).
- Take several clean takes of each. We'll cut the waits in the edit.

## After every session
Remove the extension (`chrome://extensions` → Remove), and delete the unzipped folder and the zip.
You can leave the flags and the downloaded model in place; that makes the next session quicker.

## Deadlines (final 4 days)
| What | When |
|---|---|
| Tasks 1–2 (setup + on-device test) | **Fri Nov 27** |
| Task 3: benchmark run on the hosted demo | **Sat Nov 28** |
| Task 4: final demo recordings, following Mofe's shot list | **Sat Nov 28 – Sun Nov 29, 12:00** |
| Re-takes | Sun Nov 29, evening |
| Submission | Mon Nov 30 (Mofe) |

Once the hosted demo is live (`https://longcon.web.app`), you won't need the zip for demos: just open the URL in your Longcon Chrome profile.
