import { Router } from "express";
import { getDatabase } from "../lib/firebase";

const appSettingsRouter = Router();

appSettingsRouter.get("/app-settings", async (req, res) => {
  try {
    const db = getDatabase();
    const snap = await db.ref("/bwConfig/appSettings").once("value");
    const settings = snap.val() as Record<string, any> | null;

    if (!settings) {
      res.json({ driverAppMinVersion: null, passengerAppMinVersion: null });
      return;
    }

    res.json({
      driverAppMinVersion: settings.driverAppMinVersion ?? null,
      passengerAppMinVersion: settings.passengerAppMinVersion ?? null,
    });
  } catch (err: any) {
    req.log.error({ err }, "GET /app-settings error");
    res.status(500).json({ error: err.message });
  }
});

export default appSettingsRouter;
