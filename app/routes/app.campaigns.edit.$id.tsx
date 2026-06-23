// import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
// import { useLoaderData, useNavigate, useActionData, useSubmit } from "@remix-run/react";
// import {
//   Page, Card, Text, BlockStack, InlineStack, Button, TextField,
//   Banner, Badge, InlineGrid, Divider, Select,
// } from "@shopify/polaris";
// import { useState, useCallback, useEffect } from "react";
// import { authenticate } from "../shopify.server";
// import db from "../db.server";

// // ── Loader ────────────────────────────────────────────────────────────────────
// export const loader = async ({ request, params }: LoaderFunctionArgs) => {
//   const { session, admin } = await authenticate.admin(request);
//   const { shop } = session;
//   const campaignId = params.id as string;

//   const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
//   if (!campaign || campaign.shop !== shop) {
//     throw new Response("Campaign not found", { status: 404 });
//   }

//   let tiers: any[] = [];
//   if (campaign.tiers) { try { tiers = JSON.parse(campaign.tiers); } catch {} }

//   return json({
//     campaign: {
//       ...campaign,
//       startDate: campaign.startDate ? new Date(campaign.startDate).toISOString().split("T")[0] : "",
//       endDate:   campaign.endDate   ? new Date(campaign.endDate).toISOString().split("T")[0]   : "",
//     },
//     tiers,
//   });
// };

// // ── Action ────────────────────────────────────────────────────────────────────
// export const action = async ({ request, params }: ActionFunctionArgs) => {
//   const { session, admin } = await authenticate.admin(request);
//   const { shop } = session;
//   const campaignId = params.id as string;

//   const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
//   if (!campaign || campaign.shop !== shop) {
//     return json({ success: false, message: "Campaign not found" });
//   }

//   const formData = await request.formData();
//   const newName        = (formData.get("name")         as string)?.trim();
//   const newStartDate   =  formData.get("startDate")    as string;
//   const newEndDate     =  formData.get("endDate")      as string;
//   const discountValue  =  formData.get("discountValue") as string;
//   const tiersJson      =  formData.get("tiers")        as string;

//   if (!newName) return json({ success: false, message: "Campaign name is required" });

//   const oldName = campaign.name;

//   // ── Build DB update payload ──
//   const dbUpdate: any = {
//     name:          newName,
//     startDate:     newStartDate ? new Date(newStartDate) : campaign.startDate,
//     endDate:       newEndDate   ? new Date(newEndDate)   : null,
//     updatedAt:     new Date(),
//   };

//   if (discountValue) {
//     dbUpdate.discountValue = parseFloat(discountValue);
//   }

//   let parsedTiers: any[] | null = null;
//   if (tiersJson) {
//     try {
//       parsedTiers = JSON.parse(tiersJson);
//       dbUpdate.tiers = tiersJson;
//     } catch {}
//   }

//   await db.campaign.update({ where: { id: campaignId }, data: dbUpdate });

//   // ── Update Shopify discounts ──
//   const errors: string[] = [];
//   try {
//     // Find all matching Shopify discounts (by old name — covers tier sub-discounts too)
//     const searchRes = await admin.graphql(
//       `#graphql
//       query searchDiscounts($query: String!) {
//         discountNodes(first: 100, query: $query) {
//           nodes {
//             id
//             discount {
//               __typename
//               ... on DiscountAutomaticBasic       { title startsAt endsAt
//                 customerGets { value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } }
//               }
//               ... on DiscountAutomaticApp          { title startsAt endsAt }
//               ... on DiscountAutomaticBxgy         { title startsAt endsAt }
//               ... on DiscountAutomaticFreeShipping { title startsAt endsAt }
//               ... on DiscountCodeBasic             { title startsAt endsAt codes(first:1) { nodes { code } } }
//               ... on DiscountCodeFreeShipping      { title startsAt endsAt }
//               ... on DiscountCodeBxgy              { title startsAt endsAt }
//             }
//           }
//         }
//       }`,
//       { variables: { query: `title:${oldName}*` } }
//     );
//     const searchResult = await searchRes.json();
//     let nodes = searchResult.data?.discountNodes?.nodes || [];

//     // Fallback: full scan if search returned nothing
//     if (nodes.length === 0) {
//       const allRes = await admin.graphql(`#graphql
//         query {
//           discountNodes(first: 250) {
//             nodes {
//               id
//               discount {
//                 __typename
//                 ... on DiscountAutomaticBasic       { title startsAt endsAt
//                   customerGets { value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } }
//                 }
//                 ... on DiscountAutomaticApp          { title startsAt endsAt }
//                 ... on DiscountAutomaticBxgy         { title startsAt endsAt }
//                 ... on DiscountAutomaticFreeShipping { title startsAt endsAt }
//                 ... on DiscountCodeBasic             { title startsAt endsAt }
//                 ... on DiscountCodeFreeShipping      { title startsAt endsAt }
//                 ... on DiscountCodeBxgy              { title startsAt endsAt }
//               }
//             }
//           }
//         }
//       `);
//       const allResult = await allRes.json();
//       nodes = allResult.data?.discountNodes?.nodes || [];
//     }

//     // Filter to matching nodes
//     const matching = nodes.filter((n: any) => {
//       const t = n.discount?.title || "";
//       return t === oldName || t.startsWith(oldName + " (") || t.startsWith(oldName + " - ");
//     });

//     const startsAt = newStartDate ? new Date(newStartDate).toISOString() : null;
//     const endsAt   = newEndDate   ? new Date(newEndDate).toISOString()   : null;

//     for (const node of matching) {
//       const typename = node.discount?.__typename || "";
//       const oldTitle = node.discount?.title || "";

//       // Compute new title: if campaign was renamed, replace the base name
//       const newTitle = oldName !== newName
//         ? oldTitle.replace(oldName, newName)
//         : oldTitle;

//       try {
//         if (typename === "DiscountAutomaticBasic") {
//           // Also update discount value for basic discounts
//           const currentPct = node.discount?.customerGets?.value?.percentage;
//           const currentAmt = node.discount?.customerGets?.value?.amount?.amount;

//           const valueInput = discountValue
//             ? (campaign.discountType === "fixed_amount"
//                 ? { discountAmount: { amount: parseFloat(discountValue), appliesOnEachItem: false } }
//                 : { percentage: parseFloat(discountValue) / 100 })
//             : (currentPct != null
//                 ? { percentage: currentPct }
//                 : { discountAmount: { amount: parseFloat(currentAmt || "0"), appliesOnEachItem: false } });

//           await admin.graphql(
//             `#graphql
//             mutation updateBasic($id: ID!, $input: DiscountAutomaticBasicInput!) {
//               discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $input) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               variables: {
//                 id: node.id,
//                 input: {
//                   title: newTitle,
//                   startsAt: startsAt ?? node.discount.startsAt,
//                   endsAt,
//                   customerGets: { value: valueInput },
//                 },
//               },
//             }
//           );
//         } else if (typename === "DiscountAutomaticApp") {
//           await admin.graphql(
//             `#graphql
//             mutation updateApp($id: ID!, $input: DiscountAutomaticAppInput!) {
//               discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $input) {
//                 automaticAppDiscount { discountId }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               variables: {
//                 id: node.id,
//                 input: { title: newTitle, startsAt: startsAt ?? node.discount.startsAt, endsAt },
//               },
//             }
//           );
//         } else if (typename === "DiscountAutomaticFreeShipping") {
//           await admin.graphql(
//             `#graphql
//             mutation updateShipping($id: ID!, $input: DiscountAutomaticFreeShippingInput!) {
//               discountAutomaticFreeShippingUpdate(id: $id, freeShippingDiscount: $input) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               variables: {
//                 id: node.id,
//                 input: { title: newTitle, startsAt: startsAt ?? node.discount.startsAt, endsAt },
//               },
//             }
//           );
//         } else if (typename === "DiscountCodeBasic") {
//           await admin.graphql(
//             `#graphql
//             mutation updateCode($id: ID!, $input: DiscountCodeBasicInput!) {
//               discountCodeBasicUpdate(id: $id, codeDiscount: $input) {
//                 codeDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               variables: {
//                 id: node.id,
//                 input: { title: newTitle, startsAt: startsAt ?? node.discount.startsAt, endsAt },
//               },
//             }
//           );
//         }
//         // Other types (BxGy, etc.) — skip Shopify update, DB updated above
//       } catch (e) {
//         errors.push(`${oldTitle}: ${String(e)}`);
//       }
//     }
//   } catch (e) {
//     errors.push(`Shopify sync error: ${String(e)}`);
//   }

//   if (errors.length > 0) {
//     return json({ success: true, message: `Saved with some Shopify errors: ${errors.join("; ")}` });
//   }

//   return redirect(`/app/campaigns/${campaignId}`);
// };

// // ── Helpers ───────────────────────────────────────────────────────────────────
// const TYPE_LABELS: Record<string, string> = {
//   bulk_price: "Bulk price", quantity_discount: "Quantity discount",
//   buy_x_get_y: "Buy X Get Y", advanced_discount_code: "Discount code",
//   cart_goal: "Cart goal", shipping_discount: "Shipping",
// };

// const isTiered = (type: string) => type === "quantity_discount" || type === "cart_goal";

// // ── Component ─────────────────────────────────────────────────────────────────
// export default function EditCampaign() {
//   const { campaign, tiers: initialTiers } = useLoaderData<typeof loader>();
//   const actionData = useActionData<{ success: boolean; message: string }>();
//   const navigate = useNavigate();
//   const submit = useSubmit();

//   const [name,      setName]      = useState(campaign.name);
//   const [startDate, setStartDate] = useState(campaign.startDate || "");
//   const [endDate,   setEndDate]   = useState(campaign.endDate   || "");
//   const [discountValue, setDiscountValue] = useState(String(campaign.discountValue ?? ""));
//   const [tiers, setTiers] = useState<any[]>(initialTiers);
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     if (actionData) setSaving(false);
//   }, [actionData]);

//   const handleTierChange = (idx: number, field: string, value: string) => {
//     setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
//   };

//   const handleSave = useCallback(() => {
//     setSaving(true);
//     const fd = new FormData();
//     fd.append("name", name);
//     fd.append("startDate", startDate);
//     fd.append("endDate", endDate);
//     if (!isTiered(campaign.type)) fd.append("discountValue", discountValue);
//     if (isTiered(campaign.type))  fd.append("tiers", JSON.stringify(tiers));
//     submit(fd, { method: "post" });
//   }, [name, startDate, endDate, discountValue, tiers, campaign.type, submit]);

//   return (
//     <Page
//       backAction={{ content: "Back", url: `/app/campaigns/${campaign.id}` }}
//       title={`Edit: ${campaign.name}`}
//       titleMetadata={<Badge>{TYPE_LABELS[campaign.type] || campaign.type}</Badge>}
//       primaryAction={{
//         content: saving ? "Saving…" : "Save",
//         loading: saving,
//         onAction: handleSave,
//       }}
//       secondaryActions={[{
//         content: "Cancel",
//         onAction: () => navigate(`/app/campaigns/${campaign.id}`),
//       }]}
//     >
//       <BlockStack gap="500">

//         {actionData?.message && (
//           <Banner
//             tone={actionData.success ? "warning" : "critical"}
//             onDismiss={() => {}}
//           >
//             <p>{actionData.message}</p>
//           </Banner>
//         )}

//         {/* ── Basic Info ── */}
//         <Card>
//           <BlockStack gap="400">
//             <Text as="h2" variant="headingMd">Campaign Details</Text>
//             <TextField
//               label="Campaign name"
//               value={name}
//               onChange={setName}
//               autoComplete="off"
//               helpText="Changing the name will also rename it in your Shopify discounts."
//             />
//             <InlineGrid columns={2} gap="400">
//               <TextField
//                 label="Start date"
//                 type="date"
//                 value={startDate}
//                 onChange={setStartDate}
//                 autoComplete="off"
//               />
//               <TextField
//                 label="End date"
//                 type="date"
//                 value={endDate}
//                 onChange={setEndDate}
//                 autoComplete="off"
//                 helpText="Leave blank for no end date."
//               />
//             </InlineGrid>
//           </BlockStack>
//         </Card>

//         {/* ── Tiered discount editor ── */}
//         {isTiered(campaign.type) && tiers.length > 0 && (
//           <Card>
//             <BlockStack gap="400">
//               <Text as="h2" variant="headingMd">
//                 {campaign.type === "cart_goal" ? "Spending Tiers" : "Quantity Tiers"}
//               </Text>
//               <Text as="p" variant="bodySm" tone="subdued">
//                 Edit the discount value for each tier. Changes apply immediately on your storefront.
//               </Text>
//               <Divider />
//               <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
//                 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "10px 16px", fontWeight: 700, fontSize: "12px", color: "#6d7175", background: "#f6f6f7", borderBottom: "1px solid #e1e3e5", textTransform: "uppercase", letterSpacing: "0.04em" }}>
//                   <span>{campaign.type === "cart_goal" ? "Min. Spend ($)" : "Min. Quantity"}</span>
//                   <span>Discount (%)</span>
//                   <span>Preview</span>
//                 </div>
//                 {tiers.map((tier, idx) => (
//                   <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "12px 16px", borderBottom: idx < tiers.length - 1 ? "1px solid #f0f0f0" : "none", alignItems: "center", gap: "12px" }}>
//                     <TextField
//                       label=""
//                       labelHidden
//                       type="number"
//                       value={String(tier.quantity ?? tier.amount ?? tier.spend ?? "")}
//                       onChange={v => handleTierChange(idx, campaign.type === "cart_goal" ? "amount" : "quantity", v)}
//                       autoComplete="off"
//                       prefix={campaign.type === "cart_goal" ? "$" : ""}
//                       suffix={campaign.type === "cart_goal" ? "" : " items"}
//                     />
//                     <TextField
//                       label=""
//                       labelHidden
//                       type="number"
//                       value={String(tier.discount ?? "")}
//                       onChange={v => handleTierChange(idx, "discount", v)}
//                       autoComplete="off"
//                       suffix={tier.discountType === "fixed_amount" ? "$" : "%"}
//                     />
//                     <Text as="p" variant="bodyMd" tone="success" fontWeight="semibold">
//                       {tier.discountType === "fixed_amount"
//                         ? `$${tier.discount} off`
//                         : `${tier.discount}% off`}
//                     </Text>
//                   </div>
//                 ))}
//               </div>
//             </BlockStack>
//           </Card>
//         )}

//         {/* ── Simple discount editor ── */}
//         {!isTiered(campaign.type) && campaign.discountType !== "free_shipping" && (
//           <Card>
//             <BlockStack gap="400">
//               <Text as="h2" variant="headingMd">Discount Value</Text>
//               <TextField
//                 label={campaign.discountType === "fixed_amount" ? "Fixed amount off ($)" : "Percentage off (%)"}
//                 type="number"
//                 value={discountValue}
//                 onChange={setDiscountValue}
//                 autoComplete="off"
//                 prefix={campaign.discountType === "fixed_amount" ? "$" : ""}
//                 suffix={campaign.discountType === "fixed_amount" ? "" : "%"}
//                 helpText="Updates the Shopify discount value directly."
//               />
//             </BlockStack>
//           </Card>
//         )}

//         {/* ── Read-only info ── */}
//         <Card>
//           <BlockStack gap="300">
//             <Text as="h2" variant="headingMd">Read-only Info</Text>
//             <Text as="p" variant="bodySm" tone="subdued">
//               These fields cannot be changed after campaign creation. To change the discount type or applies-to scope, delete this campaign and create a new one.
//             </Text>
//             <Divider />
//             <InlineGrid columns={2} gap="400">
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" tone="subdued">Campaign Type</Text>
//                 <Badge>{TYPE_LABELS[campaign.type] || campaign.type}</Badge>
//               </BlockStack>
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" tone="subdued">Applies To</Text>
//                 <Text as="p" variant="bodyMd">
//                   {campaign.appliesTo === "all" ? "All products" :
//                    campaign.appliesTo === "specific_products" ? "Specific products" :
//                    "Specific collections"}
//                 </Text>
//               </BlockStack>
//             </InlineGrid>
//           </BlockStack>
//         </Card>

//       </BlockStack>
//     </Page>
//   );
// }


// import {
//   json, redirect,
//   type LoaderFunctionArgs,
//   type ActionFunctionArgs,
// } from "@remix-run/node";
// import { useLoaderData, useNavigate, useSubmit, useActionData, useFetcher } from "@remix-run/react";
// import {
//   Page, Card, Text, BlockStack, InlineStack, Button, Box,
//   TextField, Select, Checkbox, Banner, FormLayout, Layout, Divider, Badge,
// } from "@shopify/polaris";
// import { useState } from "react";
// import { useAppBridge } from "@shopify/app-bridge-react";
// import { authenticate } from "../shopify.server";
// import db from "../db.server";

// const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
//   bulk_price: "Bulk price editor",
//   quantity_discount: "Quantity discount",
//   buy_x_get_y: "Buy X Get Y",
//   advanced_discount_code: "Advanced discount code",
//   cart_goal: "Cart goal",
//   shipping_discount: "Shipping discount",
// };

// // ── Loader ────────────────────────────────────────────────────────────────────
// export const loader = async ({ request, params }: LoaderFunctionArgs) => {
//   const { session, admin } = await authenticate.admin(request);
//   const { shop } = session;
//   const campaignId = params.id as string;

//   const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
//   if (!campaign || campaign.shop !== shop) {
//     throw new Response("Campaign not found", { status: 404 });
//   }

//   let tiers: any[] = [];
//   if (campaign.tiers) { try { tiers = JSON.parse(campaign.tiers); } catch {} }

//   // Load product titles/images for pre-filling the product picker
//   let loadedProducts: any[] = [];
//   if (campaign.appliesTo === "specific_products" && campaign.productIds) {
//     try {
//       const ids = JSON.parse(campaign.productIds) as string[];
//       const productGids = ids.filter(id => id.includes("/Product/") && !id.includes("/ProductVariant/"));
//       const variantGids = ids.filter(id => id.includes("/ProductVariant/"));

