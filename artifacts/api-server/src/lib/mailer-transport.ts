/**
 * Shared Gmail SMTP transport factory — exported so both mailer.ts and
 * finance-report-scheduler.ts can obtain a transport without circular deps.
 */
import nodemailer, { type Transporter } from "nodemailer";

export interface MailerCredentials {
  user?: string | null;
  pass?: string | null;
}

let _transport: Transporter | null = null;
let _transportKey = "";

export function getTransport(
  overrides?: MailerCredentials,
  log?: (msg: string) => void
): Transporter | null {
  const user = ((overrides?.user ?? "").trim() || (process.env.GMAIL_USER ?? "").trim());
  const passRaw = (overrides?.pass ?? "") || (process.env.GMAIL_APP_PASSWORD ?? "");
  const pass = String(passRaw).replace(/\s+/g, "");

  if (!user || !pass) {
    if (log) log("[mailer] Gmail credentials not configured; email skipped");
    return null;
  }

  const key = `${user}:${pass.length}:${pass.slice(-4)}`;
  if (_transport && _transportKey === key) return _transport;

  _transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  _transportKey = key;
  return _transport;
}
