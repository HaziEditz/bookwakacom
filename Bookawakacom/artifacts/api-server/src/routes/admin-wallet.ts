import { Router } from "express";
import { getDatabase } from "../lib/firebase";
import { requireAdminKey } from "../middlewares/admin-key";

/**
 * SA Portal admin wallet API — read-only views + manual adjustment.
 *
 * Storage layout (SA dev Option 1, confirmed):
 *   - Balance + ledger live at `passengerWallet/{passengerKey}/...` (unchanged from Slice 1)
 *   - Bidirectional resolver:
 *       passengerIndex/uid/{uid}  → { key, createdAt, ... }
 *       passengerIndex/key/{key}  → { uid?, createdAt, ... }
 *   - Any admin endpoint accepts uid | key | email | phone and resolves to the
 *     canonical passengerKey internally.
 *
 * Every write (currently only /adjust) also appends an immutable audit row to
 * `walletAdminAudit/{txId}` so SA Portal can render the audit trail.
 *
 * All routes here are protected by requireAdminKey (X-Admin-Key header).
 */

const adminWalletRouter = Router();

// All /admin/* paths require the shared admin key
adminWalletRouter.use("/admin", requireAdminKey);

// --- Helpers --------------------------------------------------------------

type IdentifierType = "uid" | "key" | "email" | "phone";

function normalizeEmailKey(email: string): string {
  return email.toLowerCase().replace(/\./g, ",").replace(/@/g, "__at__");
}

function normalizePhoneKey(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

/**
 * Resolve any identifier (uid/key/email/phone) to the canonical passengerKey.
 * Returns null if no wallet/passenger record exists.
 */
async function resolveToKey(
  db: ReturnType<typeof getDatabase>,
  identifier: string,
  type: IdentifierType,
): Promise<string | null> {
  if (type === "key") {
    // Existence check: a passenger key is only "real" if either the new
    // bidirectional index has a row for it OR an existing wallet record
    // exists (Slice 1 passengers predate passengerIndex/key/*). Without this
    // check, typo'd keys would silently return zeroed balances or — worse —
    // /adjust would create a wallet for a non-existent passenger.
    const [idxSnap, walletSnap] = await Promise.all([
      db.ref(`passengerIndex/key/${identifier}`).once("value"),
      db.ref(`passengerWallet/${identifier}`).once("value"),
    ]);
    return idxSnap.exists() || walletSnap.exists() ? identifier : null;
  }

  if (type === "uid") {
    const snap = await db
      .ref(`passengerIndex/uid/${identifier}`)
      .once("value");
    return snap.val()?.key ?? null;
  }

  if (type === "email") {
    const emailKey = normalizeEmailKey(identifier);
    const snap = await db
      .ref(`passengerIndex/email/${emailKey}`)
      .once("value");
    return snap.val()?.key ?? null;
  }

  if (type === "phone") {
    const phoneKey = normalizePhoneKey(identifier);
    const snap = await db
      .ref(`passengerIndex/phone/${phoneKey}`)
      .once("value");
    return snap.val()?.key ?? null;
  }

  return null;
}

/**
 * Look up the UID (if any) for a given passengerKey. UID is empty/missing for
 * web-only passengers who have never signed in to the mobile app.
 */
async function uidForKey(
  db: ReturnType<typeof getDatabase>,
  key: string,
): Promise<string | null> {
  const snap = await db.ref(`passengerIndex/key/${key}`).once("value");
  return snap.val()?.uid ?? null;
}

function parseIdentifierType(raw: unknown): IdentifierType | null {
  if (raw === "uid" || raw === "key" || raw === "email" || raw === "phone") {
    return raw;
  }
  return null;
}

// Controlled list of adjustment reasons, mirroring the cancel-reason pattern.
const ADJUST_REASONS = new Set([
  "refund_correction",
  "goodwill_credit",
  "dispute_resolution",
  "fraud_clawback",
  "other",
]);

// --- GET /admin/wallet/lookup --------------------------------------------
// ?uid=... | ?key=... | ?email=... | ?phone=...
// Returns { uid?, key, balance, currency } or 404.
adminWalletRouter.get("/admin/wallet/lookup", async (req, res) => {
  try {
    const { uid, key, email, phone } = req.query as Record<string, string | undefined>;
    let identifier: string | undefined;
    let type: IdentifierType | undefined;
    if (uid) { identifier = uid; type = "uid"; }
    else if (key) { identifier = key; type = "key"; }
    else if (email) { identifier = email; type = "email"; }
    else if (phone) { identifier = phone; type = "phone"; }

    if (!identifier || !type) {
      res.status(400).json({ error: "Provide one of: uid, key, email, phone" });
      return;
    }

    const db = getDatabase();
    const resolvedKey = await resolveToKey(db, identifier, type);
    if (!resolvedKey) {
      res.status(404).json({ error: "Passenger not found" });
      return;
    }

    const [walletSnap, resolvedUid] = await Promise.all([
      db.ref(`passengerWallet/${resolvedKey}`).once("value"),
      uidForKey(db, resolvedKey),
    ]);
    const data = walletSnap.val() ?? {};
    res.json({
      uid: resolvedUid,
      key: resolvedKey,
      balance: typeof data.balance === "number" ? data.balance : 0,
      balanceCents: typeof data.balanceCents === "number" ? data.balanceCents : 0,
      currency: data.currency ?? "NZD",
      updatedAt: data.updatedAt ?? null,
    });
  } catch (err: any) {
    req.log.error({ err }, "GET /admin/wallet/lookup failed");
    res.status(500).json({ error: err.message });
  }
});

// --- GET /admin/wallet/balance/:identifier -------------------------------
// ?type=uid|key|email|phone (default: uid). Returns balance only.
adminWalletRouter.get("/admin/wallet/balance/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const type = parseIdentifierType(req.query["type"]) ?? "uid";

    const db = getDatabase();
    const resolvedKey = await resolveToKey(db, identifier, type);
    if (!resolvedKey) {
      res.status(404).json({ error: "Passenger not found" });
      return;
    }

    const snap = await db
      .ref(`passengerWallet/${resolvedKey}`)
      .once("value");
    const data = snap.val() ?? {};
    res.json({
      key: resolvedKey,
      balance: typeof data.balance === "number" ? data.balance : 0,
      balanceCents: typeof data.balanceCents === "number" ? data.balanceCents : 0,
      currency: data.currency ?? "NZD",
      updatedAt: data.updatedAt ?? null,
    });
  } catch (err: any) {
    req.log.error({ err }, "GET /admin/wallet/balance failed");
    res.status(500).json({ error: err.message });
  }
});