//       if (productGids.length > 0) {
//         const q = productGids.slice(0, 20).map((id, i) =>
//           `p${i}: product(id: "${id}") {
//             id title
//             images(first:1) { nodes { url } }
//             variants(first: 100) { nodes { id title price sku } }
//           }`
//         ).join("\n");
//         const res = await admin.graphql(`#graphql query { ${q} }`);
//         const result = await res.json();
//         for (const p of Object.values(result.data || {}) as any[]) {
//           if (!p?.title) continue;
//           loadedProducts.push({
//             id: p.id, title: p.title,
//             image: p.images?.nodes?.[0]?.url || "",
//             variants: (p.variants?.nodes || []).map((v: any) => ({
//               id: v.id, title: v.title, price: v.price, sku: v.sku || "",
//             })),
//             variantMode: "all",
//             selectedVariantIds: [],
//             showVariants: false,
//           });
//         }
//       }

//       // Specific variant GIDs — group by product
//       if (variantGids.length > 0) {
//         const q = variantGids.slice(0, 50).map((id, i) =>
//           `v${i}: productVariant(id: "${id}") {
//             id title price sku
//             product { id title images(first:1) { nodes { url } } variants(first: 100) { nodes { id title price sku } } }
//           }`
//         ).join("\n");
//         const res = await admin.graphql(`#graphql query { ${q} }`);
//         const result = await res.json();
//         const byProduct = new Map<string, any>();
//         for (const v of Object.values(result.data || {}) as any[]) {
//           if (!v?.title || !v?.product) continue;
//           const pid = v.product.id;
//           if (!byProduct.has(pid)) {
//             byProduct.set(pid, {
//               id: pid, title: v.product.title,
//               image: v.product.images?.nodes?.[0]?.url || "",
//               variants: (v.product.variants?.nodes || []).map((pv: any) => ({
//                 id: pv.id, title: pv.title, price: pv.price, sku: pv.sku || "",
//               })),
//               variantMode: "specific",
//               selectedVariantIds: [],
//               showVariants: false,
//             });
//           }
//           byProduct.get(pid)!.selectedVariantIds.push(v.id);
//         }
//         loadedProducts.push(...byProduct.values());
//       }
//     } catch {}
//   }

//   // Load collection titles for pre-filling
//   let loadedCollections: any[] = [];
//   if (campaign.appliesTo === "specific_collections" && campaign.collectionIds) {
//     try {
//       const ids = JSON.parse(campaign.collectionIds) as string[];
//       if (ids.length > 0) {
//         const q = ids.slice(0, 20).map((id, i) => `c${i}: collection(id: "${id}") { id title image { url } }`).join("\n");
//         const res = await admin.graphql(`#graphql query { ${q} }`);
//         const result = await res.json();
//         loadedCollections = Object.values(result.data || {})
//           .filter((c: any) => c?.id)
//           .map((c: any) => ({ id: c.id, title: c.title, image: c.image?.url || "" }));
//       }
//     } catch {}
//   }

//   return json({
//     campaign: {
//       ...campaign,
//       startDate: campaign.startDate ? new Date(campaign.startDate).toISOString().split("T")[0] : "",
//       endDate:   campaign.endDate   ? new Date(campaign.endDate).toISOString().split("T")[0]   : "",
//     },
//     tiers,
//     loadedProducts,
//     loadedCollections,
//   });
// };

// // ── Action ────────────────────────────────────────────────────────────────────
// export const action = async ({ request, params }: ActionFunctionArgs) => {
//   const { session, admin } = await authenticate.admin(request);
//   const { shop } = session;
//   const campaignId = params.id as string;

//   const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
//   if (!campaign || campaign.shop !== shop) {
//     return json({ success: false, error: "Campaign not found" });
//   }

//   const formData = await request.formData();
//   const name          = (formData.get("name")          as string)?.trim();
//   const discountType  =  formData.get("discountType")  as string;
//   const discountValue = parseFloat((formData.get("discountValue") as string) || "0");
//   const appliesTo     =  formData.get("appliesTo")     as string;
//   const startNow      =  formData.get("startNow")      === "true";
//   const startDate     =  formData.get("startDate")     as string;
//   const hasEndDate    =  formData.get("hasEndDate")    === "true";
//   const endDate       =  formData.get("endDate")       as string;
//   const tiersJson     =  formData.get("tiers")         as string;
//   const productIds    =  formData.get("productIds")    as string;
//   const collectionIds =  formData.get("collectionIds") as string;
//   const minOrderForShipping    = formData.get("minOrderForShipping")    as string;
//   const minQuantityForShipping = formData.get("minQuantityForShipping") as string;
//   const requirementType        = (formData.get("requirementType") as string) || "amount";
//   const geoTarget              =  formData.get("geoTarget")        as string;
//   const combineWithProducts    =  formData.get("combineWithProducts")  === "true";
//   const combineWithOrders      =  formData.get("combineWithOrders")    === "true";
//   const combineWithShipping    =  formData.get("combineWithShipping")  === "true";
//   const bxgyDiscountPct        =  formData.get("bxgyDiscountPct")      as string;

//   if (!name) return json({ success: false, error: "Campaign name is required" });

//   const campaignStartDate = startNow ? new Date() : startDate ? new Date(startDate) : campaign.startDate!;
//   const campaignEndDate   = hasEndDate && endDate ? new Date(endDate) : null;
//   const finalDiscountType = campaign.type === "shipping_discount" ? "free_shipping" : discountType;

//   const storedMinAmount = requirementType === "quantity" ? null : (minOrderForShipping ? parseFloat(minOrderForShipping) : null);
//   const storedMinQty    = requirementType === "amount"   ? null : (minQuantityForShipping ? parseInt(minQuantityForShipping) : null);

//   const oldName = campaign.name;

//   // ── Update DB ──
//   await db.campaign.update({
//     where: { id: campaignId },
//     data: {
//       name,
//       discountType: finalDiscountType,
//       discountValue: Math.max(0, discountValue || 0),
//       appliesTo: appliesTo || "all",
//       startDate: campaignStartDate,
//       endDate: campaignEndDate,
//       tiers: tiersJson || null,
//       productIds: productIds || null,
//       collectionIds: collectionIds || null,
//       minimumAmount: storedMinAmount,
//       minimumQuantity: storedMinQty,
//       requirementType: requirementType || "amount",
//       geoTarget: geoTarget || null,
//       combineWithProducts,
//       combineWithOrders,
//       combineWithShipping,
//       updatedAt: new Date(),
//     },
//   });

//   // ── Update matching Shopify discounts ──
//   const errors: string[] = [];
//   try {
//     // Find all matching nodes (by old name)
//     const searchRes = await admin.graphql(
//       `#graphql query searchDiscounts($q: String!) {
//         discountNodes(first: 100, query: $q) {
//           nodes {
//             id
//             discount {
//               __typename
//               ... on DiscountAutomaticBasic       { title startsAt endsAt
//                 customerGets {
//                   value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } }
//                   items {
//                     ... on AllDiscountItems { allItems }
//                     ... on DiscountProducts { products(first:1) { nodes { id } } }
//                   }
//                 }
//               }
//               ... on DiscountAutomaticApp          { title startsAt endsAt }
//               ... on DiscountAutomaticBxgy         { title startsAt endsAt }
//               ... on DiscountAutomaticFreeShipping { title startsAt endsAt }
//               ... on DiscountCodeBasic             { title startsAt endsAt
//                 customerGets {
//                   value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } }
//                 }
//               }
//               ... on DiscountCodeFreeShipping { title startsAt endsAt }
//             }
//           }
//         }
//       }`,
//       { variables: { q: `title:${oldName}*` } }
//     );
//     const searchResult = await searchRes.json();
//     let nodes = searchResult.data?.discountNodes?.nodes || [];

//     // Fallback full scan
//     if (nodes.length === 0) {
//       const allRes = await admin.graphql(`#graphql query {
//         discountNodes(first: 250) {
//           nodes {
//             id
//             discount {
//               __typename
//               ... on DiscountAutomaticBasic       { title startsAt endsAt }
//               ... on DiscountAutomaticApp          { title startsAt endsAt }
//               ... on DiscountAutomaticBxgy         { title startsAt endsAt }
//               ... on DiscountAutomaticFreeShipping { title startsAt endsAt }
//               ... on DiscountCodeBasic             { title startsAt endsAt }
//               ... on DiscountCodeFreeShipping      { title startsAt endsAt }
//             }
//           }
//         }
//       }`);
//       const allResult = await allRes.json();
//       nodes = allResult.data?.discountNodes?.nodes || [];
//     }

//     const matching = nodes.filter((n: any) => {
//       const t = n.discount?.title || "";
//       return t === oldName || t.startsWith(oldName + " (") || t.startsWith(oldName + " - ");
//     });

//     const startsAt = campaignStartDate.toISOString();
//     const endsAt   = campaignEndDate ? campaignEndDate.toISOString() : null;

//     for (const node of matching) {
//       const typename = node.discount?.__typename || "";
//       const oldTitle = node.discount?.title || "";
//       const newTitle = oldName !== name ? oldTitle.replace(oldName, name) : oldTitle;

//       try {
//         if (typename === "DiscountAutomaticBasic") {
//           const isAllProducts = !node.discount?.customerGets?.items?.products?.nodes?.length;
//           const valueInput = finalDiscountType === "fixed_amount"
//             ? { discountAmount: { amount: discountValue, appliesOnEachItem: !isAllProducts } }
//             : { percentage: discountValue / 100 };

//           await admin.graphql(
//             `#graphql mutation upd($id: ID!, $input: DiscountAutomaticBasicInput!) {
//               discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $input) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               variables: {
//                 id: node.id,
//                 input: {
//                   title: newTitle,
//                   startsAt,
//                   endsAt,
//                   customerGets: { value: valueInput },
//                 },
//               },
//             }
//           );
//         } else if (typename === "DiscountAutomaticApp") {
//           await admin.graphql(
//             `#graphql mutation upd($id: ID!, $input: DiscountAutomaticAppInput!) {
//               discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $input) {
//                 automaticAppDiscount { discountId }
//                 userErrors { field message }
//               }
//             }`,
//             { variables: { id: node.id, input: { title: newTitle, startsAt, endsAt } } }
//           );
//         } else if (typename === "DiscountAutomaticFreeShipping") {
//           await admin.graphql(
//             `#graphql mutation upd($id: ID!, $input: DiscountAutomaticFreeShippingInput!) {
//               discountAutomaticFreeShippingUpdate(id: $id, freeShippingDiscount: $input) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             { variables: { id: node.id, input: { title: newTitle, startsAt, endsAt } } }
//           );
//         } else if (typename === "DiscountCodeBasic") {
//           const valueInput = finalDiscountType === "fixed_amount"
//             ? { discountAmount: { amount: discountValue, appliesOnEachItem: false } }
//             : { percentage: discountValue / 100 };
//           await admin.graphql(
//             `#graphql mutation upd($id: ID!, $input: DiscountCodeBasicInput!) {
//               discountCodeBasicUpdate(id: $id, codeDiscount: $input) {
//                 codeDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               variables: {
//                 id: node.id,
//                 input: { title: newTitle, startsAt, endsAt, customerGets: { value: valueInput } },
//               },
//             }
//           );
//         } else if (typename === "DiscountAutomaticBxgy") {
//           await admin.graphql(
//             `#graphql mutation upd($id: ID!, $input: DiscountAutomaticBxgyInput!) {
//               discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $input) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             { variables: { id: node.id, input: { title: newTitle, startsAt, endsAt } } }
//           );
//         }
//       } catch (e) {
//         errors.push(`${oldTitle}: ${String(e)}`);
//       }
//     }
//   } catch (e) {
//     errors.push(`Shopify sync error: ${String(e)}`);
//   }

//   if (errors.length > 0) {
//     return json({ success: false, error: `Saved with Shopify errors: ${errors.join("; ")}` });
//   }

//   return redirect(`/app/campaigns/${campaignId}`);
// };

// // ── Component ─────────────────────────────────────────────────────────────────
// export default function EditCampaign() {
//   const { campaign, tiers: loadedTiers, loadedProducts, loadedCollections } = useLoaderData<typeof loader>();
//   const actionData = useActionData<typeof action>();
//   const navigate = useNavigate();
//   const submit = useSubmit();
//   const shopify = useAppBridge();
//   const variantFetcher = useFetcher<{ variants: any[] }>();
//   const type = campaign.type;

//   // ── Detect tier discount type from loaded tiers ──
//   const initTierDT = (loadedTiers[0]?.discountType || "percentage") as "percentage" | "fixed_amount";

//   // ── State — pre-filled from campaign ──
//   const [name, setName]               = useState(campaign.name);
//   const [discountType, setDiscountType] = useState(campaign.discountType === "free_shipping" ? "percentage" : campaign.discountType);
//   const [discountValue, setDiscountValue] = useState(String(campaign.discountValue ?? ""));
//   const [appliesTo, setAppliesTo]     = useState(campaign.appliesTo || "all");
//   const [startNow, setStartNow]       = useState(!campaign.startDate);
//   const [startDate, setStartDate]     = useState(campaign.startDate || "");
//   const [hasEndDate, setHasEndDate]   = useState(!!campaign.endDate);
//   const [endDate, setEndDate]         = useState(campaign.endDate || "");
//   const [geoTarget, setGeoTarget]     = useState(campaign.geoTarget || "");
//   const [requirementType, setRequirementType] = useState(campaign.requirementType || "amount");
//   const [minOrderForShipping, setMinOrderForShipping] = useState(String(campaign.minimumAmount ?? ""));
//   const [minQuantityForShipping, setMinQuantityForShipping] = useState(String(campaign.minimumQuantity ?? ""));
//   const [combineWithProducts, setCombineWithProducts] = useState(campaign.combineWithProducts ?? true);
//   const [combineWithOrders,   setCombineWithOrders]   = useState(campaign.combineWithOrders   ?? true);
//   const [combineWithShipping, setCombineWithShipping] = useState(campaign.combineWithShipping  ?? true);
//   const [bxgyDiscountPct, setBxgyDiscountPct] = useState(String(campaign.discountValue ?? "10"));

//   // ── Quantity discount tiers ──
//   const [tiers, setTiers] = useState<any[]>(
//     type === "quantity_discount" && loadedTiers.length > 0
//       ? loadedTiers.map((t: any) => ({
//           quantity: String(t.quantity || t.qty || ""),
//           discount: String(t.discount || ""),
//           discountType: t.discountType || initTierDT,
//         }))
//       : [
//           { quantity: "2", discount: "5",  discountType: "percentage" },
//           { quantity: "4", discount: "10", discountType: "percentage" },
//           { quantity: "8", discount: "15", discountType: "percentage" },
//         ]
//   );
//   const [tierDiscountType, setTierDiscountType] = useState<"percentage" | "fixed_amount">(
//     type === "quantity_discount" ? initTierDT : "percentage"
//   );

//   // ── Cart goal tiers ──
//   const [cartTiers, setCartTiers] = useState<any[]>(
//     type === "cart_goal" && loadedTiers.length > 0
//       ? loadedTiers.map((t: any) => ({
//           amount:      String(t.amount || t.spend || ""),
//           discount:    String(t.discount || ""),
//           discountType: t.discountType || initTierDT,
//         }))
//       : [
//           { amount: "50",  discount: "5",  discountType: "percentage" },
//           { amount: "100", discount: "10", discountType: "percentage" },
//           { amount: "150", discount: "15", discountType: "percentage" },
//         ]
//   );
//   const [cartTierDiscountType, setCartTierDiscountType] = useState<"percentage" | "fixed_amount">(
//     type === "cart_goal" ? initTierDT : "percentage"
//   );

//   // ── Products / collections ──
//   const [selectedProducts, setSelectedProducts] = useState<any[]>(loadedProducts);
//   const [selectedCollections, setSelectedCollections] = useState<any[]>(loadedCollections);
//   const [loadingVariantsFor, setLoadingVariantsFor] = useState<number | null>(null);

//   // Inject fetched variants into a product
//   if (variantFetcher.state === "idle" && variantFetcher.data && loadingVariantsFor !== null) {
//     const fetchedVariants = variantFetcher.data.variants || [];
//     const idx = loadingVariantsFor;
//     if (selectedProducts[idx] && selectedProducts[idx].variants.length === 0) {
//       setSelectedProducts(prev =>
//         prev.map((p, i) => i === idx
//           ? { ...p, variants: fetchedVariants.map((v: any) => ({ id: v.id, title: v.title, price: v.price, sku: v.sku || "" })), showVariants: true }
//           : p
//         )
//       );
//       setLoadingVariantsFor(null);
//     }
//   }

//   const loadVariants = (productId: string, productIdx: number) => {
//     const product = selectedProducts[productIdx];
//     if (product?.variants?.length > 0) {
//       setSelectedProducts(prev => prev.map((p, i) => i === productIdx ? { ...p, showVariants: !p.showVariants } : p));
//       return;
//     }
//     variantFetcher.load(`/app/api/variants?productId=${encodeURIComponent(productId)}`);
//     setLoadingVariantsFor(productIdx);
//   };

//   const setPositiveValue = (setter: (v: string) => void) => (val: string) => {
//     const num = parseFloat(val);
//     if (val === "" || num >= 0) setter(val);
//   };

//   const updateTier     = (i: number, f: string, v: string) => { const n = [...tiers];     n[i][f] = v; setTiers(n); };
//   const updateCartTier = (i: number, f: string, v: string) => { const n = [...cartTiers]; n[i][f] = v; setCartTiers(n); };

//   const duplicateTierQtys = new Set(
//     tiers.map(t => t.quantity).filter(q => q !== "" && tiers.filter(t => t.quantity === q).length > 1)
//   );
//   const duplicateCartAmounts = new Set(
//     cartTiers.map(t => t.amount).filter(a => a !== "" && cartTiers.filter(t => t.amount === a).length > 1)
//   );

//   const handleSave = () => {
//     if (!name.trim()) { shopify.toast.show("Campaign name is required.", { isError: true }); return; }
//     if (type === "shipping_discount" && !geoTarget) {
//       shopify.toast.show("Please choose where free shipping applies.", { isError: true }); return;
//     }
//     if (type === "quantity_discount" && duplicateTierQtys.size > 0) {
//       shopify.toast.show("Each tier must have a unique minimum quantity.", { isError: true }); return;
//     }
//     if (type === "cart_goal" && duplicateCartAmounts.size > 0) {
//       shopify.toast.show("Each cart goal tier must have a unique spend amount.", { isError: true }); return;
//     }

