// import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

// interface CampaignData {
//   name: string;
//   type: string;
//   discountType: string;
//   discountValue: number;
//   appliesTo: string;
//   startDate: Date;
//   endDate: Date | null;
//   tiers: string | null;
//   productIds: string | null;
//   collectionIds: string | null;
//   freeShipping: boolean;
//   minOrderForShipping: string | null;
//   discountCode: string | null;
//   geoTarget: string | null;
// }

// function getItemsFilter(campaign: CampaignData) {
//   if (campaign.appliesTo === "specific_products" && campaign.productIds) {
//     try {
//       return { products: { productsToAdd: JSON.parse(campaign.productIds) } };
//     } catch { return { all: true }; }
//   }
//   if (campaign.appliesTo === "specific_collections" && campaign.collectionIds) {
//     try {
//       return { collections: { add: JSON.parse(campaign.collectionIds) } };
//     } catch { return { all: true }; }
//   }
//   return { all: true };
// }

// async function runMutation(admin: AdminApiContext, query: string, variables: any): Promise<any> {
//   const response = await admin.graphql(query, { variables });
//   return response.json();
// }

// /**
//  * Look up the shop's primary country code (e.g. "IN", "US").
//  * Used to scope "Domestic only" free shipping discounts to the merchant's country.
//  */
// async function getShopPrimaryCountry(admin: AdminApiContext): Promise<string | null> {
//   try {
//     const r = await admin.graphql(
//       `#graphql
//       query { shop { billingAddress { countryCodeV2 } } }`
//     );
//     const data = await r.json();
//     return data?.data?.shop?.billingAddress?.countryCodeV2 || null;
//   } catch (e) {
//     console.error("getShopPrimaryCountry error:", e);
//     return null;
//   }
// }

// /**
//  * Build a `destination` field for free-shipping mutations based on the
//  * merchant's geoTarget choice:
//  *   "domestic" → countries: [<shop primary country>], includeRestOfWorld: false
//  *   "all"      → all: true (worldwide)
//  *   anything else → all: true (defensive default)
//  *
//  * If "domestic" is requested but the shop country can't be resolved,
//  * pushes an error onto `errors` and returns null. Caller should skip
//  * the mutation in that case.
//  */
// async function buildShippingDestination(
//   admin: AdminApiContext,
//   geoTarget: string | null,
//   errors: string[]
// ): Promise<any | null> {
//   if (geoTarget === "domestic") {
//     const shopCountry = await getShopPrimaryCountry(admin);
//     if (!shopCountry) {
//       errors.push("Could not determine shop's primary country for domestic free shipping.");
//       return null;
//     }
//     return {
//       countries: {
//         add: [shopCountry],
//         includeRestOfWorld: false,
//       },
//     };
//   }
//   // "all" (or unspecified) → worldwide
//   return { all: true };
// }

// export async function createShopifyDiscount(admin: AdminApiContext, campaign: CampaignData) {
//   const startsAt = campaign.startDate.toISOString();
//   const endsAt = campaign.endDate ? campaign.endDate.toISOString() : null;
//   const items = getItemsFilter(campaign);
//   const errors: string[] = [];
//   const createdIds: string[] = [];

//   try {
//     // ─── BULK PRICE (Automatic Basic) ───
//     if (campaign.type === "bulk_price") {
//       const value = campaign.discountType === "percentage"
//         ? { percentage: campaign.discountValue / 100 }
//         : { discountAmount: { amount: String(campaign.discountValue), appliesToEachItem: true } };

//       const result = await runMutation(admin,
//         `#graphql
//         mutation create($discount: DiscountAutomaticBasicInput!) {
//           discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
//             automaticDiscountNode { id }
//             userErrors { field message }
//           }
//         }`,
//         { discount: { title: campaign.name, startsAt, endsAt, customerGets: { value, items } } }
//       );
//       const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
//       if (ue.length) errors.push(...ue.map((e: any) => e.message));
//       else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
//     }

//     // ─── QUANTITY DISCOUNT (one per tier - Shopify auto-picks the best one) ───
//     else if (campaign.type === "quantity_discount" && campaign.tiers) {
//       const tiers = JSON.parse(campaign.tiers)
//         .map((t: any) => ({ quantity: parseInt(t.quantity), discount: parseFloat(t.discount) }))
//         .filter((t: any) => !isNaN(t.quantity) && !isNaN(t.discount))
//         .sort((a: any, b: any) => a.quantity - b.quantity);

//       for (const tier of tiers) {
//         const result = await runMutation(admin,
//           `#graphql
//           mutation create($discount: DiscountAutomaticBasicInput!) {
//             discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
//               automaticDiscountNode { id }
//               userErrors { field message }
//             }
//           }`,
//           {
//             discount: {
//               title: `${campaign.name} (Buy ${tier.quantity}+ Save ${tier.discount}%)`,
//               startsAt, endsAt,
//               minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: String(tier.quantity) } },
//               customerGets: { value: { percentage: tier.discount / 100 }, items },
//               combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true },
//             },
//           }
//         );
//         const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
//         if (ue.length) errors.push(...ue.map((e: any) => `Buy ${tier.quantity}+: ${e.message}`));
//         else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
//       }
//     }

