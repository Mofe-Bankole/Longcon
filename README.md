# Longcon

**Catches the scams that take weeks, without your chats ever leaving your device.**

Romance scams, crypto "investment" scams, fake jobs and "Mum, it's my new number" impersonation
don't look dangerous in any single message. They build up slowly across weeks of conversation:
first friendliness, then secrecy, then urgency, then "send USDT". Longcon watches that progression.

## How it uses hybrid inference (Firebase AI Logic)

| Step | Where | Why there |
|---|---|---|
| Tag **every** message for scam tactics (structured JSON) | **On device**: Gemini Nano via Firebase AI Logic, `ONLY_ON_DEVICE` | Free, instant, private. Scanning every chat in the cloud would mean uploading everyone's private messages |
| Score the conversation's arc (rapport → isolation → hook → extraction) | On device, deterministic TypeScript | Auditable, testable, tunable via Remote Config |
| Verify the suspicious claims (does this platform/company exist?) | **Cloud**: Gemini with Google Search grounding, only for escalated chats | Needs web search and a stronger model. It receives a **redacted pattern summary**, never the chat |

**Privacy guard:** if Nano isn't available, Longcon does *not* quietly fall back to the cloud
(`PREFER_ON_DEVICE` would). Message tagging uses `ONLY_ON_DEVICE` unless the user explicitly consents.

## Repo layout

```
packages/core     tactics, risk engine, redaction, Firebase AI Logic models (shared)
apps/extension    Chrome MV3 extension (side panel; WhatsApp Web + Gmail adapters)
apps/web          hosted site: demo inbox, guardian dashboard
scripts/          nano-vm.sh: Google Cloud VM that can run Gemini Nano
docs/             setup guides
```

## Run it

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local     # fill in your Firebase web config
pnpm dev:web                   # web app on http://localhost:5173
pnpm --filter @longcon/extension build   # then load apps/extension/dist as an unpacked extension
pnpm test
```

On-device inference needs desktop Chrome 139+ with Gemini Nano enabled. See
[docs/demo-machine.md](docs/demo-machine.md) for the flags, or for a cloud VM if your machine can't run Nano.

### Firebase setup
1. Create a Firebase project → **AI Logic** → get started with the **Gemini Developer API**.
2. Register a **Web app** and copy its config into `.env.local`.
3. **App Check**: register the web app with reCAPTCHA Enterprise (Google Cloud console → Security → reCAPTCHA, website key, no checkbox). For local dev and the extension,
   set `VITE_APPCHECK_DEBUG_TOKEN=true`, copy the token printed in the console, and register it under
   App Check → Manage debug tokens.

## License

MIT
