# Finish line

**Submit by Mon Nov 30, 18:00 WAT** (hard deadline 23:00 WAT / 2:00pm PST). Tick items as they're done.
Live site: https://longcon.web.app · Demo: https://longcon.web.app/#/demo · Script: [`video.md`](video.md) · Write-up: [`devpost.md`](devpost.md)

## Moses: Nano proof + footage (ETA Fri evening)
- [ ] Chrome flags on, `chrome://on-device-internals` shows the model ready → screenshot
- [ ] Live demo model pill says **Private model ready on this computer** → screenshot
- [ ] Margaret & Mark played on Nano: signs show **Checked privately** → screenshot + note the day the panel first says *Some warning signs*
- [ ] `#/bench`: run with **Cloud unticked** → send the downloaded `longcon-bench-*.json` to Mofe
- [ ] Shots S1–S8 + Proof from [`video.md`](video.md) (Sat)
- If anything fails: the **exact error text** + screenshot to Mofe, and don't work around it

## Stephen: Android + edit (after work)
- [ ] Reply "OK" to the Apache-2.0 relicense
- [ ] Share to Longcon: share text → Nano (`ONLY_ON_DEVICE`, cloud behind consent) → Kotlin RiskEngine → Arc + verdict
- [ ] CI green with `GOOGLE_SERVICES_JSON` + App Check debug provider
- [ ] S9 phone screen recording (Sat night)
- [ ] Video edit, 2:50, captions, from Moses's footage + Mofe's narration (Sun)

## Mofe
- [ ] Cloud mode on the live site: fix reCAPTCHA **or** ship the separate `public-demo-judging` token (decide by **Sat 12:00**)
- [ ] Record the narration (script in [`video.md`](video.md)) (Sat)
- [ ] Upload the video to YouTube **Unlisted**, watch it logged out, then make it Public
- [ ] Free disk space (builds fail under ~500 MB)

## Claude (with Mofe)
- [ ] Benchmark JSON → `bench/`, numbers on the live site (#/about), in `video.md` (W, N) and `devpost.md`
- [ ] Final README pass (video link, real numbers)
- [ ] Redeploy after every change; check the landing page, demo, own-conversation and about pages on desktop + phone

## Submission (Mon, by 18:00 WAT)
- [ ] **Code freeze Sun 12:00**: bug fixes only after this
- [ ] Repo **public** (Settings → General → Change visibility); LICENSE (Apache-2.0) visible on GitHub
- [ ] No secrets in the repo: `git log -p | grep -iE "AIza|debug.?token|BEGIN PRIVATE"` shows only the public web config
- [ ] Devpost: title, tagline, description ([`devpost.md`](devpost.md)), video URL, hosted URL, repo URL, screenshots, "Built with"
- [ ] Every link opened in a **logged-out** browser: site, demo, video, repo
- [ ] Submitted; confirmation email received

## After judging (from Dec 16)
- [ ] Delete App Check debug tokens: `moses-pc`, `public-demo-judging` (if used), any `stephen-*`
- [ ] Stop/delete any Google Cloud VM; check the billing budget page
