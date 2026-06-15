// import {
//   DeliveryDiscountSelectionStrategy,
//   DiscountClass,
//   DeliveryInput,
//   CartDeliveryOptionsDiscountsGenerateRunResult,
// } from "../generated/api";

// /**
//  * Strict specific-products free shipping rule:
//  *   Fires ONLY IF every line in the cart belongs to the campaign's
//  *   product list AND the sum of those lines meets the minimum threshold.
//  *
//  * Config comes from a metafield on the discount:
//  *   namespace: "$app:freeshipping"
//  *   key: "config"
//  *   value (JSON): {
//  *     "productIds": ["7891234567890", "7891234567891"],
//  *     "minimumAmount": 500
//  *   }
//  *
//  * The all-products free shipping case is handled by Shopify's native
//  * `discountAutomaticFreeShipping` discount — NOT by this function.
//  */

// interface FreeShippingConfig {
//   productIds: string[];
//   minimumAmount: number;
// }

// function isValidConfig(x: any): x is FreeShippingConfig {
//   return (
//     x &&
//     Array.isArray(x.productIds) &&
//     x.productIds.every((id: any) => typeof id === "string") &&
//     typeof x.minimumAmount === "number" &&
//     x.minimumAmount >= 0
//   );
// }

// // Strip "gid://shopify/Product/12345" → "12345" so it matches the numeric
// // IDs we store in the metafield. Defensive in case Shopify ever returns
// // raw numeric IDs without the gid prefix.
// function numericId(gid: string): string {
//   const m = gid.match(/\/(\d+)$/);
//   return m ? m[1] : gid;
// }

// export function cartDeliveryOptionsDiscountsGenerateRun(
//   input: DeliveryInput,
// ): CartDeliveryOptionsDiscountsGenerateRunResult {
//   // Bail if this discount isn't classified as Shipping
//   const hasShipping = input.discount.discountClasses.includes(
//     DiscountClass.Shipping,
//   );
//   if (!hasShipping) return { operations: [] };

//   // Bail if there's nothing to discount
//   const firstGroup = input.cart.deliveryGroups[0];
//   if (!firstGroup) return { operations: [] };

//   // Read campaign config from the metafield
//   const rawConfig = input.discount.metafield?.jsonValue;
//   if (!isValidConfig(rawConfig)) {
//     // No config OR malformed config — fail closed (no discount).
//     return { operations: [] };
//   }
//   const { productIds, minimumAmount } = rawConfig;

//   // Build a Set for O(1) lookups
//   const allowedIds = new Set(productIds);

//   // Walk the cart: every line must belong to a product in the allow list,
//   // and we track the total of those lines (which equals the cart subtotal
//   // since every line must qualify).
//   // let everyLineQualifies = input.cart.lines.length > 0;
//   // let qualifyingSubtotal = 0;

//   // for (const line of input.cart.lines) {
//   //   const merch = line.merchandise;
//   //   // Custom products (gift cards, etc.) don't have a product id at all,
//   //   // so they instantly disqualify the cart.
//   //   if (merch.__typename !== "ProductVariant") {
//   //     everyLineQualifies = false;
//   //     break;
//   //   }
//   //   const pid = numericId(merch.product.id);
//   //   if (!allowedIds.has(pid)) {
//   //     everyLineQualifies = false;
//   //     break;
//   //   }
//   //   qualifyingSubtotal += parseFloat(line.cost.subtotalAmount.amount);
//   // }

//   // if (!everyLineQualifies) return { operations: [] };
//   // if (qualifyingSubtotal < minimumAmount) return { operations: [] };

//   let hasSpecific = false;
// let hasNonSpecific = false;

// let specificSubtotal = 0;
// let cartSubtotal = 0;

// for (const line of input.cart.lines) {
//   const merch = line.merchandise;

//   if (merch.__typename !== "ProductVariant") {
//     hasNonSpecific = true;
//     continue;
//   }

//   const pid = numericId(merch.product.id);

//   const lineSubtotal = parseFloat(
//     line.cost.subtotalAmount.amount
//   );

