import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

interface NominatimResult {
  display_name: string;
  place_id: number;
  lat: string;
  lon: string;
}

const NOMINATIM_COUNTRY_CODES = "nz";
const NOMINATIM_VIEWBOX = "-168,-47,-166,-46";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    onCoordChange?.(0, 0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: val,
          countrycodes: NOMINATIM_COUNTRY_CODES,
          viewbox: NOMINATIM_VIEWBOX,
        });
        const res = await fetch(`${import.meta.env.BASE_URL}api/geocode?${params}`);
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        /* silently ignore network errors */
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
    return () => document.removeEventListener("mousedown", handler);
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
        className="rounded-xl h-12"
      />
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
              {r.display_name.replace(/, New Zealand$/, "").replace(/,\s*\d{4}(?=,|$)/, "")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
