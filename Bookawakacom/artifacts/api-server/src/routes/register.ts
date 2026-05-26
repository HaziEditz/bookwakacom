import { Router } from "express";
import { getDatabase, getAuth } from "../lib/firebase";
import { sendMailerSendEmail } from "../lib/mailersend";

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
  taxi: "Taxi",
  food: "Food Delivery",
  freight: "Freight",
  towing: "Towing",
  rental: "Rental",
};

registerRouter.post("/register", async (req, res) => {
  const {
    serviceTypes,
    businessTypes,
    businessName,
    contactName,
    email,
    phone,
    city,
    country,
    password,
  } = req.body as {
    serviceTypes?: string[];
    businessTypes?: string[];
    businessName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    city?: string;
    country?: string;
    password?: string;
  };

  const types = serviceTypes ?? businessTypes ?? [];

  if (!types.length || !businessName || !contactName || !email || !phone || !city || !password) {
    res.status(400).json({ error: "All required fields must be filled in" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const typeLabel = types.map((t) => TYPE_LABELS[t] ?? t).join(", ");
  const serviceType = types.join(",");
  const refId = generateRef();
  const submittedAt = new Date().toISOString();

  let authUid: string | undefined;

  try {
    const auth = getAuth();
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: contactName,
    });
    authUid = userRecord.uid;
  } catch (err: unknown) {
    const authErr = err as {
      code?: string;
      message?: string;
      errorInfo?: { code?: string; message?: string };
    };
    const code = authErr?.code ?? authErr?.errorInfo?.code ?? "unknown";
    const message = authErr?.message ?? authErr?.errorInfo?.message ?? String(err);

    req.log.error(
      { code, message, email, err },
      `Firebase Auth user creation failed: ${code} — ${message}`,
    );

    if (code === "auth/email-already-exists") {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    if (code === "auth/invalid-email") {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }
    if (code === "auth/weak-password") {
      res.status(400).json({ error: "Password is too weak. Use at least 6 characters." });
      return;
    }
    res.status(500).json({ error: "Failed to create account. Please try again." });
    return;
  }

  const record = {
    ref: refId,
    submittedAt,
    status: "pending",
    businessName,
    companyName: businessName,
    contactName,
    ownerName: contactName,
    email,
    phone,
    city,
    country: country ?? "New Zealand",
    serviceType,
    serviceTypes: types,
    businessTypes: types,
    authUid,
    source: "website",
  };

  try {
    const db = getDatabase();
    await Promise.all([
      db.ref(`onboardRequests/${refId}`).set(record),
      db.ref(`registrations/${refId}`).set(record),
    ]);

    req.log.info({ refId, businessName, serviceType, authUid }, "Operator registration saved");
  } catch (err: any) {
    req.log.error({ err }, "Failed to write registration to Firebase");
    try {
      if (authUid) await getAuth().deleteUser(authUid);
    } catch (rollbackErr) {
      req.log.error({ rollbackErr }, "Failed to roll back auth user after RTDB error");
    }
    res.status(500).json({ error: "Failed to save registration. Please try again." });
    return;
  }

  sendRegistrationEmails({ record, typeLabel, email, businessName, contactName }).catch((e) =>
    req.log.error({ e }, "Registration email failed")
  );

  res.json({ success: true, ref: refId });
});

async function sendRegistrationEmails({
  record,
  typeLabel,
  email,
  businessName,
  contactName,
}: {
  record: Record<string, unknown>;
  typeLabel: string;
  email: string;
  businessName: string;
  contactName: string;
}) {
  const detailTable = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#0a6b6b;margin-bottom:4px;">New Operator Registration</h2>
      <p style="color:#666;margin-top:0;margin-bottom:24px;">via BookaWaka registration portal</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;width:140px;">Ref</td><td style="padding:8px 0;color:#555;font-family:monospace;">${record.ref}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Service Types</td><td style="padding:8px 0;color:#555;">${typeLabel}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Company Name</td><td style="padding:8px 0;color:#555;">${record.businessName}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Owner Name</td><td style="padding:8px 0;color:#555;">${record.contactName}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Email</td><td style="padding:8px 0;color:#555;">${record.email}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Phone</td><td style="padding:8px 0;color:#555;">${record.phone}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Location</td><td style="padding:8px 0;color:#555;">${record.city}, ${record.country}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Submitted</td><td style="padding:8px 0;color:#555;">${new Date(record.submittedAt as string).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}</td></tr>
      </table>
    </div>
  `;

  await sendMailerSendEmail({
    to: [{ email: "info@bookawaka.com", name: "BookaWaka Admin" }],
    subject: `[New Operator] ${businessName} — ${typeLabel}`,
    html: detailTable,
    fromName: "BookaWaka Registrations",
  });

  await sendMailerSendEmail({
    to: [{ email, name: contactName }],
    subject: `Your BookaWaka application has been received — ${businessName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#0a6b6b;">Application submitted</h2>
        <p>Hi ${contactName},</p>
        <p>Thank you for registering <strong>${businessName}</strong> on the BookaWaka platform.</p>
        <p><strong>Your application has been submitted. We will review and approve your account within 24 hours.</strong></p>
        <p>Your reference number is <strong style="font-family:monospace;">${record.ref}</strong>. Service types: ${typeLabel}.</p>
        <p style="color:#666;font-size:13px;margin-top:24px;">Questions? Reply to this email or visit <a href="https://bookawaka.com">bookawaka.com</a>.</p>
      </div>
    `,
  });
}

export default registerRouter;
