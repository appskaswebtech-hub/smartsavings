/**
 * Discount-code email template — the single source of truth for the email HTML.
 *
 * Pure and dependency-free so it can be imported both server-side (email.server.ts,
 * to actually send) and client-side (the campaign forms, to render a live preview).
 * Keep it free of server-only imports (nodemailer, db, etc.).
 */

/** Optional per-block styling. All optional — unset renders the built-in defaults. */
export interface BlockStyle {
  color?: string;      // text/foreground (hex); for button, the text color
  bgColor?: string;    // block background; for button, the fill
  fontSize?: number;   // px — heading / text / link
  width?: number;      // percent 10–100 — image
  align?: "left" | "center" | "right";
}

/** A single block in the email builder. Discriminated by `type`; styled by BlockStyle. */
export type EmailBlock = BlockStyle & (
  | { id: string; type: "heading"; text?: string }
  | { id: string; type: "text"; text?: string }
  | { id: string; type: "image"; url?: string; alt?: string; link?: string }
  | { id: string; type: "button"; label?: string; url?: string }
  | { id: string; type: "link"; text?: string; url?: string }
  | { id: string; type: "code" }
);

export const EMAIL_BLOCK_TYPES = ["heading", "text", "image", "button", "link", "code"] as const;

export interface EmailContentArgs {
  /** The discount code shown in the code block. */
  code: string;
  /** Human-readable discount, e.g. "20% off" or "Free shipping". */
  discountLabel: string;
  /** Shop domain — used for the store-name footer fallback and the default button link. */
  shop: string;
  /** Block-based content (preferred). When present, the legacy fields below are ignored. */
  blocks?: EmailBlock[] | null;
  heading?: string | null;
  /** Main message. `description` is a legacy alias kept for older callers. */
  body?: string | null;
  description?: string | null;
  /** CTA button; omitted entirely when buttonText is blank. */
  buttonText?: string | null;
  buttonUrl?: string | null;
  footer?: string | null;
}

// Human-readable label for the code email, e.g. "20% off".
export function discountLabel(discountType: string, discountValue: number | null): string {
  if (discountType === "free_shipping") return "Free shipping";
  if (discountType === "percentage") return `${discountValue ?? 0}% off`;
  return `$${discountValue ?? 0} off`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape, then turn newlines into <br> so multi-paragraph body text survives.
function escapeMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

// ── Block-based rendering ───────────────────────────────────────────────────

interface BlockContext {
  code: string;
  discountLabel: string;
  shop: string;
}

let _blockIdSeq = 0;
/** A fresh block of the given type with sensible defaults, for the editor. */
export function newBlock(type: EmailBlock["type"]): EmailBlock {
  const id = `b${Date.now().toString(36)}${(_blockIdSeq++).toString(36)}`;
  switch (type) {
    case "heading": return { id, type, text: "Here's your discount code" };
    case "text": return { id, type, text: "Thanks for signing up! Use the code below at checkout." };
    case "image": return { id, type, url: "", alt: "", link: "" };
    case "button": return { id, type, label: "Shop now", url: "" };
    case "link": return { id, type, text: "Visit our store", url: "" };
    case "code": return { id, type };
  }
}

/** Migrate legacy fixed-field content into blocks so old campaigns open in the editor. */
export function legacyToBlocks(args: {
  heading?: string | null;
  body?: string | null;
  description?: string | null;
  buttonText?: string | null;
  buttonUrl?: string | null;
  footer?: string | null;
}): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  const id = () => `b${Date.now().toString(36)}${(_blockIdSeq++).toString(36)}`;
  blocks.push({ id: id(), type: "heading", text: args.heading?.trim() || "Here's your discount code" });
  blocks.push({
    id: id(), type: "text",
    text: (args.body ?? args.description)?.trim() ||
      "Thanks for signing up! Use the code below at checkout to claim your discount.",
  });
  blocks.push({ id: id(), type: "code" });
  if (args.buttonText?.trim()) {
    blocks.push({ id: id(), type: "button", label: args.buttonText.trim(), url: args.buttonUrl?.trim() || "" });
  }
  if (args.footer?.trim()) {
    blocks.push({ id: id(), type: "text", text: args.footer.trim() });
  }
  return blocks;
}

// Only accept hex colors into style attributes — blocks anything that could
// break out of the inline style. Falls back to the default when invalid/unset.
function cssColor(v: string | undefined, fallback: string): string {
  return v && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : fallback;
}
function cssNum(v: number | undefined, fallback: number, min: number, max: number): number {
  return typeof v === "number" && !isNaN(v) ? Math.min(max, Math.max(min, v)) : fallback;
}
function cssAlign(v: BlockStyle["align"]): "left" | "center" | "right" {
  return v === "center" || v === "right" ? v : "left";
}