//     const fd = new FormData();
//     fd.append("name",          name);
//     fd.append("discountType",  discountType);
//     fd.append("discountValue", discountValue || "0");
//     fd.append("appliesTo",     appliesTo);
//     fd.append("startNow",      String(startNow));
//     fd.append("startDate",     startDate);
//     fd.append("hasEndDate",    String(hasEndDate));
//     fd.append("endDate",       endDate);
//     fd.append("geoTarget",     geoTarget);
//     fd.append("requirementType",        requirementType);
//     fd.append("minOrderForShipping",    minOrderForShipping);
//     fd.append("minQuantityForShipping", minQuantityForShipping);
//     fd.append("combineWithProducts",    String(combineWithProducts));
//     fd.append("combineWithOrders",      String(combineWithOrders));
//     fd.append("combineWithShipping",    String(combineWithShipping));
//     if (type === "buy_x_get_y")        fd.append("bxgyDiscountPct", bxgyDiscountPct || "10");
//     if (type === "quantity_discount")  fd.append("tiers", JSON.stringify(tiers.map(t => ({ ...t, discountType: tierDiscountType }))));
//     if (type === "cart_goal")          fd.append("tiers", JSON.stringify(cartTiers.map(t => ({ ...t, discountType: cartTierDiscountType }))));
//     if (selectedProducts.length > 0) {
//       const ids = selectedProducts.flatMap(p =>
//         p.variantMode === "specific" && p.selectedVariantIds.length > 0 ? p.selectedVariantIds : [p.id]
//       );
//       fd.append("productIds", JSON.stringify(ids));
//     }
//     if (selectedCollections.length > 0) fd.append("collectionIds", JSON.stringify(selectedCollections.map(c => c.id)));
//     submit(fd, { method: "post" });
//   };

//   const isFreeShipping = type === "shipping_discount";

//   return (
//     <Page
//       backAction={{ content: "Back", url: `/app/campaigns/${campaign.id}` }}
//       title={`Edit: ${campaign.name}`}
//       titleMetadata={<Badge>{CAMPAIGN_TYPE_LABELS[type] || type}</Badge>}
//       primaryAction={{ content: "Update campaign", onAction: handleSave }}
//       secondaryActions={[{ content: "Discard", onAction: () => navigate(`/app/campaigns/${campaign.id}`) }]}
//     >
//       {actionData && !actionData.success && (
//         <Box paddingBlockEnd="400"><Banner tone="critical"><p>{actionData.error}</p></Banner></Box>
//       )}
//       <Layout>
//         <Layout.Section>
//           <BlockStack gap="400">

//             {/* ── Campaign Details ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Campaign details</Text>
//                 <TextField
//                   label="Campaign name" value={name} onChange={setName} autoComplete="off"
//                   helpText="Changing the name also renames matching Shopify discounts."
//                 />
//               </BlockStack>
//             </Card>

//             {/* ── Discount Configuration ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Discount configuration</Text>

//                 {/* Bulk price */}
//                 {type === "bulk_price" && (
//                   <FormLayout>
//                     <Select
//                       label="Discount type"
//                       options={[
//                         { label: "Percentage", value: "percentage" },
//                         { label: "Fixed amount", value: "fixed_amount" },
//                         { label: "Set new price", value: "new_price" },
//                       ]}
//                       value={discountType}
//                       onChange={setDiscountType}
//                     />
//                     <TextField
//                       label={discountType === "percentage" ? "Discount percentage" : "Amount"}
//                       type="number" min={0}
//                       value={discountValue}
//                       onChange={setPositiveValue(setDiscountValue)}
//                       autoComplete="off"
//                       suffix={discountType === "percentage" ? "%" : "$"}
//                     />
//                   </FormLayout>
//                 )}

//                 {/* Quantity discount */}
//                 {type === "quantity_discount" && (
//                   <BlockStack gap="400">
//                     <Select
//                       label="Discount type"
//                       options={[
//                         { label: "Percentage off", value: "percentage" },
//                         { label: "Fixed amount off", value: "fixed_amount" },
//                       ]}
//                       value={tierDiscountType}
//                       onChange={(v) => {
//                         const t = v as "percentage" | "fixed_amount";
//                         setTierDiscountType(t);
//                         setTiers(prev => prev.map(tier => ({ ...tier, discountType: t })));
//                       }}
//                     />
//                     {tiers.map((tier, i) => (
//                       <InlineStack key={i} gap="200" blockAlign="end">
//                         <div style={{ flex: 1 }}>
//                           <TextField
//                             label={i === 0 ? "Min quantity" : ""}
//                             type="number" min={0}
//                             value={tier.quantity}
//                             onChange={(v) => updateTier(i, "quantity", v)}
//                             autoComplete="off" prefix="Buy" suffix="+"
//                             error={
//                               tier.quantity && duplicateTierQtys.has(tier.quantity)
//                                 ? "Duplicate quantity" : undefined
//                             }
//                           />
//                         </div>
//                         <div style={{ flex: 1 }}>
//                           <TextField
//                             label={i === 0 ? "Discount" : ""}
//                             type="number" min={0}
//                             value={tier.discount}
//                             onChange={(v) => updateTier(i, "discount", v)}
//                             autoComplete="off"
//                             prefix={tierDiscountType === "fixed_amount" ? "Save $" : "Save"}
//                             suffix={tierDiscountType === "fixed_amount" ? undefined : "%"}
//                           />
//                         </div>
//                         <Button tone="critical" size="slim" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} disabled={tiers.length <= 1}>Remove</Button>
//                       </InlineStack>
//                     ))}
//                     <Button size="slim" onClick={() => setTiers([...tiers, { quantity: "", discount: "", discountType: tierDiscountType }])}>Add tier</Button>
//                   </BlockStack>
//                 )}

//                 {/* Cart goal */}
//                 {type === "cart_goal" && (
//                   <BlockStack gap="400">
//                     <Select
//                       label="Discount type"
//                       options={[
//                         { label: "Percentage off", value: "percentage" },
//                         { label: "Fixed amount off", value: "fixed_amount" },
//                       ]}
//                       value={cartTierDiscountType}
//                       onChange={(v) => {
//                         const t = v as "percentage" | "fixed_amount";
//                         setCartTierDiscountType(t);
//                         setCartTiers(prev => prev.map(tier => ({ ...tier, discountType: t })));
//                       }}
//                     />
//                     {cartTiers.map((tier, i) => (
//                       <InlineStack key={i} gap="200" blockAlign="end">
//                         <div style={{ flex: 1 }}>
//                           <TextField
//                             label={i === 0 ? "Min cart value" : ""}
//                             type="number" min={0}
//                             value={tier.amount}
//                             onChange={(v) => updateCartTier(i, "amount", v)}
//                             autoComplete="off" prefix="$"
//                             error={tier.amount && duplicateCartAmounts.has(tier.amount) ? "Duplicate amount" : undefined}
//                           />
//                         </div>
//                         <div style={{ flex: 1 }}>
//                           <TextField
//                             label={i === 0 ? "Discount" : ""}
//                             type="number" min={0}
//                             value={tier.discount}
//                             onChange={(v) => updateCartTier(i, "discount", v)}
//                             autoComplete="off"
//                             prefix={cartTierDiscountType === "fixed_amount" ? "Save $" : "Save"}
//                             suffix={cartTierDiscountType === "fixed_amount" ? undefined : "%"}
//                           />
//                         </div>
//                         <Button tone="critical" size="slim" onClick={() => setCartTiers(cartTiers.filter((_, j) => j !== i))} disabled={cartTiers.length <= 1}>Remove</Button>
//                       </InlineStack>
//                     ))}
//                     <Button size="slim" onClick={() => setCartTiers([...cartTiers, { amount: "", discount: "", discountType: cartTierDiscountType }])}>Add tier</Button>
//                   </BlockStack>
//                 )}

//                 {/* Buy X Get Y */}
//                 {type === "buy_x_get_y" && (
//                   <FormLayout>
//                     <TextField
//                       label="Customer buys (quantity)"
//                       type="number" min={1}
//                       value={discountValue}
//                       onChange={setPositiveValue(setDiscountValue)}
//                       autoComplete="off"
//                     />
//                     <Select
//                       label="Customer gets"
//                       options={[{ label: "1 free item", value: "free" }, { label: "1 discounted item", value: "discounted" }]}
//                       value={discountType}
//                       onChange={setDiscountType}
//                     />
//                     {discountType === "discounted" && (
//                       <TextField
//                         label="Discount on get item (%)"
//                         type="number" min={1} max={99}
//                         value={bxgyDiscountPct}
//                         onChange={(v) => { const n = parseFloat(v); if (v === "" || (n >= 0 && n <= 100)) setBxgyDiscountPct(v); }}
//                         autoComplete="off" suffix="%"
//                       />
//                     )}
//                   </FormLayout>
//                 )}

//                 {/* Advanced discount code */}
//                 {type === "advanced_discount_code" && (
//                   <FormLayout>
//                     <Select
//                       label="Discount type"
//                       options={[
//                         { label: "Percentage off", value: "percentage" },
//                         { label: "Fixed amount off", value: "fixed_amount" },
//                         { label: "Free shipping", value: "free_shipping" },
//                       ]}
//                       value={discountType}
//                       onChange={setDiscountType}
//                     />
//                     {discountType !== "free_shipping" && (
//                       <TextField
//                         label="Discount value"
//                         type="number" min={0}
//                         value={discountValue}
//                         onChange={setPositiveValue(setDiscountValue)}
//                         autoComplete="off"
//                         suffix={discountType === "percentage" ? "%" : "$"}
//                       />
//                     )}
//                     {discountType === "free_shipping" && (
//                       <Select
//                         label="Where does free shipping apply?"
//                         options={[
//                           { label: "Select an option", value: "" },
//                           { label: "Domestic only", value: "domestic" },
//                           { label: "All zones (worldwide)", value: "all" },
//                         ]}
//                         value={geoTarget}
//                         onChange={setGeoTarget}
//                       />
//                     )}
//                   </FormLayout>
//                 )}

//                 {/* Shipping discount */}
//                 {type === "shipping_discount" && (
//                   <FormLayout>
//                     <Select
//                       label="Minimum requirement"
//                       options={[
//                         { label: "Minimum purchase amount ($)", value: "amount" },
//                         { label: "Minimum number of items",     value: "quantity" },
//                         { label: "Both — amount AND quantity",  value: "both" },
//                         { label: "Either — amount OR quantity", value: "either" },
//                       ]}
//                       value={requirementType}
//                       onChange={setRequirementType}
//                     />
//                     {(requirementType === "amount" || requirementType === "both" || requirementType === "either") && (
//                       <TextField
//                         label="Minimum order value"
//                         type="number" min={0}
//                         value={minOrderForShipping}
//                         onChange={setPositiveValue(setMinOrderForShipping)}
//                         autoComplete="off" prefix="$"
//                       />
//                     )}
//                     {(requirementType === "quantity" || requirementType === "both" || requirementType === "either") && (
//                       <TextField
//                         label="Minimum number of items"
//                         type="number" min={1}
//                         value={minQuantityForShipping}
//                         onChange={(v) => { const n = parseInt(v); if (v === "" || n >= 0) setMinQuantityForShipping(v); }}
//                         autoComplete="off" suffix="items"
//                       />
//                     )}
//                     <Select
//                       label="Where does free shipping apply?"
//                       options={[
//                         { label: "Select an option", value: "" },
//                         { label: "Domestic only", value: "domestic" },
//                         { label: "All zones (worldwide)", value: "all" },
//                       ]}
//                       value={geoTarget}
//                       onChange={setGeoTarget}
//                     />
//                   </FormLayout>
//                 )}
//               </BlockStack>
//             </Card>

//             {/* ── Discount Combinations ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Discount combinations</Text>
//                 <BlockStack gap="300">
//                   <Checkbox label="Product discounts"  helpText="Stack with product discount codes"   checked={combineWithProducts} onChange={setCombineWithProducts} />
//                   <Checkbox label="Order discounts"    helpText="Stack with order-level discount codes" checked={combineWithOrders}   onChange={setCombineWithOrders} />
//                   <Checkbox label="Shipping discounts" helpText="Stack with free shipping discount codes" checked={combineWithShipping} onChange={setCombineWithShipping} />
//                 </BlockStack>
//               </BlockStack>
//             </Card>

//             {/* ── Products ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Products</Text>
//                 <Select
//                   label="Applies to"
//                   options={[
//                     { label: "All products", value: "all" },
//                     { label: "Specific products", value: "specific_products" },
//                     { label: "Specific collections", value: "specific_collections" },
//                   ]}
//                   value={appliesTo}
//                   onChange={(val) => {
//                     setAppliesTo(val);
//                     if (val === "all") { setSelectedProducts([]); setSelectedCollections([]); }
//                   }}
//                 />

//                 {(appliesTo === "all" || appliesTo === "") && (
//                   <Banner tone="info"><p>Discount applies to all products in your store.</p></Banner>
//                 )}

//                 {appliesTo === "specific_products" && (
//                   <BlockStack gap="300">
//                     <InlineStack gap="200">
//                       <Button onClick={async () => {
//                         const selected = await shopify.resourcePicker({ type: "product", multiple: true, action: "select", filter: { variants: false } });
//                         if (selected) {
//                           setSelectedProducts(prev => {
//                             const existingIds = new Set(prev.map(p => p.id));
//                             const newP = selected.filter((p: any) => !existingIds.has(p.id)).map((p: any) => ({
//                               id: p.id, title: p.title,
//                               image: p.images?.[0]?.originalSrc || "",
//                               variants: (p.variants || []).map((v: any) => ({ id: v.id, title: v.title, price: v.price || "0.00", sku: v.sku || "" })),
//                               variantMode: "all",
//                               selectedVariantIds: [],
//                               showVariants: false,
//                             }));
//                             return [...prev, ...newP];
//                           });
//                         }
//                       }}>Browse products</Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedProducts([]); }}>or select all products</Button>
//                     </InlineStack>

//                     {selectedProducts.length > 0 && (
//                       <BlockStack gap="200">
//                         <Text as="p" variant="bodySm" fontWeight="bold">{selectedProducts.length} product(s) selected</Text>
//                         {selectedProducts.map((product, i) => (
//                           <Box key={product.id} background="bg-surface-secondary" borderRadius="200" padding="300">
//                             <BlockStack gap="200">
//                               <InlineStack align="space-between" blockAlign="center">
//                                 <InlineStack gap="200" blockAlign="center">
//                                   <div style={{ width: "36px", height: "36px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
//                                     {product.image
//                                       ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//                                       : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>P</div>}
//                                   </div>
//                                   <BlockStack gap="0">
//                                     <Text as="span" variant="bodySm" fontWeight="semibold">{product.title}</Text>
//                                     <Text as="span" variant="bodySm" tone="subdued">
//                                       {product.variantMode === "all"
//                                         ? `All ${product.variants.length} variants`
//                                         : `${product.selectedVariantIds.length} of ${product.variants.length} variants`}
//                                     </Text>
//                                   </BlockStack>
//                                 </InlineStack>
//                                 <InlineStack gap="100">
//                                   <Button size="slim" variant="plain" onClick={() => loadVariants(product.id, i)} loading={variantFetcher.state === "loading" && loadingVariantsFor === i}>
//                                     {product.showVariants ? "Hide variants" : `Select variants (${product.variants.length})`}
//                                   </Button>
//                                   <Button size="slim" tone="critical" onClick={() => {
//                                     const next = selectedProducts.filter((_, j) => j !== i);
//                                     setSelectedProducts(next);
//                                     if (next.length === 0) setAppliesTo("all");
//                                   }}>Remove</Button>
//                                 </InlineStack>
//                               </InlineStack>

//                               {product.showVariants && product.variants.length > 0 && (
//                                 <Box background="bg-surface" borderRadius="100" padding="300">
//                                   <BlockStack gap="200">
//                                     {["all", "specific"].map(mode => (
//                                       <label key={mode} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
//                                         <input type="radio" name={`variantMode-${i}`} checked={product.variantMode === mode}
//                                           onChange={() => setSelectedProducts(prev => prev.map((p, j) => j === i ? { ...p, variantMode: mode, selectedVariantIds: mode === "all" ? [] : p.selectedVariantIds } : p))} />
//                                         {mode === "all" ? `All ${product.variants.length} variants` : "Specific variants only"}
//                                       </label>
//                                     ))}
//                                     {product.variantMode === "specific" && (
//                                       <Box paddingInlineStart="400">
//                                         <BlockStack gap="100">
//                                           {product.variants.map((v: any) => {
//                                             const isChecked = product.selectedVariantIds.includes(v.id);
//                                             return (
//                                               <label key={v.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", padding: "4px 0" }}>
//                                                 <input type="checkbox" checked={isChecked}
//                                                   onChange={() => setSelectedProducts(prev => prev.map((p, j) => {
//                                                     if (j !== i) return p;
//                                                     const ids = isChecked ? p.selectedVariantIds.filter((id: string) => id !== v.id) : [...p.selectedVariantIds, v.id];
//                                                     return { ...p, selectedVariantIds: ids };
//                                                   }))} />
//                                                 <span style={{ flex: 1 }}>{v.title}</span>
//                                                 {v.sku && <span style={{ color: "#9ca3af", fontSize: "11px" }}>SKU: {v.sku}</span>}
//                                                 <span style={{ fontWeight: "500" }}>${v.price}</span>
//                                               </label>
//                                             );
//                                           })}
//                                         </BlockStack>
//                                       </Box>
//                                     )}
//                                   </BlockStack>
//                                 </Box>
//                               )}
//                             </BlockStack>
//                           </Box>
//                         ))}
//                       </BlockStack>
//                     )}
//                   </BlockStack>
//                 )}

