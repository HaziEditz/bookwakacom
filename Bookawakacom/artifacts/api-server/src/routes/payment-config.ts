import { Router } from "express";
import { getDatabase } from "../lib/firebase";

const paymentConfigRouter = Router();

function hasStripeKeysConfigured(stripe: Record<string, unknown> | null): boolean {
  if (!stripe || typeof stripe !== "object") return false;
  const secret =
    stripe.stripeSecretKey ?? stripe.secretKey ?? stripe.secret_key ?? "";
  const publishable =
    stripe.stripePublishableKey ?? stripe.publishableKey ?? stripe.publishable_key ?? "";
  return (
    typeof secret === "string" &&
    secret.trim().length > 0 &&
    typeof publishable === "string" &&
    publishable.trim().length > 0
  );
}

paymentConfigRouter.get("/payment-config", async (req, res) => {
  const { cid } = req.query as { cid?: string };

  if (!cid) {
    res.status(400).json({ error: "cid is required" });
    return;
  }

  try {
    const db = getDatabase();
    const [platformCashSnap, companyCashSnap, platformCardSnap, companyCardSnap, stripeSnap] =
      await Promise.all([
        db.ref("bwConfig/paymentMethods/cashEnabled").once("value"),
        db.ref(`companySettings/${cid}/paymentMethods/cashEnabled`).once("value"),
        db.ref("bwConfig/paymentMethods/cardEnabled").once("value"),
        db.ref(`companySettings/${cid}/paymentMethods/cardEnabled`).once("value"),
        db.ref(`stripeConfig/${cid}`).once("value"),
      ]);

    const cashEnabled: boolean = platformCashSnap.val() !== false;
    const companyCashEnabled: boolean = companyCashSnap.val() !== false;
    const effectiveCash: boolean = cashEnabled && companyCashEnabled;

    const platformCardEnabled: boolean = platformCardSnap.val() !== false;
    const companyCardEnabled: boolean = companyCardSnap.val() !== false;
    const stripeConfigured = hasStripeKeysConfigured(stripeSnap.val());

    // Card is enabled when Stripe keys are saved for this company, unless explicitly disabled.
    const cardEnabled: boolean =
      stripeConfigured || (platformCardEnabled && companyCardEnabled);

    const stripe = stripeSnap.val() ?? {};
    const stripePublishableKey =
      stripe.stripePublishableKey ?? stripe.publishableKey ?? stripe.publishable_key ?? "";

    res.json({
      cashEnabled,
      companyCashEnabled,
      effectiveCash,
      cardEnabled,
      stripeConfigured,
      stripePublishableKey: typeof stripePublishableKey === "string" ? stripePublishableKey : "",
    });
  } catch (err: any) {
    req.log.error({ err }, "GET /payment-config error");
    res.status(500).json({ error: err.message });
  }
});

export default paymentConfigRouter;
