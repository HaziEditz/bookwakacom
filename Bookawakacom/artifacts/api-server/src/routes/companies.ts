import { Router } from "express";
import { getDatabase } from "../lib/firebase";

const companiesRouter = Router();

companiesRouter.get("/companies", async (req, res) => {
  try {
    const db = getDatabase();

    // Read company profiles from RTDB — written by the platform admin
    const snap = await db.ref("/companyProfiles").once("value");
    const profiles = snap.val() as Record<string, any> | null;

    if (!profiles) {
      // Fallback: derive companies from which IDs have pendingjobs configured
      const pbSnap = await db.ref("/pendingjobs").once("value");
      const pbVal = pbSnap.val() as Record<string, any> | null;
      const companyIds = pbVal ? Object.keys(pbVal) : [];

      const companies = companyIds.map((id) => ({
        id,
        name: `Company ${id}`,
        services: ["taxi"],
        active: true,
      }));

      res.json({ companies });
      return;
    }

    const companies = Object.entries(profiles)
      .filter(([, v]) => v && v.active !== false)
      .map(([id, v]) => ({
        id,
        name: v.name ?? `Company ${id}`,
        services: v.services ?? ["taxi"],
        active: v.active ?? true,
        description: v.description ?? "",
        city: v.city ?? "",
        country: v.country ?? "New Zealand",
        email: v.email ?? "",
      }));

    res.json({ companies });
  } catch (err: any) {
    console.error("GET /companies error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Public alias — same data, stable path for external integrations
companiesRouter.get("/public/companies", async (req, res) => {
  try {
    const db = getDatabase();
    const snap = await db.ref("/companyProfiles").once("value");
    const profiles = snap.val() as Record<string, any> | null;

    if (!profiles) {
      res.json({ companies: [] });
      return;
    }

    const companies = Object.entries(profiles)
      .filter(([, v]) => v && v.active !== false)
      .map(([id, v]) => ({
        id,
        name: v.name ?? `Company ${id}`,
        services: v.services ?? ["taxi"],
        city: v.city ?? "",
        country: v.country ?? "New Zealand",
      }));

    res.json({ companies });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default companiesRouter;
