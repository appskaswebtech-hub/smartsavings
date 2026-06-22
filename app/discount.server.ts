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
//   minQuantityForShipping: string | null;   // NEW
//   requirementType: string | null;          // NEW: "amount" | "quantity" | "both"
//   discountCode: string | null;
//   bxgyDiscountPct?: string | null;  // separate discount % for Buy X Get Y "discounted item" mode
//   geoTarget: string | null;
//   combineWithProducts?: boolean;
//   combineWithOrders?: boolean;
//   combineWithShipping?: boolean;
// }

// function getItemsFilter(campaign: CampaignData) {
//   if (campaign.appliesTo === "specific_products" && campaign.productIds) {
//     try {
//       const ids = JSON.parse(campaign.productIds) as string[];

//       // Separate product GIDs from variant GIDs.
//       // Product GID:  gid://shopify/Product/123
//       // Variant GID:  gid://shopify/ProductVariant/456
//       const productGids = ids.filter(id => id.includes("/Product/") && !id.includes("/ProductVariant/"));
//       const variantGids = ids.filter(id => id.includes("/ProductVariant/"));

//       if (productGids.length === 0 && variantGids.length === 0) return { all: true };

//       // Shopify DiscountProductsInput supports both productsToAdd and
//       // productVariantsToAdd in the same object — mix freely.
//       return {
//         products: {
//           ...(productGids.length > 0 ? { productsToAdd:        productGids } : {}),
//           ...(variantGids.length > 0 ? { productVariantsToAdd: variantGids } : {}),
//         },
//       };
//     } catch { return { all: true }; }
//   }
//   if (campaign.appliesTo === "specific_collections" && campaign.collectionIds) {
//     try { return { collections: { add: JSON.parse(campaign.collectionIds) } }; }
//     catch { return { all: true }; }
//   }
//   return { all: true };
// }

// // Shopify requires `appliesOnEachItem` to be false whenever the discount's
// // `items` selector targets `{ all: true }` (no specific items given) — it's
// // only valid to apply the fixed amount to "each item" when there's a bounded
// // set of items (specific products/variants/collections) to apply it to.
// function eachItemAllowed(items: any): boolean {
//   return !(items && items.all === true);
// }

// async function runMutation(admin: AdminApiContext, query: string, variables: any): Promise<any> {
//   const response = await admin.graphql(query, { variables });
//   return response.json();
// }

// async function getShopPrimaryCountry(admin: AdminApiContext): Promise<string | null> {
//   try {
//     const r = await admin.graphql(`#graphql query { shop { billingAddress { countryCodeV2 } } }`);
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
//     return { countries: { add: [shopCountry], includeRestOfWorld: false } };
//   }
//   return { all: true };
// }

// function numericProductIds(productIdsJson: string | null): string[] {
//   if (!productIdsJson) return [];
//   try {
//     const arr = JSON.parse(productIdsJson) as string[];
//     return arr.map((id) => { const m = id.match(/\/(\d+)$/); return m ? m[1] : id; });
//   } catch { return []; }
// }

// function buildCombinesWith(campaign: CampaignData) {
//   return {
//     productDiscounts: campaign.combineWithProducts ?? true,
//     orderDiscounts: campaign.combineWithOrders ?? true,
//     shippingDiscounts: campaign.combineWithShipping ?? true,
//   };
// }

// function buildCombinesWithForShipping(campaign: CampaignData) {
//   return {
//     productDiscounts: campaign.combineWithProducts ?? true,
//     orderDiscounts: campaign.combineWithOrders ?? true,
//   };
// }

// async function findFreeShippingFunctionId(admin: AdminApiContext): Promise<string | null> {
//   // ── 1. Env var (fastest — set once, never query again) ──────────────
//   const envId = process.env.SHOPIFY_FREE_SHIPPING_FUNCTION_ID;
//   if (envId && envId.trim() !== "") return envId.trim();

//   try {
//     const r = await admin.graphql(`
//       #graphql
//       query {
//         shopifyFunctions(first: 50) {
//           nodes { id title apiType }
//         }
//       }
//     `);
//     const data = await r.json();
//     const nodes: any[] = data?.data?.shopifyFunctions?.nodes || [];

//     if (nodes.length === 0) {
//       console.error("[SmartSavings] No Shopify Functions found. Run: npm run deploy");
//       return null;
//     }

//     // Log all so you can see what's registered
//     console.log("[SmartSavings] Registered functions:",
//       nodes.map((n: any) => `"${n.title}" (${n.apiType})`).join(", ")
//     );

//     // ── 2. Match by apiType — most reliable, ignores title ───────────
//     const byType = nodes.find((n: any) =>
//       n.apiType === "cart_delivery_options_discounts_generate" ||
//       n.apiType?.includes("delivery") ||
//       n.apiType?.includes("shipping")
//     );
//     if (byType) {
//       console.log(`[SmartSavings] Found function by apiType: "${byType.title}" → ${byType.id}`);
//       return byType.id;
//     }

