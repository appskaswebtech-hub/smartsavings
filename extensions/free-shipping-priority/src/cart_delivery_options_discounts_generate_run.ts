import {
  DeliveryDiscountSelectionStrategy,
  DiscountClass,
  DeliveryInput,
  CartDeliveryOptionsDiscountsGenerateRunResult,
} from "../generated/api";

/**
 * Free shipping logic:
 *
 * 1. Pure specific-products cart
 *    -> specific subtotal must meet specific threshold (minimumAmount)
 *    -> message: "Free shipping on qualifying products"
 *
 * 2. Mixed cart (specific + non-specific products)
 *    -> ONLY the HIGHEST threshold applies (Math.max of minimumAmount vs allProductsThreshold)
 *    -> cart subtotal must meet highest threshold
 *    -> message: "Free shipping on your order"
 *
 * 3. No specific products in cart
 *    -> no discount from this function
 *
 * IMPORTANT:
 * - SelectionStrategy.First prevents stacking with other shipping discount functions
 * - allProductsThreshold should be set in metafield config for mixed cart scenarios
 *
 * Config comes from a metafield on the discount:
 *   namespace: "$app:freeshipping"
 *   key: "config"
 *   value (JSON): {
 *     "productIds": ["7891234567890", "7891234567891"],
 *     "minimumAmount": 2000,
 *     "allProductsThreshold": 3500
 *   }
 */

interface FreeShippingConfig {
  productIds: string[];
  minimumAmount: number;
  allProductsThreshold?: number;
}

function isValidConfig(x: any): x is FreeShippingConfig {
  return (
    x &&
    Array.isArray(x.productIds) &&
    x.productIds.every((id: any) => typeof id === "string") &&
    typeof x.minimumAmount === "number" &&
    x.minimumAmount >= 0
  );
}

// Convert gid://shopify/Product/12345 -> 12345
function numericId(gid: string): string {
  const m = gid.match(/\/(\d+)$/);
  return m ? m[1] : gid;
}

export function cartDeliveryOptionsDiscountsGenerateRun(
  input: DeliveryInput,
): CartDeliveryOptionsDiscountsGenerateRunResult {

  // Must be a shipping discount
  const hasShipping = input.discount.discountClasses.includes(
    DiscountClass.Shipping,
  );

  if (!hasShipping) {
    return { operations: [] };
  }

  // Must have at least one delivery group
  const firstGroup = input.cart.deliveryGroups[0];

  if (!firstGroup) {
    return { operations: [] };
  }

  // Read and validate metafield config
  const rawConfig = input.discount.metafield?.jsonValue;

  if (!isValidConfig(rawConfig)) {
    return { operations: [] };
  }

  const {
    productIds,
    minimumAmount,
    allProductsThreshold = 0,
  } = rawConfig;

  const allowedIds = new Set(productIds);

  let hasSpecific = false;
  let hasNonSpecific = false;

  let specificSubtotal = 0;
  let cartSubtotal = 0;

  // Analyze cart lines
  for (const line of input.cart.lines) {

    const merch = line.merchandise;

    // Non-product items (e.g. gift cards) count as non-specific
    if (merch.__typename !== "ProductVariant") {
      hasNonSpecific = true;
      continue;
    }

    const pid = numericId(merch.product.id);
    const lineSubtotal = parseFloat(line.cost.subtotalAmount.amount);

    cartSubtotal += lineSubtotal;

    if (allowedIds.has(pid)) {
      hasSpecific = true;
      specificSubtotal += lineSubtotal;
    } else {
      hasNonSpecific = true;
    }
  }

  // Empty cart — nothing to discount
  if (input.cart.lines.length === 0) {
    return { operations: [] };
  }

  let discountMessage = "Free shipping";

  /**
   * PURE SPECIFIC CART
   * All items are from the campaign product list.
   * Only the specific threshold (minimumAmount) applies.
   */
  if (hasSpecific && !hasNonSpecific) {

    if (specificSubtotal < minimumAmount) {
      return { operations: [] };
    }

    discountMessage = "Free shipping on qualifying products";

  }

  /**
   * MIXED CART
   * Cart contains both specific and non-specific products.
   * The HIGHEST threshold governs — all-products threshold wins
   * when it is greater than the specific-products threshold.
   * The entire cart subtotal must satisfy the highest threshold.
   */
  else if (hasSpecific && hasNonSpecific) {

    const highestThreshold = Math.max(minimumAmount, allProductsThreshold);

    if (cartSubtotal < highestThreshold) {
      return { operations: [] };
    }

    discountMessage = "Free shipping on your order";

  }

  /**
   * NO SPECIFIC PRODUCTS
   * Cart has no products from the campaign list — no discount.
   */
  else {

    return { operations: [] };

  }

  // Conditions met — apply 100% off shipping
  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: discountMessage,
              targets: [
                {
                  deliveryGroup: {
                    id: firstGroup.id,
                  },
                },
              ],
              value: {
                percentage: {
                  value: 100,
                },
              },
            },
          ],

          // First ensures only ONE shipping discount applies at checkout,
          // preventing stacking with other shipping discount functions.
          // The highest-threshold discount wins by design.
          selectionStrategy: DeliveryDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}