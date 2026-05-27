import { getDatabase } from "./firebase";

const DEFAULT_TAXI_COMMISSION_PCT = 15;

export type ConnectPaymentSplit = {
  commissionPct: number;
  grossCents: number;
  applicationFeeCents: number;
  companyNetCents: number;
};

/** Platform commission % for taxi card bookings (superClients/{cid}.commissionPct, default 15%). */
export async function resolveTaxiCommissionPct(
  db: ReturnType<typeof getDatabase>,
  companyId: string
): Promise<number> {
  try {
    const snap = await db.ref(`superClients/${companyId.trim()}`).once("value");
    const sc = snap.val();
    if (sc?.commissionPct != null && sc.commissionPct !== "") {
      const pct = parseFloat(String(sc.commissionPct));
      if (Number.isFinite(pct)) return clampPct(pct);
    }
  } catch {
    /* use default */
  }
  return DEFAULT_TAXI_COMMISSION_PCT;
}

function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}

/** Customer pays gross → BookaWaka keeps application fee → company receives net via Connect transfer. */
export function calcConnectPaymentSplit(
  grossCents: number,
  commissionPct: number
): ConnectPaymentSplit {
  const pct = clampPct(commissionPct);
  const applicationFeeCents = Math.min(
    Math.max(0, grossCents),
    Math.max(0, Math.round(grossCents * pct / 100))
  );
  return {
    commissionPct: pct,
    grossCents,
    applicationFeeCents,
    companyNetCents: Math.max(0, grossCents - applicationFeeCents),
  };
}

export function commissionFieldsFromMetadata(meta: Record<string, string | undefined>): Record<string, unknown> {
  const commissionPct = meta.commissionPct != null ? parseFloat(meta.commissionPct) : NaN;
  const applicationFeeCents = meta.applicationFeeCents != null ? parseInt(meta.applicationFeeCents, 10) : NaN;
  const companyNetCents = meta.companyNetCents != null ? parseInt(meta.companyNetCents, 10) : NaN;
  if (!Number.isFinite(commissionPct) || !Number.isFinite(applicationFeeCents)) return {};
  return {
    platformCommissionPct: commissionPct,
    platformCommission: applicationFeeCents / 100,
    companyNetPayout: Number.isFinite(companyNetCents) ? companyNetCents / 100 : undefined,
    stripeConnectMode: meta.stripeMode === "connect",
  };
}
