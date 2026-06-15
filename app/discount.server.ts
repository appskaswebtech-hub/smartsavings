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
//   return { all: true };
// }

// /**
//  * Strip "gid://shopify/Product/12345" → "12345".
//  * The function reads numeric IDs from the metafield, so we normalize here.
//  */
// function numericProductIds(productIdsJson: string | null): string[] {
//   if (!productIdsJson) return [];
//   try {
//     const arr = JSON.parse(productIdsJson) as string[];
//     return arr.map((id) => {
//       const m = id.match(/\/(\d+)$/);
//       return m ? m[1] : id;
//     });
//   } catch {
//     return [];
//   }
// }

// /**
//  * Look up the deployed Shopify Function for this app that targets
//  * cart.delivery-options.discounts.generate.run. Used for specific-products
//  * free shipping campaigns so we can route them through our strict rule.
//  *
//  * Returns the function id (e.g. "01H...") or null if not found.
//  */
// async function findFreeShippingFunctionId(admin: AdminApiContext): Promise<string | null> {
//   try {
//     const r = await admin.graphql(
//       `#graphql
//       query {
//         shopifyFunctions(first: 25) {
//           nodes {
//             id
//             apiType
//             title
//             apiVersion
//           }
//         }
//       }`
//     );
//     const data = await r.json();
//     const nodes = data?.data?.shopifyFunctions?.nodes || [];
//     // Filter for discount-class functions; the title we registered is
//     // "free-shipping-priority" (from shopify.extension.toml).
//     const match = nodes.find((n: any) =>
//       n.title === "free-shipping-priority" || n.title?.includes("free-shipping")
//     );
//     return match?.id || null;
//   } catch (e) {
//     console.error("findFreeShippingFunctionId error:", e);
//     return null;
//   }
// }

// /**
//  * Create the specific-products free shipping discount via the Function.
//  * Two GraphQL calls:
//  *   1. discountAutomaticAppCreate — creates the discount bound to our function
//  *   2. metafieldsSet — attaches the {productIds, minimumAmount} config to the discount
//  *
//  * Returns the discount node id, or null on failure.
//  */
// async function createSpecificFreeShipping(
//   admin: AdminApiContext,
//   campaign: CampaignData,
//   startsAt: string,
//   endsAt: string | null,
//   errors: string[]
// ): Promise<string | null> {
//   const functionId = await findFreeShippingFunctionId(admin);
//   if (!functionId) {
//     errors.push(
//       "Free shipping function not found. Deploy the extension with `npm run deploy`."
//     );
//     return null;
//   }

//   const minAmount = parseFloat(campaign.minOrderForShipping || "0");
//   const productIds = numericProductIds(campaign.productIds);

//   if (productIds.length === 0) {
//     errors.push("Specific-products free shipping requires at least one product.");
//     return null;
//   }
//   if (minAmount <= 0) {
//     errors.push("Specific-products free shipping requires a minimum order value.");
//     return null;
//   }

//   // Step 1: create the discount
//   const createResult = await runMutation(
//     admin,
//     `#graphql
//     mutation create($discount: DiscountAutomaticAppInput!) {
//       discountAutomaticAppCreate(automaticAppDiscount: $discount) {
//         automaticAppDiscount { discountId }
//         userErrors { field message }
//       }
//     }`,
//     {
//       discount: {
//         title: campaign.name,
//         functionId,
//         startsAt,
//         endsAt,
//         discountClasses: ["SHIPPING"],
//       },
//     }
//   );

//   const ue = createResult.data?.discountAutomaticAppCreate?.userErrors || [];
//   if (ue.length) {
//     errors.push(...ue.map((e: any) => e.message));
//     return null;
//   }

//   const discountId =
//     createResult.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;
//   if (!discountId) {
//     errors.push("Function discount creation returned no id.");
//     return null;
//   }

//   // Step 2: attach config metafield
//   const configValue = JSON.stringify({ productIds, minimumAmount: minAmount });
//   const metafieldResult = await runMutation(
//     admin,
//     `#graphql
//     mutation setMeta($metafields: [MetafieldsSetInput!]!) {
//       metafieldsSet(metafields: $metafields) {
//         metafields { id }
//         userErrors { field message }
//       }
//     }`,
//     {
//       metafields: [
//         {
//           ownerId: discountId,
//           namespace: "$app:freeshipping",
//           key: "config",
//           type: "json",
//           value: configValue,
//         },
//       ],
//     }
//   );

//   const mfe = metafieldResult.data?.metafieldsSet?.userErrors || [];
//   if (mfe.length) {
//     errors.push(
//       "Discount created but config attach failed: " +
//         mfe.map((e: any) => e.message).join(", ")
//     );
//     // We still return the id so caller can save it (and the merchant can fix the metafield manually).
//     return discountId;
//   }