//     // ─── CART GOAL (one per tier - Shopify auto-picks the best one) ───
//     else if (campaign.type === "cart_goal" && campaign.tiers) {
//       const tiers = JSON.parse(campaign.tiers)
//         .map((t: any) => ({ amount: parseFloat(t.amount), discount: parseFloat(t.discount) }))
//         .filter((t: any) => !isNaN(t.amount) && !isNaN(t.discount))
//         .sort((a: any, b: any) => a.amount - b.amount);

//       for (const tier of tiers) {
//         const result = await runMutation(admin,
//           `#graphql
//           mutation create($discount: DiscountAutomaticBasicInput!) {
//             discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
//               automaticDiscountNode { id }
//               userErrors { field message }
//             }
//           }`,
//           {
//             discount: {
//               title: `${campaign.name} (Spend $${tier.amount}+ Save ${tier.discount}%)`,
//               startsAt, endsAt,
//               minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: String(tier.amount) } },
//               customerGets: { value: { percentage: tier.discount / 100 }, items: { all: true } },
//               combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true },
//             },
//           }
//         );
//         const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
//         if (ue.length) errors.push(...ue.map((e: any) => `$${tier.amount}+: ${e.message}`));
//         else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
//       }
//     }

//     // ─── SHIPPING DISCOUNT (Automatic Free Shipping) ───
//     else if (campaign.type === "shipping_discount") {
//       const minReq = campaign.minOrderForShipping
//         ? { subtotal: { greaterThanOrEqualToSubtotal: campaign.minOrderForShipping } }
//         : null;

//       const destination = await buildShippingDestination(admin, campaign.geoTarget, errors);

//       // Only run mutation if destination resolved successfully
//       if (destination) {
//         const result = await runMutation(admin,
//           `#graphql
//           mutation create($discount: DiscountAutomaticFreeShippingInput!) {
//             discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $discount) {
//               automaticDiscountNode { id }
//               userErrors { field message }
//             }
//           }`,
//           {
//             discount: {
//               title: campaign.name, startsAt, endsAt,
//               ...(minReq ? { minimumRequirement: minReq } : {}),
//               destination,
//             },
//           }
//         );
//         const ue = result.data?.discountAutomaticFreeShippingCreate?.userErrors || [];
//         if (ue.length) errors.push(...ue.map((e: any) => e.message));
//         else createdIds.push(result.data?.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id);
//       }
//     }

//     // ─── BUY X GET Y ───
//     else if (campaign.type === "buy_x_get_y") {
//       const buyQty = String(campaign.discountValue || 1);
//       const getEffect = campaign.discountType === "free"
//         ? { percentage: 1.0 }
//         : { percentage: campaign.discountValue / 100 };

//       const result = await runMutation(admin,
//         `#graphql
//         mutation create($discount: DiscountAutomaticBxgyInput!) {
//           discountAutomaticBxgyCreate(automaticBxgyDiscount: $discount) {
//             automaticDiscountNode { id }
//             userErrors { field message }
//           }
//         }`,
//         {
//           discount: {
//             title: campaign.name, startsAt, endsAt,
//             usesPerOrderLimit: "1",
//             customerBuys: { value: { quantity: buyQty }, items },
//             customerGets: {
//               value: { discountOnQuantity: { quantity: "1", effect: getEffect } },
//               items,
//             },
//           },
//         }
//       );
//       const ue = result.data?.discountAutomaticBxgyCreate?.userErrors || [];
//       if (ue.length) errors.push(...ue.map((e: any) => e.message));
//       else createdIds.push(result.data?.discountAutomaticBxgyCreate?.automaticDiscountNode?.id);
//     }

//     // ─── ADVANCED DISCOUNT CODE ───
//     else if (campaign.type === "advanced_discount_code" && campaign.discountCode) {
//       if (campaign.discountType === "free_shipping") {
//         const destination = await buildShippingDestination(admin, campaign.geoTarget, errors);

//         if (destination) {
//           const result = await runMutation(admin,
//             `#graphql
//             mutation create($discount: DiscountCodeFreeShippingInput!) {
//               discountCodeFreeShippingCreate(freeShippingCodeDiscount: $discount) {
//                 codeDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             { discount: { title: campaign.name, code: campaign.discountCode, startsAt, endsAt, destination } }
//           );
//           const ue = result.data?.discountCodeFreeShippingCreate?.userErrors || [];
//           if (ue.length) errors.push(...ue.map((e: any) => e.message));
//           else createdIds.push(result.data?.discountCodeFreeShippingCreate?.codeDiscountNode?.id);
//         }
//       } else {
//         const value = campaign.discountType === "percentage"
//           ? { percentage: campaign.discountValue / 100 }
//           : { discountAmount: { amount: String(campaign.discountValue), appliesToEachItem: false } };

//         const result = await runMutation(admin,
//           `#graphql
//           mutation create($discount: DiscountCodeBasicInput!) {
//             discountCodeBasicCreate(basicCodeDiscount: $discount) {
//               codeDiscountNode { id }
//               userErrors { field message }
//             }
//           }`,
//           {
//             discount: {
//               title: campaign.name, code: campaign.discountCode, startsAt, endsAt,
//               customerGets: { value, items },
//               customerSelection: { all: true },
//             },
//           }
//         );
//         const ue = result.data?.discountCodeBasicCreate?.userErrors || [];
//         if (ue.length) errors.push(...ue.map((e: any) => e.message));
//         else createdIds.push(result.data?.discountCodeBasicCreate?.codeDiscountNode?.id);
//       }
//     }

