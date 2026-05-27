import { Router } from "express";
import { searchNzPlaces } from "../lib/geocode-search";

const geocodeRouter = Router();

// Proxy Nominatim searches so we can:
//  1. Set a proper User-Agent (required by Nominatim ToS)
//  2. Bias results toward New Zealand with a viewbox
//  3. Boost business/POI name matches with a ", New Zealand" retry
//  4. Avoid browser CORS/rate-limit issues
geocodeRouter.get("/geocode", async (req, res) => {
  const { q, countrycodes, viewbox, bounded, limit } = req.query as {
    q?: string;
    countrycodes?: string;
    viewbox?: string;
    bounded?: string;
    limit?: string;
  };
  if (!q || q.trim().length < 3) {
    res.json([]);
    return;
  }

  try {
    const data = await searchNzPlaces(q, {
      countrycodes: countrycodes?.trim() || "nz",
      viewbox: viewbox?.trim() || "167,-47,170,-45",
      bounded: bounded?.trim() || "0",
      limit: limit ? parseInt(limit, 10) || 8 : 8,
    });
    res.json(data);
  } catch (err: any) {
    req.log.warn({ err }, "GET /geocode proxy error");
    res.json([]);
  }
});

export default geocodeRouter;
