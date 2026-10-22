import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { hospitalSettings } from "@/lib/db/schema/settings";

const host = process.env.SMTP_HOST || "localhost";
const port = Number(process.env.SMTP_PORT) || 1025;
const secure = process.env.SMTP_SECURE === "true";
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

export const mailer = nodemailer.createTransport({
  host,
  port,
  secure,
  ...(user && pass ? { auth: { user, pass } } : {}),
});

let cachedHtmlTemplate: string | null = null;
let cachedTxtTemplate: string | null = null;

async function getEmailTemplates() {
  if (process.env.NODE_ENV === "production" && cachedHtmlTemplate && cachedTxtTemplate) {
    return { html: cachedHtmlTemplate, txt: cachedTxtTemplate };
  }

  const htmlPath = path.join(process.cwd(), "templates", "emails", "verify-email.html");
  const txtPath = path.join(process.cwd(), "templates", "emails", "verify-email.txt");

  const [html, txt] = await Promise.all([
    fs.readFile(htmlPath, "utf-8"),
    fs.readFile(txtPath, "utf-8"),
  ]);

  if (process.env.NODE_ENV === "production") {
    cachedHtmlTemplate = html;
    cachedTxtTemplate = txt;
  }

  return { html, txt };
}

export async function getHospitalName(): Promise<string> {
  const fallback = process.env.HOSPITAL_NAME || "Carely Hospital";
  try {
    const settings = await db
      .select({ name: hospitalSettings.hospitalName })
      .from(hospitalSettings)
      .where(eq(hospitalSettings.id, 1))
      .limit(1);

    return settings[0]?.name || fallback;
  } catch {
    return fallback;
  }
}

export interface SendVerificationEmailParams {
  to: string;
  name: string;
  verificationUrl: string;
  expiryHours?: number;
}

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTemplate(
  template: string,
  tokens: Record<string, string>,
  escapeFn?: (val: string) => string
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in tokens) {
      return escapeFn ? escapeFn(tokens[key]) : tokens[key];
    }
    return match;
  });
}

export async function sendPatientVerificationEmail({
  to,
  name,
  verificationUrl,
  expiryHours = 24,
}: SendVerificationEmailParams) {
  const hospitalName = await getHospitalName();
  const { html, txt } = await getEmailTemplates();

  const tokens: Record<string, string> = {
    patient_name: name,
    verification_url: verificationUrl,
    expiry_hours: String(expiryHours),
    hospital_name: hospitalName,
  };

  const emailFrom = process.env.SMTP_FROM || `"${hospitalName}" <no-reply@carely.local>`;

  return mailer.sendMail({
    from: emailFrom,
    to,
    subject: `Verify your ${hospitalName} account`,
    text: renderTemplate(txt, tokens),
    html: renderTemplate(html, tokens, escapeHtml),
  });
}
