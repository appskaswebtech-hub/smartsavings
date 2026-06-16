import {
  DeliveryDiscountSelectionStrategy,
  DiscountClass,
  DeliveryInput,
  CartDeliveryOptionsDiscountsGenerateRunResult,
} from "../generated/api";

/**
 * Free shipping function.
 *
 * Metafield config (namespace: "$app:freeshipping", key: "config"):
 * {
 *   "productIds":     [],      // empty = all products; non-empty = specific products
 *   "minimumAmount":  100,     // dollar threshold (0 = no requirement)
 *   "minimumQuantity": 3,      // item count threshold (0 = no requirement)
 *   "requireBoth":    true     // true = AND logic, false = OR logic (default: true)
 * }
 *
 * RequirementType mapping:
 *   "amount"   → minimumAmount only, minimumQuantity = 0
 *   "quantity" → minimumQuantity only, minimumAmount = 0
 *   "both"     → requireBoth: true  (customer must meet BOTH)
 *   "either"   → requireBoth: false (customer meets EITHER)
 */

interface FreeShippingConfig {
  productIds?:      string[];
  minimumAmount?:   number;
  minimumQuantity?: number;
  requireBoth?:     boolean;   // default true (AND); false = OR
}

function isValidConfig(x: any): x is FreeShippingConfig {
  return (
    x !== null &&
    typeof x === "object" &&
    (x.productIds   === undefined || Array.isArray(x.productIds)) &&
    (x.minimumAmount   === undefined || typeof x.minimumAmount   === "number") &&
    (x.minimumQuantity === undefined || typeof x.minimumQuantity === "number") &&
    (x.requireBoth     === undefined || typeof x.requireBoth     === "boolean")
  );
}

function numericId(gid: string): string {
  const m = gid.match(/\/(\d+)$/);
  return m ? m[1] : gid;
}

export function cartDeliveryOptionsDiscountsGenerateRun(
  input: DeliveryInput,
): CartDeliveryOptionsDiscountsGenerateRunResult {

  if (!input.discount.discountClasses.includes(DiscountClass.Shipping)) {
    return { operations: [] };
  }

  const firstGroup = input.cart.deliveryGroups[0];
  if (!firstGroup) return { operations: [] };

  if (input.cart.lines.length === 0) return { operations: [] };

  const rawConfig = input.discount.metafield?.jsonValue;
  if (!isValidConfig(rawConfig)) return { operations: [] };

  const {
    productIds    = [],
    minimumAmount  = 0,
    minimumQuantity = 0,
    requireBoth    = true,   // default AND for backward compatibility
  } = rawConfig;

  const isAllProducts = productIds.length === 0;

  // ─── ALL PRODUCTS path ───────────────────────────────────────────────
  if (isAllProducts) {
    let cartSubtotal  = 0;
    let cartItemCount = 0;

    for (const line of input.cart.lines) {
      cartSubtotal  += parseFloat(line.cost.subtotalAmount.amount);
      cartItemCount += line.quantity;
    }

    const amountMet = minimumAmount  <= 0 || cartSubtotal  >= minimumAmount;
    const qtyMet    = minimumQuantity <= 0 || cartItemCount >= minimumQuantity;

    if (requireBoth) {
      // AND: both conditions must be satisfied
      if (!amountMet || !qtyMet) return { operations: [] };
    } else {
      // OR: at least one condition must be satisfied
      if (!amountMet && !qtyMet) return { operations: [] };
    }

    return buildDiscount(firstGroup.id);
  }

  // ─── SPECIFIC PRODUCTS path ──────────────────────────────────────────
  const allowedIds = new Set(productIds);

  let everyLineQualifies  = true;
  let qualifyingSubtotal  = 0;
  let qualifyingItemCount = 0;

  for (const line of input.cart.lines) {
    const merch = line.merchandise;

    if (merch.__typename !== "ProductVariant") {
      everyLineQualifies = false;
      break;
    }

    const pid = numericId(merch.product.id);

    if (!allowedIds.has(pid)) {
      everyLineQualifies = false;
      break;
    }

    qualifyingSubtotal  += parseFloat(line.cost.subtotalAmount.amount);
    qualifyingItemCount += line.quantity;
  }

  if (!everyLineQualifies) return { operations: [] };

  const amountMet = minimumAmount   <= 0 || qualifyingSubtotal  >= minimumAmount;
  const qtyMet    = minimumQuantity <= 0 || qualifyingItemCount >= minimumQuantity;

  if (requireBoth) {
    if (!amountMet || !qtyMet) return { operations: [] };
  } else {
    if (!amountMet && !qtyMet) return { operations: [] };
  }

  return buildDiscount(firstGroup.id);
}

function buildDiscount(
  deliveryGroupId: string,
): CartDeliveryOptionsDiscountsGenerateRunResult {
  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: "Free shipping",
              targets: [{ deliveryGroup: { id: deliveryGroupId } }],
              value:   { percentage: { value: 100 } },
            },
          ],
          selectionStrategy: DeliveryDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}