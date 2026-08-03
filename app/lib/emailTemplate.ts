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
  /** @deprecated Legacy percent image width. Still rendered when `widthPx` is unset. */
  width?: number;
  align?: "left" | "center" | "right";
  // Padding around the block, px. Each side falls back to defaultPadding().
  padTop?: number;
  padRight?: number;
  padBottom?: number;
  padLeft?: number;
}

/** A single block in the email builder. Discriminated by `type`; styled by BlockStyle. */
export type EmailBlock = BlockStyle & (
  | { id: string; type: "heading"; text?: string }
  | { id: string; type: "text"; text?: string }
  | {
      id: string; type: "image"; url?: string; alt?: string; link?: string;
      inline?: boolean;   // render side by side with adjacent inline images
      widthPx?: number;   // px width (falls back to the legacy `width` percent)
      heightPx?: number;  // px height; omitted when unset so the ratio is kept
      showCaption?: boolean; // render `alt` as a visible caption under the image
      gap?: number;       // px space between images in the row
    }
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

/** Padding a block uses when the merchant hasn't overridden a side: [top, right, bottom, left]. */
export type Padding = [number, number, number, number];
export function defaultPadding(block: EmailBlock): Padding {
  // Full-width images bleed to the card edge; a side-by-side row is inset like text.
  return block.type === "image" && !block.inline ? [16, 0, 16, 0] : [16, 32, 16, 32];
}

// The `padding` shorthand for a block's cell, each side falling back to `def`.
function cellPadding(block: EmailBlock, def: Padding): string {
  const [t, r, b, l] = def;
  return `${cssNum(block.padTop, t, 0, 200)}px ${cssNum(block.padRight, r, 0, 200)}px ` +
    `${cssNum(block.padBottom, b, 0, 200)}px ${cssNum(block.padLeft, l, 0, 200)}px`;
}

// Width/height for an <img>: explicit px wins, then the legacy percent width,
// then full-bleed. Height is omitted entirely unless set, so images keep their
// aspect ratio by default. Returns the CSS and the HTML attributes, which
// Outlook honours more reliably than the inline style.
function imgSize(block: Extract<EmailBlock, { type: "image" }>, pxFallback?: number): { css: string; attrs: string } {
  const px = block.widthPx ?? pxFallback;
  const w = px != null
    ? { css: `width:${cssNum(px, 32, 8, 1000)}px;`, attrs: ` width="${cssNum(px, 32, 8, 1000)}"` }
    : { css: `width:${cssNum(block.width, 100, 10, 100)}%;`, attrs: "" };
  if (block.heightPx == null) return w;
  const h = cssNum(block.heightPx, 32, 8, 1000);
  return { css: `${w.css}height:${h}px;`, attrs: `${w.attrs} height="${h}"` };
}

// `alt` is only surfaced by mail clients when the image fails to load, so a
// merchant who wants words under the image gets them rendered for real.
function captionHtml(block: Extract<EmailBlock, { type: "image" }>): string {
  const text = block.alt?.trim();
  if (!block.showCaption || !text) return "";
  return `<div style="font-size:13px;line-height:1.4;color:#888888;padding-top:6px;">${escapeHtml(text)}</div>`;
}

function renderBlock(block: EmailBlock, ctx: BlockContext): string {
  const align = cssAlign(block.align);
  // td padding + optional background + alignment, shared by all block cells.
  const cell = (inner: string, def: Padding = [16, 32, 16, 32]) => {
    const bg = block.bgColor && /^#[0-9a-fA-F]{3,8}$/.test(block.bgColor.trim())
      ? `background:${block.bgColor.trim()};` : "";
    return `<tr><td style="padding:${cellPadding(block, def)};${bg}text-align:${align};">${inner}</td></tr>`;
  };

  switch (block.type) {
    case "heading":
      return cell(`<h1 style="margin:0;font-size:${cssNum(block.fontSize, 22, 8, 72)}px;color:${cssColor(block.color, "#1a1a1a")};">${escapeHtml(block.text?.trim() || "")}</h1>`);
    case "text":
      return cell(`<p style="margin:0;font-size:${cssNum(block.fontSize, 15, 8, 48)}px;line-height:1.5;color:${cssColor(block.color, "#555555")};">${escapeMultiline(block.text?.trim() || "")}</p>`);
    case "image": {
      const url = block.url?.trim();
      if (!url) return "";
      const size = imgSize(block);
      // margin auto only centers a below-full-width image.
      const margin = align === "center" ? "margin:0 auto;" : align === "right" ? "margin-left:auto;" : "";
      const img = `<img src="${escapeHtml(url)}" alt="${escapeHtml(block.alt?.trim() || "")}"${size.attrs} style="display:block;${size.css}max-width:100%;border:0;${margin}" />`;
      const link = block.link?.trim();
      const inner = link ? `<a href="${escapeHtml(link)}" style="text-decoration:none;">${img}</a>` : img;
      // Caption sits outside the link — it describes the image, it isn't part of the target.
      return cell(`${inner}${captionHtml(block)}`, [16, 0, 16, 0]);
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

type ImageBlock = Extract<EmailBlock, { type: "image" }>;

/** True for an image block that should share a row with its inline neighbours. */
export function isInlineImage(block: EmailBlock | undefined): block is ImageBlock {
  return !!block && block.type === "image" && block.inline === true;
}

// A run of consecutive inline image blocks, rendered as one row. Alignment,
// background and gap come from the first block that actually has an image — a
// half-configured block with no URL yet is passed over rather than splitting
// the row. A nested table is used rather than inline-block anchors because
// Outlook's Word engine ignores display:inline-block, and table cells avoid
// the inline-whitespace gap.
function renderInlineImageRow(group: ImageBlock[]): string {
  const shown = group.filter((b) => b.url?.trim());
  if (shown.length === 0) return "";
  const lead = shown[0];
  const align = cssAlign(lead.align);
  const bg = lead.bgColor && /^#[0-9a-fA-F]{3,8}$/.test(lead.bgColor.trim())
    ? `background:${lead.bgColor.trim()};` : "";
  const pad = cssNum(lead.gap, 12, 0, 64) / 2;

  const cells = shown.map((block) => {
    // 32px is the default icon size for a side-by-side image.
    const size = imgSize(block, 32);
    // A caption can be wider than the icon it sits under, which widens the
    // cell — center both so the icon doesn't end up off to one side.
    const caption = captionHtml(block);
    const img = `<img src="${escapeHtml(block.url!.trim())}" alt="${escapeHtml(block.alt?.trim() || "")}"${size.attrs} style="display:block;${size.css}max-width:100%;border:0;${caption ? "margin:0 auto;" : ""}" />`;
    const link = block.link?.trim();
    const inner = link ? `<a href="${escapeHtml(link)}" style="text-decoration:none;">${img}</a>` : img;
    return `<td style="padding:0 ${pad}px;${caption ? "text-align:center;" : ""}">${inner}${caption}</td>`;
  }).join("");

  return `<tr><td style="padding:${cellPadding(lead, [16, 32, 16, 32])};${bg}text-align:${align};"><table role="presentation" align="${align}" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>${cells}</tr></table></td></tr>`;
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
    const out: string[] = [];
    // Walk rather than map: a run of consecutive inline image blocks collapses
    // into a single row so the images sit side by side.
    for (let i = 0; i < args.blocks.length; i++) {
      const block = args.blocks[i];
      if (isInlineImage(block)) {
        const group: ImageBlock[] = [];
        while (i < args.blocks.length && isInlineImage(args.blocks[i])) {
          group.push(args.blocks[i] as ImageBlock);
          i++;
        }
        i--; // the for-loop's i++ consumes the block that ended the run
        out.push(renderInlineImageRow(group));
      } else {
        out.push(renderBlock(block, ctx));
      }
    }
    return wrapCard(out.join("\n            "));
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