//                 {appliesTo === "specific_collections" && (
//                   <BlockStack gap="300">
//                     <InlineStack gap="200">
//                       <Button onClick={async () => {
//                         const selected = await shopify.resourcePicker({ type: "collection", multiple: true, action: "select" });
//                         if (selected && selected.length > 0) {
//                           setSelectedCollections(selected.map((c: any) => ({ id: c.id, title: c.title, image: c.image?.originalSrc || "" })));
//                         }
//                       }}>Browse collections</Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedCollections([]); }}>or select all products</Button>
//                     </InlineStack>
//                     {selectedCollections.length > 0 && (
//                       <Box padding="300" background="bg-surface-secondary" borderRadius="200">
//                         <BlockStack gap="200">
//                           <Text as="p" variant="bodySm" fontWeight="bold">{selectedCollections.length} collection(s) selected</Text>
//                           {selectedCollections.map((col, i) => (
//                             <InlineStack key={i} align="space-between" blockAlign="center">
//                               <InlineStack gap="200" blockAlign="center">
//                                 <div style={{ width: "32px", height: "32px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
//                                   {col.image ? <img src={col.image} alt={col.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "C"}
//                                 </div>
//                                 <Text as="span" variant="bodySm">{col.title}</Text>
//                               </InlineStack>
//                               <Button size="slim" tone="critical" onClick={() => {
//                                 const next = selectedCollections.filter((_, j) => j !== i);
//                                 setSelectedCollections(next);
//                                 if (next.length === 0) setAppliesTo("all");
//                               }}>Remove</Button>
//                             </InlineStack>
//                           ))}
//                         </BlockStack>
//                       </Box>
//                     )}
//                   </BlockStack>
//                 )}
//               </BlockStack>
//             </Card>

//             {/* ── Schedule ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Schedule</Text>
//                 <Checkbox label="Start immediately" checked={startNow} onChange={(v) => setStartNow(v)} />
//                 {!startNow && (
//                   <TextField label="Start date" type="date" value={startDate} onChange={setStartDate} autoComplete="off" />
//                 )}
//                 <Checkbox label="Set end date" checked={hasEndDate} onChange={setHasEndDate} />
//                 {hasEndDate && (
//                   <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />
//                 )}
//               </BlockStack>
//             </Card>

//           </BlockStack>
//         </Layout.Section>

//         {/* ── Summary sidebar ── */}
//         <Layout.Section variant="oneThird">
//           <Card>
//             <BlockStack gap="400">
//               <Text as="h2" variant="headingMd">Summary</Text>
//               <Divider />
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" fontWeight="bold">Campaign type</Text>
//                 <Badge>{CAMPAIGN_TYPE_LABELS[type] || type}</Badge>
//               </BlockStack>
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" fontWeight="bold">Name</Text>
//                 <Text as="p" variant="bodyMd">{name || "—"}</Text>
//               </BlockStack>
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" fontWeight="bold">Applies to</Text>
//                 <Text as="p" variant="bodyMd">
//                   {appliesTo === "all" ? "All products"
//                     : appliesTo === "specific_products" ? `${selectedProducts.length} product(s)`
//                     : `${selectedCollections.length} collection(s)`}
//                 </Text>
//               </BlockStack>
//               {(type === "quantity_discount") && (
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Tiers</Text>
//                   {tiers.filter(t => t.quantity && t.discount).map((t, i) => (
//                     <Text key={i} as="p" variant="bodySm">
//                       Buy {t.quantity}+: {t.discountType === "fixed_amount" ? `$${t.discount} off` : `${t.discount}% off`}
//                     </Text>
//                   ))}
//                 </BlockStack>
//               )}
//               {(type === "cart_goal") && (
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Tiers</Text>
//                   {cartTiers.filter(t => t.amount && t.discount).map((t, i) => (
//                     <Text key={i} as="p" variant="bodySm">
//                       Spend ${t.amount}+: {t.discountType === "fixed_amount" ? `$${t.discount} off` : `${t.discount}% off`}
//                     </Text>
//                   ))}
//                 </BlockStack>
//               )}
//               <Divider />
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" fontWeight="bold">Schedule</Text>
//                 <Text as="p" variant="bodySm">
//                   {startNow ? "Starts immediately" : startDate ? `Starts ${startDate}` : "No start date set"}
//                 </Text>
//                 <Text as="p" variant="bodySm">
//                   {hasEndDate && endDate ? `Ends ${endDate}` : "No end date"}
//                 </Text>
//               </BlockStack>
//             </BlockStack>
//           </Card>
//         </Layout.Section>
//       </Layout>
//     </Page>
//   );
// }

// import {
//   json, redirect,
//   type LoaderFunctionArgs,
//   type ActionFunctionArgs,
// } from "@remix-run/node";
// import { useLoaderData, useNavigate, useSubmit, useActionData, useFetcher } from "@remix-run/react";
// import {
//   Page, Card, Text, BlockStack, InlineStack, Button, Box,
//   TextField, Select, Checkbox, Banner, FormLayout, Layout, Divider, Badge,
// } from "@shopify/polaris";
// import { useState } from "react";
// import { useAppBridge } from "@shopify/app-bridge-react";
// import { authenticate } from "../shopify.server";
// import db from "../db.server";

// const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
//   bulk_price: "Bulk price editor",
//   quantity_discount: "Quantity discount",
//   buy_x_get_y: "Buy X Get Y",
//   advanced_discount_code: "Advanced discount code",
//   cart_goal: "Cart goal",
//   shipping_discount: "Shipping discount",
// };

// // ── Loader ────────────────────────────────────────────────────────────────────
// export const loader = async ({ request, params }: LoaderFunctionArgs) => {
//   const { session, admin } = await authenticate.admin(request);
//   const { shop } = session;
//   const campaignId = params.id as string;

//   const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
//   if (!campaign || campaign.shop !== shop) {
//     throw new Response("Campaign not found", { status: 404 });
//   }

//   let tiers: any[] = [];
//   if (campaign.tiers) { try { tiers = JSON.parse(campaign.tiers); } catch {} }

//   // Load product titles/images for pre-filling the product picker
//   let loadedProducts: any[] = [];
//   if (campaign.appliesTo === "specific_products" && campaign.productIds) {
//     try {
//       const ids = JSON.parse(campaign.productIds) as string[];
//       const productGids = ids.filter(id => id.includes("/Product/") && !id.includes("/ProductVariant/"));
//       const variantGids = ids.filter(id => id.includes("/ProductVariant/"));

//       if (productGids.length > 0) {
//         const q = productGids.slice(0, 20).map((id, i) =>
//           `p${i}: product(id: "${id}") {
//             id title
//             images(first:1) { nodes { url } }
//             variants(first: 100) { nodes { id title price sku } }
//           }`
//         ).join("\n");
//         const res = await admin.graphql(`#graphql
//       query { ${q} }`);
//         const result = await res.json();
//         for (const p of Object.values(result.data || {}) as any[]) {
//           if (!p?.title) continue;
//           loadedProducts.push({
//             id: p.id, title: p.title,
//             image: p.images?.nodes?.[0]?.url || "",
//             variants: (p.variants?.nodes || []).map((v: any) => ({
//               id: v.id, title: v.title, price: v.price, sku: v.sku || "",
//             })),
//             variantMode: "all",
//             selectedVariantIds: [],
//             showVariants: false,
//           });
//         }
//       }

//       // Specific variant GIDs — group by product
//       if (variantGids.length > 0) {
//         const q = variantGids.slice(0, 50).map((id, i) =>
//           `v${i}: productVariant(id: "${id}") {
//             id title price sku
//             product { id title images(first:1) { nodes { url } } variants(first: 100) { nodes { id title price sku } } }
//           }`
//         ).join("\n");
//         const res = await admin.graphql(`#graphql
//       query { ${q} }`);
//         const result = await res.json();
//         const byProduct = new Map<string, any>();
//         for (const v of Object.values(result.data || {}) as any[]) {
//           if (!v?.title || !v?.product) continue;
//           const pid = v.product.id;
//           if (!byProduct.has(pid)) {
//             byProduct.set(pid, {
//               id: pid, title: v.product.title,
//               image: v.product.images?.nodes?.[0]?.url || "",
//               variants: (v.product.variants?.nodes || []).map((pv: any) => ({
//                 id: pv.id, title: pv.title, price: pv.price, sku: pv.sku || "",
//               })),
//               variantMode: "specific",
//               selectedVariantIds: [],
//               showVariants: false,
//             });
//           }
//           byProduct.get(pid)!.selectedVariantIds.push(v.id);
//         }
//         loadedProducts.push(...byProduct.values());
//       }
//     } catch {}
//   }

//   // Load collection titles for pre-filling
//   let loadedCollections: any[] = [];
//   if (campaign.appliesTo === "specific_collections" && campaign.collectionIds) {
//     try {
//       const ids = JSON.parse(campaign.collectionIds) as string[];
//       if (ids.length > 0) {
//         const q = ids.slice(0, 20).map((id, i) => `c${i}: collection(id: "${id}") { id title image { url } }`).join("\n");
//         const res = await admin.graphql(`#graphql
//       query { ${q} }`);
//         const result = await res.json();
//         loadedCollections = Object.values(result.data || {})
//           .filter((c: any) => c?.id)
//           .map((c: any) => ({ id: c.id, title: c.title, image: c.image?.url || "" }));
//       }
//     } catch {}
//   }

//   // For advanced_discount_code, fetch the existing code from Shopify
//   let existingDiscountCode = "";
//   if (campaign.type === "advanced_discount_code") {
//     try {
//       const codeRes = await admin.graphql(`#graphql
//         query {
//           discountNodes(first: 250) {
//             nodes {
//               discount {
//                 ... on DiscountCodeBasic {
//                   title
//                   codes(first: 1) { nodes { code } }
//                 }
//               }
//             }
//           }
//         }
//       `);
//       const codeResult = await codeRes.json();
//       const matchingNode = (codeResult.data?.discountNodes?.nodes || []).find(
//         (n: any) => n.discount?.title === campaign.name
//       );
//       existingDiscountCode = matchingNode?.discount?.codes?.nodes?.[0]?.code || "";
//     } catch {}
//   }

//   return json({
//     campaign: {
//       ...campaign,
//       startDate: campaign.startDate ? new Date(campaign.startDate).toISOString().split("T")[0] : "",
//       endDate:   campaign.endDate   ? new Date(campaign.endDate).toISOString().split("T")[0]   : "",
//     },
//     tiers,
//     loadedProducts,
//     loadedCollections,
//     existingDiscountCode,
//   });
// };

// // ── Action ────────────────────────────────────────────────────────────────────
// export const action = async ({ request, params }: ActionFunctionArgs) => {
//   const { session, admin } = await authenticate.admin(request);
//   const { shop } = session;
//   const campaignId = params.id as string;

//   const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
//   if (!campaign || campaign.shop !== shop) {
//     return json({ success: false, error: "Campaign not found" });
//   }

//   const formData = await request.formData();
//   const name          = (formData.get("name")          as string)?.trim();
//   const discountType  =  formData.get("discountType")  as string;
//   const discountValue = parseFloat((formData.get("discountValue") as string) || "0");
//   const appliesTo     =  formData.get("appliesTo")     as string;
//   const startNow      =  formData.get("startNow")      === "true";
//   const startDate     =  formData.get("startDate")     as string;
//   const hasEndDate    =  formData.get("hasEndDate")    === "true";
//   const endDate       =  formData.get("endDate")       as string;
//   const tiersJson     =  formData.get("tiers")         as string;
//   const productIds    =  formData.get("productIds")    as string;
//   const collectionIds =  formData.get("collectionIds") as string;
//   const minOrderForShipping    = formData.get("minOrderForShipping")    as string;
//   const minQuantityForShipping = formData.get("minQuantityForShipping") as string;
//   const requirementType        = (formData.get("requirementType") as string) || "amount";
//   const geoTarget              =  formData.get("geoTarget")        as string;
//   const combineWithProducts    =  formData.get("combineWithProducts")  === "true";
//   const combineWithOrders      =  formData.get("combineWithOrders")    === "true";
//   const combineWithShipping    =  formData.get("combineWithShipping")  === "true";
//   const bxgyDiscountPct        =  formData.get("bxgyDiscountPct")      as string;
//   const discountCode           =  formData.get("discountCode")         as string;

//   if (!name) return json({ success: false, error: "Campaign name is required" });

//   const campaignStartDate = startNow ? new Date() : startDate ? new Date(startDate) : campaign.startDate!;
//   const campaignEndDate   = hasEndDate && endDate ? new Date(endDate) : null;
//   const finalDiscountType = campaign.type === "shipping_discount" ? "free_shipping" : discountType;

//   const storedMinAmount = requirementType === "quantity" ? null : (minOrderForShipping ? parseFloat(minOrderForShipping) : null);
//   const storedMinQty    = requirementType === "amount"   ? null : (minQuantityForShipping ? parseInt(minQuantityForShipping) : null);

//   const oldName = campaign.name;

//   // ── Update DB ──
//   await db.campaign.update({
//     where: { id: campaignId },
//     data: {
//       name,
//       discountType: finalDiscountType,
//       discountValue: Math.max(0, discountValue || 0),
//       appliesTo: appliesTo || "all",
//       startDate: campaignStartDate,
//       endDate: campaignEndDate,
//       tiers: tiersJson || null,
//       productIds: productIds || null,
//       collectionIds: collectionIds || null,
//       minimumAmount: storedMinAmount,
//       minimumQuantity: storedMinQty,
//       requirementType: requirementType || "amount",
//       geoTarget: geoTarget || null,
//       combineWithProducts,
//       combineWithOrders,
//       combineWithShipping,
//       updatedAt: new Date(),
//     },
//   });

//   // ── Update matching Shopify discounts ──
//   const errors: string[] = [];
//   try {
//     // Find all matching nodes (by old name)
//     const searchRes = await admin.graphql(
//       `#graphql
//       query searchDiscounts($q: String!) {
//         discountNodes(first: 100, query: $q) {
//           nodes {
//             id
//             discount {
//               __typename
//               ... on DiscountAutomaticBasic       { title startsAt endsAt
//                 customerGets {
//                   value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } }
//                   items {
//                     ... on AllDiscountItems { allItems }
//                     ... on DiscountProducts { products(first:1) { nodes { id } } }
//                   }
//                 }
//               }
//               ... on DiscountAutomaticApp          { title startsAt endsAt }
//               ... on DiscountAutomaticBxgy         { title startsAt endsAt }
//               ... on DiscountAutomaticFreeShipping { title startsAt endsAt }
//               ... on DiscountCodeBasic             { title startsAt endsAt
//                 customerGets {
//                   value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } }
//                 }
//               }
//               ... on DiscountCodeFreeShipping { title startsAt endsAt }
//             }
//           }
//         }
//       }`,
//       { variables: { q: `title:${oldName}*` } }
//     );
//     const searchResult = await searchRes.json();
//     let nodes = searchResult.data?.discountNodes?.nodes || [];

//     // Fallback full scan
//     if (nodes.length === 0) {
//       const allRes = await admin.graphql(`#graphql
//       query {
//         discountNodes(first: 250) {
//           nodes {
//             id
//             discount {
//               __typename
//               ... on DiscountAutomaticBasic       { title startsAt endsAt }
//               ... on DiscountAutomaticApp          { title startsAt endsAt }
//               ... on DiscountAutomaticBxgy         { title startsAt endsAt }
//               ... on DiscountAutomaticFreeShipping { title startsAt endsAt }
//               ... on DiscountCodeBasic             { title startsAt endsAt }
//               ... on DiscountCodeFreeShipping      { title startsAt endsAt }
//             }
//           }
//         }
//       }`);
//       const allResult = await allRes.json();
//       nodes = allResult.data?.discountNodes?.nodes || [];
//     }

//     const matching = nodes.filter((n: any) => {
//       const t = n.discount?.title || "";
//       return t === oldName || t.startsWith(oldName + " (") || t.startsWith(oldName + " - ");
//     });

//     const startsAt = campaignStartDate.toISOString();
//     const endsAt   = campaignEndDate ? campaignEndDate.toISOString() : null;

//     for (const node of matching) {
//       const typename = node.discount?.__typename || "";
//       const oldTitle = node.discount?.title || "";
//       const newTitle = oldName !== name ? oldTitle.replace(oldName, name) : oldTitle;

//       try {
//         if (typename === "DiscountAutomaticBasic") {
//           const isAllProducts = !node.discount?.customerGets?.items?.products?.nodes?.length;
//           const valueInput = finalDiscountType === "fixed_amount"
//             ? { discountAmount: { amount: discountValue, appliesOnEachItem: !isAllProducts } }
//             : { percentage: discountValue / 100 };

//           await admin.graphql(
//             `#graphql
//             mutation upd($id: ID!, $input: DiscountAutomaticBasicInput!) {
//               discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $input) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               variables: {
//                 id: node.id,
//                 input: {
//                   title: newTitle,
//                   startsAt,
//                   endsAt,
//                   customerGets: { value: valueInput },
//                 },
//               },
//             }
//           );
//         } else if (typename === "DiscountAutomaticApp") {
//           await admin.graphql(
//             `#graphql
//             mutation upd($id: ID!, $input: DiscountAutomaticAppInput!) {
//               discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $input) {
//                 automaticAppDiscount { discountId }
//                 userErrors { field message }
//               }
//             }`,
//             { variables: { id: node.id, input: { title: newTitle, startsAt, endsAt } } }
//           );
//         } else if (typename === "DiscountAutomaticFreeShipping") {
//           await admin.graphql(
//             `#graphql
//             mutation upd($id: ID!, $input: DiscountAutomaticFreeShippingInput!) {
//               discountAutomaticFreeShippingUpdate(id: $id, freeShippingAutomaticDiscount: $input) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             { variables: { id: node.id, input: { title: newTitle, startsAt, endsAt } } }
//           );
//         } else if (typename === "DiscountCodeBasic") {
//           const valueInput = finalDiscountType === "fixed_amount"
//             ? { discountAmount: { amount: discountValue, appliesOnEachItem: false } }
//             : { percentage: discountValue / 100 };
//           await admin.graphql(
//             `#graphql
//             mutation upd($id: ID!, $input: DiscountCodeBasicInput!) {
//               discountCodeBasicUpdate(id: $id, basicCodeDiscount: $input) {
//                 codeDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             {
//               variables: {
//                 id: node.id,
//                 input: {
//                   title: newTitle,
//                   startsAt,
//                   endsAt,
//                   customerGets: { value: valueInput },
//                   ...(discountCode ? { code: discountCode } : {}),
//                 },
//               },
//             }
//           );
//         } else if (typename === "DiscountAutomaticBxgy") {
//           await admin.graphql(
//             `#graphql
//             mutation upd($id: ID!, $input: DiscountAutomaticBxgyInput!) {
//               discountAutomaticBxgyUpdate(id: $id, automaticBxgyDiscount: $input) {
//                 automaticDiscountNode { id }
//                 userErrors { field message }
//               }
//             }`,
//             { variables: { id: node.id, input: { title: newTitle, startsAt, endsAt } } }
//           );
//         }
//       } catch (e) {
//         errors.push(`${oldTitle}: ${String(e)}`);
//       }
//     }
//   } catch (e) {
//     errors.push(`Shopify sync error: ${String(e)}`);
//   }

