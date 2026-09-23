// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/**
 * Prices each Shipping protection fee line at either a percentage of the items
 * that campaign protects or a flat amount per order, on every cart update. Only
 * fee lines are touched; protected products keep their own prices.
 *
 * It uses lineExpand, not lineUpdate: lineUpdate (price override) only runs on
 * Shopify Plus, while expand operations run on every plan. A fee line is
 * expanded into one hidden "coverage" component whose fixedPricePerUnit is the
 * fee — and an expanded line's price is the sum of its components' prices.
 *
 * Config (CartTransform metafield $app:smartsavings/shipping_protection) holds
 * every active campaign, each covering different products:
 *   { campaigns: [{ feeProductId, componentVariantId, pricingType, percentage,
 *                   fixedAmount, appliesTo, productIds }] }
 * A single campaign object (the shape before multi-campaign support) still works.
 * fixedAmount is in the shop currency and converted with presentmentCurrencyRate.
 *
 * Costs are pre-discount here: cart transforms run before discounts apply.
 *
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  /** @type {any} */
  const config = input.cartTransform?.metafield?.jsonValue;
  /** @type {any[]} */
  const campaigns = (Array.isArray(config?.campaigns) ? config.campaigns : config ? [config] : []).filter(
    (campaign) => campaign?.feeProductId && campaign?.componentVariantId
  );
  if (campaigns.length === 0) return NO_CHANGES;

  const productOf = (/** @type {any} */ line) =>
    line.merchandise.__typename === "ProductVariant" ? line.merchandise.product.id : null;
  // Any campaign's fee line is a charge, not merchandise to protect.
  const feeProductIds = new Set(campaigns.map((campaign) => campaign.feeProductId));
  const presentmentRate = Number(input.presentmentCurrencyRate) || 1;

  const operations = [];
  for (const campaign of campaigns) {
    const fixed = campaign.pricingType === "fixed_amount";
    const amount = fixed ? Number(campaign.fixedAmount) : Number(campaign.percentage);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const feeLines = input.cart.lines.filter((line) => productOf(line) === campaign.feeProductId);
    if (feeLines.length === 0) continue;

    const protectAll = campaign.appliesTo === "all";
    const protectedIds = new Set(Array.isArray(campaign.productIds) ? campaign.productIds : []);
    const protectedValue = input.cart.lines
      .filter((line) => {
        const productId = productOf(line);
        return !feeProductIds.has(productId) && (protectAll || protectedIds.has(productId));
      })
      .reduce((sum, line) => sum + parseFloat(line.cost.subtotalAmount.amount), 0);

    // Nothing left to protect: charge nothing. The widgets remove the orphaned
    // line where they can, but non-Plus checkouts can't run app code — pricing it
    // at 0 guarantees a shopper never pays protection for an empty cart (a fixed
    // fee would otherwise fall back to the fee product's own price).
    const fee =
      protectedValue <= 0
        ? 0
        : fixed
          ? Math.round(amount * presentmentRate * 100) / 100
          : Math.round(protectedValue * amount) / 100;

    for (const line of feeLines) {
      operations.push({
        lineExpand: {
          cartLineId: line.id,
          expandedCartItems: [
            {
              merchandiseId: campaign.componentVariantId,
              quantity: 1,
              price: {
                adjustment: {
                  // Per unit of the fee line, so a quantity above 1 doesn't multiply the fee.
                  fixedPricePerUnit: { amount: (fee / line.quantity).toFixed(2) },
                },
              },
            },
          ],
        },
      });
    }
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}
