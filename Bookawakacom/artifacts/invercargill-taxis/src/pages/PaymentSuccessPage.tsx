import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Navigation,
  CalendarClock,
  ArrowRight,
  Loader2,
  Zap,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPassengerKey } from "@/lib/passengerKey";

type DispatchState = "pending" | "dispatched" | "already" | "error";

export default function PaymentSuccessPage() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("booking") ?? "";
  const cid = params.get("cid") ?? "";
  const sessionId = params.get("session_id") ?? "";

  const [dispatch, setDispatch] = useState<DispatchState>("pending");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!bookingId || !cid || !sessionId) {
      setDispatch("already");
      return;
    }

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");

    fetch(`${base}/api/stripe/verify-and-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, bookingId, companyId: cid }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setDispatch(d.alreadyDispatched ? "already" : "dispatched");
        } else {
          setDispatch("error");
        }
      })
      .catch(() => setDispatch("error"));
  }, [bookingId, cid, sessionId]);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const myRidesUrl = `${base}/my-rides`;

  const handleCancelBooking = async () => {
    const passengerKey = getPassengerKey();
    if (!passengerKey || !bookingId || !cid) {
      setCancelError("Could not verify your session. Open My Rides to cancel this booking.");
      return;
    }
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`${base}/api/my-rides/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: passengerKey, companyId: cid }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not cancel booking");
      setConfirmCancel(false);
      setCancelled(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not cancel booking";
      setCancelError(message);
    } finally {
      setIsCancelling(false);
    }
  };

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
            {cancelled ? (
              <>
                <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
                <h1 className="text-3xl font-display font-black text-foreground mb-3">
                  Booking cancelled
                </h1>
                <p className="text-muted-foreground font-medium mb-6 leading-relaxed">
                  Booking{" "}
                  <span className="font-mono font-bold text-foreground">{bookingId}</span> has been
                  cancelled.
                  {cancelError === null && (
                    <> Card payments cancelled before dispatch may be credited to your wallet.</>
                  )}
                </p>
                <a href={myRidesUrl}>
                  <Button size="lg" className="rounded-full font-bold px-8">
                    View My Rides
                  </Button>
                </a>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-display font-black text-foreground mb-3">
                  Payment confirmed!
                </h1>
                <p className="text-muted-foreground font-medium mb-6 leading-relaxed">
                  Your payment was successful. Your booking is being sent to the dispatch team now.
                </p>

                {bookingId && (
                  <div className="bg-muted/60 border border-border rounded-xl px-5 py-3 mb-6 text-sm text-muted-foreground">
                    Booking ID:{" "}
                    <span className="font-mono font-bold text-foreground">{bookingId}</span>
                  </div>
                )}

                <div className="mb-8">
                  {dispatch === "pending" && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending to dispatch…
                    </div>
                  )}
                  {(dispatch === "dispatched" || dispatch === "already") && (
                    <div className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      <Zap className="w-4 h-4" /> Sent to dispatch — a driver will be assigned shortly.
                    </div>
                  )}
                  {dispatch === "error" && (
                    <div className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                      Your payment went through. If your booking doesn&apos;t appear within a few
                      minutes, contact us at{" "}
                      <a href="mailto:info@bookawaka.com" className="underline font-bold">
                        info@bookawaka.com
                      </a>{" "}
                      with your booking ID.
                    </div>
                  )}
                </div>

                {confirmCancel && (
                  <div className="mb-6 p-5 bg-destructive/5 border border-destructive/20 rounded-2xl text-left">
                    <p className="text-sm font-bold text-destructive mb-2">Cancel this booking?</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      This cancels booking #{bookingId}. If no driver is assigned yet, the fare may
                      be added to your BookaWaka wallet as credit.
                    </p>
                    {cancelError && (
                      <p className="text-sm text-destructive mb-3">{cancelError}</p>
                    )}
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleCancelBooking}
                        disabled={isCancelling}
                        className="rounded-full font-bold"
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Cancelling…
                          </>
                        ) : (
                          "Yes, cancel"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConfirmCancel(false);
                          setCancelError(null);
                        }}
                        disabled={isCancelling}
                        className="rounded-full font-bold"
                      >
                        Keep booking
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                  {bookingId && cid && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setConfirmCancel(true);
                        setCancelError(null);
                      }}
                      className="rounded-full font-bold px-8 border-destructive/30 text-destructive hover:bg-destructive/5"
                    >
                      <XCircle className="w-5 h-5 mr-2" /> Cancel booking
                    </Button>
                  )}
                  <a href={myRidesUrl}>
                    <Button
                      size="lg"
                      className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold px-8"
                    >
                      <CalendarClock className="w-5 h-5 mr-2" /> My Rides
                    </Button>
                  </a>
                  <a href="/">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full font-bold px-8">
                      Back to Home <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
