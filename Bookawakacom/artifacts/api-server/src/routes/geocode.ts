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

  const parsedLimit = limit ? parseInt(limit, 10) : 8;
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.min(10, Math.max(1, parsedLimit))
    : 8;

  try {
    const data = await searchNzPlaces(q, {
      countrycodes: countrycodes?.trim() || "nz",
      viewbox: viewbox?.trim() || "167,-47,170,-45",
      bounded: bounded?.trim() || "0",
      limit: safeLimit,
    });
    res.setHeader("Content-Type", "application/json");
    res.json(Array.isArray(data) ? data : []);
  } catch (err: any) {
    req.log.warn({ err }, "GET /geocode proxy error");
    res.json([]);
  }
});

/** Debug: call Nominatim directly with a fixed query to verify upstream connectivity. */
geocodeRouter.get("/geocode-test", async (req, res) => {
  const query = "Dee Street Invercargill";
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("countrycodes", "nz");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");

  try {
    const startedAt = Date.now();
    const upstream = await fetch(url.toString(), {
      headers: {
        "User-Agent": "BookaWaka/1.0 (info@bookawaka.com)",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(10000),
    });
    const rawText = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }

    res.json({
      ok: upstream.ok,
      query,
      url: url.toString(),
      status: upstream.status,
      statusText: upstream.statusText,
      elapsedMs: Date.now() - startedAt,
      data,
    });
  } catch (err: any) {
    req.log.error({ err }, "GET /geocode-test error");
    res.status(502).json({
      ok: false,
      query,
      url: url.toString(),
      error: err.message ?? String(err),
    });
  }
});

export default geocodeRouter;
