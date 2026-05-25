import { useState, useEffect, useRef } from "react";
import {
  Car, Navigation, ArrowRight, CheckCircle2, Phone, Clock, Shield,
  MapPin, DollarSign, Loader2, Calculator, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Tariff {
  id: string;
  name: string;
  flagFall: number | null;
  ratePerKm: number | null;
  minFare: number | null;
  currency: string;
}

interface NominatimResult {
  display_name: string;
  place_id: number;
  lat: string;
  lon: string;
}

function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (display: string, lat: number, lng: number) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = (v: string) => {
    onChange(v);
    if (debounce.current) clearTimeout(debounce.current);
    if (v.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/geocode?q=${encodeURIComponent(v)}`);
        const data = await res.json();
        setSuggestions((data.results ?? []).slice(0, 5));
        setOpen(true);
      } catch { setSuggestions([]); }
    }, 300);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl h-12"
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-xl overflow-hidden">
          {suggestions.map((s) => (
            <li key={s.place_id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(s.display_name, parseFloat(s.lat), parseFloat(s.lon));
                  setSuggestions([]);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-start gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span>{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SERVICES = [
  { title: "Airport Transfers", desc: "Reliable pickups and drop-offs at Invercargill Airport — on time, every time.", icon: "✈️" },
  { title: "City Rides", desc: "Fast, affordable rides around Invercargill and surrounding suburbs.", icon: "🏙️" },
  { title: "Intercity Travel", desc: "Long-distance trips across Southland, including Queenstown and Dunedin.", icon: "🛣️" },
  { title: "Corporate Accounts", desc: "Managed billing and priority booking for businesses.", icon: "💼" },
];

export default function TaxiPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [tariffsLoading, setTariffsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [pickAddr, setPickAddr] = useState("");
  const [dropAddr, setDropAddr] = useState("");
  const [pickCoords, setPickCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropCoords, setDropCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [estimate, setEstimate] = useState<{ fare: number; tariff: string; distanceKm: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/companies`)
      .then((r) => r.json())
      .then((d) => {
        const companies = d.companies ?? [];
        const taxi = companies.find((c: any) => c.services?.includes("taxi")) ?? companies[0];
        if (!taxi) return;
        setCompanyId(taxi.id);
        return fetch(`${import.meta.env.BASE_URL}api/tariffs?cid=${taxi.id}`);
      })
      .then((r) => r?.json())
      .then((d) => {
        if (d?.tariffs) setTariffs(d.tariffs);
      })
      .catch(() => {})
      .finally(() => setTariffsLoading(false));
  }, []);

  const handleEstimate = async () => {
    if (!pickCoords || !dropCoords || !companyId) return;
    setEstimating(true);
    setEstimateError(null);
    setEstimate(null);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/fare-estimate?cid=${companyId}&fromLat=${pickCoords.lat}&fromLng=${pickCoords.lng}&toLat=${dropCoords.lat}&toLng=${dropCoords.lng}`
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not calculate fare");
      setEstimate({ fare: d.estimatedFare, tariff: d.tariffName, distanceKm: d.distanceKm });
    } catch (err: any) {
      setEstimateError(err.message ?? "Could not calculate fare");
    } finally {
      setEstimating(false);
    }
  };

  const canEstimate = !!(pickCoords && dropCoords && companyId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col">
      <header className="bg-foreground text-white px-6 py-4 flex items-center justify-between shadow-xl">
        <a href="/" className="flex items-center gap-2 group">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl rotate-3 group-hover:rotate-0 transition-transform">
            <Navigation className="w-5 h-5" />
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">BookaWaka</span>
        </a>
        <a href={`${import.meta.env.BASE_URL}book`}>
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full font-bold">
            Book a Taxi
          </Button>
        </a>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-foreground text-white py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Car className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-black mb-4 leading-tight">
              Taxi &amp; Transfers<br /><span className="text-accent">Across Southland</span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 font-medium max-w-2xl mx-auto mb-10">
              Book a taxi instantly or schedule ahead. Trusted drivers, transparent fares — no surprises.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mb-10">
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-5 py-2.5 text-sm font-bold"><Clock className="w-4 h-4 text-accent" /> Available 24/7</div>
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-5 py-2.5 text-sm font-bold"><Shield className="w-4 h-4 text-accent" /> Verified drivers</div>
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-5 py-2.5 text-sm font-bold"><DollarSign className="w-4 h-4 text-accent" /> Meter &amp; fixed fares</div>
            </div>
            <a href={`${import.meta.env.BASE_URL}book`}>
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full h-14 px-10 font-extrabold shadow-xl text-base">
                Book Now <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
          </div>
        </section>

        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto space-y-16">

            {/* Fare Calculator */}
            <div>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-extrabold uppercase tracking-widest mb-3">
                  <Calculator className="w-3.5 h-3.5" /> Fare Calculator
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-black">Get an instant estimate</h2>
                <p className="text-muted-foreground font-medium mt-2">Enter your pickup and drop-off to see an estimated fare based on live tariff rates.</p>
              </div>

              <div className="bg-card border border-border rounded-[1.5rem] p-6 md:p-8 shadow-xl space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" /> Pickup Address
                  </label>
                  <AddressAutocomplete
                    value={pickAddr}
                    onChange={(v) => { setPickAddr(v); setPickCoords(null); setEstimate(null); }}
                    onSelect={(display, lat, lng) => { setPickAddr(display); setPickCoords({ lat, lng }); setEstimate(null); }}
                    placeholder="Start typing your pickup location…"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-destructive" /> Drop-off Address
                  </label>
                  <AddressAutocomplete
                    value={dropAddr}
                    onChange={(v) => { setDropAddr(v); setDropCoords(null); setEstimate(null); }}
                    onSelect={(display, lat, lng) => { setDropAddr(display); setDropCoords({ lat, lng }); setEstimate(null); }}
                    placeholder="Where are you going?"
                  />
                </div>

                <Button
                  onClick={handleEstimate}
                  disabled={!canEstimate || estimating}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-12 font-extrabold shadow-md"
                >
                  {estimating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating…</>
                  ) : (
                    <><Calculator className="w-4 h-4 mr-2" /> Calculate Fare</>
                  )}
                </Button>

                {!canEstimate && (pickAddr || dropAddr) && (
                  <p className="text-xs text-muted-foreground text-center">Select both addresses from the dropdown suggestions to calculate.</p>
                )}

                {estimateError && (
                  <p className="text-sm text-destructive font-medium text-center">{estimateError}</p>
                )}

                {estimate && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 mb-1">Estimated Fare</p>
                    <p className="text-4xl font-display font-black text-emerald-800 mb-1">
                      ${estimate.fare.toFixed(2)} <span className="text-lg font-bold text-emerald-600">NZD</span>
                    </p>
                    <p className="text-sm text-emerald-700 font-medium">
                      {estimate.distanceKm} km · {estimate.tariff} tariff
                    </p>
                    <p className="text-xs text-emerald-600 mt-2">Final fare is set by the driver meter. This is an estimate only.</p>
                    <a href={`${import.meta.env.BASE_URL}book?pickup=${encodeURIComponent(pickAddr)}&drop=${encodeURIComponent(dropAddr)}`} className="mt-4 inline-block">
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-8">
                        <Zap className="w-4 h-4 mr-2" /> Book This Ride
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Live Tariff Rates */}
            <div>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-extrabold uppercase tracking-widest mb-3">
                  <DollarSign className="w-3.5 h-3.5" /> Live Pricing
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-black">Tariff rates</h2>
                <p className="text-muted-foreground font-medium mt-2">Current rates set by the operator — pulled live from the dispatch system.</p>
              </div>

              {tariffsLoading ? (
                <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading rates…
                </div>
              ) : tariffs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
                  <p className="font-medium">Tariff rates are not available right now.</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-[1.5rem] overflow-hidden shadow-xl">
                  <div className="grid grid-cols-4 gap-0 bg-muted/60 border-b border-border px-6 py-3">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Tariff</span>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground text-center">Flag Fall</span>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground text-center">Per km</span>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground text-right">Min Fare</span>
                  </div>
                  <div className="divide-y divide-border">
                    {tariffs.map((t) => (
                      <div key={t.id} className="grid grid-cols-4 gap-0 px-6 py-4 hover:bg-muted/20 transition-colors">
                        <div className="font-bold text-foreground text-sm">{t.name}</div>
                        <div className="text-center">
                          {t.flagFall != null ? (
                            <span className="font-bold text-foreground">${t.flagFall.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="text-center">
                          {t.ratePerKm != null ? (
                            <span className="font-bold text-foreground">${t.ratePerKm.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="text-right">
                          {t.minFare != null ? (
                            <span className="font-bold text-foreground">${t.minFare.toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-6 py-3 bg-muted/30 border-t border-border">
                    <p className="text-xs text-muted-foreground">Rates are set by the operator and subject to change. Actual fare depends on distance and time on meter.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Services */}
            <div>
              <h2 className="text-2xl font-display font-black mb-8 text-center">Our Taxi Services</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {SERVICES.map((s) => (
                  <div key={s.title} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-lg transition-all">
                    <div className="text-4xl mb-4">{s.icon}</div>
                    <h3 className="font-display font-black text-lg mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground font-medium">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Areas */}
            <div className="bg-card border border-border rounded-2xl p-8">
              <h2 className="text-xl font-display font-black mb-6 flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Areas We Cover</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {["Invercargill", "Bluff", "Gore", "Winton", "Queenstown", "Te Anau", "Riverton", "Lumsden"].map((area) => (
                  <div key={area} className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /> {area}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-primary rounded-[2rem] p-10 md:p-12 text-center text-primary-foreground">
              <h2 className="text-2xl md:text-3xl font-display font-black mb-3">Ready to ride?</h2>
              <p className="text-primary-foreground/80 font-medium mb-8 max-w-lg mx-auto">Book online in seconds or call us directly.</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <a href={`${import.meta.env.BASE_URL}book`}>
                  <Button size="lg" className="bg-accent text-accent-foreground hover:bg-white rounded-full h-14 px-10 font-extrabold shadow-xl">
                    Book Online <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </a>
                <a href="tel:+6403214444">
                  <Button size="lg" variant="outline" className="rounded-full h-14 px-10 font-extrabold border-white/40 text-white hover:bg-white/10">
                    <Phone className="w-4 h-4 mr-2" /> Call Us
                  </Button>
                </a>
              </div>
            </div>

          </div>
        </section>
      </main>

      <footer className="bg-foreground text-white/60 text-sm text-center py-6 px-6">
        <p>&copy; {new Date().getFullYear()} BookaWaka. All rights reserved. &mdash; <a href="/" className="hover:text-white transition-colors">Back to home</a></p>
      </footer>
    </div>
  );
}
