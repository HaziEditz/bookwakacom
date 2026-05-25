import { Router } from "express";
import { getDatabase } from "../lib/firebase";

const tariffsRouter = Router();

tariffsRouter.get("/tariffs", async (req, res) => {
  const { cid } = req.query as { cid?: string };

  if (!cid) {
    res.status(400).json({ error: "cid is required" });
    return;
  }

  try {
    const db = getDatabase();
    const snap = await db.ref(`tariffs/${cid}`).once("value");
    const raw = snap.val() as Record<string, any> | null;

    if (!raw) {
      res.json({ tariffs: [] });
      return;
    }

    // Exclude isTM: true tariffs — those are time-metered and not relevant to
    // web passengers estimating a fare before booking
    const tariffs = Object.entries(raw)
      .filter(([, v]) => v && v.isTM !== true)
      .map(([id, v]) => ({
        id,
        name: v.TariffName ?? v.name ?? id,
        flagFall: v.FlagFall ?? v.baseFare ?? v.StartFare ?? null,
        ratePerKm: v.RatePerKm ?? v.pricePerKm ?? v.PerKm ?? null,
        minFare: v.MinFare ?? v.minFare ?? null,
        currency: v.Currency ?? "NZD",
      }));

    req.log.info({ cid, count: tariffs.length }, "GET /tariffs");
    res.json({ tariffs });
  } catch (err: any) {
    req.log.error({ err }, "GET /tariffs error");
    res.status(500).json({ error: err.message });
  }
});

export default tariffsRouter;
