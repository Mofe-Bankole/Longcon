/**
 * Contact hashing for the household (architecture §2.4).
 *
 * cHash = hex(HMAC-SHA256(householdSecret, normaliseHandle(handle)))
 *
 * The household secret is shared device-to-device at pairing (QR) and never stored in Firestore,
 * so the server cannot brute-force phone numbers out of the hashes. Kotlin must produce identical
 * output: see contracts/vectors/hash.json.
 */

/**
 * Canonical form of a contact handle, prefixed by kind so different kinds never collide.
 * - email  → "email:jane.doe@example.com" (trimmed, lowercased)
 * - phone  → "phone:+447700900123" or "phone:08031234567" (digits, keeps a leading +)
 * - handle → "handle:eng_mark" (leading @ removed, lowercased), e.g. Telegram / Messenger names
 *
 * A phone number gets the same hash on WhatsApp and SMS, which links those channels for free.
 * Known limit: local and international forms of one number ("0803…" vs "+234803…") differ.
 */
export function normaliseHandle(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `email:${s}`;
  const digits = s.replace(/[^\d]/g, '');
  if (/^\+?[\d\s().-]+$/.test(s) && digits.length >= 7) return `phone:${s.startsWith('+') ? '+' : ''}${digits}`;
  return `handle:${s.replace(/^@+/, '').replace(/\s+/g, ' ')}`;
}

const enc = new TextEncoder();

export async function importHouseholdKey(secretHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', hexToBytes(secretHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function contactHash(key: CryptoKey, handle: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(normaliseHandle(handle)));
  return bytesToHex(new Uint8Array(sig));
}

/** 32 random bytes, hex. Generated once by the first device, shared by QR. */
export function newHouseholdSecret(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (!/^([0-9a-f]{2})+$/i.test(hex)) throw new Error('household secret must be hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
