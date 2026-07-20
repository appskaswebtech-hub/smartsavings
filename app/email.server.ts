/**
 * Gmail SMTP email helper (nodemailer).
 *
 * Sends the discount code captured through the storefront email popup.
 * Configured via environment variables:
 *   GMAIL_USER          — the Gmail address that sends the mail
 *   GMAIL_APP_PASSWORD  — a Google App Password (16 chars, spaces are ignored)
 *   GMAIL_SENDER_NAME   — display name for the sender (optional)
 *
 * Never throws — returns { success, error? } so callers can degrade gracefully.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface SendDiscountCodeArgs {
  to: string;
  code: string;
  campaignName: string;
  /** Human-readable discount, e.g. "20% off" or "Free shipping" */
  discountLabel: string;
  /** Shop domain, used for a friendly signature */
  shop: string;
  /** Optional overrides from the campaign config */
  heading?: string | null;
  description?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(args: SendDiscountCodeArgs): string {
  const heading = escapeHtml(args.heading?.trim() || "Here's your discount code");
  const description = escapeHtml(
    args.description?.trim() ||
      "Thanks for signing up! Use the code below at checkout to claim your discount."
  );
  const code = escapeHtml(args.code);
  const discountLabel = escapeHtml(args.discountLabel);
  const storeName = escapeHtml(args.shop.replace(/\.myshopify\.com$/, ""));

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0 0 12px 0;font-size:22px;color:#1a1a1a;">${heading}</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.5;color:#555;">${description}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <div style="border:2px dashed #1a1a1a;border-radius:10px;text-align:center;padding:20px;">
                  <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:6px;">${discountLabel}</div>
                  <div style="font-size:28px;font-weight:800;letter-spacing:2px;color:#1a1a1a;">${code}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px 32px;">
                <p style="margin:0;font-size:13px;color:#999;">Enter this code at checkout to redeem your offer at ${storeName}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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

  const senderName = process.env.GMAIL_SENDER_NAME || "Store Discounts";
  const senderEmail = process.env.GMAIL_USER as string;

  try {
    await tx.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: args.to,
      subject: `Your discount code for ${args.campaignName}`,
      html: buildHtml(args),
    });
    return { success: true };
  } catch (error) {
    console.error("[email] send error:", error);
    return { success: false, error: "Could not send the email. Please try again." };
  }
}
