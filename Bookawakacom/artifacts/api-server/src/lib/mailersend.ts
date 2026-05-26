import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

export const MAILERSEND_FROM_EMAIL = "noreply@bookawaka.com";
export const MAILERSEND_FROM_NAME = "BookaWaka";

function getMailerSendClient(): MailerSend {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    throw new Error("MAILERSEND_API_KEY is not configured");
  }
  return new MailerSend({ apiKey });
}

export async function sendMailerSendEmail({
  to,
  subject,
  html,
  fromName = MAILERSEND_FROM_NAME,
}: {
  to: { email: string; name?: string }[];
  subject: string;
  html: string;
  fromName?: string;
}) {
  const mailerSend = getMailerSendClient();
  const sentFrom = new Sender(MAILERSEND_FROM_EMAIL, fromName);
  const recipients = to.map((r) => new Recipient(r.email, r.name ?? r.email));

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject(subject)
    .setHtml(html);

  return mailerSend.email.send(emailParams);
}
