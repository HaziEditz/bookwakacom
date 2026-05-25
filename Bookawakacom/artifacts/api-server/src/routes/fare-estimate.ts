import { Router } from "express";
import { getDatabase } from "../lib/firebase";

const fareEstimateRouter = Router();

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

fareEstimateRouter.get("/fare-estimate", async (req, res) => {
  const { cid, fromLat, fromLng, toLat, toLng } = req.query as Record<string, string | undefined>;

  if (!cid || !fromLat || !fromLng || !toLat || !toLng) {
    res.status(400).json({ error: "cid, fromLat, fromLng, toLat, toLng are required" });
    return;
  }

  const lat1 = parseFloat(fromLat);
  const lon1 = parseFloat(fromLng);
  const lat2 = parseFloat(toLat);
  const lon2 = parseFloat(toLng);

  if ([lat1, lon1, lat2, lon2].some(isNaN)) {
    res.status(400).json({ error: "Coordinates must be valid numbers" });
    return;
  }

  try {
    const db = getDatabase();
    const snap = await db.ref(`tariffs/${cid}`).once("value");
    const raw = snap.val() as Record<string, any> | null;

    if (!raw) {
      res.status(404).json({ error: "No tariffs found for this company" });
      return;
    }

    // Pick the first non-isTM tariff — same as the public fare guide
    const applicable = Object.entries(raw)
      .filter(([, v]) => v && v.isTM !== true)
      .map(([id, v]) => ({
        id,
        name: v.TariffName ?? v.name ?? id,
        flagFall: parseFloat(v.FlagFall ?? v.baseFare ?? v.StartFare ?? "0") || 0,
        ratePerKm: parseFloat(v.RatePerKm ?? v.pricePerKm ?? v.PerKm ?? "0") || 0,
        minFare: parseFloat(v.MinFare ?? v.minFare ?? "0") || 0,
      }));

    if (applicable.length === 0) {
      res.status(404).json({ error: "No applicable tariffs found" });
      return;
    }

    const tariff = applicable[0];
    const distanceKm = haversineKm(lat1, lon1, lat2, lon2);
    const raw_estimate = tariff.flagFall + distanceKm * tariff.ratePerKm;
    const estimatedFare = Math.max(raw_estimate, tariff.minFare);

    req.log.info({ cid, distanceKm: distanceKm.toFixed(2), estimatedFare }, "GET /fare-estimate");

    res.json({
      estimatedFare: Math.round(estimatedFare * 100) / 100,
      tariffName: tariff.name,
      distanceKm: Math.round(distanceKm * 10) / 10,
      currency: "NZD",
    });
  } catch (err: any) {
    req.log.error({ err }, "GET /fare-estimate error");
    res.status(500).json({ error: err.message });
  }
});

export default fareEstimateRouter;