//   if (errors.length > 0) {
//     return json({ success: false, error: `Saved with Shopify errors: ${errors.join("; ")}` });
//   }

//   return redirect(`/app/campaigns/${campaignId}`);
// };

// // ── Component ─────────────────────────────────────────────────────────────────
// export default function EditCampaign() {
//   const { campaign, tiers: loadedTiers, loadedProducts, loadedCollections, existingDiscountCode } = useLoaderData<typeof loader>();
//   const actionData = useActionData<typeof action>();
//   const navigate = useNavigate();
//   const submit = useSubmit();
//   const shopify = useAppBridge();
//   const variantFetcher = useFetcher<{ variants: any[] }>();
//   const type = campaign.type;

//   // ── Detect tier discount type from loaded tiers ──
//   const initTierDT = (loadedTiers[0]?.discountType || "percentage") as "percentage" | "fixed_amount";

//   // ── State — pre-filled from campaign ──
//   const [name, setName]               = useState(campaign.name);
//   const [discountType, setDiscountType] = useState(campaign.discountType === "free_shipping" ? "percentage" : campaign.discountType);
//   const [discountValue, setDiscountValue] = useState(String(campaign.discountValue ?? ""));
//   const [appliesTo, setAppliesTo]     = useState(campaign.appliesTo || "all");
//   const [startNow, setStartNow]       = useState(!campaign.startDate);
//   const [startDate, setStartDate]     = useState(campaign.startDate || "");
//   const [hasEndDate, setHasEndDate]   = useState(!!campaign.endDate);
//   const [endDate, setEndDate]         = useState(campaign.endDate || "");
//   const [geoTarget, setGeoTarget]     = useState(campaign.geoTarget || "");
//   const [requirementType, setRequirementType] = useState(campaign.requirementType || "amount");
//   const [minOrderForShipping, setMinOrderForShipping] = useState(String(campaign.minimumAmount ?? ""));
//   const [minQuantityForShipping, setMinQuantityForShipping] = useState(String(campaign.minimumQuantity ?? ""));
//   const [combineWithProducts, setCombineWithProducts] = useState(campaign.combineWithProducts ?? true);
//   const [combineWithOrders,   setCombineWithOrders]   = useState(campaign.combineWithOrders   ?? true);
//   const [combineWithShipping, setCombineWithShipping] = useState(campaign.combineWithShipping  ?? true);
//   const [bxgyDiscountPct, setBxgyDiscountPct] = useState(String(campaign.discountValue ?? "10"));
//   const [discountCode, setDiscountCode]       = useState(existingDiscountCode || "");

//   // ── Quantity discount tiers ──
//   const [tiers, setTiers] = useState<any[]>(
//     type === "quantity_discount" && loadedTiers.length > 0
//       ? loadedTiers.map((t: any) => ({
//           quantity: String(t.quantity || t.qty || ""),
//           discount: String(t.discount || ""),
//           discountType: t.discountType || initTierDT,
//         }))
//       : [
//           { quantity: "2", discount: "5",  discountType: "percentage" },
//           { quantity: "4", discount: "10", discountType: "percentage" },
//           { quantity: "8", discount: "15", discountType: "percentage" },
//         ]
//   );
//   const [tierDiscountType, setTierDiscountType] = useState<"percentage" | "fixed_amount">(
//     type === "quantity_discount" ? initTierDT : "percentage"
//   );

//   // ── Cart goal tiers ──
//   const [cartTiers, setCartTiers] = useState<any[]>(
//     type === "cart_goal" && loadedTiers.length > 0
//       ? loadedTiers.map((t: any) => ({
//           amount:      String(t.amount || t.spend || ""),
//           discount:    String(t.discount || ""),
//           discountType: t.discountType || initTierDT,
//         }))
//       : [
//           { amount: "50",  discount: "5",  discountType: "percentage" },
//           { amount: "100", discount: "10", discountType: "percentage" },
//           { amount: "150", discount: "15", discountType: "percentage" },
//         ]
//   );
//   const [cartTierDiscountType, setCartTierDiscountType] = useState<"percentage" | "fixed_amount">(
//     type === "cart_goal" ? initTierDT : "percentage"
//   );

//   // ── Products / collections ──
//   const [selectedProducts, setSelectedProducts] = useState<any[]>(loadedProducts);
//   const [selectedCollections, setSelectedCollections] = useState<any[]>(loadedCollections);
//   const [loadingVariantsFor, setLoadingVariantsFor] = useState<number | null>(null);

//   // Inject fetched variants into a product
//   if (variantFetcher.state === "idle" && variantFetcher.data && loadingVariantsFor !== null) {
//     const fetchedVariants = variantFetcher.data.variants || [];
//     const idx = loadingVariantsFor;
//     if (selectedProducts[idx] && selectedProducts[idx].variants.length === 0) {
//       setSelectedProducts(prev =>
//         prev.map((p, i) => i === idx
//           ? { ...p, variants: fetchedVariants.map((v: any) => ({ id: v.id, title: v.title, price: v.price, sku: v.sku || "" })), showVariants: true }
//           : p
//         )
//       );
//       setLoadingVariantsFor(null);
//     }
//   }

//   const loadVariants = (productId: string, productIdx: number) => {
//     const product = selectedProducts[productIdx];
//     if (product?.variants?.length > 0) {
//       setSelectedProducts(prev => prev.map((p, i) => i === productIdx ? { ...p, showVariants: !p.showVariants } : p));
//       return;
//     }
//     variantFetcher.load(`/app/api/variants?productId=${encodeURIComponent(productId)}`);
//     setLoadingVariantsFor(productIdx);
//   };

//   const setPositiveValue = (setter: (v: string) => void) => (val: string) => {
//     const num = parseFloat(val);
//     if (val === "" || num >= 0) setter(val);
//   };

//   const updateTier     = (i: number, f: string, v: string) => { const n = [...tiers];     n[i][f] = v; setTiers(n); };
//   const updateCartTier = (i: number, f: string, v: string) => { const n = [...cartTiers]; n[i][f] = v; setCartTiers(n); };

//   const duplicateTierQtys = new Set(
//     tiers.map(t => t.quantity).filter(q => q !== "" && tiers.filter(t => t.quantity === q).length > 1)
//   );
//   const duplicateCartAmounts = new Set(
//     cartTiers.map(t => t.amount).filter(a => a !== "" && cartTiers.filter(t => t.amount === a).length > 1)
//   );

//   const handleSave = () => {
//     if (!name.trim()) { shopify.toast.show("Campaign name is required.", { isError: true }); return; }
//     if (type === "shipping_discount" && !geoTarget) {
//       shopify.toast.show("Please choose where free shipping applies.", { isError: true }); return;
//     }
//     if (type === "quantity_discount" && duplicateTierQtys.size > 0) {
//       shopify.toast.show("Each tier must have a unique minimum quantity.", { isError: true }); return;
//     }
//     if (type === "cart_goal" && duplicateCartAmounts.size > 0) {
//       shopify.toast.show("Each cart goal tier must have a unique spend amount.", { isError: true }); return;
//     }

//     const fd = new FormData();
//     fd.append("name",          name);
//     fd.append("discountType",  discountType);
//     fd.append("discountValue", discountValue || "0");
//     fd.append("appliesTo",     appliesTo);
//     fd.append("startNow",      String(startNow));
//     fd.append("startDate",     startDate);
//     fd.append("hasEndDate",    String(hasEndDate));
//     fd.append("endDate",       endDate);
//     fd.append("geoTarget",     geoTarget);
//     fd.append("requirementType",        requirementType);
//     fd.append("minOrderForShipping",    minOrderForShipping);
//     fd.append("minQuantityForShipping", minQuantityForShipping);
//     fd.append("combineWithProducts",    String(combineWithProducts));
//     fd.append("combineWithOrders",      String(combineWithOrders));
//     fd.append("combineWithShipping",    String(combineWithShipping));
//     if (type === "buy_x_get_y")        fd.append("bxgyDiscountPct", bxgyDiscountPct || "10");
//     if (type === "advanced_discount_code") fd.append("discountCode", discountCode);
//     if (type === "quantity_discount")  fd.append("tiers", JSON.stringify(tiers.map(t => ({ ...t, discountType: tierDiscountType }))));
//     if (type === "cart_goal")          fd.append("tiers", JSON.stringify(cartTiers.map(t => ({ ...t, discountType: cartTierDiscountType }))));
//     if (selectedProducts.length > 0) {
//       const ids = selectedProducts.flatMap(p =>
//         p.variantMode === "specific" && p.selectedVariantIds.length > 0 ? p.selectedVariantIds : [p.id]
//       );
//       fd.append("productIds", JSON.stringify(ids));
//     }
//     if (selectedCollections.length > 0) fd.append("collectionIds", JSON.stringify(selectedCollections.map(c => c.id)));
//     submit(fd, { method: "post" });
//   };

//   const isFreeShipping = type === "shipping_discount";

//   return (
//     <Page
//       backAction={{ content: "Back", url: `/app/campaigns/${campaign.id}` }}
//       title={`Edit: ${campaign.name}`}
//       titleMetadata={<Badge>{CAMPAIGN_TYPE_LABELS[type] || type}</Badge>}
//       primaryAction={{ content: "Update campaign", onAction: handleSave }}
//       secondaryActions={[{ content: "Discard", onAction: () => navigate(`/app/campaigns/${campaign.id}`) }]}
//     >
//       {actionData && !actionData.success && (
//         <Box paddingBlockEnd="400"><Banner tone="critical"><p>{actionData.error}</p></Banner></Box>
//       )}
//       <Layout>
//         <Layout.Section>
//           <BlockStack gap="400">

//             {/* ── Campaign Details ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Campaign details</Text>
//                 <TextField
//                   label="Campaign name" value={name} onChange={setName} autoComplete="off"
//                   helpText="Changing the name also renames matching Shopify discounts."
//                 />
//               </BlockStack>
//             </Card>

//             {/* ── Discount Configuration ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Discount configuration</Text>

//                 {/* Bulk price */}
//                 {type === "bulk_price" && (
//                   <FormLayout>
//                     <Select
//                       label="Discount type"
//                       options={[
//                         { label: "Percentage", value: "percentage" },
//                         { label: "Fixed amount", value: "fixed_amount" },
//                         { label: "Set new price", value: "new_price" },
//                       ]}
//                       value={discountType}
//                       onChange={setDiscountType}
//                     />
//                     <TextField
//                       label={discountType === "percentage" ? "Discount percentage" : "Amount"}
//                       type="number" min={0}
//                       value={discountValue}
//                       onChange={setPositiveValue(setDiscountValue)}
//                       autoComplete="off"
//                       suffix={discountType === "percentage" ? "%" : "$"}
//                     />
//                   </FormLayout>
//                 )}

//                 {/* Quantity discount */}
//                 {type === "quantity_discount" && (
//                   <BlockStack gap="400">
//                     <Select
//                       label="Discount type"
//                       options={[
//                         { label: "Percentage off", value: "percentage" },
//                         { label: "Fixed amount off", value: "fixed_amount" },
//                       ]}
//                       value={tierDiscountType}
//                       onChange={(v) => {
//                         const t = v as "percentage" | "fixed_amount";
//                         setTierDiscountType(t);
//                         setTiers(prev => prev.map(tier => ({ ...tier, discountType: t })));
//                       }}
//                     />
//                     {tiers.map((tier, i) => (
//                       <InlineStack key={i} gap="200" blockAlign="end">
//                         <div style={{ flex: 1 }}>
//                           <TextField
//                             label={i === 0 ? "Min quantity" : ""}
//                             type="number" min={0}
//                             value={tier.quantity}
//                             onChange={(v) => updateTier(i, "quantity", v)}
//                             autoComplete="off" prefix="Buy" suffix="+"
//                             error={
//                               tier.quantity && duplicateTierQtys.has(tier.quantity)
//                                 ? "Duplicate quantity" : undefined
//                             }
//                           />
//                         </div>
//                         <div style={{ flex: 1 }}>
//                           <TextField
//                             label={i === 0 ? "Discount" : ""}
//                             type="number" min={0}
//                             value={tier.discount}
//                             onChange={(v) => updateTier(i, "discount", v)}
//                             autoComplete="off"
//                             prefix={tierDiscountType === "fixed_amount" ? "Save $" : "Save"}
//                             suffix={tierDiscountType === "fixed_amount" ? undefined : "%"}
//                           />
//                         </div>
//                         <Button tone="critical" size="slim" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} disabled={tiers.length <= 1}>Remove</Button>
//                       </InlineStack>
//                     ))}
//                     <Button size="slim" onClick={() => setTiers([...tiers, { quantity: "", discount: "", discountType: tierDiscountType }])}>Add tier</Button>
//                   </BlockStack>
//                 )}

//                 {/* Cart goal */}
//                 {type === "cart_goal" && (
//                   <BlockStack gap="400">
//                     <Select
//                       label="Discount type"
//                       options={[
//                         { label: "Percentage off", value: "percentage" },
//                         { label: "Fixed amount off", value: "fixed_amount" },
//                       ]}
//                       value={cartTierDiscountType}
//                       onChange={(v) => {
//                         const t = v as "percentage" | "fixed_amount";
//                         setCartTierDiscountType(t);
//                         setCartTiers(prev => prev.map(tier => ({ ...tier, discountType: t })));
//                       }}
//                     />
//                     {cartTiers.map((tier, i) => (
//                       <InlineStack key={i} gap="200" blockAlign="end">
//                         <div style={{ flex: 1 }}>
//                           <TextField
//                             label={i === 0 ? "Min cart value" : ""}
//                             type="number" min={0}
//                             value={tier.amount}
//                             onChange={(v) => updateCartTier(i, "amount", v)}
//                             autoComplete="off" prefix="$"
//                             error={tier.amount && duplicateCartAmounts.has(tier.amount) ? "Duplicate amount" : undefined}
//                           />
//                         </div>
//                         <div style={{ flex: 1 }}>
//                           <TextField
//                             label={i === 0 ? "Discount" : ""}
//                             type="number" min={0}
//                             value={tier.discount}
//                             onChange={(v) => updateCartTier(i, "discount", v)}
//                             autoComplete="off"
//                             prefix={cartTierDiscountType === "fixed_amount" ? "Save $" : "Save"}
//                             suffix={cartTierDiscountType === "fixed_amount" ? undefined : "%"}
//                           />
//                         </div>
//                         <Button tone="critical" size="slim" onClick={() => setCartTiers(cartTiers.filter((_, j) => j !== i))} disabled={cartTiers.length <= 1}>Remove</Button>
//                       </InlineStack>
//                     ))}
//                     <Button size="slim" onClick={() => setCartTiers([...cartTiers, { amount: "", discount: "", discountType: cartTierDiscountType }])}>Add tier</Button>
//                   </BlockStack>
//                 )}

//                 {/* Buy X Get Y */}
//                 {type === "buy_x_get_y" && (
//                   <FormLayout>
//                     <TextField
//                       label="Customer buys (quantity)"
//                       type="number" min={1}
//                       value={discountValue}
//                       onChange={setPositiveValue(setDiscountValue)}
//                       autoComplete="off"
//                     />
//                     <Select
//                       label="Customer gets"
//                       options={[{ label: "1 free item", value: "free" }, { label: "1 discounted item", value: "discounted" }]}
//                       value={discountType}
//                       onChange={setDiscountType}
//                     />
//                     {discountType === "discounted" && (
//                       <TextField
//                         label="Discount on get item (%)"
//                         type="number" min={1} max={99}
//                         value={bxgyDiscountPct}
//                         onChange={(v) => { const n = parseFloat(v); if (v === "" || (n >= 0 && n <= 100)) setBxgyDiscountPct(v); }}
//                         autoComplete="off" suffix="%"
//                       />
//                     )}
//                   </FormLayout>
//                 )}

//                 {/* Advanced discount code */}
//                 {type === "advanced_discount_code" && (
//                   <FormLayout>
//                     <TextField
//                       label="Discount code"
//                       value={discountCode}
//                       onChange={setDiscountCode}
//                       autoComplete="off"
//                       placeholder="e.g. SAVE20"
//                       helpText="Customers enter this code at checkout."
//                       connectedRight={
//                         <Button onClick={() => {
//                           let c = "";
//                           for (let i = 0; i < 8; i++) c += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
//                           setDiscountCode(c);
//                         }}>Generate</Button>
//                       }
//                     />
//                     <Select
//                       label="Discount type"
//                       options={[
//                         { label: "Percentage off", value: "percentage" },
//                         { label: "Fixed amount off", value: "fixed_amount" },
//                         { label: "Free shipping", value: "free_shipping" },
//                       ]}
//                       value={discountType}
//                       onChange={setDiscountType}
//                     />
//                     {discountType !== "free_shipping" && (
//                       <TextField
//                         label="Discount value"
//                         type="number" min={0}
//                         value={discountValue}
//                         onChange={setPositiveValue(setDiscountValue)}
//                         autoComplete="off"
//                         suffix={discountType === "percentage" ? "%" : "$"}
//                       />
//                     )}
//                     {discountType === "free_shipping" && (
//                       <Select
//                         label="Where does free shipping apply?"
//                         options={[
//                           { label: "Select an option", value: "" },
//                           { label: "Domestic only", value: "domestic" },
//                           { label: "All zones (worldwide)", value: "all" },
//                         ]}
//                         value={geoTarget}
//                         onChange={setGeoTarget}
//                       />
//                     )}
//                   </FormLayout>
//                 )}

