import { Router } from "express";
import { getDatabase } from "../lib/firebase";
import { getUncachableResendClient } from "../lib/resend";

const contactRouter = Router();

function generateInquiryId(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INQ${yy}${mm}${dd}${rand}`;
}

contactRouter.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };

  if (!name || !email || !message) {
    res.status(400).json({ error: "name, email, and message are required" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const inquiryId = generateInquiryId();
  const submittedAt = new Date().toISOString();

  const record = {
    inquiryId,
    submittedAt,
    status: "unread",
    name,
    email,
    subject: subject ?? "",
    message,
    source: "website",
  };

  // Write to Firebase — fire-and-forget so email still goes out if DB write is slow
  const db = getDatabase();
  db.ref(`contactInquiries/${inquiryId}`).set(record).catch((err: unknown) =>
    req.log.error({ err }, "Failed to write contact inquiry to Firebase")
  );

  try {
    const { client } = await getUncachableResendClient();

    await client.emails.send({
      from: "BookaWaka Contact Form <onboarding@resend.dev>",
      to: ["info@bookawaka.com"],
      replyTo: email,
      subject: subject ? `[BookaWaka] ${subject}` : `[BookaWaka] New message from ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0a6b6b; margin-bottom: 4px;">New Contact Form Submission</h2>
          <p style="color: #666; margin-top: 0; margin-bottom: 24px;">via BookaWaka website</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #333; width: 80px;">Ref</td>
              <td style="padding: 8px 0; color: #555; font-family: monospace;">${inquiryId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #333;">Name</td>
              <td style="padding: 8px 0; color: #555;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #333;">Email</td>
              <td style="padding: 8px 0; color: #555;"><a href="mailto:${email}" style="color: #0a6b6b;">${email}</a></td>
            </tr>
            ${subject ? `<tr><td style="padding: 8px 0; font-weight: bold; color: #333;">Subject</td><td style="padding: 8px 0; color: #555;">${subject}</td></tr>` : ""}
          </table>
          <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px; border-left: 4px solid #0a6b6b;">
            <p style="margin: 0; color: #333; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="margin-top: 24px; font-size: 12px; color: #999;">Reply directly to this email to respond to ${name}. Firebase ref: contactInquiries/${inquiryId}</p>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err }, "Failed to send contact email");
    res.status(500).json({ error: "Failed to send message. Please try again." });
  }
});

export default contactRouter;