//     // ── 3. Fallback: partial title match ─────────────────────────────
//     const byTitle = nodes.find((n: any) =>
//       n.title?.toLowerCase().includes("shipping") ||
//       n.title?.toLowerCase().includes("free") ||
//       n.title?.toLowerCase().includes("delivery")
//     );
//     if (byTitle) {
//       console.log(`[SmartSavings] Found function by title: "${byTitle.title}" → ${byTitle.id}`);
//       return byTitle.id;
//     }

//     console.error("[SmartSavings] Could not match free shipping function. Available:", nodes.map((n: any) => n.title));
//     console.error("[SmartSavings] Add SHOPIFY_FREE_SHIPPING_FUNCTION_ID=<id> to your .env to fix this permanently.");
//     return null;
//   } catch (e) {
//     console.error("[SmartSavings] findFreeShippingFunctionId error:", e);
//     return null;
//   }
// }

// /**
//  * Create a function-backed free shipping discount.
//  * Used for:
//  *   - Specific products (always)
//  *   - All products with "both" (amount + quantity) requirement
//  *
//  * @param productIds  Numeric product IDs. Pass [] for all-products mode.
//  * @param minimumAmount  Dollar threshold (0 = no requirement).
//  * @param minimumQuantity  Item count threshold (0 = no requirement).
//  */
// async function createFunctionFreeShipping(
//   admin: AdminApiContext,
//   campaign: CampaignData,
//   startsAt: string,
//   endsAt: string | null,
//   productIds: string[],
//   minimumAmount: number,
//   minimumQuantity: number,
//   errors: string[],
//   requireBoth: boolean = true  // true = AND logic, false = OR logic
// ): Promise<string | null> {
//   const functionId = await findFreeShippingFunctionId(admin);
//   if (!functionId) {
//     errors.push("Free shipping function not found. Deploy the extension with `npm run deploy`.");
//     return null;
//   }

//   // Create the discount node
//   const createResult = await runMutation(admin,
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
//         combinesWith: buildCombinesWithForShipping(campaign),
//       },
//     }
//   );

//   const ue = createResult.data?.discountAutomaticAppCreate?.userErrors || [];
//   if (ue.length) { errors.push(...ue.map((e: any) => e.message)); return null; }

//   const discountId = createResult.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;
//   if (!discountId) { errors.push("Function discount creation returned no id."); return null; }

//   // Attach config metafield
//   const configValue = JSON.stringify({ productIds, minimumAmount, minimumQuantity, requireBoth });
//   const metafieldResult = await runMutation(admin,
//     `#graphql
//     mutation setMeta($metafields: [MetafieldsSetInput!]!) {
//       metafieldsSet(metafields: $metafields) {
//         metafields { id }
//         userErrors { field message }
//       }
//     }`,
//     {
//       metafields: [{
//         ownerId: discountId,
//         namespace: "$app:freeshipping",
//         key: "config",
//         type: "json",
//         value: configValue,
//       }],
//     }
//   );

//   const mfe = metafieldResult.data?.metafieldsSet?.userErrors || [];
//   if (mfe.length) {
//     errors.push("Discount created but config attach failed: " + mfe.map((e: any) => e.message).join(", "));
//   }
//   return discountId;
// }

// /**
//  * For a quantity-discount campaign targeting specific products/variants,
//  * returns the combined price of those items — used as a sanity ceiling so a
//  * fixed-amount tier can't be set higher than what the targeted items are
//  * actually worth (e.g. $181 off when the selected products total $180).
//  *
//  * Returns null when the ceiling can't be computed cheaply (campaign targets
//  * "all products" or "specific collections" — could be thousands of products),
//  * in which case the caller should skip the check. Shopify's discount engine
//  * still floors any single item's price at $0, so this is a merchant-facing
//  * sanity check rather than something that could break checkout math.
//  */
// async function getMaxFixedDiscountForItems(admin: AdminApiContext, campaign: CampaignData): Promise<number | null> {
//   if (campaign.appliesTo !== "specific_products" || !campaign.productIds) return null;

//   let ids: string[];
//   try { ids = JSON.parse(campaign.productIds) as string[]; } catch { return null; }

//   const productGids = ids.filter(id => id.includes("/Product/") && !id.includes("/ProductVariant/"));
//   const variantGids = ids.filter(id => id.includes("/ProductVariant/"));
//   if (productGids.length === 0 && variantGids.length === 0) return null;

//   let total = 0;

//   try {
//     if (productGids.length > 0) {
//       const q = productGids.slice(0, 20).map((id, i) =>
//         `p${i}: product(id: "${id}") { variants(first: 100) { nodes { price } } }`
//       ).join("\n");
//       const res = await admin.graphql(`#graphql query { ${q} }`);
//       const result = await res.json();
//       for (const p of Object.values(result.data || {}) as any[]) {
//         const prices = (p?.variants?.nodes || []).map((v: any) => parseFloat(v.price)).filter((n: number) => !isNaN(n));
//         // Use the cheapest variant per product — the most conservative ceiling,
//         // since the tier could end up applying to that variant.
//         if (prices.length > 0) total += Math.min(...prices);
//       }
//     }

