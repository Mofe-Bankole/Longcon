# M0 handoff: Stephen

**Due: Wed Nov 18, 23:59 WAT** (M0 slipped one day; M1 is still due Thu Nov 19, 23:59).
Read first: [`architecture.md`](architecture.md) (the locked design) and [`demo-machine.md`](demo-machine.md).

Already done (Mofe, 2026-11-18): Firebase project `longcon`, AI Logic (Gemini Developer API),
App Check (reCAPTCHA Enterprise, enforced), web spike verified on the cloud route (`route: "in_cloud"`).

M0 has two parts. Both must be done before M1 work starts.

---

## Part A: prove on-device inference (web)

Goal: the Longcon extension, running in Chrome on a Nano-capable machine, reports **`route: "on_device"`**.

1. **Access** (ask Mofe if missing): GitHub collaborator on `Mofe-Bankole/Longcon`; Editor on Firebase project `longcon`.
2. **VM:** follow [`demo-machine.md`](demo-machine.md) sections 1–3 (Google Cloud free trial → `nano-vm.sh create`
   → Chrome Remote Desktop → Chrome flags → wait until `chrome://on-device-internals` shows the model ready).
3. **Code on the VM** (inside the remote desktop terminal):
   ```bash
   sudo apt-get install -y git nodejs npm && sudo npm i -g pnpm
   git clone https://github.com/Mofe-Bankole/Longcon && cd Longcon && pnpm install
   ```
   Node 20+ is required. If apt's Node is older, install it with `nvm`.
4. **Env:** get the `.env.local` contents from Mofe **privately** (not via the repo or a public chat).
   Set `VITE_APPCHECK_DEBUG_TOKEN=true` for now.
5. **Your own debug token:** `pnpm dev:web` → open `http://localhost:5173` in the VM's Chrome → DevTools Console →
   copy the token after *"Firebase App Check debug token:"* → Firebase console → App Check → Apps → `longcon-web`
   → ⋮ → Manage debug tokens → Add (name it `stephen-vm`). Put the token in `.env.local` in place of `true`.
   Never commit or share it.
6. **Web check:** restart `pnpm dev:web`, reload, then:
   - "Chrome Prompt API" should say `available` (or `downloadable`, then click **1. Prepare on-device model**).
   - Leave **Allow cloud fallback UNTICKED** → **2. Tag message** → expect `route: "on_device"`.
7. **Extension check:** `pnpm --filter @longcon/extension build` → `chrome://extensions` → Developer mode →
   Load unpacked → `apps/extension/dist` → click the Longcon toolbar icon (opens the side panel) → repeat step 6
   there. **This is the real M0 question: does AI Logic find Nano inside an extension side panel?**
8. **Record** for Mofe: a screenshot of each result (web + side panel) and the latency for all 5 sample messages,
   on-device vs cloud (tick the box for cloud). These are the first benchmark numbers.

If step 7 fails but step 6 works: note the exact error and stop. That is an architecture decision for Mofe, not a workaround to improvise.

**Cost:** `bash nano-vm.sh stop` when finished.

---

## Part B: Android starting point

Goal: a Kotlin app in `apps/android` that calls Firebase AI Logic in hybrid mode and shows the route, built by GitHub Actions.

1. **Firebase:** Project settings → Add app → **Android**, package name **`com.longcon.app`** → download
   `google-services.json`. **Do not commit it** (add `apps/android/app/google-services.json` to `.gitignore`).
2. **Project:** Kotlin, minSdk **26**, Jetpack Compose (or Views; your call), in `apps/android`.
3. **Dependencies** (from the Firebase AI Logic Android hybrid docs; check for newer versions):
   ```kotlin
   implementation(platform("com.google.firebase:firebase-bom:34.10.0")) // or newer
   implementation("com.google.firebase:firebase-ai:18.2.0")
   implementation("com.google.firebase:firebase-ai-ondevice:16.0.0-beta08")
   implementation("com.google.firebase:firebase-appcheck-debug:20.1.0")
   ```
4. **Hello hybrid:** one screen, one button. It calls `generativeModel(..., onDeviceConfig = OnDeviceConfig(mode = InferenceMode.PREFER_ON_DEVICE))`
   with one sample message and shows the response text plus where it ran. Until the Galaxy arrives this
   will be the cloud route. Also show `FirebaseAIOnDevice.checkStatus()`.
   - App Check: `DebugAppCheckProviderFactory`. Register the logged debug token in the Firebase console the same way as the web one.
5. **CI:** `.github/workflows/android.yml` on push/PR touching `apps/android/**`:
   `actions/setup-java` (17), Gradle wrapper `assembleDebug`, upload the APK as an artifact.
   Provide `google-services.json` from a repo secret (`GOOGLE_SERVICES_JSON`, base64), decoded in the workflow.
6. **Done when:** CI is green, the APK artifact installs on any Android phone, and the button returns a response with a route.

Remember the Android rule (architecture §2.3): **Nano only runs while Longcon is the top foreground app**.
Background work and foreground services get `BACKGROUND_USE_BLOCKED`.

---

## Report back (one message to Mofe)
- [ ] A: web `route` on the VM (screenshot)
- [ ] A: extension side panel `route` on the VM (screenshot), or the exact error
- [ ] A: latency table, 5 samples × on-device/cloud
- [ ] B: CI run link + APK installs + response with route
- [ ] Blockers, if any
