import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Car,
  Utensils,
  Package,
  KeyRound,
  Truck,
  Navigation,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Globe,
  Lock,
} from "lucide-react";

const SERVICE_TYPES = [
  { id: "taxi", label: "Taxi", icon: Car },
  { id: "food", label: "Food Delivery", icon: Utensils },
  { id: "freight", label: "Freight", icon: Package },
  { id: "towing", label: "Towing", icon: Truck },
  { id: "rental", label: "Rental", icon: KeyRound },
];

const REGISTER_URL = `${import.meta.env.BASE_URL}api/register`;

export default function RegisterPage() {
  const [form, setForm] = useState({
    companyName: "",
    ownerName: "",
    email: "",
    phone: "",
    city: "",
    country: "New Zealand",
    password: "",
    confirmPassword: "",
  });
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const toggleService = (id: string) => {
    setServiceTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!serviceTypes.length) {
      setError("Please select at least one service type.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(REGISTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.companyName,
          contactName: form.ownerName,
          email: form.email,
          phone: form.phone,
          city: form.city,
          country: form.country,
          serviceTypes,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col">
      <header className="bg-foreground text-white px-6 py-4 flex items-center justify-between shadow-xl">
        <a href={`${import.meta.env.BASE_URL}`} className="flex items-center gap-2 group">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl rotate-3 group-hover:rotate-0 transition-transform">
            <Navigation className="w-5 h-5" />
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">BookaWaka</span>
        </a>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-black text-foreground mb-3">
                Application submitted
              </h1>
              <p className="text-lg text-muted-foreground font-medium mb-4 max-w-md mx-auto">
                Your application has been submitted. We will review and approve your account within 24 hours.
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                A confirmation email has been sent to <strong>{form.email}</strong>.
              </p>
              <a href={`${import.meta.env.BASE_URL}`}>
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-8">
                  Back to BookaWaka
                </Button>
              </a>
            </div>
          ) : (
            <div>
              <a
                href={`${import.meta.env.BASE_URL}`}
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </a>
              <h1 className="text-3xl md:text-4xl font-display font-black text-foreground mb-2">
                Register your company
              </h1>
              <p className="text-muted-foreground font-medium mb-8">
                Sign up to join the BookaWaka platform. We'll review your application and get you onboarded.
              </p>

              <form
                onSubmit={handleSubmit}
                className="space-y-5 bg-card border border-border rounded-[1.5rem] p-6 md:p-8 shadow-xl"
              >
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="font-bold text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" /> Company name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    value={form.companyName}
                    onChange={handleChange}
                    placeholder="e.g. Southland Express Taxis"
                    required
                    className="rounded-xl h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerName" className="font-bold text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Owner full name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ownerName"
                    name="ownerName"
                    value={form.ownerName}
                    onChange={handleChange}
                    placeholder="e.g. Sarah Johnson"
                    required
                    className="rounded-xl h-12"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-bold text-sm flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" /> Email address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@yourbusiness.com"
                      required
                      className="rounded-xl h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-bold text-sm flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" /> Phone number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="e.g. 021 123 4567"
                      required
                      className="rounded-xl h-12"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-bold text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" /> City <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="city"
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      placeholder="e.g. Invercargill"
                      required
                      className="rounded-xl h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country" className="font-bold text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" /> Country <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="country"
                      name="country"
                      value={form.country}
                      onChange={handleChange}
                      placeholder="e.g. New Zealand"
                      required
                      className="rounded-xl h-12"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="font-bold text-sm">
                    Service types <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {SERVICE_TYPES.map(({ id, label, icon: Icon }) => (
                      <label
                        key={id}
                        htmlFor={`service-${id}`}
                        className={`flex items-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition-all ${
                          serviceTypes.includes(id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <Checkbox
                          id={`service-${id}`}
                          checked={serviceTypes.includes(id)}
                          onCheckedChange={() => toggleService(id)}
                        />
                        <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="font-bold text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="font-bold text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" /> Password <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="At least 6 characters"
                      required
                      minLength={6}
                      className="rounded-xl h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="font-bold text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" /> Confirm password <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter password"
                      required
                      minLength={6}
                      className="rounded-xl h-12"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  size="lg"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-14 font-extrabold text-base shadow-lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…
                    </>
                  ) : (
                    "Submit application"
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