//     if (variantGids.length > 0) {
//       const q = variantGids.slice(0, 50).map((id, i) =>
//         `v${i}: productVariant(id: "${id}") { price }`
//       ).join("\n");
//       const res = await admin.graphql(`#graphql query { ${q} }`);
//       const result = await res.json();
//       for (const v of Object.values(result.data || {}) as any[]) {
//         const price = parseFloat(v?.price);
//         if (!isNaN(price)) total += price;
//       }
//     }
//   } catch (e) {
//     console.error("[SmartSavings] getMaxFixedDiscountForItems error:", e);
//     return null;
//   }

//   return total;
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
//         : { discountAmount: { amount: String(campaign.discountValue), appliesOnEachItem: eachItemAllowed(items) } };

//       const result = await runMutation(admin,
//         `#graphql
//         mutation create($discount: DiscountAutomaticBasicInput!) {
//           discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
//             automaticDiscountNode { id }
//             userErrors { field message }
//           }
//         }`,
//         { discount: { title: campaign.name, startsAt, endsAt, customerGets: { value, items }, combinesWith: buildCombinesWith(campaign) } }
//       );
//       const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
//       if (ue.length) errors.push(...ue.map((e: any) => e.message));
//       else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
//     }

//     // ─── QUANTITY DISCOUNT ───
//     else if (campaign.type === "quantity_discount" && campaign.tiers) {
//       const tiers = JSON.parse(campaign.tiers)
//         .map((t: any) => ({
//           quantity: parseInt(t.quantity),
//           discount: parseFloat(t.discount),
//           discountType: t.discountType === "fixed_amount" ? "fixed_amount" : "percentage",
//         }))
//         .filter((t: any) => !isNaN(t.quantity) && !isNaN(t.discount))
//         .sort((a: any, b: any) => a.quantity - b.quantity);

//       // ── Guard: a fixed-amount tier shouldn't exceed what the targeted products are worth ──
//       const fixedTiers = tiers.filter((t: any) => t.discountType === "fixed_amount");
//       let tierValidationError: string | null = null;
//       if (fixedTiers.length > 0) {
//         const maxAllowed = await getMaxFixedDiscountForItems(admin, campaign);
//         if (maxAllowed !== null) {
//           const tooHigh = fixedTiers.find((t: any) => t.discount > maxAllowed);
//           if (tooHigh) {
//             tierValidationError = `Buy ${tooHigh.quantity}+: the fixed discount of $${tooHigh.discount} exceeds the combined price of the selected products ($${maxAllowed.toFixed(2)}). Lower the discount amount, or select higher-priced / more products.`;
//           }
//         }
//       }

//       if (tierValidationError) {
//         errors.push(tierValidationError);
//       } else {
//         for (const tier of tiers) {
//           const value = tier.discountType === "fixed_amount"
//             ? { discountAmount: { amount: String(tier.discount), appliesOnEachItem: eachItemAllowed(items) } }
//             : { percentage: tier.discount / 100 };
//           const tierLabel = tier.discountType === "fixed_amount" ? `Save $${tier.discount}` : `Save ${tier.discount}%`;

//           // TEMP DIAGNOSTIC — remove once the appliesOnEachItem issue is confirmed fixed.
//           console.log("[SmartSavings] quantity_discount tier debug", {
//             tierQuantity: tier.quantity,
//             discountType: tier.discountType,
//             appliesTo: campaign.appliesTo,
//             productIds: campaign.productIds,
//             items,
//             computedAppliesOnEachItem: tier.discountType === "fixed_amount" ? eachItemAllowed(items) : null,
//             value,
//           });

//           const result = await runMutation(admin,
//             `#graphql
//             mutation create($discount: DiscountAutomaticBasicInput!) {
//               discountAutomaticBasicCreate(automaticBasicDiscount: $discount) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               discount: {
//                 title: `${campaign.name} (Buy ${tier.quantity}+ ${tierLabel})`,
//                 startsAt, endsAt,
//                 minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: String(tier.quantity) } },
//                 customerGets: { value, items },
//                 combinesWith: buildCombinesWith(campaign),
//               },
//             }
//           );
//           const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
//           if (ue.length) errors.push(...ue.map((e: any) => `Buy ${tier.quantity}+: ${e.message}`));
//           else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
//         }
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
//               combinesWith: buildCombinesWith(campaign),
//             },
//           }
//         );
//         const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
//         if (ue.length) errors.push(...ue.map((e: any) => `$${tier.amount}+: ${e.message}`));
//         else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
//       }
//     }

//     // ─── SHIPPING DISCOUNT ───
//     else if (campaign.type === "shipping_discount") {
//       const requirementType = campaign.requirementType || "amount";
//       const minAmount = parseFloat(campaign.minOrderForShipping || "0") || 0;
//       const minQty = parseInt(campaign.minQuantityForShipping || "0") || 0;

