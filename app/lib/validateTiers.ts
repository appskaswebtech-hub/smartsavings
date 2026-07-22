/**
 * Pre-save validation for tiered campaigns (quantity_discount, cart_goal).
 *
 * Shared by the create and edit pages so the rules can't drift between them.
 * Returns the first error message, or null when the tiers are valid.
 *
 * Rules (checked against the *valid* rows only — threshold and discount both > 0,
 * matching the server-side filter in discount.server.ts):
 *   1. At least one valid tier.
 *   2. No two tiers share the same threshold (Buy quantity / min cart value).
 *   3. At most 25 tiers — Shopify allows 25 automatic discounts per store and
 *      each tier becomes one automatic discount.
 */

// Shopify's hard cap on automatic discounts per store. One tier = one discount.
export const MAX_TIERS = 25;

export interface TierRow {
  quantity?: string;
  amount?: string;
  discount: string;
}

export function validateTiers(
  rows: TierRow[],
  thresholdKey: "quantity" | "amount",
  // Human-readable name of the threshold, e.g. "Buy quantity" | "minimum cart value".
  thresholdLabel: string,
): string | null {
  // Numeric comparison, not truthiness: the fields are strings and "0" is truthy.
  const valid = rows.filter((r) => {
    const threshold = parseFloat(r[thresholdKey] ?? "");
    const discount = parseFloat(r.discount);
    return threshold > 0 && discount > 0;
  });

  if (valid.length === 0) {
    return "Add at least one tier with a quantity and discount greater than 0.";
  }

  const seen = new Set<number>();
  for (const r of valid) {
    const threshold = parseFloat(r[thresholdKey] ?? "");
    if (seen.has(threshold)) {
      return `Each tier must have a different ${thresholdLabel} — ${threshold} is used more than once.`;
    }
    seen.add(threshold);
  }

  if (valid.length > MAX_TIERS) {
    return `Shopify allows up to ${MAX_TIERS} automatic discounts. Reduce this campaign to ${MAX_TIERS} tiers or fewer.`;
  }

  return null;
}

export interface CartGoalTierRow {
  requirementType?: string; // amount | quantity | both | either
  amount?: string;
  quantity?: string;
  discount: string;
}

/**
 * Validation for cart-goal tiers, where each tier picks its own requirement type
 * and may gate on an order value, a quantity, or both. Mirrors the per-tier logic
 * in discount.server.ts, including that an "either" tier with both thresholds set
 * produces TWO Shopify discounts (so it counts double against the 25 cap).
 */
export function validateCartGoalTiers(rows: CartGoalTierRow[]): string | null {
  let discountCount = 0;
  let validTiers = 0;

  for (const r of rows) {
    const req = ["amount", "quantity", "both", "either"].includes(r.requirementType ?? "")
      ? (r.requirementType as string)
      : "amount";
    const discount = parseFloat(r.discount);
    if (!(discount > 0)) continue;
    const hasAmount = parseFloat(r.amount ?? "") > 0;
    const hasQty = parseInt(r.quantity ?? "", 10) > 0;

    // Does this tier have the threshold(s) its requirement needs?
    const ok =
      req === "quantity" ? hasQty :
      req === "both" ? hasAmount && hasQty :
      req === "either" ? hasAmount || hasQty :
      hasAmount; // amount
    if (!ok) continue;

    validTiers += 1;
    // "either" with both thresholds present becomes two discounts; everything else is one.
    discountCount += req === "either" && hasAmount && hasQty ? 2 : 1;
  }

  if (validTiers === 0) {
    return "Add at least one tier with a discount and its required minimum(s) filled in.";
  }
  if (discountCount > MAX_TIERS) {
    return `Shopify allows up to ${MAX_TIERS} automatic discounts. This campaign would create ${discountCount} — reduce the number of tiers (note “or” tiers count as two).`;
  }
  return null;
}
