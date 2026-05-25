import { XCircle, Navigation, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentCancelPage() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("booking") ?? "";
  const cid = params.get("cid") ?? "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col">
      <header className="bg-foreground text-white px-6 py-4 flex items-center gap-3 shadow-xl">
        <a href="/" className="flex items-center gap-2 group">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl rotate-3 group-hover:rotate-0 transition-transform">
            <Navigation className="w-5 h-5" />
          </div>
          <span className="font-display font-extrabold text-xl tracking-tight">BookaWaka</span>
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="bg-card border border-border rounded-[2rem] p-8 md:p-10 shadow-xl">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-muted-foreground" />
            </div>

            <h1 className="text-3xl font-display font-black text-foreground mb-3">
              Payment cancelled
            </h1>
            <p className="text-muted-foreground font-medium mb-2 leading-relaxed">
              No payment was taken and your booking has <strong>not</strong> been dispatched.
            </p>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              Your booking reference is reserved — you can try again or book a new ride.
            </p>

            {bookingId && (
              <div className="bg-muted/60 border border-border rounded-xl px-5 py-3 mb-6 text-sm text-muted-foreground">
                Booking ref: <span className="font-mono font-bold text-foreground">{bookingId}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/book">
                <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-8">
                  <RefreshCw className="w-4 h-4 mr-2" /> Try Again
                </Button>
              </a>
              <a href="/">
                <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full font-bold px-8">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
