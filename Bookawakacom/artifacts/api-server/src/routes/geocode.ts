import { Router } from "express";

const geocodeRouter = Router();

// Proxy Nominatim searches so we can:
//  1. Set a proper User-Agent (required by Nominatim ToS)
//  2. Bias results toward Invercargill / Southland with a viewbox
//  3. Avoid browser CORS/rate-limit issues
geocodeRouter.get("/geocode", async (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q || q.trim().length < 3) {
    res.json([]);
    return;
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q.trim());
    url.searchParams.set("format", "json");
    url.searchParams.set("countrycodes", "nz");
    url.searchParams.set("limit", "6");
    url.searchParams.set("addressdetails", "0");
    // Bias toward Southland / Invercargill — results inside box rank higher,
    // but results outside still appear if nothing local matches (bounded=0)
    url.searchParams.set("viewbox", "167.0,-45.0,171.0,-47.8");
    url.searchParams.set("bounded", "0");

    const nomRes = await fetch(url.toString(), {
      headers: {
        "User-Agent": "BookaWaka/1.0 (info@bookawaka.com)",
        "Accept-Language": "en-NZ,en",
      },
    });

    if (!nomRes.ok) {
      req.log.warn({ status: nomRes.status }, "GET /geocode: Nominatim error");
      res.json([]);
      return;
    }

    const data = await nomRes.json();
    res.json(data);
  } catch (err: any) {
    req.log.warn({ err }, "GET /geocode proxy error");
    res.json([]);
  }
});

export default geocodeRouter;
