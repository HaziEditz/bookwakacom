import { Router } from "express";
import { getDatabase } from "../lib/firebase";
import { debitWallet } from "../lib/wallet";
import { resolveStripePaymentContext } from "../lib/stripe-keys";
import {
  calcConnectPaymentSplit,
  commissionFieldsFromMetadata,
  resolveTaxiCommissionPct,
} from "../lib/stripe-commission";

const stripeRouter = Router();

/** Debit walletAmountPending after card payment confirms (partial wallet + card bookings). */
async function applyPendingWalletDebit(
  db: ReturnType<typeof getDatabase>,
  booking: Record<string, any>,
  bookingId: string,
  companyId: string,
  log: any
): Promise<Record<string, any>> {
  if (booking.walletDebited || !booking.walletAmountPending || booking.walletAmountPending <= 0) {
    return {};
  }

  const rawPhone: string | null = booking.PassengerPhone ?? booking.passengerPhone ?? null;
  if (!rawPhone) {
    log.warn({ bookingId, companyId }, "wallet pending debit: no passenger phone");
    return {};
  }

  const normalizedPhone = rawPhone.replace(/[^0-9]/g, "");
  const pkSnap = await db.ref(`passengerIndex/phone/${normalizedPhone}`).once("value");
  const passengerKey: string | null = pkSnap.val()?.key ?? null;
  if (!passengerKey) {
    log.warn({ bookingId, companyId }, "wallet pending debit: passenger key not found");
    return {};
  }

  const pendingCents = Math.round(Number(booking.walletAmountPending) * 100);
  const debit = await debitWallet(db, passengerKey, pendingCents, {
    reason: "booking_payment",
    jobId: bookingId,
    companyId,
  });

  if (!debit.ok) {
    log.error({ bookingId, companyId, passengerKey, err: debit.error }, "wallet pending debit failed after card payment");
    return {};
  }

  log.info(
    { bookingId, companyId, passengerKey, walletAmount: booking.walletAmountPending },
    "Wallet debit applied after card payment"
  );

  return {
    walletAmountApplied: booking.walletAmountPending,
    walletAmountPending: null,
    walletDebited: true,
    walletDebitEntryId: debit.entryId,
  };
}