//       if (campaign.appliesTo === "specific_products") {
//         // SPECIFIC PRODUCTS — always function-backed.
//         // Includes whichever requirements the merchant selected.
//         const productIds = numericProductIds(campaign.productIds);
//         if (productIds.length === 0) {
//           errors.push("Specific-products free shipping requires at least one product.");
//         } else {
//           const effectiveAmount = requirementType === "quantity" ? 0 : minAmount;
//           const effectiveQty   = requirementType === "amount"   ? 0 : minQty;
//           const id = await createFunctionFreeShipping(
//             admin, campaign, startsAt, endsAt,
//             productIds, effectiveAmount, effectiveQty, errors
//           );
//           if (id) createdIds.push(id);
//         }
//       } else {
//         // ALL PRODUCTS
//         const destination = await buildShippingDestination(admin, campaign.geoTarget, errors);
//         if (!destination) {
//           // buildShippingDestination already pushed an error
//         } else if (requirementType === "amount" || requirementType === "") {
//           // ── Amount only → standard Shopify discount ──
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
//                 ...(minAmount > 0 ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: String(minAmount) } } } : {}),
//                 destination,
//                 combinesWith: buildCombinesWithForShipping(campaign),
//               },
//             }
//           );
//           const ue = result.data?.discountAutomaticFreeShippingCreate?.userErrors || [];
//           if (ue.length) errors.push(...ue.map((e: any) => e.message));
//           else createdIds.push(result.data?.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id);

//         } else if (requirementType === "quantity") {
//           // ── Quantity only → standard Shopify discount with quantity requirement ──
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
//                 ...(minQty > 0 ? { minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: String(minQty) } } } : {}),
//                 destination,
//                 combinesWith: buildCombinesWithForShipping(campaign),
//               },
//             }
//           );
//           const ue = result.data?.discountAutomaticFreeShippingCreate?.userErrors || [];
//           if (ue.length) errors.push(...ue.map((e: any) => e.message));
//           else createdIds.push(result.data?.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id);

//         } else if (requirementType === "both") {
//           // ── Both → function-backed, AND logic ──
//           const id = await createFunctionFreeShipping(
//             admin, campaign, startsAt, endsAt,
//             [],          // empty = all products
//             minAmount,
//             minQty,
//             errors,
//             true         // requireBoth = true → AND logic
//           );
//           if (id) createdIds.push(id);

//         } else if (requirementType === "either") {
//           // ── Either → function-backed, OR logic ──
//           const id = await createFunctionFreeShipping(
//             admin, campaign, startsAt, endsAt,
//             [],          // empty = all products
//             minAmount,
//             minQty,
//             errors,
//             false        // requireBoth = false → OR logic
//           );
//           if (id) createdIds.push(id);
//         }
//       }
//     }

//     // ─── BUY X GET Y ───
//     else if (campaign.type === "buy_x_get_y") {
//       const buyQty = String(campaign.discountValue || 1);
//       // For "discounted" mode, use bxgyDiscountPct (separate field).
//       // Fallback to discountValue for backwards-compatibility with old campaigns.
//       const discountPct = campaign.bxgyDiscountPct
//         ? parseFloat(campaign.bxgyDiscountPct) / 100
//         : campaign.discountValue / 100;
//       const getEffect = campaign.discountType === "free"
//         ? { percentage: 1.0 }
//         : { percentage: discountPct };

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
//             customerGets: { value: { discountOnQuantity: { quantity: "1", effect: getEffect } }, items },
//             combinesWith: buildCombinesWith(campaign),
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
//             {
//               discount: {
//                 title: campaign.name,
//                 code: campaign.discountCode,
//                 startsAt, endsAt,
//                 destination,
//                 customerSelection: { all: true },
//                 combinesWith: buildCombinesWithForShipping(campaign),
//               },
//             }
//           );
//           const ue = result.data?.discountCodeFreeShippingCreate?.userErrors || [];
//           if (ue.length) errors.push(...ue.map((e: any) => e.message));
//           else createdIds.push(result.data?.discountCodeFreeShippingCreate?.codeDiscountNode?.id);
//         }
//       } else {
//         const value = campaign.discountType === "percentage"
//           ? { percentage: campaign.discountValue / 100 }
//           : { discountAmount: { amount: String(campaign.discountValue), appliesOnEachItem: false } };

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
//               title: campaign.name,
//               code: campaign.discountCode,
//               startsAt, endsAt,
//               customerGets: { value, items },
//               customerSelection: { all: true },
//               combinesWith: buildCombinesWith(campaign),
//             },
//           }
//         );
//         const ue = result.data?.discountCodeBasicCreate?.userErrors || [];
//         if (ue.length) errors.push(...ue.map((e: any) => e.message));
//         else createdIds.push(result.data?.discountCodeBasicCreate?.codeDiscountNode?.id);
//       }
//     }

//     if (errors.length > 0) return { success: false, errors, createdIds };
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
  minQuantityForShipping: string | null;   // NEW
  requirementType: string | null;          // NEW: "amount" | "quantity" | "both"
  discountCode: string | null;
  bxgyDiscountPct?: string | null;  // separate discount % for Buy X Get Y "discounted item" mode
  geoTarget: string | null;
  combineWithProducts?: boolean;
  combineWithOrders?: boolean;
  combineWithShipping?: boolean;
}

