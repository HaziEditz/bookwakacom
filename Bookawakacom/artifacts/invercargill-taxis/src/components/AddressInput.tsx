import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface NominatimResult {
  display_name: string;
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
  class?: string;
}

function formatResultLabel(r: NominatimResult): string {
  const base =
    r.name && !r.display_name.toLowerCase().startsWith(r.name.toLowerCase())
      ? `${r.name}, ${r.display_name}`
      : r.display_name;
  return base.replace(/, New Zealand$/, "").replace(/,\s*\d{4}(?=,|$)/, "");
}

const MIN_SEARCH_LENGTH = 3;
const SEARCH_TIMEOUT_MS = 5000;

/** NZ-only search, biased toward Invercargill (centre -46.4132, 168.3538). */
const NOMINATIM_COUNTRY_CODES = "nz";
const NOMINATIM_BOUNDED = "0";
const NOMINATIM_LIMIT = "8";
const NOMINATIM_VIEWBOX = "167,-47,170,-45";

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

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    onCoordChange?.(0, 0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    abortRef.current = null;

    if (val.trim().length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
      setSearching(true);

      try {
        const res = await fetch(buildGeocodeSearchUrl(val.trim()), {
          signal: controller.signal,
          headers: { "Accept-Language": "en" },
        });
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        /* silently ignore network/timeout errors */
        setResults([]);
        setOpen(false);
      } finally {
        clearTimeout(timeoutId);
        setSearching(false);
      }
    }, 380);
  };

  const select = (r: NominatimResult) => {
    onChange(r.display_name);
    onCoordChange?.(parseFloat(r.lat), parseFloat(r.lon));
    setResults([]);
    setOpen(false);
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
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="rounded-xl h-12 pr-10"
      />
      {searching && (
        <Loader2 className="absolute right-3 top-3.5 w-5 h-5 animate-spin text-muted-foreground pointer-events-none" />
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                select(r);
              }}
              onClick={() => select(r)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors border-b border-border/50 last:border-0 leading-snug"
            >
              {formatResultLabel(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