//     if (errors.length > 0) {
//       return { success: false, errors, createdIds };
//     }
//     return { success: true, errors: [], createdIds };

//   } catch (error) {
//     console.error("createShopifyDiscount error:", error);
//     return { success: false, errors: [String(error)], createdIds: [] };
//   }
// }



import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

interface CampaignData {
  name: string;
  type: string;
  discountType: string;
  discountValue: number;
  appliesTo: string;
  startDate: Date;
  endDate: Date | null;
  tiers: string | null;
  productIds: string | null;
  // The create page posts variants separately; the edit page folds them into
  // productIds instead. Both are accepted so the two pages agree.
  variantIds?: string | null;
  collectionIds: string | null;
  // Persisted per campaign and surfaced in the edit form. Default true: quantity
  // tiers evaluate their whole tier set inside the function, so a campaign can
  // never stack with itself, and combining is what lets two campaigns discount
  // different products in the same cart.
  combineWithProducts?: boolean;
  combineWithOrders?: boolean;
  combineWithShipping?: boolean;
  freeShipping: boolean;
  minOrderForShipping: string | null;
  minQuantityForShipping?: string | null;
  requirementType?: string | null; // amount | quantity | both | either (shipping_discount)
  discountCode: string | null;
  geoTarget: string | null;
}

function getItemsFilter(campaign: CampaignData) {
  if (campaign.appliesTo === "specific_products" && campaign.productIds) {
    try {
      return { products: { productsToAdd: JSON.parse(campaign.productIds) } };
    } catch { return { all: true }; }
  }
  if (campaign.appliesTo === "specific_collections" && campaign.collectionIds) {
    try {
      return { collections: { add: JSON.parse(campaign.collectionIds) } };
    } catch { return { all: true }; }
  }
  return { all: true };
}

async function runMutation(admin: AdminApiContext, query: string, variables: any): Promise<any> {
  const response = await admin.graphql(query, { variables });
  return response.json();
}

async function getShopPrimaryCountry(admin: AdminApiContext): Promise<string | null> {
  try {
    const r = await admin.graphql(
      `#graphql
      query { shop { billingAddress { countryCodeV2 } } }`
    );
    const data = await r.json();
    return data?.data?.shop?.billingAddress?.countryCodeV2 || null;
  } catch (e) {
    console.error("getShopPrimaryCountry error:", e);
    return null;
  }
}

async function buildShippingDestination(
  admin: AdminApiContext,
  geoTarget: string | null,
  errors: string[]
): Promise<any | null> {
  if (geoTarget === "domestic") {
    const shopCountry = await getShopPrimaryCountry(admin);
    if (!shopCountry) {
      errors.push("Could not determine shop's primary country for domestic free shipping.");
      return null;
    }
    return {
      countries: {
        add: [shopCountry],
        includeRestOfWorld: false,
      },
    };
  }
  return { all: true };
}

/**
 * Strip "gid://shopify/Product/12345" → "12345".
 * The function reads numeric IDs from the metafield, so we normalize here.
 */
function numericProductIds(productIdsJson: string | null): string[] {
  if (!productIdsJson) return [];
  try {
    const arr = JSON.parse(productIdsJson) as string[];
    return arr.map((id) => {
      const m = id.match(/\/(\d+)$/);
      return m ? m[1] : id;
    });
  } catch {
    return [];
  }
}

/**
 * The campaign edit page folds selected VARIANT gids into productIds (replacing
 * the product gid), so that array is a mix of gid://shopify/Product/N and
 * gid://shopify/ProductVariant/N. numericProductIds() strips the gid type along
 * with the prefix, which is exactly the information the function needs to tell a
 * variant-scoped target from a product-scoped one — so split first, then strip.
 */
function splitProductAndVariantIds(productIdsJson: string | null): {
  productIds: string[];
  variantIds: string[];
} {
  const productIds: string[] = [];
  const variantIds: string[] = [];
  if (!productIdsJson) return { productIds, variantIds };

  let arr: unknown;
  try {
    arr = JSON.parse(productIdsJson);
  } catch {
    return { productIds, variantIds };
  }
  if (!Array.isArray(arr)) return { productIds, variantIds };

  for (const raw of arr) {
    if (typeof raw !== "string") continue;
    const m = raw.match(/\/(\d+)$/);
    const numeric = m ? m[1] : raw;
    if (raw.includes("/ProductVariant/")) variantIds.push(numeric);
    else productIds.push(numeric);
  }
  return { productIds, variantIds };
}

function parseGidArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x: any) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Look up this app's deployed discount Function.
 *
 * ONE extension ("free-shipping-priority") registers BOTH the cart.lines and the
 * cart.delivery-options targets, so the same function id backs the SHIPPING, the
 * PRODUCT and the ORDER discounts — shopifyFunctions returns a single node for it.
 * Older per-target deployments returned one node per apiType, so callers pass the
 * apiTypes they'd prefer (best first) rather than us assuming there's only one.
 *
 * Matching is on `title`, which resolves from "name" in the extension's
 * locales/en.default.json. Do NOT rename that key without updating this matcher —
 * a miss here degrades silently into "function not found" for every
 * function-backed campaign.
 *
 * Returns the function id (e.g. "01H...") or null if not found.
 */
