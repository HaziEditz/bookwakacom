import { getDatabase } from "./firebase";

/** Read stripeConfig/{companyId}/stripeSecretKey (or legacy aliases), else STRIPE_SECRET_KEY env. */
export async function resolveStripeSecretKey(companyId?: string): Promise<string | null> {
  if (companyId?.trim()) {
    try {
      const db = getDatabase();
      const snap = await db.ref(`stripeConfig/${companyId.trim()}`).once("value");
      const data = snap.val();
      if (data && typeof data === "object") {
        const fromFirebase =
          data.stripeSecretKey ?? data.secretKey ?? data.secret_key ?? "";
        if (typeof fromFirebase === "string" && fromFirebase.trim()) {
          return fromFirebase.trim();
        }
      }
    } catch {
      /* fall through to env */
    }
  }

  const envKey = process.env.STRIPE_SECRET_KEY?.trim();
  return envKey || null;
}