stripeRouter.post("/stripe/create-booking-payment", async (req, res) => {
  const { cid, bookingId, description, amount, currency, email } = req.body as {
    cid?: string;
    bookingId?: string;
    description?: string;
    amount?: number;
    currency?: string;
    email?: string;
  };

  if (!cid || !bookingId || !amount || !email) {
    res.status(400).json({ error: "cid, bookingId, amount, and email are required" });
    return;
  }

  const payCtx = await resolveStripePaymentContext(cid);
  if (!payCtx.secretKey) {
    req.log.error({ cid }, "No Stripe secret key for company or STRIPE_SECRET_KEY env");
    res.status(503).json({ error: "Online card payment is not configured yet. Please pay your driver on arrival." });
    return;
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(payCtx.secretKey, { apiVersion: "2026-04-22.dahlia" });

    const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? process.env.REPLIT_DEV_DOMAIN ?? "localhost:80";
    const baseUrl = `https://${domain}`;

    const amountCents = Math.round(amount * 100);
    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "payment",
      currency: currency ?? "nzd",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: currency ?? "nzd",
            unit_amount: amountCents,
            product_data: {
              name: description ?? `Booking ${bookingId}`,
              description: `BookaWaka booking — ref ${bookingId}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId,
        companyId: cid,
        type: "booking_payment",
        stripeMode: payCtx.mode ?? "direct",
      },
      success_url: `${baseUrl}/payment-success?booking=${bookingId}&cid=${encodeURIComponent(cid)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment-cancel?booking=${bookingId}&cid=${encodeURIComponent(cid)}`,
    };

    if (payCtx.mode === "connect" && payCtx.connectAccountId) {
      const db = getDatabase();
      const commissionPct = await resolveTaxiCommissionPct(db, cid);
      const split = calcConnectPaymentSplit(amountCents, commissionPct);
      sessionParams.payment_intent_data = {
        transfer_data: {
          destination: payCtx.connectAccountId,
        },
        ...(split.applicationFeeCents > 0
          ? { application_fee_amount: split.applicationFeeCents }
          : {}),
      };
      sessionParams.metadata = {
        ...sessionParams.metadata,
        commissionPct: String(split.commissionPct),
        applicationFeeCents: String(split.applicationFeeCents),
        companyNetCents: String(split.companyNetCents),
      };
      req.log.info(
        {
          bookingId,
          cid,
          commissionPct: split.commissionPct,
          applicationFeeCents: split.applicationFeeCents,
          companyNetCents: split.companyNetCents,
        },
        "Connect checkout: platform commission applied"
      );
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    req.log.info({ bookingId, cid, sessionId: session.id }, "Stripe Checkout session created");
    res.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (err: any) {
    req.log.error({ err }, "POST /stripe/create-booking-payment error");
    res.status(500).json({ error: err.message ?? "Could not create payment session" });
  }
});

// Called by the frontend when the user lands on /payment-success.
// Verifies the Stripe session directly (no webhook needed) and triggers dispatch
// if the booking hasn't been dispatched yet. Safe to call multiple times.
stripeRouter.post("/stripe/verify-and-dispatch", async (req, res) => {
  const { sessionId, bookingId, companyId } = req.body as {
    sessionId?: string;
    bookingId?: string;
    companyId?: string;
  };

  if (!sessionId || !bookingId || !companyId) {
    res.status(400).json({ error: "sessionId, bookingId, companyId are required" });
    return;
  }

  const payCtx = await resolveStripePaymentContext(companyId);
  if (!payCtx.secretKey) {
    req.log.error({ companyId }, "No Stripe secret key for company or STRIPE_SECRET_KEY env");
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(payCtx.secretKey, { apiVersion: "2026-04-22.dahlia" });

    // Verify the session with Stripe directly
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      res.status(402).json({ error: "Payment not completed", payment_status: session.payment_status });
      return;
    }

    // Verify metadata matches — guard against session ID spoofing
    const meta = session.metadata ?? {};
    if (meta.bookingId !== bookingId || meta.companyId !== companyId || meta.type !== "booking_payment") {
      req.log.warn({ sessionId, bookingId, companyId }, "verify-and-dispatch: metadata mismatch");
      res.status(403).json({ error: "Session metadata does not match booking" });
      return;
    }

    const db = getDatabase();
    const bookingSnap = await db.ref(`allbookings/${companyId}/${bookingId}`).once("value");
    const existing = bookingSnap.val() as Record<string, any> | null;

    if (!existing) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Idempotent — if already dispatched (paymentStatus === "paid") just return success
    if (existing.paymentStatus === "paid") {
      req.log.info({ bookingId, companyId }, "verify-and-dispatch: already dispatched, skipping");
      res.json({ ok: true, alreadyDispatched: true });
      return;
    }

    const paidAt = new Date().toISOString();
    const commissionFields = commissionFieldsFromMetadata(meta as Record<string, string>);
    const walletFields = await applyPendingWalletDebit(db, existing, bookingId, companyId, req.log);
    const paidBooking = {
      ...existing,
      ...walletFields,
      ...commissionFields,
      Status: "Pending",
      paymentMethod: "card",
      paymentStatus: "paid",
      stripeSessionId: session.id,
      paidAt,
    };

    const paidFields = {
      ...walletFields,
      ...commissionFields,
      Status: "Pending",
      paymentMethod: "card",
      paymentStatus: "paid",
      stripeSessionId: session.id,
      paidAt,
    };

    // Look up passenger key so we can update Passengerjobs (the source My Rides reads from)
    let passengerKey: string | null = null;
    const rawPhone: string | null = existing.PassengerPhone ?? existing.passengerPhone ?? null;
    if (rawPhone) {
      const normalizedPhone = rawPhone.replace(/[^0-9]/g, "");
      const pkSnap = await db.ref(`passengerIndex/phone/${normalizedPhone}`).once("value");
      passengerKey = pkSnap.val()?.key ?? null;
    }

    const writes: Promise<any>[] = [
      db.ref(`allbookings/${companyId}/${bookingId}`).update(paidFields),
      db.ref(`pendingjobs/${companyId}/${bookingId}`).set(paidBooking),
    ];

    // Keep Passengerjobs in sync so My Rides shows the correct status
    if (passengerKey) {
      writes.push(db.ref(`Passengerjobs/${passengerKey}/${bookingId}`).update(paidFields));
    }

    await Promise.all(writes);

    req.log.info({ bookingId, companyId, sessionId }, "verify-and-dispatch: dispatched to pendingjobs");
    res.json({ ok: true, alreadyDispatched: false });
  } catch (err: any) {
    req.log.error({ err }, "POST /stripe/verify-and-dispatch error");
    res.status(500).json({ error: err.message ?? "Verification failed" });
  }
});

stripeRouter.post("/stripe/webhook", async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const payCtx = await resolveStripePaymentContext();

  if (!payCtx.secretKey || !webhookSecret) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(payCtx.secretKey, { apiVersion: "2026-04-22.dahlia" });
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }

    const event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      Array.isArray(sig) ? sig[0] : sig,
      webhookSecret
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const { bookingId, companyId, type } = session.metadata ?? {};

      if (type === "booking_payment" && bookingId && companyId) {
        const db = getDatabase();

        // Read the full booking so we can write it to the dispatch queue
        const bookingSnap = await db.ref(`allbookings/${companyId}/${bookingId}`).once("value");
        const existingBooking = bookingSnap.val() as Record<string, any> | null;

        if (existingBooking) {
          const meta = (session.metadata ?? {}) as Record<string, string>;
          const commissionFields = commissionFieldsFromMetadata(meta);
          const walletFields = await applyPendingWalletDebit(
            db,
            existingBooking,
            bookingId,
            companyId,
            req.log
          );
          const paidAt = new Date().toISOString();
          const paidBooking = {
            ...existingBooking,
            ...walletFields,
            ...commissionFields,
            Status: "Pending",
            paymentStatus: "paid",
            stripeSessionId: session.id,
            paidAt,
          };

          await Promise.all([
            // Update allbookings with paid status and move to Pending
            db.ref(`allbookings/${companyId}/${bookingId}`).update({
              ...walletFields,
              ...commissionFields,
              Status: "Pending",
              paymentMethod: "card",
              paymentStatus: "paid",
              stripeSessionId: session.id,
              paidAt,
            }),
            // NOW write to pendingjobs to trigger dispatch
            db.ref(`pendingjobs/${companyId}/${bookingId}`).set(paidBooking),
          ]);

          req.log.info({ bookingId, companyId, sessionId: session.id }, "Booking paid — dispatched to pendingjobs");
        } else {
          req.log.warn({ bookingId, companyId }, "Stripe webhook: booking not found in allbookings");
        }
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    req.log.error({ err }, "Stripe webhook error");
    res.status(400).json({ error: err.message });
  }
});

export default stripeRouter;