function getItemsFilter(campaign: CampaignData) {
  if (campaign.appliesTo === "specific_products" && campaign.productIds) {
    try {
      const ids = JSON.parse(campaign.productIds) as string[];

      // Separate product GIDs from variant GIDs.
      // Product GID:  gid://shopify/Product/123
      // Variant GID:  gid://shopify/ProductVariant/456
      const productGids = ids.filter(id => id.includes("/Product/") && !id.includes("/ProductVariant/"));
      const variantGids = ids.filter(id => id.includes("/ProductVariant/"));

      if (productGids.length === 0 && variantGids.length === 0) return { all: true };

      // Shopify DiscountProductsInput supports both productsToAdd and
      // productVariantsToAdd in the same object — mix freely.
      return {
        products: {
          ...(productGids.length > 0 ? { productsToAdd:        productGids } : {}),
          ...(variantGids.length > 0 ? { productVariantsToAdd: variantGids } : {}),
        },
      };
    } catch { return { all: true }; }
  }
  if (campaign.appliesTo === "specific_collections" && campaign.collectionIds) {
    try { return { collections: { add: JSON.parse(campaign.collectionIds) } }; }
    catch { return { all: true }; }
  }
  return { all: true };
}

// Shopify requires `appliesOnEachItem` to be false whenever the discount's
// `items` selector targets `{ all: true }` (no specific items given) — it's
// only valid to apply the fixed amount to "each item" when there's a bounded
// set of items (specific products/variants/collections) to apply it to.
function eachItemAllowed(items: any): boolean {
  return !(items && items.all === true);
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

function buildCombinesWith(campaign: CampaignData) {
  return {
    productDiscounts: campaign.combineWithProducts ?? true,
    orderDiscounts: campaign.combineWithOrders ?? true,
    shippingDiscounts: campaign.combineWithShipping ?? true,
  };
}

function buildCombinesWithForShipping(campaign: CampaignData) {
  return {
    productDiscounts: campaign.combineWithProducts ?? true,
    orderDiscounts: campaign.combineWithOrders ?? true,
  };
}

// Tiered campaigns (quantity_discount, cart_goal) create one automatic
// discount per tier. Shopify combines same-class (PRODUCT) automatic
// discounts whenever both sides allow it, so leaving productDiscounts on
// here would let every tier the cart qualifies for stack at once instead of
// just the best one. Force it off so sibling tiers stay mutually exclusive —
// Shopify then auto-applies whichever eligible tier benefits the customer
// most. Order/shipping combination still follows the merchant's checkboxes
// since those are a different discount class and don't cause tier stacking.
function buildCombinesWithForTiers(campaign: CampaignData) {
  return {
    productDiscounts: false,
    orderDiscounts: campaign.combineWithOrders ?? true,
    shippingDiscounts: campaign.combineWithShipping ?? true,
  };
}

async function findFreeShippingFunctionId(admin: AdminApiContext): Promise<string | null> {
  // ── 1. Env var (fastest — set once, never query again) ──────────────
  const envId = process.env.SHOPIFY_FREE_SHIPPING_FUNCTION_ID;
  if (envId && envId.trim() !== "") return envId.trim();

  try {
    const r = await admin.graphql(`
      #graphql
      query {
        shopifyFunctions(first: 50) {
          nodes { id title apiType }
        }
      }
    `);
    const data = await r.json();
    const nodes: any[] = data?.data?.shopifyFunctions?.nodes || [];

    if (nodes.length === 0) {
      console.error("[SmartSavings] No Shopify Functions found. Run: npm run deploy");
      return null;
    }

    // Log all so you can see what's registered
    console.log("[SmartSavings] Registered functions:",
      nodes.map((n: any) => `"${n.title}" (${n.apiType})`).join(", ")
    );

    // ── 2. Match by apiType — most reliable, ignores title ───────────
    const byType = nodes.find((n: any) =>
      n.apiType === "cart_delivery_options_discounts_generate" ||
      n.apiType?.includes("delivery") ||
      n.apiType?.includes("shipping")
    );
    if (byType) {
      console.log(`[SmartSavings] Found function by apiType: "${byType.title}" → ${byType.id}`);
      return byType.id;
    }

    // ── 3. Fallback: partial title match ─────────────────────────────
    const byTitle = nodes.find((n: any) =>
      n.title?.toLowerCase().includes("shipping") ||
      n.title?.toLowerCase().includes("free") ||
      n.title?.toLowerCase().includes("delivery")
    );
    if (byTitle) {
      console.log(`[SmartSavings] Found function by title: "${byTitle.title}" → ${byTitle.id}`);
      return byTitle.id;
    }

    console.error("[SmartSavings] Could not match free shipping function. Available:", nodes.map((n: any) => n.title));
    console.error("[SmartSavings] Add SHOPIFY_FREE_SHIPPING_FUNCTION_ID=<id> to your .env to fix this permanently.");
    return null;
  } catch (e) {
    console.error("[SmartSavings] findFreeShippingFunctionId error:", e);
    return null;
  }
}

/**
 * Create a function-backed free shipping discount.
 * Used for:
 *   - Specific products (always)
 *   - All products with "both" (amount + quantity) requirement
 *
 * @param productIds  Numeric product IDs. Pass [] for all-products mode.
 * @param minimumAmount  Dollar threshold (0 = no requirement).
 * @param minimumQuantity  Item count threshold (0 = no requirement).
 */
async function createFunctionFreeShipping(
  admin: AdminApiContext,
  campaign: CampaignData,
  startsAt: string,
  endsAt: string | null,
  productIds: string[],
  minimumAmount: number,
  minimumQuantity: number,
  errors: string[],
  requireBoth: boolean = true  // true = AND logic, false = OR logic
): Promise<string | null> {
  const functionId = await findFreeShippingFunctionId(admin);
  if (!functionId) {
    errors.push("Free shipping function not found. Deploy the extension with `npm run deploy`.");
    return null;
  }

  // Create the discount node
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

  // Attach config metafield
  const configValue = JSON.stringify({ productIds, minimumAmount, minimumQuantity, requireBoth });
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

/**
 * For a quantity-discount campaign targeting specific products/variants,
 * returns the combined price of those items — used as a sanity ceiling so a
 * fixed-amount tier can't be set higher than what the targeted items are
 * actually worth (e.g. $181 off when the selected products total $180).
 *
 * Returns null when the ceiling can't be computed cheaply (campaign targets
 * "all products" or "specific collections" — could be thousands of products),
 * in which case the caller should skip the check. Shopify's discount engine
 * still floors any single item's price at $0, so this is a merchant-facing
 * sanity check rather than something that could break checkout math.
 */
async function getMaxFixedDiscountForItems(admin: AdminApiContext, campaign: CampaignData): Promise<number | null> {
  if (campaign.appliesTo !== "specific_products" || !campaign.productIds) return null;

  let ids: string[];
  try { ids = JSON.parse(campaign.productIds) as string[]; } catch { return null; }

  const productGids = ids.filter(id => id.includes("/Product/") && !id.includes("/ProductVariant/"));
  const variantGids = ids.filter(id => id.includes("/ProductVariant/"));
  if (productGids.length === 0 && variantGids.length === 0) return null;

  let total = 0;

  try {
    if (productGids.length > 0) {
      const q = productGids.slice(0, 20).map((id, i) =>
        `p${i}: product(id: "${id}") { variants(first: 100) { nodes { price } } }`
      ).join("\n");
      const res = await admin.graphql(`#graphql query { ${q} }`);
      const result = await res.json();
      for (const p of Object.values(result.data || {}) as any[]) {
        const prices = (p?.variants?.nodes || []).map((v: any) => parseFloat(v.price)).filter((n: number) => !isNaN(n));
        // Use the cheapest variant per product — the most conservative ceiling,
        // since the tier could end up applying to that variant.
        if (prices.length > 0) total += Math.min(...prices);
      }
    }

    if (variantGids.length > 0) {
      const q = variantGids.slice(0, 50).map((id, i) =>
        `v${i}: productVariant(id: "${id}") { price }`
      ).join("\n");
      const res = await admin.graphql(`#graphql query { ${q} }`);
      const result = await res.json();
      for (const v of Object.values(result.data || {}) as any[]) {
        const price = parseFloat(v?.price);
        if (!isNaN(price)) total += price;
      }
    }
  } catch (e) {
    console.error("[SmartSavings] getMaxFixedDiscountForItems error:", e);
    return null;
  }

  return total;
}

/**
 * Delete all Shopify discounts whose title exactly matches the campaign name
 * or starts with it followed by " (" — i.e. tier sub-discounts like
 * "Summer Sale (Buy 2+ Save 5%)".
 *
 * Call this from the campaign DELETE action so every Shopify discount created
 * for a campaign (one per tier) is fully removed, not just the stored ID.
 */
export async function deleteMatchingDiscounts(admin: AdminApiContext, campaignName: string): Promise<void> {
  try {
    const r = await admin.graphql(`#graphql
      query {
        discountNodes(first: 250) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticBasic        { title }
              ... on DiscountAutomaticBxgy          { title }
              ... on DiscountAutomaticFreeShipping  { title }
              ... on DiscountAutomaticApp           { title }
              ... on DiscountCodeBasic              { title }
              ... on DiscountCodeFreeShipping       { title }
            }
          }
        }
      }
    `);
    const data = await r.json();
    const nodes: any[] = data?.data?.discountNodes?.nodes || [];

    const matching = nodes.filter((n: any) => {
      const title: string = n.discount?.title || "";
      return (
        title === campaignName ||
        title.startsWith(campaignName + " (") ||
        title.startsWith(campaignName + " - ")
      );
    });

    for (const node of matching) {
      const typeName: string = node.discount?.__typename || "";
      if (typeName.includes("Automatic")) {
        await runMutation(admin,
          `#graphql mutation del($id: ID!) {
            discountAutomaticDelete(id: $id) {
              deletedAutomaticDiscountId
              userErrors { field message }
            }
          }`,
          { id: node.id }
        );
      } else if (typeName.includes("Code")) {
        await runMutation(admin,
          `#graphql mutation del($id: ID!) {
            discountCodeDelete(id: $id) {
              deletedCodeDiscountId
              userErrors { field message }
            }
          }`,
          { id: node.id }
        );
      }
    }

    if (matching.length > 0) {
      console.log(`[SmartSavings] Cleaned up ${matching.length} stale Shopify discount(s) for campaign "${campaignName}"`);
    }
  } catch (e) {
    // Non-fatal — log and continue so the new discounts still get created
    console.error("[SmartSavings] deleteMatchingDiscounts error:", e);
  }
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
        : { discountAmount: { amount: String(campaign.discountValue), appliesOnEachItem: eachItemAllowed(items) } };

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
        .map((t: any) => ({
          quantity: parseInt(t.quantity),
          discount: parseFloat(t.discount),
          discountType: t.discountType === "fixed_amount" ? "fixed_amount" : "percentage",
        }))
        .filter((t: any) => !isNaN(t.quantity) && !isNaN(t.discount) && t.discount > 0 && t.quantity > 0)
        .sort((a: any, b: any) => a.quantity - b.quantity);

      // ── Guard: duplicate quantities mean multiple discounts fire for the same qty ──
      const quantities = tiers.map((t: any) => t.quantity);
      const uniqueQtys = new Set(quantities);
      if (uniqueQtys.size !== quantities.length) {
        const dupes = quantities.filter((q: number, i: number) => quantities.indexOf(q) !== i);
        errors.push(`Tiers cannot share the same minimum quantity. Duplicate quantity found: ${[...new Set<number>(dupes)].map(q => `Buy ${q}+`).join(", ")}. Each tier must have a unique quantity threshold.`);
      }

      // ── Guard: a fixed-amount tier shouldn't exceed what the targeted products are worth ──
      const fixedTiers = tiers.filter((t: any) => t.discountType === "fixed_amount");
      let tierValidationError: string | null = null;
      if (fixedTiers.length > 0) {
        const maxAllowed = await getMaxFixedDiscountForItems(admin, campaign);
        if (maxAllowed !== null) {
          const tooHigh = fixedTiers.find((t: any) => t.discount > maxAllowed);
          if (tooHigh) {
            tierValidationError = `Buy ${tooHigh.quantity}+: the fixed discount of $${tooHigh.discount} exceeds the combined price of the selected products ($${maxAllowed.toFixed(2)}). Lower the discount amount, or select higher-priced / more products.`;
          }
        }
      }

      if (uniqueQtys.size !== quantities.length) {
        // error already pushed above — don't proceed to create any Shopify discounts
      } else if (tierValidationError) {
        errors.push(tierValidationError);
      } else {
        for (const tier of tiers) {
          const value = tier.discountType === "fixed_amount"
            ? { discountAmount: { amount: String(tier.discount), appliesOnEachItem: eachItemAllowed(items) } }
            : { percentage: tier.discount / 100 };
          const tierLabel = tier.discountType === "fixed_amount" ? `Save $${tier.discount}` : `Save ${tier.discount}%`;

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
                title: `${campaign.name} (Buy ${tier.quantity}+ ${tierLabel})`,
                startsAt, endsAt,
                minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: String(tier.quantity) } },
                customerGets: { value, items },
                combinesWith: buildCombinesWithForTiers(campaign),
              },
            }
          );
          const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
          if (ue.length) errors.push(...ue.map((e: any) => `Buy ${tier.quantity}+: ${e.message}`));
          else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
        }
      }
    }

    // ─── CART GOAL ───
    else if (campaign.type === "cart_goal" && campaign.tiers) {
      const tiers = JSON.parse(campaign.tiers)
        .map((t: any) => ({
          amount: parseFloat(t.amount),
          discount: parseFloat(t.discount),
          discountType: t.discountType === "fixed_amount" ? "fixed_amount" : "percentage",
        }))
        .filter((t: any) => !isNaN(t.amount) && !isNaN(t.discount) && t.discount > 0 && t.amount >= 0)
        .sort((a: any, b: any) => a.amount - b.amount);

      // ── Guard: duplicate spend amounts ──
      const amounts = tiers.map((t: any) => t.amount);
      const uniqueAmounts = new Set(amounts);
      if (uniqueAmounts.size !== amounts.length) {
        const dupes = amounts.filter((a: number, i: number) => amounts.indexOf(a) !== i);
        errors.push(`Cart goal tiers cannot share the same minimum spend amount. Duplicate amount found: ${[...new Set<number>(dupes)].map(a => `$${a}+`).join(", ")}.`);
      } else {
        for (const tier of tiers) {
          // cart_goal always targets all products → appliesOnEachItem must be false
          const value = tier.discountType === "fixed_amount"
            ? { discountAmount: { amount: String(tier.discount), appliesOnEachItem: false } }
            : { percentage: tier.discount / 100 };
          const tierLabel = tier.discountType === "fixed_amount"
            ? `Save $${tier.discount}`
            : `Save ${tier.discount}%`;

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
                title: `${campaign.name} (Spend $${tier.amount}+ ${tierLabel})`,
                startsAt, endsAt,
                minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: String(tier.amount) } },
                customerGets: { value, items: { all: true } },
                combinesWith: buildCombinesWithForTiers(campaign),
              },
            }
          );
          const ue = result.data?.discountAutomaticBasicCreate?.userErrors || [];
          if (ue.length) errors.push(...ue.map((e: any) => `$${tier.amount}+: ${e.message}`));
          else createdIds.push(result.data?.discountAutomaticBasicCreate?.automaticDiscountNode?.id);
        }
      }
    }

    // ─── SHIPPING DISCOUNT ───
    else if (campaign.type === "shipping_discount") {
      const requirementType = campaign.requirementType || "amount";
      const minAmount = parseFloat(campaign.minOrderForShipping || "0") || 0;
      const minQty = parseInt(campaign.minQuantityForShipping || "0") || 0;

      if (campaign.appliesTo === "specific_products") {
        // SPECIFIC PRODUCTS — always function-backed.
        // Includes whichever requirements the merchant selected.
        const productIds = numericProductIds(campaign.productIds);
        if (productIds.length === 0) {
          errors.push("Specific-products free shipping requires at least one product.");
        } else {
          const effectiveAmount = requirementType === "quantity" ? 0 : minAmount;
          const effectiveQty   = requirementType === "amount"   ? 0 : minQty;
          const id = await createFunctionFreeShipping(
            admin, campaign, startsAt, endsAt,
            productIds, effectiveAmount, effectiveQty, errors
          );
          if (id) createdIds.push(id);
        }
      } else {
        // ALL PRODUCTS
        const destination = await buildShippingDestination(admin, campaign.geoTarget, errors);
        if (!destination) {
          // buildShippingDestination already pushed an error
        } else if (requirementType === "amount" || requirementType === "") {
          // ── Amount only → standard Shopify discount ──
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
                ...(minAmount > 0 ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: String(minAmount) } } } : {}),
                destination,
                combinesWith: buildCombinesWithForShipping(campaign),
              },
            }
          );
          const ue = result.data?.discountAutomaticFreeShippingCreate?.userErrors || [];
          if (ue.length) errors.push(...ue.map((e: any) => e.message));
          else createdIds.push(result.data?.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id);

        } else if (requirementType === "quantity") {
          // ── Quantity only → standard Shopify discount with quantity requirement ──
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
                ...(minQty > 0 ? { minimumRequirement: { quantity: { greaterThanOrEqualToQuantity: String(minQty) } } } : {}),
                destination,
                combinesWith: buildCombinesWithForShipping(campaign),
              },
            }
          );
          const ue = result.data?.discountAutomaticFreeShippingCreate?.userErrors || [];
          if (ue.length) errors.push(...ue.map((e: any) => e.message));
          else createdIds.push(result.data?.discountAutomaticFreeShippingCreate?.automaticDiscountNode?.id);

        } else if (requirementType === "both") {
          // ── Both → function-backed, AND logic ──
          const id = await createFunctionFreeShipping(
            admin, campaign, startsAt, endsAt,
            [],          // empty = all products
            minAmount,
            minQty,
            errors,
            true         // requireBoth = true → AND logic
          );
          if (id) createdIds.push(id);

        } else if (requirementType === "either") {
          // ── Either → function-backed, OR logic ──
          const id = await createFunctionFreeShipping(
            admin, campaign, startsAt, endsAt,
            [],          // empty = all products
            minAmount,
            minQty,
            errors,
            false        // requireBoth = false → OR logic
          );
          if (id) createdIds.push(id);
        }
      }
    }

    // ─── BUY X GET Y ───
    else if (campaign.type === "buy_x_get_y") {
      const buyQty = String(campaign.discountValue || 1);
      // For "discounted" mode, use bxgyDiscountPct (separate field).
      // Fallback to discountValue for backwards-compatibility with old campaigns.
      const discountPct = campaign.bxgyDiscountPct
        ? parseFloat(campaign.bxgyDiscountPct) / 100
        : campaign.discountValue / 100;
      const getEffect = campaign.discountType === "free"
        ? { percentage: 1.0 }
        : { percentage: discountPct };

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
                title: campaign.name,
                code: campaign.discountCode,
                startsAt, endsAt,
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
              title: campaign.name,
              code: campaign.discountCode,
              startsAt, endsAt,
              customerGets: { value, items },
              customerSelection: { all: true },
              combinesWith: buildCombinesWith(campaign),
            },
          }
        );
        const ue = result.data?.discountCodeBasicCreate?.userErrors || [];
        if (ue.length) errors.push(...ue.map((e: any) => e.message));
        else createdIds.push(result.data?.discountCodeBasicCreate?.codeDiscountNode?.id);
      }
    }

    if (errors.length > 0) return { success: false, errors, createdIds };
    return { success: true, errors: [], createdIds };

  } catch (error) {
    console.error("createShopifyDiscount error:", error);
    return { success: false, errors: [String(error)], createdIds: [] };
  }
}