//   return discountId;
// }

// export async function createShopifyDiscount(admin: AdminApiContext, campaign: CampaignData) {
//   const startsAt = campaign.startDate.toISOString();
//   const endsAt = campaign.endDate ? campaign.endDate.toISOString() : null;
//   const items = getItemsFilter(campaign);
//   const errors: string[] = [];
//   const createdIds: string[] = [];

//   try {
//     // ─── BULK PRICE ───
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

//     // ─── QUANTITY DISCOUNT ───
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

//     // ─── CART GOAL ───
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

//     // ─── SHIPPING DISCOUNT ───
//     // Two paths:
//     //   - specific_products → function-backed discount (strict rule)
//     //   - all (or anything else) → standard free shipping (Shopify's built-in)
//     else if (campaign.type === "shipping_discount") {
//       if (campaign.appliesTo === "specific_products") {
//         const id = await createSpecificFreeShipping(admin, campaign, startsAt, endsAt, errors);
//         if (id) createdIds.push(id);
//       } else {
//         // All-products path — unchanged from before
//         const minReq = campaign.minOrderForShipping
//           ? { subtotal: { greaterThanOrEqualToSubtotal: campaign.minOrderForShipping } }
//           : null;

//         const destination = await buildShippingDestination(admin, campaign.geoTarget, errors);

//         if (destination) {
//           const result = await runMutation(admin,
//             `#graphql
//             mutation create($discount: DiscountAutomaticFreeShippingInput!) {
//               discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $discount) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               discount: {
//                 title: campaign.name, startsAt, endsAt,
//                 ...(minReq ? { minimumRequirement: minReq } : {}),
//                 destination,
//               },
//             }
//           );
//           const ue = result.data?.discountAutomaticFreeShippingCreate?.userErrors || [];
//           if (ue.length) errors.push(...ue.map((e: any) => e.message));
//           else createdIds.push(result.data?.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id);
//         }
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
  collectionIds: string | null;
  freeShipping: boolean;
  minOrderForShipping: string | null;
  discountCode: string | null;
  geoTarget: string | null;
  combineWithProducts?: boolean;
  combineWithOrders?: boolean;
  combineWithShipping?: boolean;
}

function getItemsFilter(campaign: CampaignData) {
  if (campaign.appliesTo === "specific_products" && campaign.productIds) {
    try { return { products: { productsToAdd: JSON.parse(campaign.productIds) } }; }
    catch { return { all: true }; }
  }
  if (campaign.appliesTo === "specific_collections" && campaign.collectionIds) {
    try { return { collections: { add: JSON.parse(campaign.collectionIds) } }; }
    catch { return { all: true }; }
  }
  return { all: true };
}

async function runMutation(admin: AdminApiContext, query: string, variables: any): Promise<any> {
  const response = await admin.graphql(query, { variables });
  return response.json();
}

async function getShopPrimaryCountry(admin: AdminApiContext): Promise<string | null> {
  try {
    const r = await admin.graphql(`#graphql query { shop { billingAddress { countryCodeV2 } } }`);
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
    return { countries: { add: [shopCountry], includeRestOfWorld: false } };
  }
  return { all: true };
}

function numericProductIds(productIdsJson: string | null): string[] {
  if (!productIdsJson) return [];
  try {
    const arr = JSON.parse(productIdsJson) as string[];
    return arr.map((id) => { const m = id.match(/\/(\d+)$/); return m ? m[1] : id; });
  } catch { return []; }
}

/** combinesWith for non-shipping discount classes */
function buildCombinesWith(campaign: CampaignData) {
  return {
    productDiscounts: campaign.combineWithProducts ?? true,
    orderDiscounts: campaign.combineWithOrders ?? true,
    shippingDiscounts: campaign.combineWithShipping ?? true,
  };
}

/**
 * combinesWith for SHIPPING class discounts.
 * shippingDiscounts is NOT valid for the shipping class — Shopify rejects it.
 */
function buildCombinesWithForShipping(campaign: CampaignData) {
  return {
    productDiscounts: campaign.combineWithProducts ?? true,
    orderDiscounts: campaign.combineWithOrders ?? true,
    // shippingDiscounts intentionally omitted — invalid for shipping class
  };
}

async function findFreeShippingFunctionId(admin: AdminApiContext): Promise<string | null> {
  try {
    const r = await admin.graphql(
      `#graphql query { shopifyFunctions(first: 25) { nodes { id apiType title apiVersion } } }`
    );
    const data = await r.json();
    const nodes = data?.data?.shopifyFunctions?.nodes || [];
    const match = nodes.find((n: any) =>
      n.title === "free-shipping-priority" || n.title?.includes("free-shipping")
    );
    return match?.id || null;
  } catch (e) {
    console.error("findFreeShippingFunctionId error:", e);
    return null;
  }
}

