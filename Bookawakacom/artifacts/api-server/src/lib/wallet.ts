import { getDatabase } from "./firebase";
import {
  ensurePassengerIndexForWallet,
  PassengerKeyQuery,
  resolvePassengerWalletKey,
} from "./passengerKey";

type FirebaseDatabase = ReturnType<typeof getDatabase>;

export type WalletPassengerRef = string | PassengerKeyQuery;

async function resolveRef(
  db: FirebaseDatabase,
  ref: WalletPassengerRef,
): Promise<string | null> {
  const query: PassengerKeyQuery =
    typeof ref === "string" ? { key: ref } : ref;
  const resolved = await resolvePassengerWalletKey(db, query);
  if (!resolved) {
    console.warn("[Wallet] could not resolve passenger key", query);
  }
  return resolved;
}

/**
 * Effective wallet balance in cents. Uses the higher of `balance` (NZD dollars)
 * and `balanceCents` so UI dollar balance and ledger cents stay in sync.
 */
export function walletBalanceCents(data: Record<string, any> | null | undefined): number {
  if (!data) return 0;
  let cents = 0;
  if (typeof data.balance === "number" && !Number.isNaN(data.balance)) {
    cents = Math.max(cents, Math.round(data.balance * 100));
  }
  if (typeof data.balanceCents === "number" && !Number.isNaN(data.balanceCents)) {
    cents = Math.max(cents, Math.max(0, Math.round(data.balanceCents)));
  }
  return cents;
}

export async function readWalletBalanceCents(
  db: FirebaseDatabase,
  passengerRef: WalletPassengerRef,
): Promise<number> {
  const passengerKey = await resolveRef(db, passengerRef);
  if (!passengerKey) return 0;
  const snap = await db.ref(`passengerWallet/${passengerKey}`).once("value");
  return walletBalanceCents(snap.val());
}

export { resolvePassengerWalletKey };

export type WalletEntryMeta = {
  reason: string;
  jobId: string;
  companyId: string;
};

export async function debitWallet(
  db: FirebaseDatabase,
  passengerRef: WalletPassengerRef,
  cents: number,
  meta: WalletEntryMeta,
): Promise<
  | { ok: true; entryId: string; newBalanceCents: number; passengerKey: string }
  | { ok: false; error: string }
> {
  if (cents <= 0) return { ok: false, error: "Debit amount must be positive" };

  const passengerKey = await resolveRef(db, passengerRef);
  if (!passengerKey) {
    return { ok: false, error: "Wallet not found for this passenger" };
  }

  const walletRef = db.ref(`passengerWallet/${passengerKey}`);
  const entryRef = walletRef.child("entries").push();
  const entryId = entryRef.key!;
  const nowIso = new Date().toISOString();

  const txResult = await walletRef.transaction((current: Record<string, any> | null) => {
    const wallet = current ?? {};
    const bal = walletBalanceCents(wallet);
    if (bal < cents) return;
    const newBalanceCents = bal - cents;
    return {
      ...wallet,
      balanceCents: newBalanceCents,
      balance: +(newBalanceCents / 100).toFixed(2),
      currency: wallet.currency ?? "NZD",
    };
  });

  if (!txResult.committed) {
    return { ok: false, error: "Insufficient wallet balance" };
  }

  const walletAfter = (txResult.snapshot.val() ?? {}) as Record<string, any>;
  const newBalanceCents = walletBalanceCents(walletAfter);

  await walletRef.update({
    balance: +(newBalanceCents / 100).toFixed(2),
    balanceCents: newBalanceCents,
    currency: walletAfter.currency ?? "NZD",
    updatedAt: nowIso,
    [`entries/${entryId}`]: {
      amount: -(cents / 100),
      amountCents: -cents,
      type: "debit",
      reason: meta.reason,
      jobId: meta.jobId,
      companyId: meta.companyId,
      createdAt: nowIso,
    },
  });

  const query: PassengerKeyQuery =
    typeof passengerRef === "string" ? { key: passengerRef } : passengerRef;
  await ensurePassengerIndexForWallet(db, passengerKey, {
    phone: query.phone,
    email: query.email,
  });

  return { ok: true, entryId, newBalanceCents, passengerKey };
}

export async function creditWallet(
  db: FirebaseDatabase,
  passengerRef: WalletPassengerRef,
  cents: number,
  meta: WalletEntryMeta & { note?: string },
): Promise<
  | { ok: true; entryId: string; newBalanceCents: number; passengerKey: string }
  | { ok: false; error: string }
> {
  if (cents <= 0) return { ok: false, error: "Credit amount must be positive" };

  const passengerKey = await resolveRef(db, passengerRef);
  if (!passengerKey) {
    return { ok: false, error: "Wallet not found for this passenger" };
  }

  const walletRef = db.ref(`passengerWallet/${passengerKey}`);
  const entryRef = walletRef.child("entries").push();
  const entryId = entryRef.key!;
  const nowIso = new Date().toISOString();

  const txResult = await walletRef.transaction((current: Record<string, any> | null) => {
    const wallet = current ?? {};
    const bal = walletBalanceCents(wallet);
    const newBalanceCents = bal + cents;
    return {
      ...wallet,
      balanceCents: newBalanceCents,
      balance: +(newBalanceCents / 100).toFixed(2),
      currency: wallet.currency ?? "NZD",
    };
  });

  if (!txResult.committed) {
    return { ok: false, error: "Wallet credit failed" };
  }

  const walletAfter = (txResult.snapshot.val() ?? {}) as Record<string, any>;
  const newBalanceCents = walletBalanceCents(walletAfter);

  await walletRef.update({
    balance: +(newBalanceCents / 100).toFixed(2),
    balanceCents: newBalanceCents,
    currency: walletAfter.currency ?? "NZD",
    updatedAt: nowIso,
    [`entries/${entryId}`]: {
      amount: +(cents / 100).toFixed(2),
      amountCents: cents,
      type: "credit",
      reason: meta.reason,
      jobId: meta.jobId,
      companyId: meta.companyId,
      ...(meta.note ? { note: meta.note } : {}),
      createdAt: nowIso,
    },
  });

  const query: PassengerKeyQuery =
    typeof passengerRef === "string" ? { key: passengerRef } : passengerRef;
  await ensurePassengerIndexForWallet(db, passengerKey, {
    phone: query.phone,
    email: query.email,
  });

  return { ok: true, entryId, newBalanceCents, passengerKey };
}
