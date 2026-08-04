/**
 * Tidy a URL a merchant pasted, without ever rejecting it.
 *
 * Merchants paste links in every shape: no scheme ("www.tiktok.com/@user"),
 * wrapped in invisible characters from a chat app, or carrying a long share
 * query string. This accepts all of them and returns a short, storable form —
 * the blocks JSON lives in a fixed-width `emailContent` column, so trimming
 * tracking params keeps that budget for actual content.
 *
 * Pure and dependency-free, like emailTemplate.ts, so it can be unit-checked
 * on its own. Anything it can't parse is returned untouched: input is never lost.
 */

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "msclkid",                          // ad click ids
  "igshid", "igsh", "mibextid",                                   // Instagram / Facebook share
  "_r", "_t", "_d", "share_app_id", "share_link_id", "tt_from",   // TikTok share
  "si",                                                           // YouTube share
]);

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:", "sms:"]);

// Control chars, DEL, the zero-width range and the BOM — paste artifacts from
// chat apps and docs. Built from a string so the escapes stay readable in source.
const JUNK_CHARS = new RegExp("[\\x00-\\x1F\\x7F\\u200B-\\u200D\\uFEFF]", "g");

export function normalizeUrl(input: string): string {
  const raw = input.replace(JUNK_CHARS, "").trim();
  if (!raw) return "";

  // A bare host like "www.tiktok.com/@user" is what people actually paste.
  const hasScheme =
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) || /^(mailto|tel|sms):/i.test(raw);

  let url: URL;
  try {
    url = new URL(hasScheme ? raw : `https://${raw.replace(/^\/+/, "")}`);
  } catch {
    return raw; // unparseable — keep exactly what they typed
  }

  // Don't rewrite schemes we don't understand; notably this keeps `javascript:`
  // out of an <a href>, which the preview iframe would otherwise execute.
  if (!SAFE_SCHEMES.has(url.protocol)) return raw;

  if (url.protocol === "http:" || url.protocol === "https:") {
    // Only known tracking keys — a link needing ?variant=123 keeps working.
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || key.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }
  }

  return url.toString().replace(/\?$/, "").replace(/#$/, "");
}
