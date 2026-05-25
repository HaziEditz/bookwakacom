import { Router } from "express";
import { getDatabase } from "../lib/firebase";
import { getUncachableResendClient } from "../lib/resend";

const registerRouter = Router();

function generateRef(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `OB${yy}${mm}${dd}${rand}`;
}

const TYPE_LABELS: Record<string, string> = {
  taxi: "Taxi Company",
  restaurant: "Restaurant / Food Delivery",
  courier: "Courier / Freight",
  rental: "Rental Cars",
  towing: "Towing & Recovery",
};

registerRouter.post("/register", async (req, res) => {
  const {
    businessTypes,
    businessName,
    contactName,
    email,
    phone,
    city,
    country,
    message,
  } = req.body as {
    businessTypes?: string[];
    businessName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    city?: string;
    country?: string;
    message?: string;
  };

  if (!businessTypes?.length || !businessName || !contactName || !email || !phone || !city) {
    res.status(400).json({ error: "All required fields must be filled in" });
    return;
  }

  const typeLabel = businessTypes.map((t) => TYPE_LABELS[t] ?? t).join(", ");
  const serviceType = businessTypes.join(",");
  const refId = generateRef();
  const submittedAt = new Date().toISOString();

  const record = {
    ref: refId,
    submittedAt,
    status: "pending",
    businessName,
    contactName,
    email,
    phone,
    city,
    country: country ?? "New Zealand",
    serviceType,
    businessTypes,
    message: message ?? "",
    source: "website",
  };

  try {
    // Write to both paths — SA portal previously confirmed onboardRequests/ but
    // also mentions registrations/{id}. Writing to both until the canonical path is confirmed.
    const db = getDatabase();
    await Promise.all([
      db.ref(`onboardRequests/${refId}`).set(record),
      db.ref(`registrations/${refId}`).set(record),
    ]);

    req.log.info({ refId, businessName, serviceType }, "Operator registration saved");
  } catch (err: any) {
    req.log.error({ err }, "Failed to write registration to Firebase");
    res.status(500).json({ error: "Failed to save registration. Please try again." });
    return;
  }

  // Send emails fire-and-forget — don't block the response on email
  sendRegistrationEmails({ record, typeLabel, email, businessName }).catch((e) =>
    req.log.error({ e }, "Registration email failed")
  );

  res.json({ success: true, ref: refId });
});

async function sendRegistrationEmails({
  record,
  typeLabel,
  email,
  businessName,
}: {
  record: any;
  typeLabel: string;
  email: string;
  businessName: string;
}) {
  const { client } = await getUncachableResendClient();

  const detailTable = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#0a6b6b;margin-bottom:4px;">New Operator Registration</h2>
      <p style="color:#666;margin-top:0;margin-bottom:24px;">via BookaWaka registration portal</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;width:140px;">Ref</td><td style="padding:8px 0;color:#555;font-family:monospace;">${record.ref}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Business Type</td><td style="padding:8px 0;color:#555;">${typeLabel}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Business Name</td><td style="padding:8px 0;color:#555;">${record.businessName}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Contact Name</td><td style="padding:8px 0;color:#555;">${record.contactName}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Email</td><td style="padding:8px 0;color:#555;">${record.email}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Phone</td><td style="padding:8px 0;color:#555;">${record.phone}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Location</td><td style="padding:8px 0;color:#555;">${record.city}, ${record.country}</td></tr>
        ${record.message ? `<tr><td style="padding:8px 0;font-weight:bold;color:#333;vertical-align:top;">Message</td><td style="padding:8px 0;color:#555;">${record.message}</td></tr>` : ""}
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Submitted</td><td style="padding:8px 0;color:#555;">${new Date(record.submittedAt).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}</td></tr>
      </table>
    </div>
  `;

  await client.emails.send({
    from: "BookaWaka Registrations <onboarding@resend.dev>",
    to: ["info@bookawaka.com"],
    subject: `[New Operator] ${businessName} — ${typeLabel}`,
    html: detailTable,
  });

  await client.emails.send({
    from: "BookaWaka <onboarding@resend.dev>",
    to: [email],
    subject: `We've received your application — ${businessName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#0a6b6b;">Application received!</h2>
        <p>Thanks for registering <strong>${businessName}</strong> as a <strong>${typeLabel}</strong> on the BookaWaka platform. We'll review your application and be in touch within 1–2 business days.</p>
        ${detailTable}
        <p style="color:#666;font-size:13px;margin-top:24px;">Questions? Reply to this email or visit <a href="https://bookawaka.com">bookawaka.com</a>.</p>
      </div>
    `,
  });
}

export default registerRouter;
