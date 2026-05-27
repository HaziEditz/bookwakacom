const NOMINATIM_HEADERS = {
  "User-Agent": "BookaWaka/1.0 (info@bookawaka.com)",
  "Accept-Language": "en",
};

const NOMINATIM_TIMEOUT_MS = 5000;
const DEFAULT_VIEWBOX = "167,-47,170,-45"; // Invercargill area bias

export interface NominatimHit {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
  class?: string;
}

function mergeHits(primary: NominatimHit[], secondary: NominatimHit[], max: number): NominatimHit[] {
  const seen = new Set<number>();
  const merged: NominatimHit[] = [];
  for (const hit of [...primary, ...secondary]) {
    if (seen.has(hit.place_id)) continue;
    seen.add(hit.place_id);
    merged.push(hit);
    if (merged.length >= max) break;
  }
  return merged;
}

async function nominatimSearch(
  q: string,
  opts: {
    countrycodes?: string;
    viewbox?: string;
    bounded?: string;
    limit?: number;
  }
): Promise<NominatimHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("countrycodes", opts.countrycodes ?? "nz");
  url.searchParams.set("limit", String(opts.limit ?? 8));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set("viewbox", opts.viewbox ?? DEFAULT_VIEWBOX);
  url.searchParams.set("bounded", opts.bounded ?? "0");

  const res = await fetch(url.toString(), {
    headers: NOMINATIM_HEADERS,
    signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimHit[];
  return Array.isArray(data) ? data : [];
}

/** Free-text search biased to NZ; retries with ", New Zealand" for business/POI names. */
export async function searchNzPlaces(
  query: string,
  opts?: {
    countrycodes?: string;
    viewbox?: string;
    bounded?: string;
    limit?: number;
  }
): Promise<NominatimHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const limit = opts?.limit ?? 8;
  const searchOpts = {
    countrycodes: opts?.countrycodes ?? "nz",
    viewbox: opts?.viewbox ?? DEFAULT_VIEWBOX,
    bounded: opts?.bounded ?? "0",
    limit,
  };

  const primary = await nominatimSearch(trimmed, searchOpts);

  const hasNzHint = /\b(new zealand|nz)\b/i.test(trimmed);
  const looksLikePlaceName = !/^\d+\s/.test(trimmed);
  if (looksLikePlaceName && !hasNzHint && primary.length < limit) {
    const boosted = await nominatimSearch(`${trimmed}, New Zealand`, searchOpts);
    return mergeHits(primary, boosted, limit);
  }

  return primary.slice(0, limit);
}
