/**
 * Gmail SMTP email helper (nodemailer).
 *
 * Sends the discount code captured through the storefront email popup.
 * Configured via environment variables:
 *   GMAIL_USER          — the Gmail address that sends the mail
 *   GMAIL_APP_PASSWORD  — a Google App Password (16 chars, spaces are ignored)
 *   GMAIL_SENDER_NAME   — last-resort display name; callers normally pass the
 *                         merchant's own name or their Shopify store name
 *
 * Never throws — returns { success, error? } so callers can degrade gracefully.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { buildEmailHtml, type EmailContentArgs } from "./lib/emailTemplate";

interface SendDiscountCodeArgs extends EmailContentArgs {
  to: string;
  /** Used only in the subject line. */
  campaignName: string;
  /**
   * Display name for the From header — the merchant's own name, or their
   * Shopify store name. Falls back to GMAIL_SENDER_NAME when unset.
   * The address itself is always GMAIL_USER: Gmail rewrites any other sender
   * unless it is a verified "Send mail as" alias on that account.
   */
  senderName?: string;
}

// This name comes from a merchant or from Shopify and goes straight into a mail
// header, so strip quotes and CR/LF — a newline would let extra headers be
// injected into the message. Capped at RFC 5322's practical line length.
function headerSafe(name: string | undefined): string {
  return (name ?? "").replace(/[\r\n"]/g, "").trim().slice(0, 78);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER;
  // App passwords are shown as "xxxx xxxx xxxx xxxx" — strip spaces before use.
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!user || !pass) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendDiscountCodeEmail(
  args: SendDiscountCodeArgs
): Promise<{ success: boolean; error?: string }> {
  const tx = getTransporter();
  if (!tx) {
    console.error("[email] Missing GMAIL_USER or GMAIL_APP_PASSWORD env vars");
    return { success: false, error: "Email service is not configured." };
  }

  // Merchant override → shop name (both arrive via args) → env → generic.
  const senderName =
    headerSafe(args.senderName) || process.env.GMAIL_SENDER_NAME || "Store Discounts";
  const senderEmail = process.env.GMAIL_USER as string;

  try {
    await tx.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: args.to,
      subject: `Your discount code for ${args.campaignName}`,
      html: buildEmailHtml(args),
    });
    return { success: true };
  } catch (error) {
    console.error("[email] send error:", error);
    return { success: false, error: "Could not send the email. Please try again." };
  }
}
