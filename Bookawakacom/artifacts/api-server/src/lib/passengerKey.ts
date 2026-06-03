import { getDatabase } from "./firebase";

type FirebaseDatabase = ReturnType<typeof getDatabase>;

export type PassengerKeyQuery = {
  key?: string;
  phone?: string;
  /** Raw email or passengerIndex/email normalized key */
  email?: string;
};

export function normalizePhoneKey(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export function normalizeEmailKey(email: string): string {
  return email.toLowerCase().replace(/\./g, ",").replace(/@/g, "__at__");
}

/** Accept raw email or an already-normalized passengerIndex/email key. */
export function emailIndexKey(email: string): string {
  const e = email.trim();
  if (!e) return "";
  return e.includes("@") ? normalizeEmailKey(e) : e;
}

/** NZ phone variants for passengerIndex/phone/{digits} lookups. */
export function phoneIndexCandidates(digits: string): string[] {
  const out = new Set<string>();
  const d = normalizePhoneKey(digits);
  if (!d) return [];
  out.add(d);
  if (d.startsWith("0")) out.add(d.slice(1));
  else if (d.length >= 8) out.add(`0${d}`);
  if (d.startsWith("64") && d.length > 2) out.add(d.slice(2));
  else if (d.length >= 8 && !d.startsWith("64")) out.add(`64${d}`);
  return [...out];
}

async function lookupEmailInIndex(
  db: FirebaseDatabase,
  email: string,
): Promise<string | null> {
  const emailKey = emailIndexKey(email);
  if (!emailKey) return null;
  const snap = await db.ref(`passengerIndex/email/${emailKey}`).once("value");
  const key = snap.val()?.key;
  return key ? String(key) : null;
}

async function lookupPhoneInIndex(
  db: FirebaseDatabase,
  digits: string,
): Promise<string | null> {
  for (const candidate of phoneIndexCandidates(digits)) {
    const snap = await db.ref(`passengerIndex/phone/${candidate}`).once("value");
    const key = snap.val()?.key;
    if (key) return String(key);
  }
  return null;
}

async function walletExists(db: FirebaseDatabase, key: string): Promise<boolean> {
  const snap = await db.ref(`passengerWallet/${key}`).once("value");
  return snap.exists() && snap.val() != null;
}

/**
 * Scan passengerWallet/* for a record whose phone field matches.
 * Used when passengerIndex/phone is missing but wallet lives under web_* keys.
 */
async function scanWalletByPhone(
  db: FirebaseDatabase,
  digits: string,
): Promise<string | null> {
  const candidates = new Set(phoneIndexCandidates(digits));
  const snap = await db.ref("passengerWallet").once("value");
  if (!snap.exists()) return null;

  let found: string | null = null;
  snap.forEach((child) => {
    if (found || !child.key) return;
    const w = child.val() as Record<string, unknown> | null;
    if (!w || typeof w !== "object") return;

    const recordPhone = normalizePhoneKey(
      String(w.phone ?? w.passengerPhone ?? w.Phone ?? w.PhoneNo ?? ""),
    );
    if (recordPhone && candidates.has(recordPhone)) {
      found = child.key;
    }
  });
  return found;
}

/**
 * Write passengerIndex/email and passengerIndex/phone rows so future lookups
 * resolve by email (preferred) or phone.
 */
export async function ensurePassengerIndexForWallet(
  db: FirebaseDatabase,
  passengerKey: string,
  opts: { phone?: string; email?: string },
): Promise<void> {
  const updates: Record<string, { key: string; updatedAt?: string }> = {};
  const nowIso = new Date().toISOString();

  if (opts.email) {
    const emailKey = emailIndexKey(opts.email);
    if (emailKey) {
      updates[`passengerIndex/email/${emailKey}`] = { key: passengerKey, updatedAt: nowIso };
    }
  }

  if (opts.phone) {
    for (const candidate of phoneIndexCandidates(opts.phone)) {
      updates[`passengerIndex/phone/${candidate}`] = { key: passengerKey, updatedAt: nowIso };
    }
  }

  if (Object.keys(updates).length === 0) return;
  await db.ref().update(updates);
}

/**
 * Resolve canonical passengerWallet key.
 * Order: email (passengerIndex/email) → explicit web key → phone index / scan.
 */
export async function resolvePassengerWalletKey(
  db: FirebaseDatabase,
  query: PassengerKeyQuery,
): Promise<string | null> {
  const rawKey = query.key?.trim() ?? "";
  const phoneDigits = query.phone ? normalizePhoneKey(query.phone) : "";
  const emailInput = query.email?.trim() ?? "";

  if (emailInput) {
    const fromEmail = await lookupEmailInIndex(db, emailInput);
    if (fromEmail) return fromEmail;
  }

  if (rawKey) {
    const [hasWallet, keyIdxSnap] = await Promise.all([
      walletExists(db, rawKey),
      db.ref(`passengerIndex/key/${rawKey}`).once("value"),
    ]);
    if (hasWallet || keyIdxSnap.exists()) {
      return rawKey;
    }
  }

  const phoneToLookup =
    phoneDigits ||
    (rawKey && /^\d{8,15}$/.test(normalizePhoneKey(rawKey))
      ? normalizePhoneKey(rawKey)
      : "");

  if (phoneToLookup) {
    const fromIndex = await lookupPhoneInIndex(db, phoneToLookup);
    if (fromIndex) return fromIndex;

    const fromScan = await scanWalletByPhone(db, phoneToLookup);
    if (fromScan) return fromScan;
  }

  if (rawKey && (await walletExists(db, rawKey))) {
    return rawKey;
  }

  return null;
}