// --- GET /admin/wallet/ledger/:identifier --------------------------------
// ?type=uid|key|email|phone (default: uid). ?from=ISO&to=ISO optional.
// Returns oldest-first ledger entries with id + createdAt.
adminWalletRouter.get("/admin/wallet/ledger/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const type = parseIdentifierType(req.query["type"]) ?? "uid";
    const { from, to } = req.query as Record<string, string | undefined>;

    const db = getDatabase();
    const resolvedKey = await resolveToKey(db, identifier, type);
    if (!resolvedKey) {
      res.status(404).json({ error: "Passenger not found" });
      return;
    }

    const snap = await db
      .ref(`passengerWallet/${resolvedKey}/entries`)
      .once("value");
    const entriesObj: Record<string, any> = snap.val() ?? {};
    const fromMs = from ? Date.parse(from) : -Infinity;
    const toMs = to ? Date.parse(to) : Infinity;

    const entries = Object.entries(entriesObj)
      .map(([id, e]: [string, any]) => ({ id, ...e }))
      .filter((e) => {
        const t = Date.parse(e.createdAt ?? "");
        return Number.isFinite(t) ? t >= fromMs && t <= toMs : true;
      })
      .sort(
        (a, b) =>
          Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? ""),
      );

    res.json({ key: resolvedKey, entries });
  } catch (err: any) {
    req.log.error({ err }, "GET /admin/wallet/ledger failed");
    res.status(500).json({ error: err.message });
  }
});

