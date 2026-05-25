import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Car,
  Utensils,
  Package,
  KeyRound,
  Truck,
  Navigation,
  ChevronRight,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Globe,
  Check,
  Plus,
  Hash,
} from "lucide-react";

const BUSINESS_TYPES = [
  {
    id: "taxi",
    label: "Taxi Company",
    shortLabel: "Taxi / Transport",
    icon: <Car className="w-6 h-6" />,
    smallIcon: <Car className="w-4 h-4" />,
    desc: "Register your taxi or transport fleet on the BookaWaka dispatch platform",
  },
  {
    id: "food",
    label: "Restaurant / Food",
    shortLabel: "Food Delivery",
    icon: <Utensils className="w-6 h-6" />,
    smallIcon: <Utensils className="w-4 h-4" />,
    desc: "Partner with us to offer delivery for your restaurant or takeaway",
  },
  {
    id: "courier",
    label: "Courier Business",
    shortLabel: "Courier",
    icon: <Package className="w-6 h-6" />,
    smallIcon: <Package className="w-4 h-4" />,
    desc: "Grow your courier operation by joining the BookaWaka delivery network",
  },
  {
    id: "rental",
    label: "Rental Cars",
    shortLabel: "Rental Cars",
    icon: <KeyRound className="w-6 h-6" />,
    smallIcon: <KeyRound className="w-4 h-4" />,
    desc: "List your rental fleet — cars, vans & SUVs — on the BookaWaka platform",
  },
  {
    id: "towing",
    label: "Towing & Recovery",
    shortLabel: "Towing",
    icon: <Truck className="w-6 h-6" />,
    smallIcon: <Truck className="w-4 h-4" />,
    desc: "Join the BookaWaka network as a towing or roadside recovery operator",
  },
];

const REGISTER_URL = "/api/register";