//   cartSubtotal += lineSubtotal;

//   if (allowedIds.has(pid)) {
//     hasSpecific = true;
//     specificSubtotal += lineSubtotal;
//   } else {
//     hasNonSpecific = true;
//   }
// }

// // PURE SPECIFIC CART
// if (hasSpecific && !hasNonSpecific) {
//   if (specificSubtotal < minimumAmount) {
//     return { operations: [] };
//   }
// }

// // MIXED CART
// else if (hasSpecific && hasNonSpecific) {

//   // Replace this with your actual higher threshold
//   const higherThreshold = Math.max(
//     minimumAmount,
//     1000 // all-products threshold
//   );

//   if (cartSubtotal < higherThreshold) {
//     return { operations: [] };
//   }
// }

// // NO SPECIFIC PRODUCTS
// else {
//   return { operations: [] };
// }

//   // Conditions met — fire 100% off shipping for the first delivery group
//   return {
//     operations: [
//       {
//         deliveryDiscountsAdd: {
//           candidates: [
//             {
//               message: "Free shipping",
//               targets: [
//                 {
//                   deliveryGroup: {
//                     id: firstGroup.id,
//                   },
//                 },
//               ],
//               value: {
//                 percentage: {
//                   value: 100,
//                 },
//               },
//             },
//           ],
//           selectionStrategy: DeliveryDiscountSelectionStrategy.All,
//         },
//       },
//     ],
//   };
// }


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
 *    -> specific subtotal must meet specific threshold
 *
 * 2. Mixed cart
 *    -> ONLY the HIGHEST threshold applies
 *    -> cart subtotal must meet highest threshold
 *
 * 3. No specific products
 *    -> no discount from this function
 *
 * IMPORTANT:
 * - This function returns ONLY ONE shipping discount
 * - Uses SelectionStrategy.First to prevent stacking
 */

interface FreeShippingConfig {
  productIds: string[];
  minimumAmount: number;

  // ADD THIS IN YOUR METAFIELD CONFIG
  // for all-products threshold
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

  // Must be shipping discount
  const hasShipping = input.discount.discountClasses.includes(
    DiscountClass.Shipping,
  );

  if (!hasShipping) {
    return { operations: [] };
  }

  // Must have delivery group
  const firstGroup = input.cart.deliveryGroups[0];

  if (!firstGroup) {
    return { operations: [] };
  }

  // Read metafield config
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

  // Analyze cart
  for (const line of input.cart.lines) {

    const merch = line.merchandise;

    // Non-product items disqualify pure-specific carts
    if (merch.__typename !== "ProductVariant") {
      hasNonSpecific = true;
      continue;
    }

    const pid = numericId(merch.product.id);

    const lineSubtotal = parseFloat(
      line.cost.subtotalAmount.amount
    );

    cartSubtotal += lineSubtotal;

    if (allowedIds.has(pid)) {

      hasSpecific = true;

      specificSubtotal += lineSubtotal;

    } else {

      hasNonSpecific = true;

    }
  }

  // Empty cart
  if (input.cart.lines.length === 0) {
    return { operations: [] };
  }

  /**
   * PURE SPECIFIC CART
   */
  if (hasSpecific && !hasNonSpecific) {

    // specific threshold only
    if (specificSubtotal < minimumAmount) {
      return { operations: [] };
    }

  }

  /**
   * MIXED CART
   */
  else if (hasSpecific && hasNonSpecific) {

    // ONLY HIGHEST THRESHOLD SHOULD APPLY
    const highestThreshold = Math.max(
      minimumAmount,
      allProductsThreshold
    );

    // WHOLE CART must satisfy highest threshold
    if (cartSubtotal < highestThreshold) {
      return { operations: [] };
    }

  }

  /**
   * NO SPECIFIC PRODUCTS
   */
  else {

    return { operations: [] };

  }

  // APPLY FREE SHIPPING
  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: "Free shipping",
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

          // IMPORTANT:
          // Prevent multiple shipping discounts stacking
          selectionStrategy:
            DeliveryDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}