// --- GET /admin/wallet/reconciliation ------------------------------------
// ?from=ISO&to=ISO. Walks every passengerWallet/* and sums credits/debits.
// Returns { from, to, totalCredits, totalDebits, byReason, passengerCount, totalBalanceCents }.
// NOTE: O(N) across all wallets — fine while N is small; revisit when we have
// thousands of passengers.
adminWalletRouter.get("/admin/wallet/reconciliation", async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string | undefined>;
    const fromMs = from ? Date.parse(from) : -Infinity;
    const toMs = to ? Date.parse(to) : Infinity;

    const db = getDatabase();
    const snap = await db.ref("passengerWallet").once("value");
    const wallets: Record<string, any> = snap.val() ?? {};

    // Conventions:
    //   - amountCents is SIGNED in admin_adjustment entries (positive = credit,
    //     negative = debit). In Slice 1 cancellation-credit entries it is
    //     positive and type === "credit". Reading the sign of amountCents lets
    //     us classify reliably without trusting the `type` field.
    //   - totalCreditsCents / totalDebitsCents are POSITIVE magnitudes (debits
    //     are reported as |amount| so the SA UI can render them as plain
    //     positive numbers).
    //   - byReason[*].totalCents is the SIGNED net per reason
    //     (credits − debits) — convenient for "what did this reason cost us"
    //     style summaries.
    //   - openingBalanceCents = sum of all entries dated STRICTLY BEFORE `from`
    //     (i.e. balance carried into the window). If `from` is omitted, opening
    //     is 0.
    //   - closingBalanceCents = sum of all entries dated AT OR BEFORE `to`
    //     (i.e. balance leaving the window). If `to` is omitted, closing
    //     equals the current snapshot balance.
    //   - Identity that should always hold (for the same date window):
    //       closingBalanceCents − openingBalanceCents
    //         === totalCreditsCents − totalDebitsCents

    let totalCreditsCents = 0;
    let totalDebitsCents = 0;
    let snapshotBalanceCents = 0; // current sum of balanceCents fields (sanity)
    let openingBalanceCents = 0;
    let closingBalanceCents = 0;
    const byReason: Record<
      string,
      { count: number; creditsCents: number; debitsCents: number; totalCents: number }
    > = {};
    let passengerCount = 0;

    for (const wallet of Object.values(wallets)) {
      passengerCount += 1;
      if (typeof wallet.balanceCents === "number") {
        snapshotBalanceCents += wallet.balanceCents;
      }
      const entries: Record<string, any> = wallet.entries ?? {};
      for (const e of Object.values(entries)) {
        const t = Date.parse(e.createdAt ?? "");
        const hasTime = Number.isFinite(t);
        const rawCents: number =
          typeof e.amountCents === "number"
            ? e.amountCents
            : Math.round((Number(e.amount) || 0) * 100);
        // Robust credit/debit classification — prefer sign, fall back to `type`.
        const isCredit =
          rawCents > 0 || (rawCents === 0 && e.type === "credit");
        const absCents = Math.abs(rawCents);

        // Opening balance: entries strictly before `from`
        if (hasTime && t < fromMs) {
          openingBalanceCents += rawCents;
        }
        // Closing balance: entries at or before `to`
        if (hasTime && t <= toMs) {
          closingBalanceCents += rawCents;
        }
        // In-window totals
        if (hasTime && t >= fromMs && t <= toMs) {
          const reason: string = e.reason ?? "unknown";
          const slot =
            byReason[reason] ?? {
              count: 0,
              creditsCents: 0,
              debitsCents: 0,
              totalCents: 0,
            };
          slot.count += 1;
          if (isCredit) {
            totalCreditsCents += absCents;
            slot.creditsCents += absCents;
            slot.totalCents += absCents;
          } else {
            totalDebitsCents += absCents;
            slot.debitsCents += absCents;
            slot.totalCents -= absCents;
          }
          byReason[reason] = slot;
        }
      }
    }

    res.json({
      from: from ?? null,
      to: to ?? null,
      currency: "NZD",
      passengerCount,
      // Date-range bounded balances (preferred for SA-Wallet.aspx)
      openingBalanceCents,
      openingBalance: +(openingBalanceCents / 100).toFixed(2),
      closingBalanceCents,
      closingBalance: +(closingBalanceCents / 100).toFixed(2),
      // Positive magnitudes
      totalCreditsCents,
      totalCredits: +(totalCreditsCents / 100).toFixed(2),
      totalDebitsCents,
      totalDebits: +(totalDebitsCents / 100).toFixed(2),
      // Per-reason aggregation
      byReason,
      // Sanity field: live snapshot total of balanceCents across all wallets.
      // Should equal closingBalanceCents when `to` is in the future / omitted.
      snapshotBalanceCents,
      snapshotBalance: +(snapshotBalanceCents / 100).toFixed(2),
    });
  } catch (err: any) {
    req.log.error({ err }, "GET /admin/wallet/reconciliation failed");
    res.status(500).json({ error: err.message });
  }
});