const STEPS = ["Business Type", "Your Details", "Confirm"];

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    country: "New Zealand",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickPrimary = (id: string) => {
    setSelectedTypes([id]);
    setStep(1);
  };

  const toggleExtra = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(REGISTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          city: form.city,
          country: form.country,
          businessTypes: selectedTypes,
          message: form.message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Something went wrong. Please try again.");
      setRefNumber(data.ref ?? data.refNumber ?? data.id ?? null);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLabels = BUSINESS_TYPES.filter((b) => selectedTypes.includes(b.id)).map((b) => b.label);
  const extraTypes = BUSINESS_TYPES.filter((b) => b.id !== selectedTypes[0]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-foreground text-white px-6 py-4 flex items-center justify-between shadow-xl">
        <a href="/" className="flex items-center gap-2 group">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl rotate-3 group-hover:rotate-0 transition-transform">
            <Navigation className="w-5 h-5" />
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">BookaWaka</span>
        </a>
        {!submitted && (
          <div className="hidden sm:flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all ${
                    i < step
                      ? "bg-accent text-accent-foreground"
                      : i === step
                      ? "bg-primary text-white"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-bold ${i === step ? "text-white" : "text-white/40"}`}>{s}</span>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-white/20" />}
              </div>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl">

          {/* Success */}
          {submitted && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-black text-foreground mb-3">Application received!</h1>
              <p className="text-muted-foreground font-medium mb-4 max-w-sm mx-auto">
                We've received the registration for <strong>{form.businessName}</strong> and will be in touch within 1–2 business days.
              </p>
              {refNumber && (
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-xl px-5 py-3 mb-4 font-mono font-bold text-sm">
                  <Hash className="w-4 h-4" /> Reference: {refNumber}
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-8">
                A confirmation has been sent to <strong>{form.email}</strong>.
                {refNumber && " Please keep your reference number for your records."}
              </p>
              <a href="/">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-8">
                  Back to BookaWaka
                </Button>
              </a>
            </div>
          )}

          {/* Step 0: Pick your primary type */}
          {!submitted && step === 0 && (
            <div>
              <a href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium">
                <ArrowLeft className="w-4 h-4" /> Back
              </a>
              <h1 className="text-3xl md:text-4xl font-display font-black text-foreground mb-2">Join BookaWaka</h1>
              <p className="text-muted-foreground font-medium mb-8">
                What best describes your business? <span className="text-foreground font-semibold">Click to get started.</span>
              </p>
              <div className="space-y-3">
                {BUSINESS_TYPES.map((bt) => (
                  <button
                    key={bt.id}
                    type="button"
                    onClick={() => pickPrimary(bt.id)}
                    className="w-full text-left rounded-2xl p-5 transition-all flex items-center gap-4 border-2 border-border bg-card hover:border-primary hover:shadow-lg group"
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                      {bt.icon}
                    </div>
                    <div className="flex-1">
                      <div className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors">{bt.label}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{bt.desc}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Business Details */}
          {!submitted && step === 1 && (
            <div>
              <button
                onClick={() => { setStep(0); setSelectedTypes([]); }}
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h1 className="text-3xl md:text-4xl font-display font-black text-foreground mb-2">Your details</h1>
              <p className="text-muted-foreground font-medium mb-8">
                Registering as: <span className="font-bold text-foreground">{selectedLabels.join(", ")}</span>
              </p>

              <form
                onSubmit={(e) => { e.preventDefault(); setStep(2); }}
                className="space-y-5 bg-card border border-border rounded-[1.5rem] p-6 md:p-8 shadow-xl"
              >
                <div className="space-y-2">
                  <Label htmlFor="businessName" className="font-bold text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" /> Business Name <span className="text-destructive">*</span>
                  </Label>
                  <Input id="businessName" name="businessName" value={form.businessName} onChange={handleChange} placeholder="e.g. Southland Express Taxis" required className="rounded-xl h-12" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName" className="font-bold text-sm flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" /> Your Name <span className="text-destructive">*</span>
                    </Label>
                    <Input id="contactName" name="contactName" value={form.contactName} onChange={handleChange} placeholder="e.g. Sarah Johnson" required className="rounded-xl h-12" />
                    <p className="text-xs text-muted-foreground">First and last name of the person we should contact</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-bold text-sm flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" /> Phone Number <span className="text-destructive">*</span>
                    </Label>
                    <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="e.g. 021 123 4567" required className="rounded-xl h-12" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" /> Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@yourbusiness.com" required className="rounded-xl h-12" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-bold text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" /> City <span className="text-destructive">*</span>
                    </Label>
                    <Input id="city" name="city" value={form.city} onChange={handleChange} placeholder="e.g. Invercargill" required className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country" className="font-bold text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" /> Country <span className="text-destructive">*</span>
                    </Label>
                    <Input id="country" name="country" value={form.country} onChange={handleChange} placeholder="e.g. New Zealand" required className="rounded-xl h-12" />
                  </div>
                </div>

                {/* Also offer? */}
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Also offer? <span className="font-normal normal-case">(tick any that apply)</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {extraTypes.map((bt) => {
                      const checked = selectedTypes.includes(bt.id);
                      return (
                        <button
                          key={bt.id}
                          type="button"
                          onClick={() => toggleExtra(bt.id)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border-2 text-sm font-bold transition-all ${
                            checked
                              ? "bg-primary border-primary text-white shadow-md"
                              : "bg-background border-border text-foreground hover:border-primary/50"
                          }`}
                        >
                          <span className={checked ? "text-white" : "text-muted-foreground"}>{bt.smallIcon}</span>
                          {bt.shortLabel}
                          {checked && <Check className="w-3.5 h-3.5 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="font-bold text-sm">Tell us about your business (optional)</Label>
                  <Textarea id="message" name="message" value={form.message} onChange={handleChange} placeholder="Fleet size, area you cover, any questions…" rows={3} className="rounded-xl resize-none" />
                </div>

                <Button type="submit" size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-14 font-extrabold text-base shadow-lg">
                  Review Application <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </form>
            </div>
          )}

          {/* Step 2: Confirm */}
          {!submitted && step === 2 && (
            <div>
              <button onClick={() => setStep(1)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h1 className="text-3xl md:text-4xl font-display font-black text-foreground mb-2">Confirm application</h1>
              <p className="text-muted-foreground font-medium mb-8">Check everything looks right before submitting.</p>

              <div className="bg-card border border-border rounded-[1.5rem] p-6 md:p-8 shadow-xl space-y-4 mb-6">
                <Row label="Services" value={selectedLabels.join(", ")} />
                <Row label="Business" value={form.businessName} />
                <Row label="Contact" value={form.contactName} />
                <Row label="Email" value={form.email} />
                <Row label="Phone" value={form.phone} />
                <Row label="Location" value={`${form.city}, ${form.country}`} />
                {form.message && <Row label="Message" value={form.message} />}
              </div>

              {error && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium">
                  {error}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 rounded-full h-14 font-extrabold text-base shadow-lg"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…</>
                ) : (
                  <>Submit Application <ChevronRight className="w-5 h-5 ml-2" /></>
                )}
              </Button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="text-sm font-bold text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
