import { getDatabase } from "./firebase";

type StripeConfigRow = Record<string, unknown>;

async function readStripeConfig(companyId: string): Promise<StripeConfigRow | null> {
  if (!companyId?.trim()) return null;
  try {
    const db = getDatabase();
    const snap = await db.ref(`stripeConfig/${companyId.trim()}`).once("value");
    const data = snap.val();
    return data && typeof data === "object" ? (data as StripeConfigRow) : null;
  } catch {
    return null;
  }
}

function isConnectComplete(data: StripeConfigRow | null): boolean {
  if (!data) return false;
  if (data.connectStatus === "complete" || data.connectOnboardingComplete === true) return true;
  const accountId = data.stripeAccountId ?? data.stripeConnectId;
  return (
    typeof accountId === "string" &&
    accountId.startsWith("acct_") &&
    data.connectChargesEnabled === true
  );
}

/** Platform Stripe secret (BookaWaka Connect platform account). */
export function resolvePlatformStripeSecretKey(): string | null {
  const envKey = process.env.STRIPE_SECRET_KEY?.trim();
  return envKey || null;
}

/** Connected Express account ID when onboarding is complete. */
export async function resolveStripeConnectAccountId(companyId?: string): Promise<string | null> {
  const data = companyId ? await readStripeConfig(companyId) : null;
  if (!data || !isConnectComplete(data)) return null;
  const accountId = data.stripeAccountId ?? data.stripeConnectId;
  return typeof accountId === "string" && accountId.startsWith("acct_") ? accountId : null;
}

export type StripePaymentContext = {
  secretKey: string | null;
  connectAccountId: string | null;
  mode: "connect" | "direct" | null;
};

/** Prefer Connect (platform key + destination) when complete; else per-company direct keys. */
export async function resolveStripePaymentContext(companyId?: string): Promise<StripePaymentContext> {
  if (companyId?.trim()) {
    const data = await readStripeConfig(companyId);
    const connectAccountId = await resolveStripeConnectAccountId(companyId);
    const platformKey = resolvePlatformStripeSecretKey();
    if (connectAccountId && platformKey) {
      return { secretKey: platformKey, connectAccountId, mode: "connect" };
    }

    if (data && typeof data === "object") {
      const fromFirebase =
        data.stripeSecretKey ?? data.secretKey ?? data.secret_key ?? "";
      if (typeof fromFirebase === "string" && fromFirebase.trim()) {
        return { secretKey: fromFirebase.trim(), connectAccountId: null, mode: "direct" };
      }
    }
  }

  const envKey = resolvePlatformStripeSecretKey();
  return envKey
    ? { secretKey: envKey, connectAccountId: null, mode: "direct" }
    : { secretKey: null, connectAccountId: null, mode: null };
}

/** Read stripeConfig/{companyId}/stripeSecretKey (or legacy aliases), else STRIPE_SECRET_KEY env. */
export async function resolveStripeSecretKey(companyId?: string): Promise<string | null> {
  const ctx = await resolveStripePaymentContext(companyId);
  return ctx.secretKey;
}
