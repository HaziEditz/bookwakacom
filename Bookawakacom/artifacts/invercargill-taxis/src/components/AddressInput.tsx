import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  amenity?: string;
  shop?: string;
  tourism?: string;
  building?: string;
  leisure?: string;
  office?: string;
  historic?: string;
}

interface NominatimResult {
  display_name: string;
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
  class?: string;
  address?: NominatimAddress;
}

const MIN_SEARCH_LENGTH = 3;
const SEARCH_TIMEOUT_MS = 5000;
const SEARCH_DEBOUNCE_MS = 200;

/** NZ-only search, biased toward Invercargill (centre -46.4132, 168.3538). */
const NOMINATIM_COUNTRY_CODES = "nz";
const NOMINATIM_BOUNDED = "0";
const NOMINATIM_LIMIT = "8";
const NOMINATIM_VIEWBOX = "167,-47,170,-45";

function cleanDisplayName(displayName: string): string {
  return displayName
    .replace(/, New Zealand(?: \/ Aotearoa)?$/i, "")
    .replace(/, Aotearoa$/i, "")
    .trim();
}

function formatStreetLine(addr?: NominatimAddress): string {
  if (!addr) return "";
  const parts: string[] = [];
  if (addr.house_number) parts.push(addr.house_number);
  if (addr.road) parts.push(addr.road);
  return parts.join(" ").trim();
}

function pickLocality(addr?: NominatimAddress): string {
  if (!addr) return "";
  return (
    addr.suburb ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    ""
  ).trim();
}

function pickCity(addr?: NominatimAddress): string {
  if (!addr) return "";
  const suburb = pickLocality(addr);
  const city = (addr.city || addr.town || addr.village || addr.municipality || "").trim();
  return city && city.toLowerCase() !== suburb.toLowerCase() ? city : "";
}

/** Primary line: business / POI name, or street number + street name. */
export function getPlaceTitle(r: NominatimResult): string {
  const addr = r.address;
  const street = formatStreetLine(addr);

  if (r.name?.trim()) return r.name.trim();

  const poiName =
    addr?.amenity ||
    addr?.shop ||
    addr?.tourism ||
    addr?.leisure ||
    addr?.office ||
    addr?.historic ||
    (addr?.building && addr.building !== "yes" ? addr.building : "");
  if (poiName?.trim()) return poiName.trim();

  if (street) return street;

  const parts = cleanDisplayName(r.display_name).split(",").map((p) => p.trim()).filter(Boolean);
  return parts[0] ?? r.display_name;
}

/** Secondary line: street (when title is a business), suburb, city, postcode. */
export function getPlaceSubtitle(r: NominatimResult): string {
  const addr = r.address;
  const title = getPlaceTitle(r);
  const street = formatStreetLine(addr);
  const suburb = addr?.suburb || addr?.neighbourhood || addr?.quarter || "";
  const city = pickCity(addr);
  const postcode = addr?.postcode?.trim() || "";
  const region = addr?.state?.trim() || addr?.county?.trim() || "";

  const parts: string[] = [];
  const titleLower = title.toLowerCase();
  const streetLower = street.toLowerCase();

  if (street && titleLower !== streetLower && !titleLower.includes(streetLower)) {
    parts.push(street);
  }
  if (suburb && !parts.some((p) => p.toLowerCase() === suburb.toLowerCase())) {
    parts.push(suburb);
  }
  if (city && !parts.some((p) => p.toLowerCase() === city.toLowerCase())) {
    parts.push(city);
  }
  if (postcode) parts.push(postcode);
  else if (region && !parts.some((p) => p.toLowerCase() === region.toLowerCase())) {
    parts.push(region);
  }

  if (parts.length > 0) return parts.join(", ");

  const displayParts = cleanDisplayName(r.display_name)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const rest = displayParts.filter((p) => p.toLowerCase() !== titleLower);
  return rest.join(", ");
}

/** Value stored in the input after the user picks a suggestion. */
export function formatSelectedAddress(r: NominatimResult): string {
  const title = getPlaceTitle(r);
  const subtitle = getPlaceSubtitle(r);
  if (subtitle && subtitle.toLowerCase() !== title.toLowerCase()) {
    return `${title}, ${subtitle}`;
  }
  return title || cleanDisplayName(r.display_name);
}

/** Client-side URL → proxied to Nominatim on the API server. */
function buildGeocodeSearchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    countrycodes: NOMINATIM_COUNTRY_CODES,
    bounded: NOMINATIM_BOUNDED,
    limit: NOMINATIM_LIMIT,
    viewbox: NOMINATIM_VIEWBOX,
  });
  return `${import.meta.env.BASE_URL}api/geocode?${params}`;
}

export default function AddressInput({
  id,
  name,
  value,
  onChange,
  onCoordChange,
  placeholder,
  required,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (val: string) => void;
  onCoordChange?: (lat: number, lng: number) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestQueryRef = useRef("");

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    latestQueryRef.current = trimmed;

    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    setSearching(true);

    try {
      const res = await fetch(buildGeocodeSearchUrl(trimmed), {
        signal: controller.signal,
        headers: { "Accept-Language": "en" },
      });
      if (!res.ok || latestQueryRef.current !== trimmed) {
        if (latestQueryRef.current === trimmed) {
          setResults([]);
          setOpen(false);
        }
        return;
      }
      const data: NominatimResult[] = await res.json();
      if (!Array.isArray(data) || latestQueryRef.current !== trimmed) {
        if (latestQueryRef.current === trimmed) {
          setResults([]);
          setOpen(false);
        }
        return;
      }
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      if (latestQueryRef.current === trimmed) {
        setResults([]);
        setOpen(false);
      }
    } finally {
      clearTimeout(timeoutId);
      if (latestQueryRef.current === trimmed) {
        setSearching(false);
      }
    }
  }, []);

  const scheduleSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const trimmed = query.trim();

      if (trimmed.length < MIN_SEARCH_LENGTH) {
        setResults([]);
        setOpen(false);
        setSearching(false);
        return;
      }

      setSearching(true);
      const delay = trimmed.length === MIN_SEARCH_LENGTH ? 0 : SEARCH_DEBOUNCE_MS;
      debounceRef.current = setTimeout(() => {
        void runSearch(trimmed);
      }, delay);
    },
    [runSearch]
  );

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    onCoordChange?.(0, 0);
    abortRef.current?.abort();
    abortRef.current = null;
    scheduleSearch(val);
  };

  const select = (r: NominatimResult) => {
    onChange(formatSelectedAddress(r));
    onCoordChange?.(parseFloat(r.lat), parseFloat(r.lon));
    setResults([]);
    setOpen(false);
    setSearching(false);
    latestQueryRef.current = "";
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        name={name}
        value={value}
        onChange={handleInput}
        onFocus={() => {
          if (value.trim().length >= MIN_SEARCH_LENGTH) {
            if (results.length > 0) {
              setOpen(true);
            } else {
              scheduleSearch(value);
            }
          }
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="rounded-xl h-12 pr-10"
      />
      {searching && (
        <Loader2 className="absolute right-3 top-3.5 w-5 h-5 animate-spin text-muted-foreground pointer-events-none" />
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
          {results.map((r) => {
            const title = getPlaceTitle(r);
            const subtitle = getPlaceSubtitle(r);
            return (
              <button
                key={r.place_id}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  select(r);
                }}
                onClick={() => select(r)}
                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border/50 last:border-0"
              >
                <div className="text-sm font-semibold text-foreground leading-snug">{title}</div>
                {subtitle ? (
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{subtitle}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