async function createSpecificFreeShipping(
  admin: AdminApiContext,
  campaign: CampaignData,
  startsAt: string,
  endsAt: string | null,
  errors: string[]
): Promise<string | null> {
  const functionId = await findFreeShippingFunctionId(admin);
  if (!functionId) {
    errors.push("Free shipping function not found. Deploy the extension with `npm run deploy`.");
    return null;
  }
  const minAmount = parseFloat(campaign.minOrderForShipping || "0");
  const productIds = numericProductIds(campaign.productIds);
  if (productIds.length === 0) { errors.push("Specific-products free shipping requires at least one product."); return null; }
  if (minAmount <= 0) { errors.push("Specific-products free shipping requires a minimum order value."); return null; }

  const createResult = await runMutation(admin,
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
        combinesWith: buildCombinesWithForShipping(campaign),
      },
    }
  );

  const ue = createResult.data?.discountAutomaticAppCreate?.userErrors || [];
  if (ue.length) { errors.push(...ue.map((e: any) => e.message)); return null; }

  const discountId = createResult.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;
  if (!discountId) { errors.push("Function discount creation returned no id."); return null; }

  const configValue = JSON.stringify({ productIds, minimumAmount: minAmount });
  const metafieldResult = await runMutation(admin,
    `#graphql
    mutation setMeta($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      metafields: [{
        ownerId: discountId,
        namespace: "$app:freeshipping",
        key: "config",
        type: "json",
        value: configValue,
      }],
    }
  );

  const mfe = metafieldResult.data?.metafieldsSet?.userErrors || [];
  if (mfe.length) {
    errors.push("Discount created but config attach failed: " + mfe.map((e: any) => e.message).join(", "));
  }
  return discountId;
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
      const value = campaign.discountType === "percentage"
        ? { percentage: campaign.discountValue / 100 }
        : { discountAmount: { amount: String(campaign.discountValue), appliesToEachItem: true } };

      const result = await runMutation(admin,
        `#graphql
        mutation create($discount: DiscountAutomaticBasicInput!) {
          discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
            automaticDiscountNode { id }
            userErrors { field message }
          }
        }`,
        { discount: { title: campaign.name, startsAt, endsAt, customerGets: { value, items }, combinesWith: buildCombinesWith(campaign) } }
      );
      const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
      if (ue.length) errors.push(...ue.map((e: any) => e.message));
      else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
    }

    // ─── QUANTITY DISCOUNT ───
    else if (campaign.type === "quantity_discount" && campaign.tiers) {
      const tiers = JSON.parse(campaign.tiers)
        .map((t: any) => ({ quantity: parseInt(t.quantity), discount: parseFloat(t.discount) }))
        .filter((t: any) => !isNaN(t.quantity) && !isNaN(t.discount))
        .sort((a: any, b: any) => a.quantity - b.quantity);

      for (const tier of tiers) {
        const result = await runMutation(admin,
          `#graphql
          mutation create($discount: DiscountAutomaticBasicInput!) {
            discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
              automaticDiscountNode { id }
              userErrors { field message }
            }
          }`,
          {
            discount: {
              title: `${campaign.name} (Buy ${tier.quantity}+ Save ${tier.discount}%)`,
              startsAt, endsAt,
              minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: String(tier.quantity) } },
              customerGets: { value: { percentage: tier.discount / 100 }, items },
              combinesWith: buildCombinesWith(campaign),
            },
          }
        );
        const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
        if (ue.length) errors.push(...ue.map((e: any) => `Buy ${tier.quantity}+: ${e.message}`));
        else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
      }
    }

    // ─── CART GOAL ───
    else if (campaign.type === "cart_goal" && campaign.tiers) {
      const tiers = JSON.parse(campaign.tiers)
        .map((t: any) => ({ amount: parseFloat(t.amount), discount: parseFloat(t.discount) }))
        .filter((t: any) => !isNaN(t.amount) && !isNaN(t.discount))
        .sort((a: any, b: any) => a.amount - b.amount);

      for (const tier of tiers) {
        const result = await runMutation(admin,
          `#graphql
          mutation create($discount: DiscountAutomaticBasicInput!) {
            discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
              automaticDiscountNode { id }
              userErrors { field message }
            }
          }`,
          {
            discount: {
              title: `${campaign.name} (Spend $${tier.amount}+ Save ${tier.discount}%)`,
              startsAt, endsAt,
              minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: String(tier.amount) } },
              customerGets: { value: { percentage: tier.discount / 100 }, items: { all: true } },
              combinesWith: buildCombinesWith(campaign),
            },
          }
        );
        const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
        if (ue.length) errors.push(...ue.map((e: any) => `$${tier.amount}+: ${e.message}`));
        else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
      }
    }

    // ─── SHIPPING DISCOUNT ───
    else if (campaign.type === "shipping_discount") {
      if (campaign.appliesTo === "specific_products") {
        const id = await createSpecificFreeShipping(admin, campaign, startsAt, endsAt, errors);
        if (id) createdIds.push(id);
      } else {
        const minReq = campaign.minOrderForShipping
          ? { subtotal: { greaterThanOrEqualToSubtotal: campaign.minOrderForShipping } }
          : null;
        const destination = await buildShippingDestination(admin, campaign.geoTarget, errors);
        if (destination) {
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
                title: campaign.name, startsAt, endsAt,
                ...(minReq ? { minimumRequirement: minReq } : {}),
                destination,
                combinesWith: buildCombinesWithForShipping(campaign),
              },
            }
          );
          const ue = result.data?.discountAutomaticFreeShippingCreate?.userErrors || [];
          if (ue.length) errors.push(...ue.map((e: any) => e.message));
          else createdIds.push(result.data?.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id);
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
            customerGets: { value: { discountOnQuantity: { quantity: "1", effect: getEffect } }, items },
            combinesWith: buildCombinesWith(campaign),
          },
        }
      );
      const ue = result.data?.discountAutomaticBxgyCreate?.userErrors || [];
      if (ue.length) errors.push(...ue.map((e: any) => e.message));
      else createdIds.push(result.data?.discountAutomaticBxgyCreate?.automaticDiscountNode?.id);
    }

    // ─── ADVANCED DISCOUNT CODE ───
    //
    // Shopify does NOT allow two code discount nodes with the same code.
    // So we create exactly ONE node per campaign:
    //
    //   Case A — free shipping only (discountValue = 0, freeShipping = true)
    //     → DiscountCodeFreeShipping
    //
    //   Case B — amount discount only, OR amount + free shipping
    //     → DiscountCodeBasic
    //     When freeShipping is also checked, we force shippingDiscounts: true
    //     so this code stacks with any active automatic free shipping campaign.
    //     The code itself does NOT create a second shipping discount.
    //
    else if (campaign.type === "advanced_discount_code" && campaign.discountCode) {
      const hasAmountDiscount = campaign.discountValue > 0;

      // ── Case A: Free shipping only ──
      if (!hasAmountDiscount && campaign.freeShipping) {
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
                title: campaign.name,
                code: campaign.discountCode,
                startsAt,
                endsAt,
                destination,
                customerSelection: { all: true },
                combinesWith: buildCombinesWithForShipping(campaign),
              },
            }
          );
          const ue = result.data?.discountCodeFreeShippingCreate?.userErrors || [];
          if (ue.length) errors.push(...ue.map((e: any) => e.message));
          else createdIds.push(result.data?.discountCodeFreeShippingCreate?.codeDiscountNode?.id);
        }
      }

      // ── Case B: Amount discount (with or without free shipping stacking) ──
      else if (hasAmountDiscount) {
        const value = campaign.discountType === "percentage"
          ? { percentage: campaign.discountValue / 100 }
          : { discountAmount: { amount: String(campaign.discountValue), appliesToEachItem: false } };

        // If free shipping is checked, force shippingDiscounts combining ON
        // so this code stacks with any active automatic free shipping campaign.
        const combinesWith = {
          productDiscounts: campaign.combineWithProducts ?? true,
          orderDiscounts: campaign.combineWithOrders ?? true,
          shippingDiscounts: campaign.freeShipping ? true : (campaign.combineWithShipping ?? true),
        };

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
              title: campaign.name,
              code: campaign.discountCode,
              startsAt,
              endsAt,
              customerGets: { value, items },
              customerSelection: { all: true },
              combinesWith,
            },
          }
        );
        const ue = result.data?.discountCodeBasicCreate?.userErrors || [];
        if (ue.length) errors.push(...ue.map((e: any) => e.message));
        else createdIds.push(result.data?.discountCodeBasicCreate?.codeDiscountNode?.id);
      }

      // ── Case C: Nothing to create ──
      else {
        errors.push("Please enter a discount value or enable free shipping.");
      }
    }

    if (errors.length > 0) return { success: false, errors, createdIds };
    return { success: true, errors: [], createdIds };

  } catch (error) {
    console.error("createShopifyDiscount error:", error);
    return { success: false, errors: [String(error)], createdIds: [] };
  }
}