//                 {/* Shipping discount */}
//                 {type === "shipping_discount" && (
//                   <FormLayout>
//                     <Select
//                       label="Minimum requirement"
//                       options={[
//                         { label: "Minimum purchase amount ($)", value: "amount" },
//                         { label: "Minimum number of items",     value: "quantity" },
//                         { label: "Both — amount AND quantity",  value: "both" },
//                         { label: "Either — amount OR quantity", value: "either" },
//                       ]}
//                       value={requirementType}
//                       onChange={setRequirementType}
//                     />
//                     {(requirementType === "amount" || requirementType === "both" || requirementType === "either") && (
//                       <TextField
//                         label="Minimum order value"
//                         type="number" min={0}
//                         value={minOrderForShipping}
//                         onChange={setPositiveValue(setMinOrderForShipping)}
//                         autoComplete="off" prefix="$"
//                       />
//                     )}
//                     {(requirementType === "quantity" || requirementType === "both" || requirementType === "either") && (
//                       <TextField
//                         label="Minimum number of items"
//                         type="number" min={1}
//                         value={minQuantityForShipping}
//                         onChange={(v) => { const n = parseInt(v); if (v === "" || n >= 0) setMinQuantityForShipping(v); }}
//                         autoComplete="off" suffix="items"
//                       />
//                     )}
//                     <Select
//                       label="Where does free shipping apply?"
//                       options={[
//                         { label: "Select an option", value: "" },
//                         { label: "Domestic only", value: "domestic" },
//                         { label: "All zones (worldwide)", value: "all" },
//                       ]}
//                       value={geoTarget}
//                       onChange={setGeoTarget}
//                     />
//                   </FormLayout>
//                 )}
//               </BlockStack>
//             </Card>

//             {/* ── Discount Combinations ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Discount combinations</Text>
//                 <BlockStack gap="300">
//                   <Checkbox label="Product discounts"  helpText="Stack with product discount codes"   checked={combineWithProducts} onChange={setCombineWithProducts} />
//                   <Checkbox label="Order discounts"    helpText="Stack with order-level discount codes" checked={combineWithOrders}   onChange={setCombineWithOrders} />
//                   <Checkbox label="Shipping discounts" helpText="Stack with free shipping discount codes" checked={combineWithShipping} onChange={setCombineWithShipping} />
//                 </BlockStack>
//               </BlockStack>
//             </Card>

//             {/* ── Products ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Products</Text>
//                 <Select
//                   label="Applies to"
//                   options={[
//                     { label: "All products", value: "all" },
//                     { label: "Specific products", value: "specific_products" },
//                     { label: "Specific collections", value: "specific_collections" },
//                   ]}
//                   value={appliesTo}
//                   onChange={(val) => {
//                     setAppliesTo(val);
//                     if (val === "all") { setSelectedProducts([]); setSelectedCollections([]); }
//                   }}
//                 />

//                 {(appliesTo === "all" || appliesTo === "") && (
//                   <Banner tone="info"><p>Discount applies to all products in your store.</p></Banner>
//                 )}

//                 {appliesTo === "specific_products" && (
//                   <BlockStack gap="300">
//                     <InlineStack gap="200">
//                       <Button onClick={async () => {
//                         const selected = await shopify.resourcePicker({ type: "product", multiple: true, action: "select", filter: { variants: false } });
//                         if (selected) {
//                           setSelectedProducts(prev => {
//                             const existingIds = new Set(prev.map(p => p.id));
//                             const newP = selected.filter((p: any) => !existingIds.has(p.id)).map((p: any) => ({
//                               id: p.id, title: p.title,
//                               image: p.images?.[0]?.originalSrc || "",
//                               variants: (p.variants || []).map((v: any) => ({ id: v.id, title: v.title, price: v.price || "0.00", sku: v.sku || "" })),
//                               variantMode: "all",
//                               selectedVariantIds: [],
//                               showVariants: false,
//                             }));
//                             return [...prev, ...newP];
//                           });
//                         }
//                       }}>Browse products</Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedProducts([]); }}>or select all products</Button>
//                     </InlineStack>

//                     {selectedProducts.length > 0 && (
//                       <BlockStack gap="200">
//                         <Text as="p" variant="bodySm" fontWeight="bold">{selectedProducts.length} product(s) selected</Text>
//                         {selectedProducts.map((product, i) => (
//                           <Box key={product.id} background="bg-surface-secondary" borderRadius="200" padding="300">
//                             <BlockStack gap="200">
//                               <InlineStack align="space-between" blockAlign="center">
//                                 <InlineStack gap="200" blockAlign="center">
//                                   <div style={{ width: "36px", height: "36px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
//                                     {product.image
//                                       ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//                                       : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>P</div>}
//                                   </div>
//                                   <BlockStack gap="0">
//                                     <Text as="span" variant="bodySm" fontWeight="semibold">{product.title}</Text>
//                                     <Text as="span" variant="bodySm" tone="subdued">
//                                       {product.variantMode === "all"
//                                         ? `All ${product.variants.length} variants`
//                                         : `${product.selectedVariantIds.length} of ${product.variants.length} variants`}
//                                     </Text>
//                                   </BlockStack>
//                                 </InlineStack>
//                                 <InlineStack gap="100">
//                                   <Button size="slim" variant="plain" onClick={() => loadVariants(product.id, i)} loading={variantFetcher.state === "loading" && loadingVariantsFor === i}>
//                                     {product.showVariants ? "Hide variants" : `Select variants (${product.variants.length})`}
//                                   </Button>
//                                   <Button size="slim" tone="critical" onClick={() => {
//                                     const next = selectedProducts.filter((_, j) => j !== i);
//                                     setSelectedProducts(next);
//                                     if (next.length === 0) setAppliesTo("all");
//                                   }}>Remove</Button>
//                                 </InlineStack>
//                               </InlineStack>

//                               {product.showVariants && product.variants.length > 0 && (
//                                 <Box background="bg-surface" borderRadius="100" padding="300">
//                                   <BlockStack gap="200">
//                                     {["all", "specific"].map(mode => (
//                                       <label key={mode} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
//                                         <input type="radio" name={`variantMode-${i}`} checked={product.variantMode === mode}
//                                           onChange={() => setSelectedProducts(prev => prev.map((p, j) => j === i ? { ...p, variantMode: mode, selectedVariantIds: mode === "all" ? [] : p.selectedVariantIds } : p))} />
//                                         {mode === "all" ? `All ${product.variants.length} variants` : "Specific variants only"}
//                                       </label>
//                                     ))}
//                                     {product.variantMode === "specific" && (
//                                       <Box paddingInlineStart="400">
//                                         <BlockStack gap="100">
//                                           {product.variants.map((v: any) => {
//                                             const isChecked = product.selectedVariantIds.includes(v.id);
//                                             return (
//                                               <label key={v.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", padding: "4px 0" }}>
//                                                 <input type="checkbox" checked={isChecked}
//                                                   onChange={() => setSelectedProducts(prev => prev.map((p, j) => {
//                                                     if (j !== i) return p;
//                                                     const ids = isChecked ? p.selectedVariantIds.filter((id: string) => id !== v.id) : [...p.selectedVariantIds, v.id];
//                                                     return { ...p, selectedVariantIds: ids };
//                                                   }))} />
//                                                 <span style={{ flex: 1 }}>{v.title}</span>
//                                                 {v.sku && <span style={{ color: "#9ca3af", fontSize: "11px" }}>SKU: {v.sku}</span>}
//                                                 <span style={{ fontWeight: "500" }}>${v.price}</span>
//                                               </label>
//                                             );
//                                           })}
//                                         </BlockStack>
//                                       </Box>
//                                     )}
//                                   </BlockStack>
//                                 </Box>
//                               )}
//                             </BlockStack>
//                           </Box>
//                         ))}
//                       </BlockStack>
//                     )}
//                   </BlockStack>
//                 )}

//                 {appliesTo === "specific_collections" && (
//                   <BlockStack gap="300">
//                     <InlineStack gap="200">
//                       <Button onClick={async () => {
//                         const selected = await shopify.resourcePicker({ type: "collection", multiple: true, action: "select" });
//                         if (selected && selected.length > 0) {
//                           setSelectedCollections(selected.map((c: any) => ({ id: c.id, title: c.title, image: c.image?.originalSrc || "" })));
//                         }
//                       }}>Browse collections</Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedCollections([]); }}>or select all products</Button>
//                     </InlineStack>
//                     {selectedCollections.length > 0 && (
//                       <Box padding="300" background="bg-surface-secondary" borderRadius="200">
//                         <BlockStack gap="200">
//                           <Text as="p" variant="bodySm" fontWeight="bold">{selectedCollections.length} collection(s) selected</Text>
//                           {selectedCollections.map((col, i) => (
//                             <InlineStack key={i} align="space-between" blockAlign="center">
//                               <InlineStack gap="200" blockAlign="center">
//                                 <div style={{ width: "32px", height: "32px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
//                                   {col.image ? <img src={col.image} alt={col.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "C"}
//                                 </div>
//                                 <Text as="span" variant="bodySm">{col.title}</Text>
//                               </InlineStack>
//                               <Button size="slim" tone="critical" onClick={() => {
//                                 const next = selectedCollections.filter((_, j) => j !== i);
//                                 setSelectedCollections(next);
//                                 if (next.length === 0) setAppliesTo("all");
//                               }}>Remove</Button>
//                             </InlineStack>
//                           ))}
//                         </BlockStack>
//                       </Box>
//                     )}
//                   </BlockStack>
//                 )}
//               </BlockStack>
//             </Card>

//             {/* ── Schedule ── */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Schedule</Text>
//                 <Checkbox label="Start immediately" checked={startNow} onChange={(v) => setStartNow(v)} />
//                 {!startNow && (
//                   <TextField label="Start date" type="date" value={startDate} onChange={setStartDate} autoComplete="off" />
//                 )}
//                 <Checkbox label="Set end date" checked={hasEndDate} onChange={setHasEndDate} />
//                 {hasEndDate && (
//                   <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />
//                 )}
//               </BlockStack>
//             </Card>

//           </BlockStack>
//         </Layout.Section>

//         {/* ── Summary sidebar ── */}
//         <Layout.Section variant="oneThird">
//           <Card>
//             <BlockStack gap="400">
//               <Text as="h2" variant="headingMd">Summary</Text>
//               <Divider />
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" fontWeight="bold">Campaign type</Text>
//                 <Badge>{CAMPAIGN_TYPE_LABELS[type] || type}</Badge>
//               </BlockStack>
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" fontWeight="bold">Name</Text>
//                 <Text as="p" variant="bodyMd">{name || "—"}</Text>
//               </BlockStack>
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" fontWeight="bold">Applies to</Text>
//                 <Text as="p" variant="bodyMd">
//                   {appliesTo === "all" ? "All products"
//                     : appliesTo === "specific_products" ? `${selectedProducts.length} product(s)`
//                     : `${selectedCollections.length} collection(s)`}
//                 </Text>
//               </BlockStack>
//               {(type === "quantity_discount") && (
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Tiers</Text>
//                   {tiers.filter(t => t.quantity && t.discount).map((t, i) => (
//                     <Text key={i} as="p" variant="bodySm">
//                       Buy {t.quantity}+: {t.discountType === "fixed_amount" ? `$${t.discount} off` : `${t.discount}% off`}
//                     </Text>
//                   ))}
//                 </BlockStack>
//               )}
//               {(type === "cart_goal") && (
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Tiers</Text>
//                   {cartTiers.filter(t => t.amount && t.discount).map((t, i) => (
//                     <Text key={i} as="p" variant="bodySm">
//                       Spend ${t.amount}+: {t.discountType === "fixed_amount" ? `$${t.discount} off` : `${t.discount}% off`}
//                     </Text>
//                   ))}
//                 </BlockStack>
//               )}
//               <Divider />
//               <BlockStack gap="100">
//                 <Text as="p" variant="bodySm" fontWeight="bold">Schedule</Text>
//                 <Text as="p" variant="bodySm">
//                   {startNow ? "Starts immediately" : startDate ? `Starts ${startDate}` : "No start date set"}
//                 </Text>
//                 <Text as="p" variant="bodySm">
//                   {hasEndDate && endDate ? `Ends ${endDate}` : "No end date"}
//                 </Text>
//               </BlockStack>
//             </BlockStack>
//           </Card>
//         </Layout.Section>
//       </Layout>
//     </Page>
//   );
// }


import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useSubmit,
  useActionData,
  useFetcher,
  useNavigation,
} from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  TextField,
  Select,
  Checkbox,
  Banner,
  FormLayout,
  Layout,
  Divider,
  Badge,
} from "@shopify/polaris";
import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { createShopifyDiscount, deleteShopifyDiscountsByIds } from "../discount.server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  bulk_price: "Bulk price editor",
  quantity_discount: "Quantity discount",
  buy_x_get_y: "Buy X Get Y",
  advanced_discount_code: "Advanced discount code",
  cart_goal: "Cart goal",
  shipping_discount: "Shipping discount",
};

// Finds the IDs of Shopify discounts currently matching a campaign name —
// does NOT delete anything. Must be called BEFORE creating any replacement
// discount with the same name: querying by title-prefix AFTER creation would
// also match the brand-new discounts (same name prefix), causing them to be
// deleted along with the old ones. Callers should snapshot these IDs first,
// then delete them explicitly by ID once the replacements are confirmed live.
// Does NOT catch its own errors — a failed lookup here must not be confused
// with "no matching discounts exist." Swallowing it previously made the
// caller skip deletion silently with no indication anything went wrong;
// callers should catch this themselves and surface the failure to the user.
async function findMatchingDiscountIds(
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
    throw new Error(`findMatchingDiscountIds GraphQL error for "${campaignName}": ${JSON.stringify(data.errors)}`);
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

// ── Loader ────────────────────────────────────────────────────────────────────
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;
  const campaignId = params.id as string;

  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.shop !== shop) {
    throw new Response("Campaign not found", { status: 404 });
  }

  let tiers: any[] = [];
  if (campaign.tiers) {
    try {
      tiers = JSON.parse(campaign.tiers);
    } catch {}
  }

  let loadedProducts: any[] = [];
  if (campaign.appliesTo === "specific_products" && campaign.productIds) {
    try {
      const ids = JSON.parse(campaign.productIds) as string[];
      const productGids = ids.filter(
        (id) => id.includes("/Product/") && !id.includes("/ProductVariant/")
      );
      const variantGids = ids.filter((id) => id.includes("/ProductVariant/"));

      if (productGids.length > 0) {
        const q = productGids
          .slice(0, 20)
          .map(
            (id, i) => `
          p${i}: product(id: "${id}") {
            id title
            images(first:1) { nodes { url } }
            variants(first: 100) { nodes { id title price sku } }
          }`
          )
          .join("\n");
        const res = await admin.graphql(`#graphql
          query { ${q} }`);
        const result = await res.json();
        for (const p of Object.values(result.data || {}) as any[]) {
          if (!p?.title) continue;
          loadedProducts.push({
            id: p.id,
            title: p.title,
            image: p.images?.nodes?.[0]?.url || "",
            variants: (p.variants?.nodes || []).map((v: any) => ({
              id: v.id,
              title: v.title,
              price: v.price,
              sku: v.sku || "",
            })),
            variantMode: "all",
            selectedVariantIds: [],
            showVariants: false,
          });
        }
      }

      if (variantGids.length > 0) {
        const q = variantGids
          .slice(0, 50)
          .map(
            (id, i) => `
          v${i}: productVariant(id: "${id}") {
            id title price sku
            product { id title images(first:1) { nodes { url } } variants(first: 100) { nodes { id title price sku } } }
          }`
          )
          .join("\n");
        const res = await admin.graphql(`#graphql
          query { ${q} }`);
        const result = await res.json();
        const byProduct = new Map<string, any>();
        for (const v of Object.values(result.data || {}) as any[]) {
          if (!v?.title || !v?.product) continue;
          const pid = v.product.id;
          if (!byProduct.has(pid)) {
            byProduct.set(pid, {
              id: pid,
              title: v.product.title,
              image: v.product.images?.nodes?.[0]?.url || "",
              variants: (v.product.variants?.nodes || []).map((pv: any) => ({
                id: pv.id,
                title: pv.title,
                price: pv.price,
                sku: pv.sku || "",
              })),
              variantMode: "specific",
              selectedVariantIds: [],
              showVariants: false,
            });
          }
          byProduct.get(pid)!.selectedVariantIds.push(v.id);
        }
        loadedProducts.push(...byProduct.values());
      }
    } catch {}
  }

  let loadedCollections: any[] = [];
  if (campaign.appliesTo === "specific_collections" && campaign.collectionIds) {
    try {
      const ids = JSON.parse(campaign.collectionIds) as string[];
      if (ids.length > 0) {
        const q = ids
          .slice(0, 20)
          .map(
            (id, i) => `c${i}: collection(id: "${id}") { id title image { url } }`
          )
          .join("\n");
        const res = await admin.graphql(`#graphql
          query { ${q} }`);
        const result = await res.json();
        loadedCollections = Object.values(result.data || {})
          .filter((c: any) => c?.id)
          .map((c: any) => ({
            id: c.id,
            title: c.title,
            image: c.image?.url || "",
          }));
      }
    } catch {}
  }

  let existingDiscountCode = "";
  if (campaign.type === "advanced_discount_code") {
    try {
      const codeRes = await admin.graphql(`#graphql
        query {
          discountNodes(first: 250) {
            nodes {
              discount {
                ... on DiscountCodeBasic {
                  title
                  codes(first: 1) { nodes { code } }
                }
              }
            }
          }
        }
      `);
      const codeResult = await codeRes.json();
      const matchingNode = (codeResult.data?.discountNodes?.nodes || []).find(
        (n: any) => n.discount?.title === campaign.name
      );
      existingDiscountCode =
        matchingNode?.discount?.codes?.nodes?.[0]?.code || "";
    } catch {}
  }

  return json({
    campaign: {
      ...campaign,
      startDate: campaign.startDate
        ? new Date(campaign.startDate).toISOString().split("T")[0]
        : "",
      endDate: campaign.endDate
        ? new Date(campaign.endDate).toISOString().split("T")[0]
        : "",
    },
    tiers,
    loadedProducts,
    loadedCollections,
    existingDiscountCode,
  });
};