// --- POST /admin/wallet/adjust -------------------------------------------
// Body: { identifier, identifierType, amount, reason, adjustedBy, note? }
// - amount in NZD dollars (can be negative for clawback)
// - reason must be in ADJUST_REASONS
// - adjustedBy is the SA admin's logged-in name (audit trail)
//
// Atomically updates balanceCents, appends a ledger entry of type
// 'admin_adjustment', and writes walletAdminAudit/{txId} with before/after.
adminWalletRouter.post("/admin/wallet/adjust", async (req, res) => {
  try {
    const { identifier, identifierType, amount, reason, adjustedBy, note } = req.body as {
      identifier?: string;
      identifierType?: string;
      amount?: number;
      reason?: string;
      adjustedBy?: string;
      note?: string;
    };

    if (!identifier || !identifierType) {
      res.status(400).json({ error: "identifier and identifierType are required" });
      return;
    }
    const type = parseIdentifierType(identifierType);
    if (!type) {
      res.status(400).json({ error: "identifierType must be uid|key|email|phone" });
      return;
    }
    const amountNum = typeof amount === "number" ? amount : NaN;
    if (!Number.isFinite(amountNum) || amountNum === 0) {
      res.status(400).json({ error: "amount must be a non-zero number" });
      return;
    }
    if (!reason || !ADJUST_REASONS.has(reason)) {
      res.status(400).json({
        error: `reason must be one of: ${Array.from(ADJUST_REASONS).join(", ")}`,
      });
      return;
    }
    if (!adjustedBy || typeof adjustedBy !== "string" || adjustedBy.trim() === "") {
      res.status(400).json({ error: "adjustedBy is required (SA admin display name)" });
      return;
    }

    const db = getDatabase();
    const resolvedKey = await resolveToKey(db, identifier, type);
    if (!resolvedKey) {
      res.status(404).json({ error: "Passenger not found" });
      return;
    }

    const cents = Math.round(amountNum * 100);
    const walletRef = db.ref(`passengerWallet/${resolvedKey}`);
    const entryRef = walletRef.child("entries").push();
    const entryId = entryRef.key!;
    // Pre-generate the audit txId so it can be embedded in the ledger entry —
    // gives us cross-reference even if the separate audit write later fails.
    const auditRef = db.ref("walletAdminAudit").push();
    const txId = auditRef.key!;
    const nowIso = new Date().toISOString();

    // Atomic read-modify-write on the ENTIRE wallet node. This bundles the
    // balance change + ledger entry + metadata into a single Firebase
    // transaction — Firebase guarantees no other writer interleaves between
    // the read and the commit. The updater may run multiple times under
    // contention; we capture beforeBalanceCents from the LAST invocation
    // (i.e. the snapshot that actually committed).
    let observedBeforeCents = 0;
    const txResult = await walletRef.transaction((current: any) => {
      const wallet = current ?? {};
      const baseCents = typeof wallet.balanceCents === "number" ? wallet.balanceCents : 0;
      observedBeforeCents = baseCents;
      const newCents = baseCents + cents;
      const entries = wallet.entries ?? {};
      return {
        ...wallet,
        balanceCents: newCents,
        balance: +(newCents / 100).toFixed(2),
        currency: "NZD",
        updatedAt: nowIso,
        entries: {
          ...entries,
          [entryId]: {
            amount: +(cents / 100).toFixed(2),
            amountCents: cents,
            type: cents >= 0 ? "credit" : "debit",
            reason: "admin_adjustment",
            adjustReason: reason,
            adjustedBy,
            note: note ?? null,
            auditTxId: txId,
            createdAt: nowIso,
          },
        },
      };
    });

    if (!txResult.committed) {
      req.log.error({ resolvedKey, cents }, "Wallet adjust transaction did not commit");
      res.status(500).json({ error: "Wallet transaction failed" });
      return;
    }

    const committed = txResult.snapshot.val() as any;
    const afterBalanceCents: number = committed?.balanceCents ?? 0;
    const beforeBalanceCents = observedBeforeCents;

    // Audit log — separate path, write after the wallet is consistent so a
    // failure here can't leave the wallet in a bad state. If this write
    // fails we still have full recovery info: the ledger entry itself
    // carries adjustedBy, adjustReason, note and auditTxId.
    try {
      await auditRef.set({
        txId,
        passengerKey: resolvedKey,
        identifier,
        identifierType: type,
        amountCents: cents,
        amount: +(cents / 100).toFixed(2),
        reason,
        adjustedBy,
        note: note ?? null,
        beforeBalanceCents,
        afterBalanceCents,
        entryId,
        createdAt: nowIso,
      });
    } catch (auditErr: any) {
      // Wallet state is already correct. Log loudly so it can be repaired
      // from the ledger entry (which carries auditTxId).
      req.log.error(
        { err: auditErr, txId, resolvedKey, entryId, beforeBalanceCents, afterBalanceCents },
        "CRITICAL: wallet adjusted but audit row write failed — recover from ledger entry.auditTxId",
      );
    }

    req.log.info(
      { txId, resolvedKey, adjustedBy, cents, reason, beforeBalanceCents, afterBalanceCents },
      "Wallet admin adjustment applied",
    );

    res.json({
      ok: true,
      txId,
      passengerKey: resolvedKey,
      entryId,
      beforeBalance: +(beforeBalanceCents / 100).toFixed(2),
      afterBalance: +(afterBalanceCents / 100).toFixed(2),
      currency: "NZD",
    });
  } catch (err: any) {
    req.log.error({ err }, "POST /admin/wallet/adjust failed");
    res.status(500).json({ error: err.message });
  }
});

export default adminWalletRouter;
