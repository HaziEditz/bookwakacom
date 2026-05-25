import { getDatabase } from "./firebase";

type FirebaseDatabase = ReturnType<typeof getDatabase>;

export function walletBalanceCents(data: Record<string, any> | null | undefined): number {
  if (!data) return 0;
  if (typeof data.balanceCents === "number") return Math.max(0, data.balanceCents);
  if (typeof data.balance === "number") return Math.max(0, Math.round(data.balance * 100));
  return 0;
}

export async function readWalletBalanceCents(
  db: FirebaseDatabase,
  passengerKey: string
): Promise<number> {
  const snap = await db.ref(`passengerWallet/${passengerKey}`).once("value");
  return walletBalanceCents(snap.val());
}

export type WalletEntryMeta = {
  reason: string;
  jobId: string;
  companyId: string;
};

export async function debitWallet(
  db: FirebaseDatabase,
  passengerKey: string,
  cents: number,
  meta: WalletEntryMeta
): Promise<
  | { ok: true; entryId: string; newBalanceCents: number }
  | { ok: false; error: string }
> {
  if (cents <= 0) return { ok: false, error: "Debit amount must be positive" };

  const walletRef = db.ref(`passengerWallet/${passengerKey}`);
  const entryRef = walletRef.child("entries").push();
  const entryId = entryRef.key!;
  const nowIso = new Date().toISOString();

  const txResult = await walletRef.child("balanceCents").transaction((current: number | null) => {
    const bal = typeof current === "number" ? current : 0;
    if (bal < cents) return;
    return bal - cents;
  });

  if (!txResult.committed) {
    return { ok: false, error: "Insufficient wallet balance" };
  }

  const newBalanceCents = txResult.snapshot.val() as number;
  await walletRef.update({
    balance: +(newBalanceCents / 100).toFixed(2),
    currency: "NZD",
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

  return { ok: true, entryId, newBalanceCents };
}

export async function creditWallet(
  db: FirebaseDatabase,
  passengerKey: string,
  cents: number,
  meta: WalletEntryMeta & { note?: string }
): Promise<
  | { ok: true; entryId: string; newBalanceCents: number }
  | { ok: false; error: string }
> {
  if (cents <= 0) return { ok: false, error: "Credit amount must be positive" };

  const walletRef = db.ref(`passengerWallet/${passengerKey}`);
  const entryRef = walletRef.child("entries").push();
  const entryId = entryRef.key!;
  const nowIso = new Date().toISOString();

  const txResult = await walletRef.child("balanceCents").transaction((current: number | null) => {
    const bal = typeof current === "number" ? current : 0;
    return bal + cents;
  });

  if (!txResult.committed) {
    return { ok: false, error: "Wallet credit failed" };
  }

  const newBalanceCents = txResult.snapshot.val() as number;
  await walletRef.update({
    balance: +(newBalanceCents / 100).toFixed(2),
    currency: "NZD",
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

  return { ok: true, entryId, newBalanceCents };
}