async function findDiscountFunctionId(
  admin: AdminApiContext,
  preferredApiTypes: string[] = []
): Promise<string | null> {
  try {
    const r = await admin.graphql(
      `#graphql
      query {
        shopifyFunctions(first: 25) {
          nodes {
            id
            apiType
            title
            apiVersion
          }
        }
      }`
    );
    const data = await r.json();
    const nodes = data?.data?.shopifyFunctions?.nodes || [];
    const matches = nodes.filter((n: any) =>
      n.title === "free-shipping-priority" || n.title?.includes("free-shipping")
    );
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0].id;

    for (const apiType of preferredApiTypes) {
      const hit = matches.find((n: any) => n.apiType === apiType);
      if (hit) return hit.id;
    }
    return matches[0].id;
  } catch (e) {
    console.error("findDiscountFunctionId error:", e);
    return null;
  }
}

async function findFreeShippingFunctionId(admin: AdminApiContext): Promise<string | null> {
  return findDiscountFunctionId(admin, ["discount", "shipping_discounts"]);
}

/**
 * Create the specific-products free shipping discount via the Function.
 * Two GraphQL calls:
 *   1. discountAutomaticAppCreate — creates the discount bound to our function
 *   2. metafieldsSet — attaches the {productIds, minimumAmount} config to the discount
 *
 * Returns the discount node id, or null on failure.
 */
