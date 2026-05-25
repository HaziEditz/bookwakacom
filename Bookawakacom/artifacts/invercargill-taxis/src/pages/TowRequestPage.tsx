import { useState } from "react";
import { Truck, Navigation, Phone, Mail, MapPin, User, ArrowRight, CheckCircle2, Loader2, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function TowRequestPage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", location: "", destination: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          location: form.location,
          destination: form.destination,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setRefNumber(data.refId ?? null);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col">
      <header className="bg-foreground text-white px-6 py-4 flex items-center justify-between shadow-xl">
        <a href="/" className="flex items-center gap-2 group">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl rotate-3 group-hover:rotate-0 transition-transform">
            <Navigation className="w-5 h-5" />
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">BookaWaka</span>
        </a>
        <a href="tel:+6403123456">
          <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full font-bold">
            <Phone className="w-4 h-4 mr-1.5" /> Emergency Call
          </Button>
        </a>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h1 className="text-3xl font-display font-black mb-3">Request received!</h1>
              <p className="text-muted-foreground font-medium mb-4 max-w-sm mx-auto">
                We've logged your tow request and are dispatching the nearest available operator to <strong>{form.location}</strong>.
              </p>
              {refNumber && (
                <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-xl px-5 py-3 mb-4 font-mono font-bold text-sm">
                  <Hash className="w-4 h-4" /> Job ID: {refNumber}
                </div>
              )}
              <p className="text-sm text-muted-foreground mb-8">
                A confirmation has been sent to <strong>{form.email}</strong>. Use your Job ID to track your tow.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <a href={`/tow/track${refNumber ? `?id=${refNumber}` : ""}`}>
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-8">
                    Track My Tow <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>
                <a href="/">
                  <Button size="lg" variant="outline" className="rounded-full font-bold px-8">Back to Home</Button>
                </a>
              </div>
            </div>
          ) : (
            <div>
              <a href="/towing" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 font-medium text-sm">
                ← Back to Towing
              </a>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center text-destructive">
                  <Truck className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-display font-black">Request a Tow</h1>
                  <p className="text-muted-foreground text-sm font-medium">Fill in your details and we'll dispatch help.</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="bg-card border border-border rounded-[1.5rem] p-6 md:p-8 shadow-xl space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-bold text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> Your Name <span className="text-destructive">*</span>
                  </Label>
                  <Input id="name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Jane Smith" required className="rounded-xl h-12" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-bold text-sm flex items-center gap-2">
                      <Phone className="w-4 h-4 text-primary" /> Phone <span className="text-destructive">*</span>
                    </Label>
                    <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="021 123 4567" required className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-bold text-sm flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" /> Email <span className="text-destructive">*</span>
                    </Label>
                    <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required className="rounded-xl h-12" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="font-bold text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Vehicle Location <span className="text-destructive">*</span>
                  </Label>
                  <Input id="location" name="location" value={form.location} onChange={handleChange} placeholder="e.g. 123 Dee Street, Invercargill" required className="rounded-xl h-12" />
                  <p className="text-xs text-muted-foreground">Be as specific as possible — street address, landmark, or road name</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="destination" className="font-bold text-sm flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary" /> Tow Destination <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input id="destination" name="destination" value={form.destination} onChange={handleChange} placeholder="e.g. Smith's Panel & Paint, 45 Bond Street" className="rounded-xl h-12" />
                  <p className="text-xs text-muted-foreground">Where would you like the vehicle towed? Leave blank if unsure.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="font-bold text-sm">Additional Details (optional)</Label>
                  <Textarea id="notes" name="notes" value={form.notes} onChange={handleChange} placeholder="Vehicle make/model, what happened, special instructions…" rows={3} className="rounded-xl resize-none" />
                </div>

                <Button type="submit" size="lg" disabled={submitting} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full h-14 font-extrabold text-base shadow-lg">
                  {submitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting…</> : <><Truck className="w-5 h-5 mr-2" /> Request Tow Now</>}
                </Button>

                <p className="text-center text-xs text-muted-foreground">For life-threatening emergencies, call 111. For urgent breakdown: <a href="tel:+6403123456" className="font-bold text-primary hover:underline">call us directly</a>.</p>
              </form>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-foreground text-white/60 text-sm text-center py-6 px-6">
        <p>&copy; {new Date().getFullYear()} BookaWaka. All rights reserved. &mdash; <a href="/" className="hover:text-white transition-colors">Back to home</a></p>
      </footer>
    </div>
  );
}