// ── Action ────────────────────────────────────────────────────────────────────
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;
  const campaignId = params.id as string;

  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.shop !== shop) {
    return json({ success: false, error: "Campaign not found" });
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string)?.trim();
  const discountType = formData.get("discountType") as string;
  const discountValue = parseFloat((formData.get("discountValue") as string) || "0");
  const appliesTo = formData.get("appliesTo") as string;
  const startNow = formData.get("startNow") === "true";
  const startDate = formData.get("startDate") as string;
  const hasEndDate = formData.get("hasEndDate") === "true";
  const endDate = formData.get("endDate") as string;
  const tiersJson = formData.get("tiers") as string;
  const productIds = formData.get("productIds") as string;
  const collectionIds = formData.get("collectionIds") as string;
  const minOrderForShipping = formData.get("minOrderForShipping") as string;
  const minQuantityForShipping = formData.get("minQuantityForShipping") as string;
  const requirementType = (formData.get("requirementType") as string) || "amount";
  const geoTarget = formData.get("geoTarget") as string;
  const combineWithProducts = formData.get("combineWithProducts") === "true";
  const combineWithOrders = formData.get("combineWithOrders") === "true";
  const combineWithShipping = formData.get("combineWithShipping") === "true";
  const bxgyDiscountPct = formData.get("bxgyDiscountPct") as string;
  const discountCode = formData.get("discountCode") as string;

  if (!name || name.trim() === "") {
    return json({ success: false, error: "Campaign name is required" });
  }

  const campaignStartDate = startNow
    ? new Date()
    : startDate
      ? new Date(startDate)
      : campaign.startDate!;
  const campaignEndDate = hasEndDate && endDate ? new Date(endDate) : null;

  if (hasEndDate && campaignEndDate && campaignEndDate <= campaignStartDate) {
    return json({
      success: false,
      error: "End date must be after the start date.",
    });
  }

  const finalDiscountType =
    campaign.type === "shipping_discount" ? "free_shipping" : discountType;

  const storedMinAmount =
    requirementType === "quantity"
      ? null
      : minOrderForShipping
        ? parseFloat(minOrderForShipping)
        : null;

  const storedMinQty =
    requirementType === "amount"
      ? null
      : minQuantityForShipping
        ? parseInt(minQuantityForShipping)
        : null;

  const oldName = campaign.name;

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      name,
      discountType: finalDiscountType,
      discountValue: Math.max(0, discountValue || 0),
      appliesTo: appliesTo || "all",
      startDate: campaignStartDate,
      endDate: campaignEndDate,
      tiers: tiersJson || null,
      productIds: productIds || null,
      collectionIds: collectionIds || null,
      minimumAmount: storedMinAmount,
      minimumQuantity: storedMinQty,
      requirementType: requirementType || "amount",
      geoTarget: geoTarget || null,
      combineWithProducts,
      combineWithOrders,
      combineWithShipping,
      updatedAt: new Date(),
    },
  });

  const errors: string[] = [];

  try {
    const startsAt = campaignStartDate.toISOString();
    const endsAt = campaignEndDate ? campaignEndDate.toISOString() : null;

    const updatedCampaignForShopify = {
      ...campaign,
      name,
      type: campaign.type,
      discountType: finalDiscountType,
      discountValue: Math.max(0, discountValue || 0),
      appliesTo: appliesTo || "all",
      startDate: campaignStartDate,
      endDate: campaignEndDate,
      tiers: tiersJson || null,
      productIds: productIds || null,
      collectionIds: collectionIds || null,
      freeShipping: campaign.freeShipping,
      minOrderForShipping: minOrderForShipping || null,
      minQuantityForShipping: minQuantityForShipping || null,
      requirementType: requirementType || "amount",
      discountCode: discountCode || null,
      bxgyDiscountPct: bxgyDiscountPct || null,
      geoTarget: geoTarget || null,
      combineWithProducts,
      combineWithOrders,
      combineWithShipping,
    };

    // Always delete the campaign's existing Shopify discount(s) and recreate
    // from the freshly-submitted form data. The old in-place GraphQL update
    // mutations here only ever touched title/startsAt/endsAt — they silently
    // dropped edits to the actual discount terms (BXGY buy/get quantities,
    // free-shipping minimum requirements/destination, app-discount config
    // metafields), so a saved edit never reached the live discount that
    // carts evaluate against. Recreating via createShopifyDiscount reuses
    // the same fully-correct creation logic for every campaign type and
    // guarantees products already in a cart pick up the edited discount the
    // next time the cart recalculates.
    // Delete the old discount(s) BEFORE creating the replacement — not after.
    // If the campaign name/tier values are unchanged (the common case — most
    // edits don't touch every field), the new discount's title would be
    // byte-identical to the still-live old one, and Shopify rejects automatic
    // discounts with duplicate titles outright. Creating before deleting
    // therefore made every "edit without changing the discount terms" fail
    // every time, with the old discount never removed since recreate never
    // succeeded. Deleting first avoids that collision entirely.
    //
    // The risk this reintroduces — a delete webhook landing before the local
    // row is updated, wiping the campaign out from under an in-progress edit
    // (see webhooks.discounts.delete.tsx, which matches by exact
    // shopifyDiscountId) — is neutralized by clearing shopifyDiscountId to
    // null first: a null value can never match a specific id in that
    // webhook's lookup, so the race is closed without needing to delete after
    // creation.
    const oldDiscountIds = await findMatchingDiscountIds(admin, oldName);

    if (oldDiscountIds.length > 0) {
      try {
        await db.campaign.update({
          where: { id: campaignId },
          data: { shopifyDiscountId: null },
        });
      } catch (e) {
        errors.push(`Failed to clear discount ID before replacing: ${String(e)}`);
      }
      const oldDeleteErrors = await deleteShopifyDiscountsByIds(admin, oldDiscountIds);
      if (oldDeleteErrors.length > 0) {
        errors.push(...oldDeleteErrors);
      }
    }

    const recreateResult = await createShopifyDiscount(
      admin,
      updatedCampaignForShopify as any
    );

    if (!recreateResult.success) {
      // Some tiers may have been created before the failure (e.g. tier 1-2
      // succeeded, tier 3 hit a userError) — roll those back so we don't
      // leave a half-applied, inconsistent set of discounts live. Note: the
      // old discounts are already gone at this point, so a recreate failure
      // here does mean the campaign temporarily has zero live discounts —
      // the error banner surfaces this so the merchant can retry.
      if (recreateResult.createdIds?.length) {
        const rollbackErrors = await deleteShopifyDiscountsByIds(admin, recreateResult.createdIds);
        if (rollbackErrors.length > 0) {
          errors.push(...rollbackErrors);
        }
      }
      errors.push(
        ...(recreateResult.errors || []).map(
          (e: any) => e.message || String(e)
        )
      );
    } else if (recreateResult.createdIds?.[0]) {
      try {
        await db.campaign.update({
          where: { id: campaignId },
          data: { shopifyDiscountId: recreateResult.createdIds[0] },
        });
      } catch (e) {
        errors.push(`Failed to persist new discount ID: ${String(e)}`);
      }
    }
  } catch (e) {
    errors.push(`Shopify sync error: ${String(e)}`);
  }

  if (errors.length > 0) {
    return json({
      success: false,
      error: `Saved with Shopify errors: ${errors.join("; ")}`,
    });
  }

  return redirect(`/app/campaigns/${campaignId}`);
};