async function createSpecificFreeShipping(
  admin: AdminApiContext,
  campaign: CampaignData,
  startsAt: string,
  endsAt: string | null,
  errors: string[]
): Promise<string | null> {
  const functionId = await findFreeShippingFunctionId(admin);
  if (!functionId) {
    errors.push(
      "Free shipping function not found. Deploy the extension with `npm run deploy`."
    );
    return null;
  }

  const minAmount = parseFloat(campaign.minOrderForShipping || "0");
  const productIds = numericProductIds(campaign.productIds);

  if (productIds.length === 0) {
    errors.push("Specific-products free shipping requires at least one product.");
    return null;
  }
  if (minAmount <= 0) {
    errors.push("Specific-products free shipping requires a minimum order value.");
    return null;
  }

  // Step 1: create the discount
  const createResult = await runMutation(
    admin,
    `#graphql
    mutation create($discount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $discount) {
        automaticAppDiscount { discountId }
        userErrors { field message }
      }
    }`,
    {
      discount: {
        title: campaign.name,
        functionId,
        startsAt,
        endsAt,
        discountClasses: ["SHIPPING"],
      },
    }
  );

  const ue = createResult.data?.discountAutomaticAppCreate?.userErrors || [];
  if (ue.length) {
    errors.push(...ue.map((e: any) => e.message));
    return null;
  }

  const discountId =
    createResult.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;
  if (!discountId) {
    errors.push("Function discount creation returned no id.");
    return null;
  }

  // Step 2: attach config metafield
  const configValue = JSON.stringify({ productIds, minimumAmount: minAmount });
  const metafieldResult = await runMutation(
    admin,
    `#graphql
    mutation setMeta($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      metafields: [
        {
          ownerId: discountId,
          namespace: "$app:freeshipping",
          key: "config",
          type: "json",
          value: configValue,
        },
      ],
    }
  );

  const mfe = metafieldResult.data?.metafieldsSet?.userErrors || [];
  if (mfe.length) {
    errors.push(
      "Discount created but config attach failed: " +
        mfe.map((e: any) => e.message).join(", ")
    );
    // We still return the id so caller can save it (and the merchant can fix the metafield manually).
    return discountId;
  }

  return discountId;
}

// ─── Function-backed tiered discounts ───────────────────────────────────────
// quantity_discount and cart_goal are ONE app discount per campaign, with the
// tier table in a metafield, instead of one native discount per tier.
//
// Per-tier native discounts had to set combinesWith.productDiscounts: false to
// stop a campaign's own tiers stacking (at qty 8 the 2+, 4+ and 8+ discounts
// would all apply). That flag also stopped two DIFFERENT campaigns from ever
// discounting the same cart: Shopify applies one automatic product discount
// unless all of them opt into combining, so the second campaign was silently
// dropped. The function evaluates the whole tier set and awards only the winning
// tier, so combining is safe to turn on and both campaigns apply.

const TIERS_NAMESPACE = "$app:smartsavings";
const TIERS_KEY = "config";
// Function input has practical size limits well below the JSON metafield cap.
const MAX_TARGET_IDS = 500;
// Documented ceiling for a GraphQL list used as an input-query variable.
const MAX_COLLECTION_IDS = 100;

function combinesWithFor(campaign: CampaignData) {
  return {
    productDiscounts: campaign.combineWithProducts ?? true,
    orderDiscounts: campaign.combineWithOrders ?? true,
    shippingDiscounts: campaign.combineWithShipping ?? true,
  };
}

/**
 * Create a function-backed app discount and attach its config metafield.
 * Returns the discount node id, or null on failure.
 */
async function createFunctionDiscount(
  admin: AdminApiContext,
  campaign: CampaignData,
  discountClass: "PRODUCT" | "ORDER",
  config: Record<string, unknown>,
  startsAt: string,
  endsAt: string | null,
  errors: string[]
): Promise<string | null> {
  const functionId = await findDiscountFunctionId(admin, ["discount", "product_discounts"]);
  if (!functionId) {
    errors.push(
      "Discount function not found. Deploy the extension with `npm run deploy`."
    );
    return null;
  }

  const createResult = await runMutation(
    admin,
    `#graphql
    mutation create($discount: DiscountAutomaticAppInput!) {
      discountAutomaticAppCreate(automaticAppDiscount: $discount) {
        automaticAppDiscount { discountId }
        userErrors { field message }
      }
    }`,
    {
      discount: {
        title: campaign.name,
        functionId,
        startsAt,
        endsAt,
        discountClasses: [discountClass],
        combinesWith: combinesWithFor(campaign),
      },
    }
  );

  const ue = createResult.data?.discountAutomaticAppCreate?.userErrors || [];
  if (ue.length) {
    errors.push(...ue.map((e: any) => e.message));
    return null;
  }

  const discountId =
    createResult.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;
  if (!discountId) {
    errors.push("Function discount creation returned no id.");
    return null;
  }

  // The config is also the source of the $collectionIds input-query variable
  // (see [extensions.input.variables] in shopify.extension.toml), so
  // collectionIds must stay a TOP-LEVEL key holding full GIDs. productIds and
  // variantIds are numeric and are matched inside the function instead.
  const metafieldResult = await runMutation(
    admin,
    `#graphql
    mutation setMeta($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      metafields: [
        {
          ownerId: discountId,
          namespace: TIERS_NAMESPACE,
          key: TIERS_KEY,
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    }
  );

  const mfe = metafieldResult.data?.metafieldsSet?.userErrors || [];
  if (mfe.length) {
    errors.push(
      "Discount created but config attach failed: " +
        mfe.map((e: any) => e.message).join(", ")
    );
    // Return the id anyway so the caller can roll it back. Without the config
    // the function's validation bails, so the live discount is inert rather
    // than wrong — but it still occupies one of the store's discount slots.
    return discountId;
  }

  return discountId;
}

function parseQuantityTiers(tiersJson: string | null) {
  if (!tiersJson) return [];
  try {
    return JSON.parse(tiersJson)
      .map((t: any) => ({
        quantity: parseInt(t.quantity, 10),
        value: parseFloat(t.discount),
        type: t.discountType === "fixed_amount" ? "fixed_amount" : "percentage",
      }))
      // Zero rows are kept in the DB as placeholders but are not valid tiers.
      .filter(
        (t: any) => !isNaN(t.quantity) && !isNaN(t.value) && t.quantity > 0 && t.value > 0
      )
      .sort((a: any, b: any) => a.quantity - b.quantity);
  } catch {
    return [];
  }
}

async function createQuantityTierDiscount(
  admin: AdminApiContext,
  campaign: CampaignData,
  startsAt: string,
  endsAt: string | null,
  errors: string[]
): Promise<string | null> {
  const tiers = parseQuantityTiers(campaign.tiers);
  if (tiers.length === 0) {
    errors.push("Add at least one tier with a quantity and a discount greater than 0.");
    return null;
  }

  const { productIds, variantIds } = splitProductAndVariantIds(campaign.productIds);
  // The create page posts variants in their own field, the edit page folds them
  // into productIds. Merge both so either entry point produces the same config.
  const allVariantIds = Array.from(
    new Set([...variantIds, ...numericProductIds(campaign.variantIds ?? null)])
  );
  const collectionIds = parseGidArray(campaign.collectionIds);

  const appliesTo =
    campaign.appliesTo === "specific_products" ||
    campaign.appliesTo === "specific_collections"
      ? campaign.appliesTo
      : "all";

  // getItemsFilter() falls back to { all: true } when the id list is empty or
  // unparseable. Under the function that would discount the entire catalogue,
  // so fail loudly instead of silently widening the campaign.
  if (appliesTo === "specific_products" && productIds.length + allVariantIds.length === 0) {
    errors.push("Select at least one product for this quantity discount.");
    return null;
  }
  if (appliesTo === "specific_collections" && collectionIds.length === 0) {
    errors.push("Select at least one collection for this quantity discount.");
    return null;
  }
  if (productIds.length + allVariantIds.length > MAX_TARGET_IDS) {
    errors.push(
      `A quantity discount can target at most ${MAX_TARGET_IDS} products or variants.`
    );
    return null;
  }
  if (collectionIds.length > MAX_COLLECTION_IDS) {
    errors.push(
      `A quantity discount can target at most ${MAX_COLLECTION_IDS} collections.`
    );
    return null;
  }

  return createFunctionDiscount(
    admin,
    campaign,
    "PRODUCT",
    {
      version: 1,
      kind: "quantity_tiers",
      campaignName: campaign.name,
      appliesTo,
      productIds,
      variantIds: allVariantIds,
      collectionIds,
      // Mirrors the native rule `appliesOnEachItem: !targetsAllItems`: a fixed
      // amount comes off each unit when specific items are targeted, and once
      // across the entitled items when the campaign targets everything.
      fixedPerItem: appliesTo !== "all",
      tiers,
    },
    startsAt,
    endsAt,
    errors
  );
}

function parseCartGoalTiers(tiersJson: string | null) {
  if (!tiersJson) return [];
  try {
    return JSON.parse(tiersJson)
      .map((t: any) => ({
        requirementType: ["amount", "quantity", "both", "either"].includes(t.requirementType)
          ? t.requirementType
          : "amount",
        amount: parseFloat(t.amount),
        quantity: parseInt(t.quantity, 10),
        value: parseFloat(t.discount),
        type: t.discountType === "fixed_amount" ? "fixed_amount" : "percentage",
      }))
      // Zero placeholders stay saved but aren't sent. A tier needs a discount
      // plus whichever threshold(s) its requirement type gates on.
      .filter((t: any) => {
        if (isNaN(t.value) || t.value <= 0) return false;
        const hasAmount = !isNaN(t.amount) && t.amount > 0;
        const hasQty = !isNaN(t.quantity) && t.quantity > 0;
        if (t.requirementType === "quantity") return hasQty;
        if (t.requirementType === "both") return hasAmount && hasQty;
        if (t.requirementType === "either") return hasAmount || hasQty;
        return hasAmount; // amount
      })
      // The function reads amount and quantity on every tier, so normalise the
      // unused half of a single-requirement tier to 0 rather than NaN — NaN
      // doesn't survive JSON.stringify and would fail the function's validation.
      .map((t: any) => ({
        ...t,
        amount: isNaN(t.amount) ? 0 : t.amount,
        quantity: isNaN(t.quantity) ? 0 : t.quantity,
      }))
      .sort(
        (a: any, b: any) =>
          (a.amount || 0) - (b.amount || 0) || (a.quantity || 0) - (b.quantity || 0)
      );
  } catch {
    return [];
  }
}

async function createCartGoalDiscount(
  admin: AdminApiContext,
  campaign: CampaignData,
  startsAt: string,
  endsAt: string | null,
  errors: string[]
): Promise<string | null> {
  const tiers = parseCartGoalTiers(campaign.tiers);
  if (tiers.length === 0) {
    errors.push("Add at least one tier with a discount and its required minimum(s).");
    return null;
  }

  return createFunctionDiscount(
    admin,
    campaign,
    "ORDER",
    {
      version: 1,
      kind: "cart_goal",
      campaignName: campaign.name,
      collectionIds: [],
      tiers,
    },
    startsAt,
    endsAt,
    errors
  );
}

export async function createShopifyDiscount(admin: AdminApiContext, campaign: CampaignData) {
  const startsAt = campaign.startDate.toISOString();
  const endsAt = campaign.endDate ? campaign.endDate.toISOString() : null;
  const items = getItemsFilter(campaign);
  const errors: string[] = [];
  const createdIds: string[] = [];

  try {
    // ─── BULK PRICE ───
    if (campaign.type === "bulk_price") {
      // Shopify rejects appliesOnEachItem: true unless customerGets names specific
      // items. Derive this from the resolved filter rather than campaign.appliesTo —
      // getItemsFilter also falls back to { all: true } when ids are missing or
      // unparseable, and those cases must send false too.
      const targetsAllItems = "all" in items;
      const value = campaign.discountType === "percentage"
        ? { percentage: campaign.discountValue / 100 }
        : {
            discountAmount: {
              amount: String(campaign.discountValue),
              appliesOnEachItem: !targetsAllItems,
            },
          };

      const result = await runMutation(admin,
        `#graphql
        mutation create($discount: DiscountAutomaticBasicInput!) {
          discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
            automaticDiscountNode { id }
            userErrors { field message }
          }
        }`,
        { discount: { title: campaign.name, startsAt, endsAt, customerGets: { value, items } } }
      );
      const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
      if (ue.length) errors.push(...ue.map((e: any) => e.message));
      else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
    }

    // ─── QUANTITY DISCOUNT ───
    // One function-backed PRODUCT discount per campaign; the tier table lives in
    // a metafield. See createQuantityTierDiscount for why this is no longer one
    // native discount per tier.
    else if (campaign.type === "quantity_discount" && campaign.tiers) {
      const id = await createQuantityTierDiscount(admin, campaign, startsAt, endsAt, errors);
      if (id) createdIds.push(id);
    }

    // ─── CART GOAL ───
    // One function-backed ORDER discount per campaign. Native discounts could
    // only require a subtotal OR a quantity, so an "either" tier needed two
    // discounts and a "both" tier silently degraded to subtotal-only. The
    // function evaluates each tier's requirement properly.
    else if (campaign.type === "cart_goal" && campaign.tiers) {
      const id = await createCartGoalDiscount(admin, campaign, startsAt, endsAt, errors);
      if (id) createdIds.push(id);
    }

    // ─── SHIPPING DISCOUNT ───
    // Two paths:
    //   - specific_products → function-backed discount (strict rule)
    //   - all (or anything else) → standard free shipping (Shopify's built-in)
    else if (campaign.type === "shipping_discount") {
      if (campaign.appliesTo === "specific_products") {
        const id = await createSpecificFreeShipping(admin, campaign, startsAt, endsAt, errors);
        if (id) createdIds.push(id);
      } else {
        // All-products path. Shopify's free-shipping minimumRequirement is one-of
        // (subtotal OR quantity), so requirementType maps to how many discounts we
        // create:
        //   amount    → 1 discount, subtotal minimum
        //   quantity  → 1 discount, quantity minimum
        //   either    → 2 discounts (subtotal + quantity); meeting either qualifies
        //   both      → 1 discount, subtotal minimum (native discounts can't AND two
        //               requirement types — the quantity leg is display-only until the
        //               free-shipping Function enforces it; see createSpecificFreeShipping)
        const destination = await buildShippingDestination(admin, campaign.geoTarget, errors);

        if (destination) {
          const reqType = campaign.requirementType || "amount";
          const hasAmount = !!campaign.minOrderForShipping && parseFloat(campaign.minOrderForShipping) > 0;
          const hasQty = !!campaign.minQuantityForShipping && parseInt(campaign.minQuantityForShipping, 10) > 0;

          const subtotalReq = { subtotal: { greaterThanOrEqualToSubtotal: campaign.minOrderForShipping } };
          const quantityReq = { quantity: { greaterThanOrEqualToQuantity: String(campaign.minQuantityForShipping) } };

          // Each entry becomes one discount. Distinct titles avoid the "title must be
          // unique" error and still match findMatchingDiscountIds' prefix rule so
          // edit/delete cleans up every one.
          const toCreate: { title: string; minimumRequirement?: any }[] = [];
          if (reqType === "quantity") {
            toCreate.push({ title: campaign.name, ...(hasQty ? { minimumRequirement: quantityReq } : {}) });
          } else if (reqType === "either") {
            if (hasAmount) toCreate.push({ title: campaign.name, minimumRequirement: subtotalReq });
            if (hasQty) toCreate.push({ title: `${campaign.name} (min items)`, minimumRequirement: quantityReq });
            // If neither threshold is set, "either" is meaningless — fall back to an
            // unconditional free-shipping discount so the campaign still does something.
            if (!hasAmount && !hasQty) toCreate.push({ title: campaign.name });
          } else {
            // amount and both: gate on the order-value subtotal.
            toCreate.push({ title: campaign.name, ...(hasAmount ? { minimumRequirement: subtotalReq } : {}) });
          }

          for (const spec of toCreate) {
            const result = await runMutation(admin,
              `#graphql
              mutation create($discount: DiscountAutomaticFreeShippingInput!) {
                discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $discount) {
                  automaticDiscountNode { id }
                  userErrors { field message }
                }
              }`,
              {
                discount: {
                  title: spec.title, startsAt, endsAt,
                  ...(spec.minimumRequirement ? { minimumRequirement: spec.minimumRequirement } : {}),
                  destination,
                },
              }
            );
            const ue = result.data?.discountAutomaticFreeShippingCreate?.userErrors || [];
            if (ue.length) errors.push(...ue.map((e: any) => e.message));
            else createdIds.push(result.data?.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id);
          }
        }
      }
    }

    // ─── BUY X GET Y ───
    else if (campaign.type === "buy_x_get_y") {
      const buyQty = String(campaign.discountValue || 1);
      const getEffect = campaign.discountType === "free"
        ? { percentage: 1.0 }
        : { percentage: campaign.discountValue / 100 };

      const result = await runMutation(admin,
        `#graphql
        mutation create($discount: DiscountAutomaticBxgyInput!) {
          discountAutomaticBxgyCreate(automaticBxgyDiscount: $discount) {
            automaticDiscountNode { id }
            userErrors { field message }
          }
        }`,
        {
          discount: {
            title: campaign.name, startsAt, endsAt,
            usesPerOrderLimit: "1",
            customerBuys: { value: { quantity: buyQty }, items },
            customerGets: {
              value: { discountOnQuantity: { quantity: "1", effect: getEffect } },
              items,
            },
          },
        }
      );
      const ue = result.data?.discountAutomaticBxgyCreate?.userErrors || [];
      if (ue.length) errors.push(...ue.map((e: any) => e.message));
      else createdIds.push(result.data?.discountAutomaticBxgyCreate?.automaticDiscountNode?.id);
    }

    // ─── ADVANCED DISCOUNT CODE ───
    else if (campaign.type === "advanced_discount_code" && campaign.discountCode) {
      if (campaign.discountType === "free_shipping") {
        const destination = await buildShippingDestination(admin, campaign.geoTarget, errors);

        if (destination) {
          const result = await runMutation(admin,
            `#graphql
            mutation create($discount: DiscountCodeFreeShippingInput!) {
              discountCodeFreeShippingCreate(freeShippingCodeDiscount: $discount) {
                codeDiscountNode { id }
                userErrors { field message }
              }
            }`,
            {
              discount: {
                title: campaign.name, code: campaign.discountCode, startsAt, endsAt, destination,
                // Required on create — omitting it fails with "Context can't be blank".
                // Matches the basic-code branch below; `customerSelection` is deprecated on
                // current API versions but is the field that exists on the pinned one.
                customerSelection: { all: true },
              },
            }
          );
          const ue = result.data?.discountCodeFreeShippingCreate?.userErrors || [];
          if (ue.length) errors.push(...ue.map((e: any) => e.message));
          else createdIds.push(result.data?.discountCodeFreeShippingCreate?.codeDiscountNode?.id);
        }
      } else {
        const value = campaign.discountType === "percentage"
          ? { percentage: campaign.discountValue / 100 }
          : { discountAmount: { amount: String(campaign.discountValue), appliesOnEachItem: false } };

        const result = await runMutation(admin,
          `#graphql
          mutation create($discount: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $discount) {
              codeDiscountNode { id }
              userErrors { field message }
            }
          }`,
          {
            discount: {
              title: campaign.name, code: campaign.discountCode, startsAt, endsAt,
              customerGets: { value, items },
              customerSelection: { all: true },
            },
          }
        );
        const ue = result.data?.discountCodeBasicCreate?.userErrors || [];
        if (ue.length) errors.push(...ue.map((e: any) => e.message));
        else createdIds.push(result.data?.discountCodeBasicCreate?.codeDiscountNode?.id);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors, createdIds };
    }
    return { success: true, errors: [], createdIds };

  } catch (error) {
    console.error("createShopifyDiscount error:", error);
    return { success: false, errors: [String(error)], createdIds: [] };
  }
}

// Returns the ids of every Shopify discount belonging to a campaign, matching on
// title: the campaign name itself, plus the "name (…)" / "name - …" shapes older
// per-tier discounts used. Read-only — it does NOT delete anything.
//
// Must be called BEFORE creating any replacement discount with the same name:
// querying by title-prefix AFTER creation would also match the brand-new
// discounts and delete them along with the old ones. Callers should snapshot
// these ids first, then delete them explicitly once replacements are confirmed.
//
// Does NOT catch its own errors — a failed lookup must not be confused with "no
// matching discounts exist". Swallowing it previously made callers skip deletion
// silently; callers should catch and surface the failure to the merchant.
export async function findMatchingDiscountIds(
  admin: AdminApiContext,
  campaignName: string
): Promise<string[]> {
  const res = await admin.graphql(
    `#graphql
    query {
      discountNodes(first: 250) {
        nodes {
          id
          discount {
            __typename
            ... on DiscountAutomaticBasic { title }
            ... on DiscountAutomaticApp { title }
            ... on DiscountAutomaticBxgy { title }
            ... on DiscountAutomaticFreeShipping { title }
            ... on DiscountCodeBasic { title }
            ... on DiscountCodeFreeShipping { title }
          }
        }
      }
    }`
  );

  const data: any = await res.json();
  if (data?.errors) {
    throw new Error(
      `findMatchingDiscountIds GraphQL error for "${campaignName}": ${JSON.stringify(data.errors)}`
    );
  }
  const nodes = data?.data?.discountNodes?.nodes || [];

  return nodes
    .filter((n: any) => {
      const t = n.discount?.title || "";
      return (
        t === campaignName ||
        t.startsWith(campaignName + " (") ||
        t.startsWith(campaignName + " - ")
      );
    })
    .map((n: any) => n.id);
}

// Code discounts and automatic discounts are deleted by different mutations, so
// every id has to be classified before it can be removed. Ids reach us from two
// places with no type information attached: mutation payloads (which carry the
// concrete node type in the gid) and the discountNodes query (which does not).
async function resolveDiscountKinds(
  admin: AdminApiContext,
  ids: string[]
): Promise<Record<string, "code" | "automatic">> {
  const kinds: Record<string, "code" | "automatic"> = {};
  const unknown: string[] = [];

  for (const id of ids) {
    if (id.includes("DiscountCodeNode")) kinds[id] = "code";
    else if (id.includes("DiscountAutomaticNode")) kinds[id] = "automatic";
    else unknown.push(id);
  }

  if (unknown.length === 0) return kinds;

  // One batched lookup for everything the gid couldn't classify.
  const res = await admin.graphql(
    `#graphql
    query discountKinds($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on DiscountNode {
          id
          discount { __typename }
        }
      }
    }`,
    { variables: { ids: unknown } }
  );
  const data: any = await res.json();
  const nodes = data?.data?.nodes || [];

  for (const node of nodes) {
    if (!node?.id) continue;
    kinds[node.id] = (node.discount?.__typename || "").includes("Code")
      ? "code"
      : "automatic";
  }

  // Anything the lookup couldn't resolve falls back to automatic — every
  // campaign type except advanced_discount_code creates automatic discounts.
  for (const id of unknown) {
    if (!kinds[id]) kinds[id] = "automatic";
  }

  return kinds;
}

// Deletes the given Shopify discounts and returns a list of error messages —
// empty when every deletion succeeded. Errors are returned rather than thrown
// because callers treat the return value as the error channel and accumulate
// these alongside their own failures.
export async function deleteShopifyDiscountsByIds(
  admin: AdminApiContext,
  ids: string[]
): Promise<string[]> {
  // createShopifyDiscount pushes the mutation's node id without checking it
  // exists, so createdIds can legitimately contain undefined entries.
  const targets = (ids || []).filter(Boolean);
  if (targets.length === 0) return [];

  const errors: string[] = [];

  try {
    const kinds = await resolveDiscountKinds(admin, targets);

    for (const id of targets) {
      const result = kinds[id] === "code"
        ? await runMutation(admin,
            `#graphql
            mutation del($id: ID!) {
              discountCodeDelete(id: $id) {
                deletedCodeDiscountId
                userErrors { field message }
              }
            }`,
            { id }
          )
        : await runMutation(admin,
            `#graphql
            mutation del($id: ID!) {
              discountAutomaticDelete(id: $id) {
                deletedAutomaticDiscountId
                userErrors { field message }
              }
            }`,
            { id }
          );

      const ue =
        result.data?.discountCodeDelete?.userErrors ||
        result.data?.discountAutomaticDelete?.userErrors ||
        [];
      if (ue.length) {
        errors.push(...ue.map((e: any) => `Failed to delete ${id}: ${e.message}`));
      }
    }
  } catch (error) {
    console.error("deleteShopifyDiscountsByIds error:", error);
    errors.push(String(error));
  }

  return errors;
}