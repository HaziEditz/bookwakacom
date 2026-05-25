import { Router } from "express";
import { getDatabase } from "../lib/firebase";
import { getUncachableResendClient } from "../lib/resend";

const towRouter = Router();

function generateRefId(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TOW${yy}${mm}${dd}${rand}`;
}

towRouter.post("/tow", async (req, res) => {
  const { name, phone, email, location, destination, notes } = req.body as {
    name?: string;
    phone?: string;
    email?: string;
    location?: string;
    destination?: string;
    notes?: string;
  };

  if (!name || !phone || !location) {
    res.status(400).json({ ok: false, error: "name, phone, and location are required" });
    return;
  }

  const refId = generateRefId();
  const createdAt = new Date().toISOString();

  const record = {
    refId,
    createdAt,
    status: "pending",
    name,
    phone,
    email: email ?? "",
    location,
    destination: destination ?? "",
    notes: notes ?? "",
  };

  try {
    const db = getDatabase();
    await db.ref(`towRequests/${refId}`).set(record);

    req.log.info({ refId, name, phone }, "Tow request created");

    sendTowEmail({ record }).catch((e) =>
      req.log.error({ e }, "Failed to send tow request email")
    );

    res.json({ ok: true, refId, createdAt });
  } catch (err: any) {
    req.log.error({ err }, "POST /tow error");
    res.status(500).json({ ok: false, error: err.message });
  }
});

towRouter.get("/tow/:refId", async (req, res) => {
  const { refId } = req.params;

  if (!refId || refId.length < 5) {
    res.status(400).json({ ok: false, error: "Invalid job ID" });
    return;
  }

  try {
    const db = getDatabase();
    const snap = await db.ref(`towRequests/${refId}`).once("value");
    const record = snap.val();

    if (!record) {
      res.status(404).json({ ok: false, error: "Job not found. Check the ID and try again." });
      return;
    }

    res.json({ ok: true, ...record });
  } catch (err: any) {
    req.log.error({ err }, "GET /tow/:refId error");
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function sendTowEmail({ record }: { record: any }) {
  const { client } = await getUncachableResendClient();

  await client.emails.send({
    from: "BookaWaka Tow Requests <onboarding@resend.dev>",
    to: ["info@bookawaka.com"],
    subject: `[Tow Request] ${record.name} — ${record.location}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#0a6b6b;margin-bottom:4px;">New Tow Request</h2>
        <p style="color:#666;margin-top:0;margin-bottom:24px;">via BookaWaka tow portal</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:bold;color:#333;width:130px;">Job ID</td><td style="padding:8px 0;color:#555;font-family:monospace;">${record.refId}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Name</td><td style="padding:8px 0;color:#555;">${record.name}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Phone</td><td style="padding:8px 0;color:#555;">${record.phone}</td></tr>
          ${record.email ? `<tr><td style="padding:8px 0;font-weight:bold;color:#333;">Email</td><td style="padding:8px 0;color:#555;">${record.email}</td></tr>` : ""}
          <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Vehicle Location</td><td style="padding:8px 0;color:#555;">${record.location}</td></tr>
          ${record.destination ? `<tr><td style="padding:8px 0;font-weight:bold;color:#333;">Tow Destination</td><td style="padding:8px 0;color:#555;">${record.destination}</td></tr>` : ""}
          ${record.notes ? `<tr><td style="padding:8px 0;font-weight:bold;color:#333;">Details</td><td style="padding:8px 0;color:#555;">${record.notes}</td></tr>` : ""}
          <tr><td style="padding:8px 0;font-weight:bold;color:#333;">Submitted</td><td style="padding:8px 0;color:#555;">${new Date(record.createdAt).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}</td></tr>
        </table>
        <p style="margin-top:24px;font-size:12px;color:#999;">Update the job status in Firebase under towRequests/${record.refId}/status</p>
      </div>
    `,
  });
}

export default towRouter;