export default function EditCampaign() {
  const {
    campaign,
    tiers: loadedTiers,
    loadedProducts,
    loadedCollections,
    existingDiscountCode,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const variantFetcher = useFetcher<{ variants: any[] }>();
  const type = campaign.type;

  const initTierDT = (loadedTiers[0]?.discountType || "percentage") as
    | "percentage"
    | "fixed_amount";

  const [name, setName] = useState(campaign.name);
  const [discountType, setDiscountType] = useState(
    campaign.discountType === "free_shipping" ? "percentage" : campaign.discountType
  );
  const [discountValue, setDiscountValue] = useState(
    String(campaign.discountValue ?? "")
  );
  const [appliesTo, setAppliesTo] = useState(campaign.appliesTo || "all");
  const [startNow, setStartNow] = useState(!campaign.startDate);
  const [startDate, setStartDate] = useState(campaign.startDate || "");
  const [hasEndDate, setHasEndDate] = useState(!!campaign.endDate);
  const [endDate, setEndDate] = useState(campaign.endDate || "");
  const [geoTarget, setGeoTarget] = useState(campaign.geoTarget || "");
  const [requirementType, setRequirementType] = useState(
    campaign.requirementType || "amount"
  );
  const [minOrderForShipping, setMinOrderForShipping] = useState(
    String(campaign.minimumAmount ?? "")
  );
  const [minQuantityForShipping, setMinQuantityForShipping] = useState(
    String(campaign.minimumQuantity ?? "")
  );
  const [combineWithProducts, setCombineWithProducts] = useState(
    campaign.combineWithProducts ?? true
  );
  const [combineWithOrders, setCombineWithOrders] = useState(
    campaign.combineWithOrders ?? true
  );
  const [combineWithShipping, setCombineWithShipping] = useState(
    campaign.combineWithShipping ?? true
  );
  const [bxgyDiscountPct, setBxgyDiscountPct] = useState(
    String(campaign.discountValue ?? "10")
  );
  const [discountCode, setDiscountCode] = useState(existingDiscountCode || "");

  const [tiers, setTiers] = useState<any[]>(
    type === "quantity_discount" && loadedTiers.length > 0
      ? loadedTiers.map((t: any) => ({
          quantity: String(t.quantity || t.qty || ""),
          discount: String(t.discount || ""),
          discountType: t.discountType || initTierDT,
        }))
      : [
          { quantity: "2", discount: "5", discountType: "percentage" },
          { quantity: "4", discount: "10", discountType: "percentage" },
          { quantity: "8", discount: "15", discountType: "percentage" },
        ]
  );
  const [tierDiscountType, setTierDiscountType] = useState<
    "percentage" | "fixed_amount"
  >(type === "quantity_discount" ? initTierDT : "percentage");

  const [cartTiers, setCartTiers] = useState<any[]>(
    type === "cart_goal" && loadedTiers.length > 0
      ? loadedTiers.map((t: any) => ({
          amount: String(t.amount || t.spend || ""),
          discount: String(t.discount || ""),
          discountType: t.discountType || initTierDT,
        }))
      : [
          { amount: "50", discount: "5", discountType: "percentage" },
          { amount: "100", discount: "10", discountType: "percentage" },
          { amount: "150", discount: "15", discountType: "percentage" },
        ]
  );
  const [cartTierDiscountType, setCartTierDiscountType] = useState<
    "percentage" | "fixed_amount"
  >(type === "cart_goal" ? initTierDT : "percentage");

  const [selectedProducts, setSelectedProducts] = useState<any[]>(loadedProducts);
  const [selectedCollections, setSelectedCollections] =
    useState<any[]>(loadedCollections);
  const [loadingVariantsFor, setLoadingVariantsFor] = useState<number | null>(
    null
  );

  if (
    variantFetcher.state === "idle" &&
    variantFetcher.data &&
    loadingVariantsFor !== null
  ) {
    const fetchedVariants = variantFetcher.data.variants || [];
    const idx = loadingVariantsFor;
    if (selectedProducts[idx] && selectedProducts[idx].variants.length === 0) {
      setSelectedProducts((prev) =>
        prev.map((p, i) =>
          i === idx
            ? {
                ...p,
                variants: fetchedVariants.map((v: any) => ({
                  id: v.id,
                  title: v.title,
                  price: v.price,
                  sku: v.sku || "",
                })),
                showVariants: true,
              }
            : p
        )
      );
      setLoadingVariantsFor(null);
    }
  }

  const loadVariants = (productId: string, productIdx: number) => {
    const product = selectedProducts[productIdx];
    if (product?.variants?.length > 0) {
      setSelectedProducts((prev) =>
        prev.map((p, i) => (i === productIdx ? { ...p, showVariants: !p.showVariants } : p))
      );
      return;
    }
    variantFetcher.load(`/app/api/variants?productId=${encodeURIComponent(productId)}`);
    setLoadingVariantsFor(productIdx);
  };

  const setPositiveValue = (setter: (v: string) => void) => (val: string) => {
    const num = parseFloat(val);
    if (val === "" || num >= 0) setter(val);
  };

  const updateTier = (i: number, f: string, v: string) => {
    const n = [...tiers];
    n[i][f] = v;
    setTiers(n);
  };

  const updateCartTier = (i: number, f: string, v: string) => {
    const n = [...cartTiers];
    n[i][f] = v;
    setCartTiers(n);
  };

  const duplicateTierQtys = new Set(
    tiers
      .map((t) => t.quantity)
      .filter(
        (q) => q !== "" && tiers.filter((t) => t.quantity === q).length > 1
      )
  );
  const duplicateCartAmounts = new Set(
    cartTiers
      .map((t) => t.amount)
      .filter(
        (a) => a !== "" && cartTiers.filter((t) => t.amount === a).length > 1
      )
  );

  const campaignStartForValidation = startNow
    ? new Date()
    : startDate
      ? new Date(startDate)
      : campaign.startDate
        ? new Date(campaign.startDate)
        : new Date();

  const isSaving =
    navigation.state === "submitting" || navigation.state === "loading";

  const handleSave = () => {
    if (isSaving) return;

    if (!name.trim()) {
      shopify.toast.show("Campaign name is required.", { isError: true });
      return;
    }

    if (hasEndDate && endDate) {
      const end = new Date(endDate);
      if (end <= campaignStartForValidation) {
        shopify.toast.show("End date must be after the start date.", {
          isError: true,
        });
        return;
      }
    }

    if (type === "shipping_discount" && !geoTarget) {
      shopify.toast.show("Please choose where free shipping applies.", {
        isError: true,
      });
      return;
    }

    if (type === "quantity_discount" && duplicateTierQtys.size > 0) {
      shopify.toast.show(
        "Each tier must have a unique minimum quantity.",
        { isError: true }
      );
      return;
    }

    if (type === "cart_goal" && duplicateCartAmounts.size > 0) {
      shopify.toast.show(
        "Each cart goal tier must have a unique spend amount.",
        { isError: true }
      );
      return;
    }

    const fd = new FormData();
    fd.append("name", name);
    fd.append("discountType", discountType);
    fd.append("discountValue", discountValue || "0");
    fd.append("appliesTo", appliesTo);
    fd.append("startNow", String(startNow));
    fd.append("startDate", startDate);
    fd.append("hasEndDate", String(hasEndDate));
    fd.append("endDate", endDate);
    fd.append("geoTarget", geoTarget);
    fd.append("requirementType", requirementType);
    fd.append("minOrderForShipping", minOrderForShipping);
    fd.append("minQuantityForShipping", minQuantityForShipping);
    fd.append("combineWithProducts", String(combineWithProducts));
    fd.append("combineWithOrders", String(combineWithOrders));
    fd.append("combineWithShipping", String(combineWithShipping));
    if (type === "buy_x_get_y") fd.append("bxgyDiscountPct", bxgyDiscountPct || "10");
    if (type === "advanced_discount_code") fd.append("discountCode", discountCode);
    if (type === "quantity_discount")
      fd.append("tiers", JSON.stringify(tiers.map((t) => ({ ...t, discountType: tierDiscountType }))));
    if (type === "cart_goal")
      fd.append("tiers", JSON.stringify(cartTiers.map((t) => ({ ...t, discountType: cartTierDiscountType }))));
    if (selectedProducts.length > 0) {
      const ids = selectedProducts.flatMap((p) =>
        p.variantMode === "specific" && p.selectedVariantIds.length > 0
          ? p.selectedVariantIds
          : [p.id]
      );
      fd.append("productIds", JSON.stringify(ids));
    }
    if (selectedCollections.length > 0) {
      fd.append(
        "collectionIds",
        JSON.stringify(selectedCollections.map((c) => c.id))
      );
    }

    submit(fd, { method: "post" });
  };

  return (
    <Page
      backAction={{ content: "Back", url: `/app/campaigns/${campaign.id}` }}
      title={`Edit: ${campaign.name}`}
      titleMetadata={<Badge>{CAMPAIGN_TYPE_LABELS[type] || type}</Badge>}
      primaryAction={{
        content: isSaving ? "Updating campaign..." : "Update campaign",
        onAction: handleSave,
        loading: isSaving,
      }}
      secondaryActions={[
        { content: "Discard", onAction: () => navigate(`/app/campaigns/${campaign.id}`) },
      ]}
    >
      {actionData && !actionData.success && (
        <Box paddingBlockEnd="400">
          <Banner tone="critical">
            <p>{actionData.error}</p>
          </Banner>
        </Box>
      )}

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Campaign details
                </Text>
                <TextField
                  label="Campaign name"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                  helpText="Changing the name also renames matching Shopify discounts."
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Discount configuration
                </Text>

                {type === "bulk_price" && (
                  <FormLayout>
                    <Select
                      label="Discount type"
                      options={[
                        { label: "Percentage", value: "percentage" },
                        { label: "Fixed amount", value: "fixed_amount" },
                        { label: "Set new price", value: "new_price" },
                      ]}
                      value={discountType}
                      onChange={setDiscountType}
                    />
                    <TextField
                      label={discountType === "percentage" ? "Discount percentage" : "Amount"}
                      type="number"
                      min={0}
                      value={discountValue}
                      onChange={setPositiveValue(setDiscountValue)}
                      autoComplete="off"
                      suffix={discountType === "percentage" ? "%" : "$"}
                    />
                  </FormLayout>
                )}

                {type === "quantity_discount" && (
                  <BlockStack gap="400">
                    <Select
                      label="Discount type"
                      options={[
                        { label: "Percentage off", value: "percentage" },
                        { label: "Fixed amount off", value: "fixed_amount" },
                      ]}
                      value={tierDiscountType}
                      onChange={(v) => {
                        const t = v as "percentage" | "fixed_amount";
                        setTierDiscountType(t);
                        setTiers((prev) => prev.map((tier) => ({ ...tier, discountType: t })));
                      }}
                    />
                    {tiers.map((tier, i) => (
                      <InlineStack key={i} gap="200" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={i === 0 ? "Min quantity" : ""}
                            type="number"
                            min={0}
                            value={tier.quantity}
                            onChange={(v) => updateTier(i, "quantity", v)}
                            autoComplete="off"
                            prefix="Buy"
                            suffix="+"
                            error={
                              tier.quantity && duplicateTierQtys.has(tier.quantity)
                                ? "Duplicate quantity"
                                : undefined
                            }
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={i === 0 ? "Discount" : ""}
                            type="number"
                            min={0}
                            value={tier.discount}
                            onChange={(v) => updateTier(i, "discount", v)}
                            autoComplete="off"
                            prefix={tierDiscountType === "fixed_amount" ? "Save $" : "Save"}
                            suffix={tierDiscountType === "fixed_amount" ? undefined : "%"}
                          />
                        </div>
                        <Button
                          tone="critical"
                          size="slim"
                          onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                          disabled={tiers.length <= 1}
                        >
                          Remove
                        </Button>
                      </InlineStack>
                    ))}
                    <Button
                      size="slim"
                      onClick={() =>
                        setTiers([
                          ...tiers,
                          { quantity: "", discount: "", discountType: tierDiscountType },
                        ])
                      }
                    >
                      Add tier
                    </Button>
                  </BlockStack>
                )}

                {type === "cart_goal" && (
                  <BlockStack gap="400">
                    <Select
                      label="Discount type"
                      options={[
                        { label: "Percentage off", value: "percentage" },
                        { label: "Fixed amount off", value: "fixed_amount" },
                      ]}
                      value={cartTierDiscountType}
                      onChange={(v) => {
                        const t = v as "percentage" | "fixed_amount";
                        setCartTierDiscountType(t);
                        setCartTiers((prev) => prev.map((tier) => ({ ...tier, discountType: t })));
                      }}
                    />
                    {cartTiers.map((tier, i) => (
                      <InlineStack key={i} gap="200" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={i === 0 ? "Min cart value" : ""}
                            type="number"
                            min={0}
                            value={tier.amount}
                            onChange={(v) => updateCartTier(i, "amount", v)}
                            autoComplete="off"
                            prefix="$"
                            error={
                              tier.amount && duplicateCartAmounts.has(tier.amount)
                                ? "Duplicate amount"
                                : undefined
                            }
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={i === 0 ? "Discount" : ""}
                            type="number"
                            min={0}
                            value={tier.discount}
                            onChange={(v) => updateCartTier(i, "discount", v)}
                            autoComplete="off"
                            prefix={cartTierDiscountType === "fixed_amount" ? "Save $" : "Save"}
                            suffix={cartTierDiscountType === "fixed_amount" ? undefined : "%"}
                          />
                        </div>
                        <Button
                          tone="critical"
                          size="slim"
                          onClick={() => setCartTiers(cartTiers.filter((_, j) => j !== i))}
                          disabled={cartTiers.length <= 1}
                        >
                          Remove
                        </Button>
                      </InlineStack>
                    ))}
                    <Button
                      size="slim"
                      onClick={() =>
                        setCartTiers([
                          ...cartTiers,
                          { amount: "", discount: "", discountType: cartTierDiscountType },
                        ])
                      }
                    >
                      Add tier
                    </Button>
                  </BlockStack>
                )}

                {type === "buy_x_get_y" && (
                  <FormLayout>
                    <TextField
                      label="Customer buys (quantity)"
                      type="number"
                      min={1}
                      value={discountValue}
                      onChange={setPositiveValue(setDiscountValue)}
                      autoComplete="off"
                    />
                    <Select
                      label="Customer gets"
                      options={[
                        { label: "1 free item", value: "free" },
                        { label: "1 discounted item", value: "discounted" },
                      ]}
                      value={discountType}
                      onChange={setDiscountType}
                    />
                    {discountType === "discounted" && (
                      <TextField
                        label="Discount on get item (%)"
                        type="number"
                        min={1}
                        max={99}
                        value={bxgyDiscountPct}
                        onChange={(v) => {
                          const n = parseFloat(v);
                          if (v === "" || (n >= 0 && n <= 100)) setBxgyDiscountPct(v);
                        }}
                        autoComplete="off"
                        suffix="%"
                      />
                    )}
                  </FormLayout>
                )}

                {type === "advanced_discount_code" && (
                  <FormLayout>
                    <TextField
                      label="Discount code"
                      value={discountCode}
                      onChange={setDiscountCode}
                      autoComplete="off"
                      placeholder="e.g. SAVE20"
                      helpText="Customers enter this code at checkout."
                      connectedRight={
                        <Button
                          onClick={() => {
                            let c = "";
                            for (let i = 0; i < 8; i++) {
                              c += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
                            }
                            setDiscountCode(c);
                          }}
                        >
                          Generate
                        </Button>
                      }
                    />
                    <Select
                      label="Discount type"
                      options={[
                        { label: "Percentage off", value: "percentage" },
                        { label: "Fixed amount off", value: "fixed_amount" },
                        { label: "Free shipping", value: "free_shipping" },
                      ]}
                      value={discountType}
                      onChange={setDiscountType}
                    />
                    {discountType !== "free_shipping" && (
                      <TextField
                        label="Discount value"
                        type="number"
                        min={0}
                        value={discountValue}
                        onChange={setPositiveValue(setDiscountValue)}
                        autoComplete="off"
                        suffix={discountType === "percentage" ? "%" : "$"}
                      />
                    )}
                    {discountType === "free_shipping" && (
                      <Select
                        label="Where does free shipping apply?"
                        options={[
                          { label: "Select an option", value: "" },
                          { label: "Domestic only", value: "domestic" },
                          { label: "All zones (worldwide)", value: "all" },
                        ]}
                        value={geoTarget}
                        onChange={setGeoTarget}
                      />
                    )}
                  </FormLayout>
                )}

                {type === "shipping_discount" && (
                  <FormLayout>
                    <Select
                      label="Minimum requirement"
                      options={[
                        { label: "Minimum purchase amount ($)", value: "amount" },
                        { label: "Minimum number of items", value: "quantity" },
                        { label: "Both — amount AND quantity", value: "both" },
                        { label: "Either — amount OR quantity", value: "either" },
                      ]}
                      value={requirementType}
                      onChange={setRequirementType}
                    />
                    {(requirementType === "amount" ||
                      requirementType === "both" ||
                      requirementType === "either") && (
                      <TextField
                        label="Minimum order value"
                        type="number"
                        min={0}
                        value={minOrderForShipping}
                        onChange={setPositiveValue(setMinOrderForShipping)}
                        autoComplete="off"
                        prefix="$"
                      />
                    )}
                    {(requirementType === "quantity" ||
                      requirementType === "both" ||
                      requirementType === "either") && (
                      <TextField
                        label="Minimum number of items"
                        type="number"
                        min={1}
                        value={minQuantityForShipping}
                        onChange={(v) => {
                          const n = parseInt(v);
                          if (v === "" || n >= 0) setMinQuantityForShipping(v);
                        }}
                        autoComplete="off"
                        suffix="items"
                      />
                    )}
                    <Select
                      label="Where does free shipping apply?"
                      options={[
                        { label: "Select an option", value: "" },
                        { label: "Domestic only", value: "domestic" },
                        { label: "All zones (worldwide)", value: "all" },
                      ]}
                      value={geoTarget}
                      onChange={setGeoTarget}
                    />
                  </FormLayout>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Discount combinations
                </Text>
                <BlockStack gap="300">
                  <Checkbox
                    label="Product discounts"
                    helpText="Stack with product discount codes"
                    checked={combineWithProducts}
                    onChange={setCombineWithProducts}
                  />
                  <Checkbox
                    label="Order discounts"
                    helpText="Stack with order-level discount codes"
                    checked={combineWithOrders}
                    onChange={setCombineWithOrders}
                  />
                  <Checkbox
                    label="Shipping discounts"
                    helpText="Stack with free shipping discount codes"
                    checked={combineWithShipping}
                    onChange={setCombineWithShipping}
                  />
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Products
                </Text>
                <Select
                  label="Applies to"
                  options={[
                    { label: "All products", value: "all" },
                    { label: "Specific products", value: "specific_products" },
                    { label: "Specific collections", value: "specific_collections" },
                  ]}
                  value={appliesTo}
                  onChange={(val) => {
                    setAppliesTo(val);
                    if (val === "all") {
                      setSelectedProducts([]);
                      setSelectedCollections([]);
                    }
                  }}
                />
                {(appliesTo === "all" || appliesTo === "") && (
                  <Banner tone="info">
                    <p>Discount applies to all products in your store.</p>
                  </Banner>
                )}

                {appliesTo === "specific_products" && (
                  <BlockStack gap="300">
                    <InlineStack gap="200">
                      <Button
                        onClick={async () => {
                          const selected = await shopify.resourcePicker({
                            type: "product",
                            multiple: true,
                            action: "select",
                            filter: { variants: false },
                          });
                          if (selected) {
                            setSelectedProducts((prev) => {
                              const existingIds = new Set(prev.map((p) => p.id));
                              const newP = selected
                                .filter((p: any) => !existingIds.has(p.id))
                                .map((p: any) => ({
                                  id: p.id,
                                  title: p.title,
                                  image: p.images?.[0]?.originalSrc || "",
                                  variants: (p.variants || []).map((v: any) => ({
                                    id: v.id,
                                    title: v.title,
                                    price: v.price || "0.00",
                                    sku: v.sku || "",
                                  })),
                                  variantMode: "all",
                                  selectedVariantIds: [],
                                  showVariants: false,
                                }));
                              return [...prev, ...newP];
                            });
                          }
                        }}
                      >
                        Browse products
                      </Button>
                      <Button
                        variant="plain"
                        onClick={() => {
                          setAppliesTo("all");
                          setSelectedProducts([]);
                        }}
                      >
                        or select all products
                      </Button>
                    </InlineStack>

                    {selectedProducts.length > 0 && (
                      <BlockStack gap="200">
                        <Text as="p" variant="bodySm" fontWeight="bold">
                          {selectedProducts.length} product(s) selected
                        </Text>

                        {selectedProducts.map((product, i) => (
                          <Box
                            key={product.id}
                            background="bg-surface-secondary"
                            borderRadius="200"
                            padding="300"
                          >
                            <BlockStack gap="200">
                              <InlineStack align="space-between" blockAlign="center">
                                <InlineStack gap="200" blockAlign="center">
                                  <div
                                    style={{
                                      width: "36px",
                                      height: "36px",
                                      background: "#f0f0f0",
                                      borderRadius: "4px",
                                      overflow: "hidden",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {product.image ? (
                                      <img
                                        src={product.image}
                                        alt={product.title}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: "10px",
                                        }}
                                      >
                                        P
                                      </div>
                                    )}
                                  </div>
                                  <BlockStack gap="0">
                                    <Text as="span" variant="bodySm" fontWeight="semibold">
                                      {product.title}
                                    </Text>
                                    <Text as="span" variant="bodySm" tone="subdued">
                                      {product.variantMode === "all"
                                        ? `All ${product.variants.length} variants`
                                        : `${product.selectedVariantIds.length} of ${product.variants.length} variants`}
                                    </Text>
                                  </BlockStack>
                                </InlineStack>
                                <InlineStack gap="100">
                                  <Button
                                    size="slim"
                                    variant="plain"
                                    onClick={() => loadVariants(product.id, i)}
                                    loading={
                                      variantFetcher.state === "loading" &&
                                      loadingVariantsFor === i
                                    }
                                  >
                                    {product.showVariants
                                      ? "Hide variants"
                                      : `Select variants (${product.variants.length})`}
                                  </Button>
                                  <Button
                                    size="slim"
                                    tone="critical"
                                    onClick={() => {
                                      const next = selectedProducts.filter((_, j) => j !== i);
                                      setSelectedProducts(next);
                                      if (next.length === 0) setAppliesTo("all");
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </InlineStack>
                              </InlineStack>

                              {product.showVariants && product.variants.length > 0 && (
                                <Box background="bg-surface" borderRadius="100" padding="300">
                                  <BlockStack gap="200">
                                    {["all", "specific"].map((mode) => (
                                      <label
                                        key={mode}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                          cursor: "pointer",
                                          fontSize: "13px",
                                          fontWeight: "600",
                                        }}
                                      >
                                        <input
                                          type="radio"
                                          name={`variantMode-${i}`}
                                          checked={product.variantMode === mode}
                                          onChange={() =>
                                            setSelectedProducts((prev) =>
                                              prev.map((p, j) =>
                                                j === i
                                                  ? {
                                                      ...p,
                                                      variantMode: mode,
                                                      selectedVariantIds:
                                                        mode === "all"
                                                          ? []
                                                          : p.selectedVariantIds,
                                                    }
                                                  : p
                                              )
                                            )
                                          }
                                        />
                                        {mode === "all"
                                          ? `All ${product.variants.length} variants`
                                          : "Specific variants only"}
                                      </label>
                                    ))}

                                    {product.variantMode === "specific" && (
                                      <Box paddingInlineStart="400">
                                        <BlockStack gap="100">
                                          {product.variants.map((v: any) => {
                                            const isChecked =
                                              product.selectedVariantIds.includes(v.id);
                                            return (
                                              <label
                                                key={v.id}
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "8px",
                                                  cursor: "pointer",
                                                  fontSize: "13px",
                                                  padding: "4px 0",
                                                }}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() =>
                                                    setSelectedProducts((prev) =>
                                                      prev.map((p, j) => {
                                                        if (j !== i) return p;
                                                        const ids = isChecked
                                                          ? p.selectedVariantIds.filter(
                                                              (id: string) => id !== v.id
                                                            )
                                                          : [...p.selectedVariantIds, v.id];
                                                        return { ...p, selectedVariantIds: ids };
                                                      })
                                                    )
                                                  }
                                                />
                                                <span style={{ flex: 1 }}>{v.title}</span>
                                                {v.sku && (
                                                  <span
                                                    style={{
                                                      color: "#9ca3af",
                                                      fontSize: "11px",
                                                    }}
                                                  >
                                                    SKU: {v.sku}
                                                  </span>
                                                )}
                                                <span style={{ fontWeight: "500" }}>
                                                  ${v.price}
                                                </span>
                                              </label>
                                            );
                                          })}
                                        </BlockStack>
                                      </Box>
                                    )}
                                  </BlockStack>
                                </Box>
                              )}
                            </BlockStack>
                          </Box>
                        ))}
                      </BlockStack>
                    )}
                  </BlockStack>
                )}

                {appliesTo === "specific_collections" && (
                  <BlockStack gap="300">
                    <InlineStack gap="200">
                      <Button
                        onClick={async () => {
                          const selected = await shopify.resourcePicker({
                            type: "collection",
                            multiple: true,
                            action: "select",
                          });
                          if (selected && selected.length > 0) {
                            setSelectedCollections(
                              selected.map((c: any) => ({
                                id: c.id,
                                title: c.title,
                                image: c.image?.originalSrc || "",
                              }))
                            );
                          }
                        }}
                      >
                        Browse collections
                      </Button>
                      <Button
                        variant="plain"
                        onClick={() => {
                          setAppliesTo("all");
                          setSelectedCollections([]);
                        }}
                      >
                        or select all products
                      </Button>
                    </InlineStack>

                    {selectedCollections.length > 0 && (
                      <Box
                        padding="300"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <BlockStack gap="200">
                          <Text as="p" variant="bodySm" fontWeight="bold">
                            {selectedCollections.length} collection(s) selected
                          </Text>
                          {selectedCollections.map((col, i) => (
                            <InlineStack key={i} align="space-between" blockAlign="center">
                              <InlineStack gap="200" blockAlign="center">
                                <div
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    background: "#f0f0f0",
                                    borderRadius: "4px",
                                    overflow: "hidden",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "10px",
                                  }}
                                >
                                  {col.image ? (
                                    <img
                                      src={col.image}
                                      alt={col.title}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                      }}
                                    />
                                  ) : (
                                    "C"
                                  )}
                                </div>
                                <Text as="span" variant="bodySm">
                                  {col.title}
                                </Text>
                              </InlineStack>
                              <Button
                                size="slim"
                                tone="critical"
                                onClick={() => {
                                  const next = selectedCollections.filter((_, j) => j !== i);
                                  setSelectedCollections(next);
                                  if (next.length === 0) setAppliesTo("all");
                                }}
                              >
                                Remove
                              </Button>
                            </InlineStack>
                          ))}
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Schedule
                </Text>
                <Checkbox
                  label="Start immediately"
                  checked={startNow}
                  onChange={(v) => setStartNow(v)}
                />
                {!startNow && (
                  <TextField
                    label="Start date"
                    type="date"
                    value={startDate}
                    onChange={setStartDate}
                    autoComplete="off"
                  />
                )}
                <Checkbox
                  label="Set end date"
                  checked={hasEndDate}
                  onChange={setHasEndDate}
                />
                {hasEndDate && (
                  <TextField
                    label="End date"
                    type="date"
                    value={endDate}
                    onChange={setEndDate}
                    autoComplete="off"
                  />
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Summary
              </Text>
              <Divider />
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  Campaign type
                </Text>
                <Badge>{CAMPAIGN_TYPE_LABELS[type] || type}</Badge>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  Name
                </Text>
                <Text as="p" variant="bodyMd">
                  {name || "—"}
                </Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  Applies to
                </Text>
                <Text as="p" variant="bodyMd">
                  {appliesTo === "all"
                    ? "All products"
                    : appliesTo === "specific_products"
                      ? `${selectedProducts.length} product(s)`
                      : `${selectedCollections.length} collection(s)`}
                </Text>
              </BlockStack>

              {type === "quantity_discount" && (
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="bold">
                    Tiers
                  </Text>
                  {tiers.filter((t) => t.quantity && t.discount).map((t, i) => (
                    <Text key={i} as="p" variant="bodySm">
                      Buy {t.quantity}+:{" "}
                      {t.discountType === "fixed_amount"
                        ? `$${t.discount} off`
                        : `${t.discount}% off`}
                    </Text>
                  ))}
                </BlockStack>
              )}

              {type === "cart_goal" && (
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="bold">
                    Tiers
                  </Text>
                  {cartTiers.filter((t) => t.amount && t.discount).map((t, i) => (
                    <Text key={i} as="p" variant="bodySm">
                      Spend ${t.amount}+:{" "}
                      {t.discountType === "fixed_amount"
                        ? `$${t.discount} off`
                        : `${t.discount}% off`}
                    </Text>
                  ))}
                </BlockStack>
              )}

              <Divider />

              <BlockStack gap="100">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  Schedule
                </Text>
                <Text as="p" variant="bodySm">
                  {startNow
                    ? "Starts immediately"
                    : startDate
                      ? `Starts ${startDate}`
                      : "No start date set"}
                </Text>
                <Text as="p" variant="bodySm">
                  {hasEndDate && endDate ? `Ends ${endDate}` : "No end date"}
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}