function renderBlock(block: EmailBlock, ctx: BlockContext): string {
  const align = cssAlign(block.align);
  // td padding + optional background + alignment, shared by all block cells.
  const cell = (inner: string, pad = "16px 32px") => {
    const bg = block.bgColor && /^#[0-9a-fA-F]{3,8}$/.test(block.bgColor.trim())
      ? `background:${block.bgColor.trim()};` : "";
    return `<tr><td style="padding:${pad};${bg}text-align:${align};">${inner}</td></tr>`;
  };

  switch (block.type) {
    case "heading":
      return cell(`<h1 style="margin:0;font-size:${cssNum(block.fontSize, 22, 8, 72)}px;color:${cssColor(block.color, "#1a1a1a")};">${escapeHtml(block.text?.trim() || "")}</h1>`);
    case "text":
      return cell(`<p style="margin:0;font-size:${cssNum(block.fontSize, 15, 8, 48)}px;line-height:1.5;color:${cssColor(block.color, "#555555")};">${escapeMultiline(block.text?.trim() || "")}</p>`);
    case "image": {
      const url = block.url?.trim();
      if (!url) return "";
      const w = cssNum(block.width, 100, 10, 100);
      // margin auto only centers a below-full-width image.
      const margin = align === "center" ? "margin:0 auto;" : align === "right" ? "margin-left:auto;" : "";
      const img = `<img src="${escapeHtml(url)}" alt="${escapeHtml(block.alt?.trim() || "")}" style="display:block;width:${w}%;max-width:100%;border:0;${margin}" />`;
      const link = block.link?.trim();
      const inner = link ? `<a href="${escapeHtml(link)}" style="text-decoration:none;">${img}</a>` : img;
      return cell(inner, "16px 0");
    }
    case "button": {
      const label = block.label?.trim();
      if (!label) return "";
      const url = escapeHtml(block.url?.trim() || `https://${ctx.shop}`);
      return cell(`<a href="${url}" style="display:inline-block;background:${cssColor(block.bgColor, "#1a1a1a")};color:${cssColor(block.color, "#ffffff")};text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;">${escapeHtml(label)}</a>`);
    }
    case "link": {
      const text = block.text?.trim();
      if (!text) return "";
      const url = escapeHtml(block.url?.trim() || `https://${ctx.shop}`);
      return cell(`<a href="${url}" style="color:${cssColor(block.color, "#1a1a1a")};text-decoration:underline;font-size:${cssNum(block.fontSize, 15, 8, 48)}px;">${escapeHtml(text)}</a>`);
    }
    case "code":
      return cell(
        `<div style="border:2px dashed #1a1a1a;border-radius:10px;text-align:center;padding:20px;">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:6px;">${escapeHtml(ctx.discountLabel)}</div>
          <div style="font-size:28px;font-weight:800;letter-spacing:2px;color:#1a1a1a;">${escapeHtml(ctx.code)}</div>
        </div>`
      );
  }
}

function wrapCard(rowsHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            ${rowsHtml}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function buildEmailHtml(args: EmailContentArgs): string {
  // Block-based content takes precedence; legacy fixed fields are the fallback
  // path for campaigns saved before the builder existed (rendered unchanged).
  if (args.blocks && args.blocks.length > 0) {
    const ctx: BlockContext = { code: args.code, discountLabel: args.discountLabel, shop: args.shop };
    const rows = args.blocks.map((b) => renderBlock(b, ctx)).join("\n            ");
    return wrapCard(rows);
  }

  const heading = escapeHtml(args.heading?.trim() || "Here's your discount code");
  const body = escapeMultiline(
    (args.body ?? args.description)?.trim() ||
      "Thanks for signing up! Use the code below at checkout to claim your discount."
  );
  const code = escapeHtml(args.code);
  const discountLabelText = escapeHtml(args.discountLabel);
  const storeName = escapeHtml(args.shop.replace(/\.myshopify\.com$/, ""));

  const buttonText = args.buttonText?.trim();
  // Fall back to the storefront home page when no explicit link is given.
  const buttonUrl = escapeHtml(args.buttonUrl?.trim() || `https://${args.shop}`);
  const buttonHtml = buttonText
    ? `<tr>
              <td style="padding:8px 32px 0 32px;">
                <a href="${buttonUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;">${escapeHtml(buttonText)}</a>
              </td>
            </tr>`
    : "";

  const footer = args.footer?.trim();
  const footerHtml = footer
    ? escapeMultiline(footer)
    : `Enter this code at checkout to redeem your offer at ${storeName}.`;

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
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.5;color:#555;">${body}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <div style="border:2px dashed #1a1a1a;border-radius:10px;text-align:center;padding:20px;">
                  <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:6px;">${discountLabelText}</div>
                  <div style="font-size:28px;font-weight:800;letter-spacing:2px;color:#1a1a1a;">${code}</div>
                </div>
              </td>
            </tr>
            ${buttonHtml}
            <tr>
              <td style="padding:24px 32px 32px 32px;">
                <p style="margin:0;font-size:13px;color:#999;">${footerHtml}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
