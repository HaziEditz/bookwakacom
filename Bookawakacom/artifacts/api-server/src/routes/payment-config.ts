import { Router } from "express";
import { getDatabase } from "../lib/firebase";

const paymentConfigRouter = Router();

paymentConfigRouter.get("/payment-config", async (req, res) => {
  const { cid } = req.query as { cid?: string };

  if (!cid) {
    res.status(400).json({ error: "cid is required" });
    return;
  }

  try {
    const db = getDatabase();
    const [platformCashSnap, companyCashSnap, platformCardSnap, companyCardSnap] = await Promise.all([
      db.ref("bwConfig/paymentMethods/cashEnabled").once("value"),
      db.ref(`companySettings/${cid}/paymentMethods/cashEnabled`).once("value"),
      db.ref("bwConfig/paymentMethods/cardEnabled").once("value"),
      db.ref(`companySettings/${cid}/paymentMethods/cardEnabled`).once("value"),
    ]);

    // Default to true if node absent — safe open default
    const cashEnabled: boolean = platformCashSnap.val() !== false;
    const companyCashEnabled: boolean = companyCashSnap.val() !== false;
    const effectiveCash: boolean = cashEnabled && companyCashEnabled;

    // Card defaults to true at platform level, company can override to false
    const platformCardEnabled: boolean = platformCardSnap.val() !== false;
    const companyCardEnabled: boolean = companyCardSnap.val() !== false;
    const cardEnabled: boolean = platformCardEnabled && companyCardEnabled;

    res.json({ cashEnabled, companyCashEnabled, effectiveCash, cardEnabled });
  } catch (err: any) {
    req.log.error({ err }, "GET /payment-config error");
    res.status(500).json({ error: err.message });
  }
});

export default paymentConfigRouter;
