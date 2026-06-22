// import {
//   json,
//   redirect,
//   type LoaderFunctionArgs,
//   type ActionFunctionArgs,
// } from "@remix-run/node";
// import { useLoaderData, useNavigate, useSubmit, useActionData, useFetcher } from "@remix-run/react";
// import {
//   Page,
//   Card,
//   Text,
//   BlockStack,
//   InlineStack,
//   Button,
//   Box,
//   TextField,
//   Select,
//   Checkbox,
//   Banner,
//   FormLayout,
//   Layout,
//   Divider,
//   Badge,
// } from "@shopify/polaris";
// import { useState } from "react";
// import { useAppBridge } from "@shopify/app-bridge-react";
// import { authenticate } from "../shopify.server";
// import db from "../db.server";
// import { createShopifyDiscount } from "../discount.server";

// const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
//   bulk_price: "Bulk price editor",
//   quantity_discount: "Quantity discount",
//   buy_x_get_y: "Buy X Get Y",
//   advanced_discount_code: "Advanced discount code",
//   cart_goal: "Cart goal",
//   shipping_discount: "Shipping discount",
// };

// const CAMPAIGN_TYPE_DESCRIPTIONS: Record<string, string> = {
//   bulk_price: "Update products prices and compare at prices in bulk for promotions and sales.",
//   quantity_discount: "Offer tiered discounts based on the quantity of items purchased.",
//   buy_x_get_y: "Offer free or discounted items when customers buy selected products.",
//   advanced_discount_code: "Offer order and shipping discounts with a single code.",
//   cart_goal: "Offer discounts when customers reach a minimum cart value.",
//   shipping_discount: "Offer different shipping discounts or free shipping promotions.",
// };

// export const loader = async ({ request }: LoaderFunctionArgs) => {
//   await authenticate.admin(request);
//   const url = new URL(request.url);
//   const type = url.searchParams.get("type") || "bulk_price";
//   return json({ type });
// };

// export const action = async ({ request }: ActionFunctionArgs) => {
//   const { session, admin } = await authenticate.admin(request);
//   const { shop } = session;
//   const formData = await request.formData();

//   const name = formData.get("name") as string;
//   const type = formData.get("type") as string;
//   const discountType = formData.get("discountType") as string;
//   const discountValue = parseFloat((formData.get("discountValue") as string) || "0");
//   const appliesTo = formData.get("appliesTo") as string;
//   const status = formData.get("status") as string;
//   const startNow = formData.get("startNow") === "true";
//   const startDate = formData.get("startDate") as string;
//   const hasEndDate = formData.get("hasEndDate") === "true";
//   const endDate = formData.get("endDate") as string;
//   const tiers = formData.get("tiers") as string;
//   const bxgyDiscountPct = (formData.get("bxgyDiscountPct") as string) || null;
//   const freeShipping = formData.get("freeShipping") === "true";
//   const minOrderForShipping = formData.get("minOrderForShipping") as string;
//   const minQuantityForShipping = formData.get("minQuantityForShipping") as string;
//   const requirementType = (formData.get("requirementType") as string) || "amount";
//   const geoTarget = formData.get("geoTarget") as string;
//   const productIds = formData.get("productIds") as string;
//   const collectionIds = formData.get("collectionIds") as string;
//   const discountCode = formData.get("discountCode") as string;
//   const combineWithProducts = formData.get("combineWithProducts") === "true";
//   const combineWithOrders = formData.get("combineWithOrders") === "true";
//   const combineWithShipping = formData.get("combineWithShipping") === "true";

//   if (!name || name.trim() === "") {
//     return json({ success: false, error: "Campaign name is required" });
//   }

//   const needsGeoTarget =
//     type === "shipping_discount" ||
//     (type === "advanced_discount_code" && discountType === "free_shipping");

//   if (needsGeoTarget) {
//     if (!geoTarget || (geoTarget !== "domestic" && geoTarget !== "all")) {
//       return json({
//         success: false,
//         error: "Please choose where free shipping applies (Domestic or All zones).",
//       });
//     }
//   }

//   const campaignStartDate = startNow ? new Date() : startDate ? new Date(startDate) : new Date();
//   const campaignEndDate = hasEndDate && endDate ? new Date(endDate) : null;
//   const finalDiscountType = type === "shipping_discount" ? "free_shipping" : discountType;

//   try {
//     const shopifyResult = await createShopifyDiscount(admin, {
//       name: name.trim(),
//       type,
//       discountType: finalDiscountType,
//       discountValue: Math.max(0, discountValue || 0),
//       bxgyDiscountPct: bxgyDiscountPct || null,
//       appliesTo: appliesTo || "all",
//       startDate: campaignStartDate,
//       endDate: campaignEndDate,
//       tiers: tiers || null,
//       productIds: productIds || null,
//       collectionIds: collectionIds || null,
//       freeShipping,
//       minOrderForShipping: minOrderForShipping || null,
//       minQuantityForShipping: minQuantityForShipping || null,
//       requirementType: requirementType || "amount",
//       discountCode: discountCode || null,
//       geoTarget: geoTarget || null,
//       combineWithProducts,
//       combineWithOrders,
//       combineWithShipping,
//     });

//     if (!shopifyResult.success && shopifyResult.errors?.length) {
//       const errorMsg = shopifyResult.errors.map((e: any) => e.message || e).join(", ");
//       return json({ success: false, error: `Shopify error: ${errorMsg}` });
//     }

//     // Store the Shopify discount ID so webhooks can match reliably by ID
//     // instead of fragile title matching.
//     const shopifyDiscountId = shopifyResult.createdIds?.[0] || null;

//     // Derive correct DB values based on requirementType:
//     //   "amount"   → save to minimumAmount,   minimumQuantity = null
//     //   "quantity" → save to minimumQuantity, minimumAmount   = null
//     //   "both"     → save both fields
//     const storedMinAmount = (requirementType === "quantity")
//       ? null
//       : minOrderForShipping ? parseFloat(minOrderForShipping) : null;

//     const storedMinQty = (requirementType === "amount")
//       ? null
//       : minQuantityForShipping ? parseInt(minQuantityForShipping) : null;

//     await db.campaign.create({
//       data: {
//         shop,
//         name: name.trim(),
//         type,
//         status: status || "active",
//         discountType: finalDiscountType,
//         discountValue: Math.max(0, discountValue || 0),
//         appliesTo: appliesTo || "all",
//         startDate: campaignStartDate,
//         endDate: campaignEndDate,
//         tiers: tiers || null,
//         minimumAmount:  storedMinAmount,   // null when requirementType = "quantity"
//         minimumQuantity: storedMinQty,     // null when requirementType = "amount"
//         requirementType: requirementType || "amount",  // store so proxy/widget can use OR vs AND logic
//         geoTarget: geoTarget || null,
//         productIds: productIds || null,
//         collectionIds: collectionIds || null,
//         combineWithProducts,
//         combineWithOrders,
//         combineWithShipping,
//         shopifyDiscountId,                 // stored for reliable webhook matching
//       },
//     });

//     return redirect("/app/campaigns");
//   } catch (error: any) {
//     console.error("Failed to create campaign:", error);
//     // Surface the real error message so we can debug it
//     const msg = error?.message || error?.toString() || "Unknown error";
//     return json({ success: false, error: `Failed to create campaign: ${msg}` });
//   }
// };

// /* ── Discount Preview ── */
// function DiscountPreview({
//   type, name, discountType, discountValue, tiers, cartTiers,
//   freeShipping, minOrderForShipping, minQuantityForShipping, requirementType,
//   appliesTo, status, bxgyDiscountPct,
// }: {
//   type: string; name: string; discountType: string; discountValue: string;
//   tiers: { quantity: string; discount: string }[];
//   cartTiers: { amount: string; discount: string }[];
//   freeShipping: boolean; minOrderForShipping: string; minQuantityForShipping: string;
//   requirementType: string; appliesTo: string; status: string;
//   bxgyDiscountPct: string;
// }) {
//   const [cartQty, setCartQty] = useState(1);
//   const samplePrice = 10.0;
//   const discountVal = parseFloat(discountValue) || 0;

//   const getQuantityDiscount = (qty: number) => {
//     const validTiers = tiers.filter(t => t.quantity && t.discount)
//       .map(t => ({ quantity: parseInt(t.quantity), discount: parseFloat(t.discount) }))
//       .filter(t => !isNaN(t.quantity) && !isNaN(t.discount)).sort((a, b) => b.quantity - a.quantity);
//     const match = validTiers.find(t => qty >= t.quantity);
//     return match ? match.discount : 0;
//   };

//   const getCartGoalDiscount = (totalAmount: number) => {
//     const validTiers = cartTiers.filter(t => t.amount && t.discount)
//       .map(t => ({ amount: parseFloat(t.amount), discount: parseFloat(t.discount) }))
//       .filter(t => !isNaN(t.amount) && !isNaN(t.discount)).sort((a, b) => b.amount - a.amount);
//     const match = validTiers.find(t => totalAmount >= t.amount);
//     return match ? match.discount : 0;
//   };

//   const cartTotal = samplePrice * cartQty;
//   let discountPercent = 0, discountAmount = 0, finalTotal = cartTotal;
//   if (type === "bulk_price") {
//     if (discountType === "percentage") { discountPercent = discountVal; discountAmount = cartTotal * (discountVal / 100); }
//     else if (discountType === "fixed_amount") { discountAmount = discountVal * cartQty; }
//     else if (discountType === "new_price") { discountAmount = (samplePrice - discountVal) * cartQty; }
//   } else if (type === "quantity_discount") {
//     discountPercent = getQuantityDiscount(cartQty); discountAmount = cartTotal * (discountPercent / 100);
//   } else if (type === "cart_goal") {
//     discountPercent = getCartGoalDiscount(cartTotal); discountAmount = cartTotal * (discountPercent / 100);
//   }
//   discountAmount = Math.max(0, discountAmount);
//   finalTotal = Math.max(0, cartTotal - discountAmount);
//   const unitPrice = cartQty > 0 ? finalTotal / cartQty : samplePrice;
//   const appliesToLabel = appliesTo === "all" ? "Applies to products and variants" :
//     appliesTo === "specific_products" ? "Applies to specific products" : "Applies to specific collections";

//   const shippingRequirementText = () => {
//     const parts = [];
//     if ((requirementType === "amount" || requirementType === "both" || requirementType === "either") && minOrderForShipping && parseFloat(minOrderForShipping) > 0)
//       parts.push(`orders above $${minOrderForShipping}`);
//     if ((requirementType === "quantity" || requirementType === "both" || requirementType === "either") && minQuantityForShipping && parseInt(minQuantityForShipping) > 0)
//       parts.push(`${minQuantityForShipping}+ items in cart`);
//     const connector = requirementType === "either" ? " OR " : " AND ";
//     return parts.length > 0 ? `When: ${parts.join(connector)}` : "No minimum required";
//   };

//   return (
//     <Card>
//       <BlockStack gap="400">
//         <Text as="h2" variant="headingMd">Discount preview</Text>
//         <Box background="bg-surface-secondary" borderRadius="200" padding="400">
//           <BlockStack gap="300">
//             <Text as="h3" variant="headingSm">On product page</Text>
//             {type === "bulk_price" && discountVal > 0 && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <BlockStack gap="200">
//                   <Text as="p" variant="bodySm" tone="subdued">For products without "compare at price"</Text>
//                   <InlineStack align="space-between">
//                     <Text as="span" variant="bodySm">Before</Text>
//                     <Text as="span" variant="bodySm">After</Text>
//                   </InlineStack>
//                   <InlineStack align="space-between">
//                     <Text as="span" variant="bodyMd" fontWeight="bold">${samplePrice.toFixed(2)}</Text>
//                     <InlineStack gap="100">
//                       <Text as="span" variant="bodyMd" fontWeight="bold">${unitPrice.toFixed(2)}</Text>
//                       <Text as="span" variant="bodySm" tone="critical" textDecorationLine="line-through">${samplePrice.toFixed(2)}</Text>
//                     </InlineStack>
//                   </InlineStack>
//                 </BlockStack>
//               </Box>
//             )}
//             {type === "quantity_discount" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Buy more, Save more!</Text>
//                   {tiers.filter(t => t.quantity && t.discount).map((tier, i) => (
//                     <InlineStack key={i} align="space-between">
//                       <Text as="span" variant="bodySm">Buy {tier.quantity}+</Text>
//                       <Badge tone="success">{`Save ${tier.discount}%`}</Badge>
//                     </InlineStack>
//                   ))}
//                 </BlockStack>
//               </Box>
//             )}
//             {type === "cart_goal" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Spend more, Save more!</Text>
//                   {cartTiers.filter(t => t.amount && t.discount).map((tier, i) => (
//                     <InlineStack key={i} align="space-between">
//                       <Text as="span" variant="bodySm">Spend ${tier.amount}+</Text>
//                       <Badge tone="success">{`Save ${tier.discount}%`}</Badge>
//                     </InlineStack>
//                   ))}
//                 </BlockStack>
//               </Box>
//             )}
//             {type === "shipping_discount" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Free shipping</Text>
//                   <Text as="p" variant="bodySm" tone="subdued">{shippingRequirementText()}</Text>
//                 </BlockStack>
//               </Box>
//             )}
//             {type === "buy_x_get_y" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <Text as="p" variant="bodySm" fontWeight="bold">
//                   Buy {discountValue || "X"}, Get 1 {discountType === "free" ? "Free" : `at ${bxgyDiscountPct || "?"}% off`}
//                 </Text>
//               </Box>
//             )}
//             {type === "advanced_discount_code" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <Text as="p" variant="bodySm" fontWeight="bold">
//                   {discountType === "free_shipping" ? "Free shipping with code" :
//                     discountType === "percentage" ? `${discountVal}% off with code` : `$${discountVal} off with code`}
//                 </Text>
//               </Box>
//             )}
//           </BlockStack>
//         </Box>
//         <Box background="bg-surface-secondary" borderRadius="200" padding="400">
//           <BlockStack gap="300">
//             <Text as="h3" variant="headingSm">On cart</Text>
//             <Box padding="300" background="bg-surface" borderRadius="200">
//               <BlockStack gap="300">
//                 <InlineStack align="space-between" blockAlign="center">
//                   <InlineStack gap="200" blockAlign="center">
//                     <div style={{ width: "40px", height: "40px", background: "#f0f0f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold" }}>A</div>
//                     <BlockStack gap="0">
//                       <Text as="span" variant="bodySm" fontWeight="bold">Product A</Text>
//                       <Text as="span" variant="bodySm" tone="subdued">${samplePrice.toFixed(2)}</Text>
//                     </BlockStack>
//                   </InlineStack>
//                   <Text as="span" variant="bodySm" fontWeight="bold">${(samplePrice * cartQty).toFixed(2)}</Text>
//                 </InlineStack>
//                 <InlineStack align="center" gap="200" blockAlign="center">
//                   <Button size="slim" onClick={() => setCartQty(Math.max(1, cartQty - 1))} disabled={cartQty <= 1}>−</Button>
//                   <div style={{ minWidth: "36px", textAlign: "center" as const, padding: "4px 8px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontWeight: "bold" }}>{cartQty}</div>
//                   <Button size="slim" onClick={() => setCartQty(cartQty + 1)}>+</Button>
//                 </InlineStack>
//                 {type === "quantity_discount" && discountPercent > 0 && (
//                   <Box padding="200" background="bg-surface-success" borderRadius="200">
//                     <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">{discountPercent}% discount applied (qty: {cartQty})</Text>
//                   </Box>
//                 )}
//                 {type === "cart_goal" && discountPercent > 0 && (
//                   <Box padding="200" background="bg-surface-success" borderRadius="200">
//                     <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">{discountPercent}% discount applied (cart: ${cartTotal.toFixed(2)})</Text>
//                   </Box>
//                 )}
//                 <Divider />
//                 <InlineStack align="space-between">
//                   <Text as="span" variant="bodySm">Total ({cartQty} items)</Text>
//                   <Text as="span" variant="bodySm">${cartTotal.toFixed(2)}</Text>
//                 </InlineStack>
//                 {discountAmount > 0 && (
//                   <InlineStack align="space-between">
//                     <Text as="span" variant="bodySm" tone="success">Saving {discountPercent > 0 ? `(${discountPercent}%)` : ""}</Text>
//                     <Text as="span" variant="bodySm" tone="success">-${discountAmount.toFixed(2)}</Text>
//                   </InlineStack>
//                 )}
//                 <InlineStack align="space-between">
//                   <Text as="span" variant="bodyMd" fontWeight="bold">Subtotal</Text>
//                   <Text as="span" variant="bodyMd" fontWeight="bold">${finalTotal.toFixed(2)}</Text>
//                 </InlineStack>
//               </BlockStack>
//             </Box>
//           </BlockStack>
//         </Box>
//         <Divider />
//         <BlockStack gap="300">
//           <Text as="h3" variant="headingSm">Summary</Text>
//           <Text as="p" variant="bodySm" fontWeight="bold">{name || "No campaign name yet"}</Text>
//           <BlockStack gap="100">
//             <Text as="p" variant="bodySm" fontWeight="bold">Campaign type</Text>
//             <InlineStack gap="100"><span style={{ fontSize: "12px" }}>•</span><Text as="p" variant="bodySm">{CAMPAIGN_TYPE_LABELS[type]}</Text></InlineStack>
//           </BlockStack>
//           <BlockStack gap="100">
//             <Text as="p" variant="bodySm" fontWeight="bold">Details</Text>
//             <InlineStack gap="100"><span style={{ fontSize: "12px" }}>•</span><Text as="p" variant="bodySm">{appliesToLabel}</Text></InlineStack>
//           </BlockStack>
//           <Divider />
//           <BlockStack gap="100">
//             <Text as="p" variant="bodySm" fontWeight="bold">Need help?</Text>
//             <Text as="p" variant="bodySm" tone="subdued">If you need assistance, click below for support.</Text>
//             <Button size="slim" variant="plain" url="/app/helpandsupport">Contact support</Button>
//           </BlockStack>
//         </BlockStack>
//       </BlockStack>
//     </Card>
//   );
// }

// /* ── Main Component ── */
// export default function NewCampaign() {
//   const { type } = useLoaderData<typeof loader>();
//   const actionData = useActionData<typeof action>();
//   const navigate = useNavigate();
//   const submit = useSubmit();

//   const [name, setName] = useState("");
//   const [discountType, setDiscountType] = useState("percentage");
//   const [discountValue, setDiscountValue] = useState("");
//   const [appliesTo, setAppliesTo] = useState("all");
//   const [startNow, setStartNow] = useState(true);
//   const [startDate, setStartDate] = useState("");
//   const [hasEndDate, setHasEndDate] = useState(false);
//   const [endDate, setEndDate] = useState("");
//   const [status, setStatus] = useState("active");
//   const [tiers, setTiers] = useState([{ quantity: "2", discount: "5" }, { quantity: "4", discount: "10" }, { quantity: "8", discount: "15" }]);
//   const [cartTiers, setCartTiers] = useState([{ amount: "50", discount: "5" }, { amount: "100", discount: "10" }, { amount: "150", discount: "15" }]);
//   const [freeShipping] = useState(true);
//   const [bxgyDiscountPct, setBxgyDiscountPct] = useState("10"); // separate state for BxGy discount %
//   const [minOrderForShipping, setMinOrderForShipping] = useState("");
//   const [minQuantityForShipping, setMinQuantityForShipping] = useState("");
//   const [requirementType, setRequirementType] = useState("amount");
//   const [geoTarget, setGeoTarget] = useState("");
//   const [discountCode, setDiscountCode] = useState("");
//   // Enhanced product state — supports both all-variants and specific-variant selection
//   const [selectedProducts, setSelectedProducts] = useState<{
//     id: string;
//     title: string;
//     image: string;
//     variants: { id: string; title: string; price: string; sku: string }[];
//     variantMode: 'all' | 'specific';
//     selectedVariantIds: string[];
//     showVariants: boolean;
//   }[]>([]);
//   const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
//   const [combineWithProducts, setCombineWithProducts] = useState(true);
//   const [combineWithOrders, setCombineWithOrders] = useState(true);
//   const [combineWithShipping, setCombineWithShipping] = useState(true);

//   const shopify = useAppBridge();
//   const variantFetcher = useFetcher<{ variants: any[] }>();

//   // Load variants from the server for a product
//   const loadVariants = (productId: string, productIdx: number) => {
//     // Only fetch if we don't already have variants
//     const product = selectedProducts[productIdx];
//     if (product?.variants?.length > 0) {
//       // Already have variants — just toggle open
//       setSelectedProducts(prev =>
//         prev.map((p, i) => i === productIdx ? { ...p, showVariants: !p.showVariants } : p)
//       );
//       return;
//     }
//     // Fetch variants from server
//     variantFetcher.load(`/app/api/variants?productId=${encodeURIComponent(productId)}`);
//     // Mark which product we're loading for
//     setLoadingVariantsFor(productIdx);
//   };

//   const [loadingVariantsFor, setLoadingVariantsFor] = useState<number | null>(null);

//   // When fetcher finishes, inject variants into that product
//   if (
//     variantFetcher.state === "idle" &&
//     variantFetcher.data &&
//     loadingVariantsFor !== null
//   ) {
//     const fetchedVariants = variantFetcher.data.variants || [];
//     const idx = loadingVariantsFor;
//     // Use a ref flag to avoid infinite re-render
//     if (selectedProducts[idx] && selectedProducts[idx].variants.length === 0) {
//       setSelectedProducts(prev =>
//         prev.map((p, i) => i === idx
//           ? {
//               ...p,
//               variants: fetchedVariants.map((v: any) => ({
//                 id: v.id,
//                 title: v.title,
//                 price: v.price,
//                 sku: v.sku || "",
//               })),
//               showVariants: true,
//             }
//           : p
//         )
//       );
//       setLoadingVariantsFor(null);
//     }
//   }
//   const isFreeShippingCampaign = type === "shipping_discount";

//   const setPositiveValue = (setter: (v: string) => void) => (val: string) => {
//     const num = parseFloat(val);
//     if (val === "" || num >= 0) setter(val);
//   };

//   const updateTier = (index: number, field: "quantity" | "discount", value: string) => {
//     const num = parseFloat(value);
//     if (value !== "" && num < 0) return;
//     const n = [...tiers]; n[index][field] = value; setTiers(n);
//   };

//   const updateCartTier = (index: number, field: "amount" | "discount", value: string) => {
//     const num = parseFloat(value);
//     if (value !== "" && num < 0) return;
//     const n = [...cartTiers]; n[index][field] = value; setCartTiers(n);
//   };

//   const handleSave = () => {
//     if (isFreeShippingCampaign && !geoTarget) {
//       shopify.toast.show("Please choose where free shipping applies (Domestic or All zones).", { isError: true });
//       return;
//     }
//     const formData = new FormData();
//     formData.append("name", name);
//     formData.append("type", type);
//     formData.append("discountType", discountType);
//     formData.append("discountValue", discountValue || "0");
//     formData.append("appliesTo", appliesTo);
//     formData.append("status", status);
//     formData.append("startNow", String(startNow));
//     formData.append("startDate", startDate);
//     formData.append("hasEndDate", String(hasEndDate));
//     formData.append("endDate", endDate);
//     formData.append("freeShipping", String(freeShipping));
//     formData.append("minOrderForShipping", minOrderForShipping);
//     formData.append("minQuantityForShipping", minQuantityForShipping);
//     formData.append("requirementType", requirementType);
//     formData.append("geoTarget", geoTarget);
//     formData.append("discountCode", discountCode);
//     formData.append("combineWithProducts", String(combineWithProducts));
//     formData.append("combineWithOrders", String(combineWithOrders));
//     formData.append("combineWithShipping", String(combineWithShipping));
//     if (selectedProducts.length > 0) {
//       // Build IDs array: product GID if all variants selected, variant GIDs if specific
//       const ids = selectedProducts.flatMap(p => {
//         if (p.variantMode === 'all' || p.selectedVariantIds.length === 0) {
//           return [p.id]; // product GID → applies to ALL variants
//         }
//         return p.selectedVariantIds; // variant GIDs → specific variants only
//       });
//       formData.append("productIds", JSON.stringify(ids));
//     }
//     if (selectedCollections.length > 0) formData.append("collectionIds", JSON.stringify(selectedCollections.map(c => c.id)));
//     if (type === "buy_x_get_y") formData.append("bxgyDiscountPct", bxgyDiscountPct || "10");
//     if (type === "quantity_discount") formData.append("tiers", JSON.stringify(tiers));
//     else if (type === "cart_goal") formData.append("tiers", JSON.stringify(cartTiers));
//     submit(formData, { method: "post" });
//   };

//   return (
//     <Page
//       backAction={{ content: "Choose campaign type", url: "/app/campaigns/create" }}
//       title={`Create ${CAMPAIGN_TYPE_LABELS[type] || "Campaign"}`}
//       primaryAction={{ content: "Save campaign", onAction: handleSave }}
//       secondaryActions={[{ content: "Discard", onAction: () => navigate("/app/campaigns") }]}
//     >
//       {actionData && !actionData.success && (
//         <Box paddingBlockEnd="400"><Banner tone="critical"><p>{actionData.error}</p></Banner></Box>
//       )}
//       <Layout>
//         <Layout.Section>
//           <BlockStack gap="400">
//             <Banner tone="info">
//               <p><strong>{CAMPAIGN_TYPE_LABELS[type]}</strong> — {CAMPAIGN_TYPE_DESCRIPTIONS[type]}</p>
//             </Banner>

//             {/* Campaign Details */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Campaign details</Text>
//                 <TextField label="Campaign name" value={name} onChange={setName} autoComplete="off" placeholder="e.g. Summer Sale 2025" helpText="This name helps you identify the campaign internally." />
//                 <Select label="Status" options={[{ label: "Active", value: "active" }, { label: "Draft", value: "draft" }, { label: "Scheduled", value: "scheduled" }]} value={status} onChange={setStatus} />
//               </BlockStack>
//             </Card>

//             {/* Discount Configuration */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Discount configuration</Text>

//                 {type === "bulk_price" && (
//                   <FormLayout>
//                     <Select label="Discount type" options={[{ label: "Percentage", value: "percentage" }, { label: "Fixed amount", value: "fixed_amount" }, { label: "Set new price", value: "new_price" }]} value={discountType} onChange={setDiscountType} />
//                     <TextField label={discountType === "percentage" ? "Discount percentage" : "Amount"} type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" suffix={discountType === "percentage" ? "%" : "$"} placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 10.00"} />
//                   </FormLayout>
//                 )}

//                 {type === "quantity_discount" && (
//                   <BlockStack gap="400">
//                     <Text as="p" variant="bodySm" tone="subdued">Set up tiered discounts based on quantity purchased.</Text>
//                     {tiers.map((tier, i) => (
//                       <InlineStack key={i} gap="200" blockAlign="end">
//                         <div style={{ flex: 1 }}><TextField label={i === 0 ? "Min quantity" : ""} type="number" min={0} value={tier.quantity} onChange={(v) => updateTier(i, "quantity", v)} autoComplete="off" prefix="Buy" suffix="+" /></div>
//                         <div style={{ flex: 1 }}><TextField label={i === 0 ? "Discount %" : ""} type="number" min={0} value={tier.discount} onChange={(v) => updateTier(i, "discount", v)} autoComplete="off" prefix="Save" suffix="%" /></div>
//                         <Button tone="critical" size="slim" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} disabled={tiers.length <= 1}>Remove</Button>
//                       </InlineStack>
//                     ))}
//                     <div><Button size="slim" onClick={() => setTiers([...tiers, { quantity: "", discount: "" }])}>Add tier</Button></div>
//                   </BlockStack>
//                 )}

//                 {type === "buy_x_get_y" && (
//                   <FormLayout>
//                     <TextField
//                       label="Customer buys (quantity)"
//                       type="number" min={1}
//                       value={discountValue}
//                       onChange={setPositiveValue(setDiscountValue)}
//                       autoComplete="off"
//                       placeholder="e.g. 2"
//                       helpText="Number of items the customer must add to cart"
//                     />
//                     <Select
//                       label="Customer gets"
//                       options={[
//                         { label: "1 free item", value: "free" },
//                         { label: "1 discounted item", value: "discounted" },
//                       ]}
//                       value={discountType}
//                       onChange={setDiscountType}
//                     />
//                     {discountType === "discounted" && (
//                       <TextField
//                         label="Discount on the free item (%)"
//                         type="number" min={1} max={99}
//                         value={bxgyDiscountPct}
//                         onChange={(v) => {
//                           const num = parseFloat(v);
//                           if (v === "" || (num >= 0 && num <= 100)) setBxgyDiscountPct(v);
//                         }}
//                         autoComplete="off"
//                         suffix="%"
//                         placeholder="e.g. 50"
//                         helpText="Percentage off the 'get' item. 100% = free."
//                       />
//                     )}
//                   </FormLayout>
//                 )}

//                 {type === "advanced_discount_code" && (
//                   <FormLayout>
//                     <TextField label="Discount code" value={discountCode} onChange={setDiscountCode} autoComplete="off" placeholder="e.g. SAVE20" helpText="Customers will enter this code at checkout" />
//                     <Button size="slim" onClick={() => {
//                       let c = "";
//                       for (let i = 0; i < 8; i++) c += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
//                       setDiscountCode(c);
//                     }}>Generate code</Button>
//                     <Select label="Discount type" options={[{ label: "Percentage off", value: "percentage" }, { label: "Fixed amount off", value: "fixed_amount" }, { label: "Free shipping", value: "free_shipping" }]} value={discountType} onChange={setDiscountType} />
//                     {discountType !== "free_shipping" && <TextField label="Discount value" type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" suffix={discountType === "percentage" ? "%" : "$"} />}
//                     {discountType === "free_shipping" && (
//                       <Select label="Where does free shipping apply?" options={[{ label: "Select an option", value: "" }, { label: "Domestic only (same country as your store)", value: "domestic" }, { label: "All zones (worldwide)", value: "all" }]} value={geoTarget} onChange={setGeoTarget} helpText="Required. Choose whether free shipping applies only to your store's country, or worldwide." />
//                     )}
//                   </FormLayout>
//                 )}

//                 {type === "cart_goal" && (
//                   <BlockStack gap="400">
//                     <Text as="p" variant="bodySm" tone="subdued">Set minimum cart values and their corresponding discounts.</Text>
//                     {cartTiers.map((tier, i) => (
//                       <InlineStack key={i} gap="200" blockAlign="end">
//                         <div style={{ flex: 1 }}><TextField label={i === 0 ? "Min cart value" : ""} type="number" min={0} value={tier.amount} onChange={(v) => updateCartTier(i, "amount", v)} autoComplete="off" prefix="$" /></div>
//                         <div style={{ flex: 1 }}><TextField label={i === 0 ? "Discount %" : ""} type="number" min={0} value={tier.discount} onChange={(v) => updateCartTier(i, "discount", v)} autoComplete="off" prefix="Save" suffix="%" /></div>
//                         <Button tone="critical" size="slim" onClick={() => setCartTiers(cartTiers.filter((_, j) => j !== i))} disabled={cartTiers.length <= 1}>Remove</Button>
//                       </InlineStack>
//                     ))}
//                     <div><Button size="slim" onClick={() => setCartTiers([...cartTiers, { amount: "", discount: "" }])}>Add tier</Button></div>
//                   </BlockStack>
//                 )}

//                 {/* ── Shipping Discount ── */}
//                 {type === "shipping_discount" && (
//                   <FormLayout>
//                     {/* Requirement type selector */}
//                     <Select
//                       label="Minimum requirement"
//                       helpText="Choose what customers must reach to unlock free shipping."
//                       options={[
//                         { label: "Minimum purchase amount ($)", value: "amount" },
//                         { label: "Minimum number of items", value: "quantity" },
//                         { label: "Both — amount AND quantity", value: "both" },
//                         { label: "Either — amount OR quantity", value: "either" },
//                       ]}
//                       value={requirementType}
//                       onChange={setRequirementType}
//                     />

//                     {/* Amount field */}
//                     {(requirementType === "amount" || requirementType === "both" || requirementType === "either") && (
//                       <TextField
//                         label="Minimum order value"
//                         type="number"
//                         min={0}
//                         value={minOrderForShipping}
//                         onChange={setPositiveValue(setMinOrderForShipping)}
//                         autoComplete="off"
//                         prefix="$"
//                         placeholder="e.g. 100"
//                         helpText="Customers must spend at least this amount. Leave blank for no minimum."
//                       />
//                     )}

//                     {/* Quantity field */}
//                     {(requirementType === "quantity" || requirementType === "both" || requirementType === "either") && (
//                       <TextField
//                         label="Minimum number of items"
//                         type="number"
//                         min={1}
//                         value={minQuantityForShipping}
//                         onChange={(v) => {
//                           const num = parseInt(v);
//                           if (v === "" || num >= 0) setMinQuantityForShipping(v);
//                         }}
//                         autoComplete="off"
//                         suffix="items"
//                         placeholder="e.g. 3"
//                         helpText="Customers must have at least this many items in their cart."
//                       />
//                     )}

//                     {/* Info banner for "both" mode */}
//                     {requirementType === "both" && (
//                       <Banner tone="info">
//                         <p>Customer must meet <strong>both</strong> the amount AND quantity requirement to get free shipping.</p>
//                       </Banner>
//                     )}
//                     {requirementType === "either" && (
//                       <Banner tone="info">
//                         <p>Customer gets free shipping if they meet <strong>either</strong> the amount OR the quantity requirement — whichever comes first.</p>
//                       </Banner>
//                     )}

//                     {/* Geo target */}
//                     <Select
//                       label="Where does free shipping apply?"
//                       options={[
//                         { label: "Select an option", value: "" },
//                         { label: "Domestic only (same country as your store)", value: "domestic" },
//                         { label: "All zones (worldwide)", value: "all" },
//                       ]}
//                       value={geoTarget}
//                       onChange={setGeoTarget}
//                       helpText="Required. Choose whether free shipping applies only to your store's country, or worldwide."
//                     />
//                   </FormLayout>
//                 )}
//               </BlockStack>
//             </Card>

//             {/* Discount Combinations */}
//             <Card>
//               <BlockStack gap="400">
//                 <BlockStack gap="100">
//                   <Text as="h2" variant="headingMd">Discount combinations</Text>
//                   <Text as="p" variant="bodySm" tone="subdued">Control whether this discount can stack with other active discounts at checkout.</Text>
//                 </BlockStack>
//                 <BlockStack gap="300">
//                   <Checkbox label="Product discounts" helpText="Stack with product discount codes" checked={combineWithProducts} onChange={setCombineWithProducts} />
//                   <Checkbox label="Order discounts" helpText="Stack with order-level discount codes" checked={combineWithOrders} onChange={setCombineWithOrders} />
//                   <Checkbox label="Shipping discounts" helpText="Stack with other free shipping discount codes" checked={combineWithShipping} onChange={setCombineWithShipping} />
//                 </BlockStack>
//               </BlockStack>
//             </Card>

//             {/* Products */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Products</Text>
//                 <Select
//                   label="Applies to"
//                   helpText="Selecting products or collections below automatically updates this."
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
//                 {(appliesTo === "all" || appliesTo === "") && <Banner tone="info"><p>Discount will apply to all products in your store</p></Banner>}
//                 {appliesTo === "specific_products" && (
//                   <BlockStack gap="300">
//                     <InlineStack gap="200">
//                       <Button onClick={async () => {
//                         const selected = await shopify.resourcePicker({
//                           type: "product", multiple: true, action: "select",
//                           filter: { variants: false },
//                         });
//                         if (selected) {
//                           setSelectedProducts(prev => {
//                             const existingIds = new Set(prev.map(p => p.id));
//                             const newProducts = selected
//                               .filter((p: any) => !existingIds.has(p.id))
//                               .map((p: any) => ({
//                                 id: p.id,
//                                 title: p.title,
//                                 image: p.images?.[0]?.originalSrc || "",
//                                 variants: (p.variants || []).map((v: any) => ({
//                                   id: v.id,
//                                   title: v.title,
//                                   price: v.price || "0.00",
//                                   sku: v.sku || "",
//                                 })),
//                                 variantMode: 'all' as const,
//                                 selectedVariantIds: [],
//                                 showVariants: false,
//                               }));
//                             return [...prev, ...newProducts];
//                           setAppliesTo("specific_products"); // Auto-set when products selected
//                           });
//                         }
//                       }}>Browse products</Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedProducts([]); }}>
//                         or select all products
//                       </Button>
//                     </InlineStack>

//                     {selectedProducts.length > 0 && (
//                       <BlockStack gap="200">
//                         <Text as="p" variant="bodySm" fontWeight="bold">
//                           {selectedProducts.length} product(s) selected
//                         </Text>

//                         {selectedProducts.map((product, i) => (
//                           <Box key={product.id} background="bg-surface-secondary" borderRadius="200" padding="300">
//                             <BlockStack gap="200">

//                               {/* ── Product header row ── */}
//                               <InlineStack align="space-between" blockAlign="center">
//                                 <InlineStack gap="200" blockAlign="center">
//                                   <div style={{ width: "36px", height: "36px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
//                                     {product.image
//                                       ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//                                       : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>P</div>
//                                     }
//                                   </div>
//                                   <BlockStack gap="0">
//                                     <Text as="span" variant="bodySm" fontWeight="semibold">{product.title}</Text>
//                                     <Text as="span" variant="bodySm" tone="subdued">
//                                       {product.variantMode === 'all'
//                                         ? `All ${product.variants.length} variants`
//                                         : `${product.selectedVariantIds.length} of ${product.variants.length} variants`}
//                                     </Text>
//                                   </BlockStack>
//                                 </InlineStack>
//                                 <InlineStack gap="100">
//                                   <Button
//                                     size="slim" variant="plain"
//                                     onClick={() => loadVariants(product.id, i)}
//                                     loading={variantFetcher.state === "loading" && loadingVariantsFor === i}
//                                   >
//                                     {product.showVariants
//                                       ? "Hide variants"
//                                       : product.variants.length > 0
//                                         ? `Select variants (${product.variants.length})`
//                                         : "Select variants"}
//                                   </Button>
//                                   <Button size="slim" tone="critical"
//                                     onClick={() => {
//                                       const next = selectedProducts.filter((_, j) => j !== i);
//                                       setSelectedProducts(next);
//                                       if (next.length === 0) setAppliesTo("all"); // reset when no products
//                                     }}>
//                                     Remove
//                                   </Button>
//                                 </InlineStack>
//                               </InlineStack>

//                               {/* ── Variant selector (expanded) ── */}
//                               {product.showVariants && product.variants.length > 0 && (
//                                 <Box background="bg-surface" borderRadius="100" padding="300">
//                                   <BlockStack gap="200">
//                                     {/* All variants toggle */}
//                                     <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
//                                       <input
//                                         type="radio"
//                                         name={`variantMode-${i}`}
//                                         checked={product.variantMode === 'all'}
//                                         onChange={() => setSelectedProducts(prev =>
//                                           prev.map((p, j) => j === i ? { ...p, variantMode: 'all', selectedVariantIds: [] } : p)
//                                         )}
//                                       />
//                                       Apply to all {product.variants.length} variants
//                                     </label>

//                                     <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
//                                       <input
//                                         type="radio"
//                                         name={`variantMode-${i}`}
//                                         checked={product.variantMode === 'specific'}
//                                         onChange={() => setSelectedProducts(prev =>
//                                           prev.map((p, j) => j === i ? { ...p, variantMode: 'specific' } : p)
//                                         )}
//                                       />
//                                       Apply to specific variants only
//                                     </label>

//                                     {/* Variant checkboxes */}
//                                     {product.variantMode === 'specific' && (
//                                       <Box paddingInlineStart="400">
//                                         <BlockStack gap="100">
//                                           {product.variants.map((v: any) => {
//                                             const isChecked = product.selectedVariantIds.includes(v.id);
//                                             return (
//                                               <label key={v.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", padding: "4px 0" }}>
//                                                 <input
//                                                   type="checkbox"
//                                                   checked={isChecked}
//                                                   onChange={() => setSelectedProducts(prev =>
//                                                     prev.map((p, j) => {
//                                                       if (j !== i) return p;
//                                                       const ids = isChecked
//                                                         ? p.selectedVariantIds.filter(id => id !== v.id)
//                                                         : [...p.selectedVariantIds, v.id];
//                                                       return { ...p, selectedVariantIds: ids };
//                                                     })
//                                                   )}
//                                                 />
//                                                 <span style={{ flex: 1 }}>{v.title}</span>
//                                                 {v.sku && <span style={{ color: "#9ca3af", fontSize: "11px" }}>SKU: {v.sku}</span>}
//                                                 <span style={{ color: "#374151", fontWeight: "500" }}>${v.price}</span>
//                                               </label>
//                                             );
//                                           })}
//                                           {product.variantMode === 'specific' && product.selectedVariantIds.length === 0 && (
//                                             <Text as="p" variant="bodySm" tone="caution">
//                                               Select at least one variant, or switch to "All variants".
//                                             </Text>
//                                           )}
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
//                           setAppliesTo("specific_collections"); // Auto-set when collections picked
//                         }
//                       }}>Browse collections</Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedCollections([]); }}>or select all products</Button>
//                     </InlineStack>
//                     {selectedCollections.length > 0 && (
//                       <Box padding="300" background="bg-surface-secondary" borderRadius="200">
//                         <BlockStack gap="200">
//                           <Text as="p" variant="bodySm" fontWeight="bold">{selectedCollections.length} collection(s) selected</Text>
//                           {selectedCollections.map((collection, i) => (
//                             <InlineStack key={i} align="space-between" blockAlign="center">
//                               <InlineStack gap="200" blockAlign="center">
//                                 <div style={{ width: "32px", height: "32px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
//                                   {collection.image ? <img src={collection.image} alt={collection.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "C"}
//                                 </div>
//                                 <Text as="span" variant="bodySm">{collection.title}</Text>
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

//             {/* Schedule */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Schedule</Text>
//                 <Checkbox label="Start immediately" checked={startNow} onChange={() => {}} />
//                 <Checkbox label="Set end date" checked={hasEndDate} onChange={setHasEndDate} />
//                 {hasEndDate && <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />}
//               </BlockStack>
//             </Card>
//           </BlockStack>
//         </Layout.Section>

//         {/* Preview */}
//         <Layout.Section variant="oneThird">
//           <DiscountPreview
//             type={type} name={name} discountType={discountType} discountValue={discountValue}
//             tiers={tiers} cartTiers={cartTiers} freeShipping={freeShipping}
//             minOrderForShipping={minOrderForShipping} minQuantityForShipping={minQuantityForShipping}
//             requirementType={requirementType} appliesTo={appliesTo} status={status}
//             bxgyDiscountPct={bxgyDiscountPct}
//           />
//         </Layout.Section>
//       </Layout>
//     </Page>
//   );
// }

// import {
//   json,
//   redirect,
//   type LoaderFunctionArgs,
//   type ActionFunctionArgs,
// } from "@remix-run/node";
// import { useLoaderData, useNavigate, useSubmit, useActionData, useFetcher } from "@remix-run/react";
// import {
//   Page,
//   Card,
//   Text,
//   BlockStack,
//   InlineStack,
//   Button,
//   Box,
//   TextField,
//   Select,
//   Checkbox,
//   Banner,
//   FormLayout,
//   Layout,
//   Divider,
//   Badge,
// } from "@shopify/polaris";
// import { useState } from "react";
// import { useAppBridge } from "@shopify/app-bridge-react";
// import { authenticate } from "../shopify.server";
// import db from "../db.server";
// import { createShopifyDiscount } from "../discount.server";

// const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
//   bulk_price: "Bulk price editor",
//   quantity_discount: "Quantity discount",
//   buy_x_get_y: "Buy X Get Y",
//   advanced_discount_code: "Advanced discount code",
//   cart_goal: "Cart goal",
//   shipping_discount: "Shipping discount",
// };

// const CAMPAIGN_TYPE_DESCRIPTIONS: Record<string, string> = {
//   bulk_price: "Update products prices and compare at prices in bulk for promotions and sales.",
//   quantity_discount: "Offer tiered discounts based on the quantity of items purchased.",
//   buy_x_get_y: "Offer free or discounted items when customers buy selected products.",
//   advanced_discount_code: "Offer order and shipping discounts with a single code.",
//   cart_goal: "Offer discounts when customers reach a minimum cart value.",
//   shipping_discount: "Offer different shipping discounts or free shipping promotions.",
// };

// export const loader = async ({ request }: LoaderFunctionArgs) => {
//   await authenticate.admin(request);
//   const url = new URL(request.url);
//   const type = url.searchParams.get("type") || "bulk_price";
//   return json({ type });
// };

// export const action = async ({ request }: ActionFunctionArgs) => {
//   const { session, admin } = await authenticate.admin(request);
//   const { shop } = session;
//   const formData = await request.formData();

//   const name = formData.get("name") as string;
//   const type = formData.get("type") as string;
//   const discountType = formData.get("discountType") as string;
//   const discountValue = parseFloat((formData.get("discountValue") as string) || "0");
//   const appliesTo = formData.get("appliesTo") as string;
//   const status = formData.get("status") as string;
//   const startNow = formData.get("startNow") === "true";
//   const startDate = formData.get("startDate") as string;
//   const hasEndDate = formData.get("hasEndDate") === "true";
//   const endDate = formData.get("endDate") as string;
//   const tiers = formData.get("tiers") as string;
//   const bxgyDiscountPct = (formData.get("bxgyDiscountPct") as string) || null;
//   const freeShipping = formData.get("freeShipping") === "true";
//   const minOrderForShipping = formData.get("minOrderForShipping") as string;
//   const minQuantityForShipping = formData.get("minQuantityForShipping") as string;
//   const requirementType = (formData.get("requirementType") as string) || "amount";
//   const geoTarget = formData.get("geoTarget") as string;
//   const productIds = formData.get("productIds") as string;
//   const collectionIds = formData.get("collectionIds") as string;
//   const discountCode = formData.get("discountCode") as string;
//   const combineWithProducts = formData.get("combineWithProducts") === "true";
//   const combineWithOrders = formData.get("combineWithOrders") === "true";
//   const combineWithShipping = formData.get("combineWithShipping") === "true";

//   if (!name || name.trim() === "") {
//     return json({ success: false, error: "Campaign name is required" });
//   }

//   const needsGeoTarget =
//     type === "shipping_discount" ||
//     (type === "advanced_discount_code" && discountType === "free_shipping");

//   if (needsGeoTarget) {
//     if (!geoTarget || (geoTarget !== "domestic" && geoTarget !== "all")) {
//       return json({
//         success: false,
//         error: "Please choose where free shipping applies (Domestic or All zones).",
//       });
//     }
//   }

//   const campaignStartDate = startNow ? new Date() : startDate ? new Date(startDate) : new Date();
//   const campaignEndDate = hasEndDate && endDate ? new Date(endDate) : null;
//   const finalDiscountType = type === "shipping_discount" ? "free_shipping" : discountType;

//   try {
//     const shopifyResult = await createShopifyDiscount(admin, {
//       name: name.trim(),
//       type,
//       discountType: finalDiscountType,
//       discountValue: Math.max(0, discountValue || 0),
//       bxgyDiscountPct: bxgyDiscountPct || null,
//       appliesTo: appliesTo || "all",
//       startDate: campaignStartDate,
//       endDate: campaignEndDate,
//       tiers: tiers || null,
//       productIds: productIds || null,
//       collectionIds: collectionIds || null,
//       freeShipping,
//       minOrderForShipping: minOrderForShipping || null,
//       minQuantityForShipping: minQuantityForShipping || null,
//       requirementType: requirementType || "amount",
//       discountCode: discountCode || null,
//       geoTarget: geoTarget || null,
//       combineWithProducts,
//       combineWithOrders,
//       combineWithShipping,
//     });

//     if (!shopifyResult.success && shopifyResult.errors?.length) {
//       const errorMsg = shopifyResult.errors.map((e: any) => e.message || e).join(", ");
//       return json({ success: false, error: `Shopify error: ${errorMsg}` });
//     }

//     // Store the Shopify discount ID so webhooks can match reliably by ID
//     // instead of fragile title matching.
//     const shopifyDiscountId = shopifyResult.createdIds?.[0] || null;

//     // Derive correct DB values based on requirementType:
//     //   "amount"   → save to minimumAmount,   minimumQuantity = null
//     //   "quantity" → save to minimumQuantity, minimumAmount   = null
//     //   "both"     → save both fields
//     const storedMinAmount = (requirementType === "quantity")
//       ? null
//       : minOrderForShipping ? parseFloat(minOrderForShipping) : null;

//     const storedMinQty = (requirementType === "amount")
//       ? null
//       : minQuantityForShipping ? parseInt(minQuantityForShipping) : null;

//     await db.campaign.create({
//       data: {
//         shop,
//         name: name.trim(),
//         type,
//         status: status || "active",
//         discountType: finalDiscountType,
//         discountValue: Math.max(0, discountValue || 0),
//         appliesTo: appliesTo || "all",
//         startDate: campaignStartDate,
//         endDate: campaignEndDate,
//         tiers: tiers || null,
//         minimumAmount:  storedMinAmount,   // null when requirementType = "quantity"
//         minimumQuantity: storedMinQty,     // null when requirementType = "amount"
//         requirementType: requirementType || "amount",  // store so proxy/widget can use OR vs AND logic
//         geoTarget: geoTarget || null,
//         productIds: productIds || null,
//         collectionIds: collectionIds || null,
//         combineWithProducts,
//         combineWithOrders,
//         combineWithShipping,
//         shopifyDiscountId,                 // stored for reliable webhook matching
//       },
//     });

//     return redirect("/app/campaigns");
//   } catch (error: any) {
//     console.error("Failed to create campaign:", error);
//     // Surface the real error message so we can debug it
//     const msg = error?.message || error?.toString() || "Unknown error";
//     return json({ success: false, error: `Failed to create campaign: ${msg}` });
//   }
// };

// /* ── Discount Preview ── */
// function DiscountPreview({
//   type, name, discountType, discountValue, tiers, cartTiers,
//   freeShipping, minOrderForShipping, minQuantityForShipping, requirementType,
//   appliesTo, status, bxgyDiscountPct,
// }: {
//   type: string; name: string; discountType: string; discountValue: string;
//   tiers: { quantity: string; discount: string }[];
//   cartTiers: { amount: string; discount: string }[];
//   freeShipping: boolean; minOrderForShipping: string; minQuantityForShipping: string;
//   requirementType: string; appliesTo: string; status: string;
//   bxgyDiscountPct: string;
// }) {
//   const [cartQty, setCartQty] = useState(1);
//   const samplePrice = 10.0;
//   const discountVal = parseFloat(discountValue) || 0;

//   const getQuantityDiscount = (qty: number) => {
//     const validTiers = tiers.filter(t => t.quantity && t.discount)
//       .map(t => ({ quantity: parseInt(t.quantity), discount: parseFloat(t.discount) }))
//       .filter(t => !isNaN(t.quantity) && !isNaN(t.discount)).sort((a, b) => b.quantity - a.quantity);
//     const match = validTiers.find(t => qty >= t.quantity);
//     return match ? match.discount : 0;
//   };

//   const getCartGoalDiscount = (totalAmount: number) => {
//     const validTiers = cartTiers.filter(t => t.amount && t.discount)
//       .map(t => ({ amount: parseFloat(t.amount), discount: parseFloat(t.discount) }))
//       .filter(t => !isNaN(t.amount) && !isNaN(t.discount)).sort((a, b) => b.amount - a.amount);
//     const match = validTiers.find(t => totalAmount >= t.amount);
//     return match ? match.discount : 0;
//   };

//   const cartTotal = samplePrice * cartQty;
//   let discountPercent = 0, discountAmount = 0, finalTotal = cartTotal;
//   if (type === "bulk_price") {
//     if (discountType === "percentage") { discountPercent = discountVal; discountAmount = cartTotal * (discountVal / 100); }
//     else if (discountType === "fixed_amount") { discountAmount = discountVal * cartQty; }
//     else if (discountType === "new_price") { discountAmount = (samplePrice - discountVal) * cartQty; }
//   } else if (type === "quantity_discount") {
//     discountPercent = getQuantityDiscount(cartQty); discountAmount = cartTotal * (discountPercent / 100);
//   } else if (type === "cart_goal") {
//     discountPercent = getCartGoalDiscount(cartTotal); discountAmount = cartTotal * (discountPercent / 100);
//   }
//   discountAmount = Math.max(0, discountAmount);
//   finalTotal = Math.max(0, cartTotal - discountAmount);
//   const unitPrice = cartQty > 0 ? finalTotal / cartQty : samplePrice;
//   const appliesToLabel = appliesTo === "all" ? "Applies to products and variants" :
//     appliesTo === "specific_products" ? "Applies to specific products" : "Applies to specific collections";

//   const shippingRequirementText = () => {
//     const parts = [];
//     if ((requirementType === "amount" || requirementType === "both" || requirementType === "either") && minOrderForShipping && parseFloat(minOrderForShipping) > 0)
//       parts.push(`orders above $${minOrderForShipping}`);
//     if ((requirementType === "quantity" || requirementType === "both" || requirementType === "either") && minQuantityForShipping && parseInt(minQuantityForShipping) > 0)
//       parts.push(`${minQuantityForShipping}+ items in cart`);
//     const connector = requirementType === "either" ? " OR " : " AND ";
//     return parts.length > 0 ? `When: ${parts.join(connector)}` : "No minimum required";
//   };

//   return (
//     <Card>
//       <BlockStack gap="400">
//         <Text as="h2" variant="headingMd">Discount preview</Text>
//         <Box background="bg-surface-secondary" borderRadius="200" padding="400">
//           <BlockStack gap="300">
//             <Text as="h3" variant="headingSm">On product page</Text>
//             {type === "bulk_price" && discountVal > 0 && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <BlockStack gap="200">
//                   <Text as="p" variant="bodySm" tone="subdued">For products without "compare at price"</Text>
//                   <InlineStack align="space-between">
//                     <Text as="span" variant="bodySm">Before</Text>
//                     <Text as="span" variant="bodySm">After</Text>
//                   </InlineStack>
//                   <InlineStack align="space-between">
//                     <Text as="span" variant="bodyMd" fontWeight="bold">${samplePrice.toFixed(2)}</Text>
//                     <InlineStack gap="100">
//                       <Text as="span" variant="bodyMd" fontWeight="bold">${unitPrice.toFixed(2)}</Text>
//                       <Text as="span" variant="bodySm" tone="critical" textDecorationLine="line-through">${samplePrice.toFixed(2)}</Text>
//                     </InlineStack>
//                   </InlineStack>
//                 </BlockStack>
//               </Box>
//             )}
//             {type === "quantity_discount" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Buy more, Save more!</Text>
//                   {tiers.filter(t => t.quantity && t.discount).map((tier, i) => (
//                     <InlineStack key={i} align="space-between">
//                       <Text as="span" variant="bodySm">Buy {tier.quantity}+</Text>
//                       <Badge tone="success">{`Save ${tier.discount}%`}</Badge>
//                     </InlineStack>
//                   ))}
//                 </BlockStack>
//               </Box>
//             )}
//             {type === "cart_goal" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Spend more, Save more!</Text>
//                   {cartTiers.filter(t => t.amount && t.discount).map((tier, i) => (
//                     <InlineStack key={i} align="space-between">
//                       <Text as="span" variant="bodySm">Spend ${tier.amount}+</Text>
//                       <Badge tone="success">{`Save ${tier.discount}%`}</Badge>
//                     </InlineStack>
//                   ))}
//                 </BlockStack>
//               </Box>
//             )}
//             {type === "shipping_discount" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">Free shipping</Text>
//                   <Text as="p" variant="bodySm" tone="subdued">{shippingRequirementText()}</Text>
//                 </BlockStack>
//               </Box>
//             )}
//             {type === "buy_x_get_y" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <Text as="p" variant="bodySm" fontWeight="bold">
//                   Buy {discountValue || "X"}, Get 1 {discountType === "free" ? "Free" : `at ${bxgyDiscountPct || "?"}% off`}
//                 </Text>
//               </Box>
//             )}
//             {type === "advanced_discount_code" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <Text as="p" variant="bodySm" fontWeight="bold">
//                   {discountType === "free_shipping" ? "Free shipping with code" :
//                     discountType === "percentage" ? `${discountVal}% off with code` : `$${discountVal} off with code`}
//                 </Text>
//               </Box>
//             )}
//           </BlockStack>
//         </Box>
//         <Box background="bg-surface-secondary" borderRadius="200" padding="400">
//           <BlockStack gap="300">
//             <Text as="h3" variant="headingSm">On cart</Text>
//             <Box padding="300" background="bg-surface" borderRadius="200">
//               <BlockStack gap="300">
//                 <InlineStack align="space-between" blockAlign="center">
//                   <InlineStack gap="200" blockAlign="center">
//                     <div style={{ width: "40px", height: "40px", background: "#f0f0f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold" }}>A</div>
//                     <BlockStack gap="0">
//                       <Text as="span" variant="bodySm" fontWeight="bold">Product A</Text>
//                       <Text as="span" variant="bodySm" tone="subdued">${samplePrice.toFixed(2)}</Text>
//                     </BlockStack>
//                   </InlineStack>
//                   <Text as="span" variant="bodySm" fontWeight="bold">${(samplePrice * cartQty).toFixed(2)}</Text>
//                 </InlineStack>
//                 <InlineStack align="center" gap="200" blockAlign="center">
//                   <Button size="slim" onClick={() => setCartQty(Math.max(1, cartQty - 1))} disabled={cartQty <= 1}>−</Button>
//                   <div style={{ minWidth: "36px", textAlign: "center" as const, padding: "4px 8px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontWeight: "bold" }}>{cartQty}</div>
//                   <Button size="slim" onClick={() => setCartQty(cartQty + 1)}>+</Button>
//                 </InlineStack>
//                 {type === "quantity_discount" && discountPercent > 0 && (
//                   <Box padding="200" background="bg-surface-success" borderRadius="200">
//                     <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">{discountPercent}% discount applied (qty: {cartQty})</Text>
//                   </Box>
//                 )}
//                 {type === "cart_goal" && discountPercent > 0 && (
//                   <Box padding="200" background="bg-surface-success" borderRadius="200">
//                     <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">{discountPercent}% discount applied (cart: ${cartTotal.toFixed(2)})</Text>
//                   </Box>
//                 )}
//                 <Divider />
//                 <InlineStack align="space-between">
//                   <Text as="span" variant="bodySm">Total ({cartQty} items)</Text>
//                   <Text as="span" variant="bodySm">${cartTotal.toFixed(2)}</Text>
//                 </InlineStack>
//                 {discountAmount > 0 && (
//                   <InlineStack align="space-between">
//                     <Text as="span" variant="bodySm" tone="success">Saving {discountPercent > 0 ? `(${discountPercent}%)` : ""}</Text>
//                     <Text as="span" variant="bodySm" tone="success">-${discountAmount.toFixed(2)}</Text>
//                   </InlineStack>
//                 )}
//                 <InlineStack align="space-between">
//                   <Text as="span" variant="bodyMd" fontWeight="bold">Subtotal</Text>
//                   <Text as="span" variant="bodyMd" fontWeight="bold">${finalTotal.toFixed(2)}</Text>
//                 </InlineStack>
//               </BlockStack>
//             </Box>
//           </BlockStack>
//         </Box>
//         <Divider />
//         <BlockStack gap="300">
//           <Text as="h3" variant="headingSm">Summary</Text>
//           <Text as="p" variant="bodySm" fontWeight="bold">{name || "No campaign name yet"}</Text>
//           <BlockStack gap="100">
//             <Text as="p" variant="bodySm" fontWeight="bold">Campaign type</Text>
//             <InlineStack gap="100"><span style={{ fontSize: "12px" }}>•</span><Text as="p" variant="bodySm">{CAMPAIGN_TYPE_LABELS[type]}</Text></InlineStack>
//           </BlockStack>
//           <BlockStack gap="100">
//             <Text as="p" variant="bodySm" fontWeight="bold">Details</Text>
//             <InlineStack gap="100"><span style={{ fontSize: "12px" }}>•</span><Text as="p" variant="bodySm">{appliesToLabel}</Text></InlineStack>
//           </BlockStack>
//           <Divider />
//           <BlockStack gap="100">
//             <Text as="p" variant="bodySm" fontWeight="bold">Need help?</Text>
//             <Text as="p" variant="bodySm" tone="subdued">If you need assistance, click below for support.</Text>
//             <Button size="slim" variant="plain" url="/app/helpandsupport">Contact support</Button>
//           </BlockStack>
//         </BlockStack>
//       </BlockStack>
//     </Card>
//   );
// }

// /* ── Main Component ── */
// export default function NewCampaign() {
//   const { type } = useLoaderData<typeof loader>();
//   const actionData = useActionData<typeof action>();
//   const navigate = useNavigate();
//   const submit = useSubmit();

//   const [name, setName] = useState("");
//   const [discountType, setDiscountType] = useState("percentage");
//   const [discountValue, setDiscountValue] = useState("");
//   const [appliesTo, setAppliesTo] = useState("all");
//   const [startNow, setStartNow] = useState(true);
//   const [startDate, setStartDate] = useState("");
//   const [hasEndDate, setHasEndDate] = useState(false);
//   const [endDate, setEndDate] = useState("");
//   const [status, setStatus] = useState("active");
//   const [tiers, setTiers] = useState([{ quantity: "2", discount: "5" }, { quantity: "4", discount: "10" }, { quantity: "8", discount: "15" }]);
//   const [cartTiers, setCartTiers] = useState([{ amount: "50", discount: "5" }, { amount: "100", discount: "10" }, { amount: "150", discount: "15" }]);
//   const [freeShipping] = useState(true);
//   const [bxgyDiscountPct, setBxgyDiscountPct] = useState("10"); // separate state for BxGy discount %
//   const [minOrderForShipping, setMinOrderForShipping] = useState("");
//   const [minQuantityForShipping, setMinQuantityForShipping] = useState("");
//   const [requirementType, setRequirementType] = useState("amount");
//   const [geoTarget, setGeoTarget] = useState("");
//   const [discountCode, setDiscountCode] = useState("");
//   // Enhanced product state — supports both all-variants and specific-variant selection
//   const [selectedProducts, setSelectedProducts] = useState<{
//     id: string;
//     title: string;
//     image: string;
//     variants: { id: string; title: string; price: string; sku: string }[];
//     variantMode: 'all' | 'specific';
//     selectedVariantIds: string[];
//     showVariants: boolean;
//   }[]>([]);
//   const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
//   const [combineWithProducts, setCombineWithProducts] = useState(true);
//   const [combineWithOrders, setCombineWithOrders] = useState(true);
//   const [combineWithShipping, setCombineWithShipping] = useState(true);

//   const shopify = useAppBridge();
//   const variantFetcher = useFetcher<{ variants: any[] }>();

//   // Load variants from the server for a product
//   const loadVariants = (productId: string, productIdx: number) => {
//     // Only fetch if we don't already have variants
//     const product = selectedProducts[productIdx];
//     if (product?.variants?.length > 0) {
//       // Already have variants — just toggle open
//       setSelectedProducts(prev =>
//         prev.map((p, i) => i === productIdx ? { ...p, showVariants: !p.showVariants } : p)
//       );
//       return;
//     }
//     // Fetch variants from server
//     variantFetcher.load(`/app/api/variants?productId=${encodeURIComponent(productId)}`);
//     // Mark which product we're loading for
//     setLoadingVariantsFor(productIdx);
//   };

//   const [loadingVariantsFor, setLoadingVariantsFor] = useState<number | null>(null);

//   // When fetcher finishes, inject variants into that product
//   if (
//     variantFetcher.state === "idle" &&
//     variantFetcher.data &&
//     loadingVariantsFor !== null
//   ) {
//     const fetchedVariants = variantFetcher.data.variants || [];
//     const idx = loadingVariantsFor;
//     // Use a ref flag to avoid infinite re-render
//     if (selectedProducts[idx] && selectedProducts[idx].variants.length === 0) {
//       setSelectedProducts(prev =>
//         prev.map((p, i) => i === idx
//           ? {
//               ...p,
//               variants: fetchedVariants.map((v: any) => ({
//                 id: v.id,
//                 title: v.title,
//                 price: v.price,
//                 sku: v.sku || "",
//               })),
//               showVariants: true,
//             }
//           : p
//         )
//       );
//       setLoadingVariantsFor(null);
//     }
//   }
//   const isFreeShippingCampaign = type === "shipping_discount";

//   const setPositiveValue = (setter: (v: string) => void) => (val: string) => {
//     const num = parseFloat(val);
//     if (val === "" || num >= 0) setter(val);
//   };

//   const updateTier = (index: number, field: "quantity" | "discount", value: string) => {
//     const num = parseFloat(value);
//     if (value !== "" && num < 0) return;
//     const n = [...tiers]; n[index][field] = value; setTiers(n);
//   };

//   const updateCartTier = (index: number, field: "amount" | "discount", value: string) => {
//     const num = parseFloat(value);
//     if (value !== "" && num < 0) return;
//     const n = [...cartTiers]; n[index][field] = value; setCartTiers(n);
//   };

//   const handleSave = () => {
//     if (isFreeShippingCampaign && !geoTarget) {
//       shopify.toast.show("Please choose where free shipping applies (Domestic or All zones).", { isError: true });
//       return;
//     }
//     const formData = new FormData();
//     formData.append("name", name);
//     formData.append("type", type);
//     formData.append("discountType", discountType);
//     formData.append("discountValue", discountValue || "0");
//     formData.append("appliesTo", appliesTo);
//     formData.append("status", status);
//     formData.append("startNow", String(startNow));
//     formData.append("startDate", startDate);
//     formData.append("hasEndDate", String(hasEndDate));
//     formData.append("endDate", endDate);
//     formData.append("freeShipping", String(freeShipping));
//     formData.append("minOrderForShipping", minOrderForShipping);
//     formData.append("minQuantityForShipping", minQuantityForShipping);
//     formData.append("requirementType", requirementType);
//     formData.append("geoTarget", geoTarget);
//     formData.append("discountCode", discountCode);
//     formData.append("combineWithProducts", String(combineWithProducts));
//     formData.append("combineWithOrders", String(combineWithOrders));
//     formData.append("combineWithShipping", String(combineWithShipping));
//     if (selectedProducts.length > 0) {
//       // Build IDs array: product GID if all variants selected, variant GIDs if specific
//       const ids = selectedProducts.flatMap(p => {
//         if (p.variantMode === 'all' || p.selectedVariantIds.length === 0) {
//           return [p.id]; // product GID → applies to ALL variants
//         }
//         return p.selectedVariantIds; // variant GIDs → specific variants only
//       });
//       formData.append("productIds", JSON.stringify(ids));
//     }
//     if (selectedCollections.length > 0) formData.append("collectionIds", JSON.stringify(selectedCollections.map(c => c.id)));
//     if (type === "buy_x_get_y") formData.append("bxgyDiscountPct", bxgyDiscountPct || "10");
//     if (type === "quantity_discount") formData.append("tiers", JSON.stringify(tiers));
//     else if (type === "cart_goal") formData.append("tiers", JSON.stringify(cartTiers));
//     submit(formData, { method: "post" });
//   };

//   return (
//     <Page
//       backAction={{ content: "Choose campaign type", url: "/app/campaigns/create" }}
//       title={`Create ${CAMPAIGN_TYPE_LABELS[type] || "Campaign"}`}
//       primaryAction={{ content: "Save campaign", onAction: handleSave }}
//       secondaryActions={[{ content: "Discard", onAction: () => navigate("/app/campaigns") }]}
//     >
//       {actionData && !actionData.success && (
//         <Box paddingBlockEnd="400"><Banner tone="critical"><p>{actionData.error}</p></Banner></Box>
//       )}
//       <Layout>
//         <Layout.Section>
//           <BlockStack gap="400">
//             <Banner tone="info">
//               <p><strong>{CAMPAIGN_TYPE_LABELS[type]}</strong> — {CAMPAIGN_TYPE_DESCRIPTIONS[type]}</p>
//             </Banner>

//             {/* Campaign Details */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Campaign details</Text>
//                 <TextField label="Campaign name" value={name} onChange={setName} autoComplete="off" placeholder="e.g. Summer Sale 2025" helpText="This name helps you identify the campaign internally." />
//                 <Select label="Status" options={[{ label: "Active", value: "active" }, { label: "Draft", value: "draft" }, { label: "Scheduled", value: "scheduled" }]} value={status} onChange={setStatus} />
//               </BlockStack>
//             </Card>

//             {/* Discount Configuration */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Discount configuration</Text>

//                 {type === "bulk_price" && (
//                   <FormLayout>
//                     <Select label="Discount type" options={[{ label: "Percentage", value: "percentage" }, { label: "Fixed amount", value: "fixed_amount" }, { label: "Set new price", value: "new_price" }]} value={discountType} onChange={setDiscountType} />
//                     <TextField label={discountType === "percentage" ? "Discount percentage" : "Amount"} type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" suffix={discountType === "percentage" ? "%" : "$"} placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 10.00"} />
//                   </FormLayout>
//                 )}

//                 {type === "quantity_discount" && (
//                   <BlockStack gap="400">
//                     <Text as="p" variant="bodySm" tone="subdued">Set up tiered discounts based on quantity purchased.</Text>
//                     {tiers.map((tier, i) => (
//                       <InlineStack key={i} gap="200" blockAlign="end">
//                         <div style={{ flex: 1 }}><TextField label={i === 0 ? "Min quantity" : ""} type="number" min={0} value={tier.quantity} onChange={(v) => updateTier(i, "quantity", v)} autoComplete="off" prefix="Buy" suffix="+" /></div>
//                         <div style={{ flex: 1 }}><TextField label={i === 0 ? "Discount %" : ""} type="number" min={0} value={tier.discount} onChange={(v) => updateTier(i, "discount", v)} autoComplete="off" prefix="Save" suffix="%" /></div>
//                         <Button tone="critical" size="slim" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} disabled={tiers.length <= 1}>Remove</Button>
//                       </InlineStack>
//                     ))}
//                     <div><Button size="slim" onClick={() => setTiers([...tiers, { quantity: "", discount: "" }])}>Add tier</Button></div>
//                   </BlockStack>
//                 )}

//                 {type === "buy_x_get_y" && (
//                   <FormLayout>
//                     <TextField
//                       label="Customer buys (quantity)"
//                       type="number" min={1}
//                       value={discountValue}
//                       onChange={setPositiveValue(setDiscountValue)}
//                       autoComplete="off"
//                       placeholder="e.g. 2"
//                       helpText="Number of items the customer must add to cart"
//                     />
//                     <Select
//                       label="Customer gets"
//                       options={[
//                         { label: "1 free item", value: "free" },
//                         { label: "1 discounted item", value: "discounted" },
//                       ]}
//                       value={discountType}
//                       onChange={setDiscountType}
//                     />
//                     {discountType === "discounted" && (
//                       <TextField
//                         label="Discount on the free item (%)"
//                         type="number" min={1} max={99}
//                         value={bxgyDiscountPct}
//                         onChange={(v) => {
//                           const num = parseFloat(v);
//                           if (v === "" || (num >= 0 && num <= 100)) setBxgyDiscountPct(v);
//                         }}
//                         autoComplete="off"
//                         suffix="%"
//                         placeholder="e.g. 50"
//                         helpText="Percentage off the 'get' item. 100% = free."
//                       />
//                     )}
//                   </FormLayout>
//                 )}

//                 {type === "advanced_discount_code" && (
//                   <FormLayout>
//                     <TextField label="Discount code" value={discountCode} onChange={setDiscountCode} autoComplete="off" placeholder="e.g. SAVE20" helpText="Customers will enter this code at checkout" />
//                     <Button size="slim" onClick={() => {
//                       let c = "";
//                       for (let i = 0; i < 8; i++) c += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
//                       setDiscountCode(c);
//                     }}>Generate code</Button>
//                     <Select label="Discount type" options={[{ label: "Percentage off", value: "percentage" }, { label: "Fixed amount off", value: "fixed_amount" }, { label: "Free shipping", value: "free_shipping" }]} value={discountType} onChange={setDiscountType} />
//                     {discountType !== "free_shipping" && <TextField label="Discount value" type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" suffix={discountType === "percentage" ? "%" : "$"} />}
//                     {discountType === "free_shipping" && (
//                       <Select label="Where does free shipping apply?" options={[{ label: "Select an option", value: "" }, { label: "Domestic only (same country as your store)", value: "domestic" }, { label: "All zones (worldwide)", value: "all" }]} value={geoTarget} onChange={setGeoTarget} helpText="Required. Choose whether free shipping applies only to your store's country, or worldwide." />
//                     )}
//                   </FormLayout>
//                 )}

//                 {type === "cart_goal" && (
//                   <BlockStack gap="400">
//                     <Text as="p" variant="bodySm" tone="subdued">Set minimum cart values and their corresponding discounts.</Text>
//                     {cartTiers.map((tier, i) => (
//                       <InlineStack key={i} gap="200" blockAlign="end">
//                         <div style={{ flex: 1 }}><TextField label={i === 0 ? "Min cart value" : ""} type="number" min={0} value={tier.amount} onChange={(v) => updateCartTier(i, "amount", v)} autoComplete="off" prefix="$" /></div>
//                         <div style={{ flex: 1 }}><TextField label={i === 0 ? "Discount %" : ""} type="number" min={0} value={tier.discount} onChange={(v) => updateCartTier(i, "discount", v)} autoComplete="off" prefix="Save" suffix="%" /></div>
//                         <Button tone="critical" size="slim" onClick={() => setCartTiers(cartTiers.filter((_, j) => j !== i))} disabled={cartTiers.length <= 1}>Remove</Button>
//                       </InlineStack>
//                     ))}
//                     <div><Button size="slim" onClick={() => setCartTiers([...cartTiers, { amount: "", discount: "" }])}>Add tier</Button></div>
//                   </BlockStack>
//                 )}

//                 {/* ── Shipping Discount ── */}
//                 {type === "shipping_discount" && (
//                   <FormLayout>
//                     {/* Requirement type selector */}
//                     <Select
//                       label="Minimum requirement"
//                       helpText="Choose what customers must reach to unlock free shipping."
//                       options={[
//                         { label: "Minimum purchase amount ($)", value: "amount" },
//                         { label: "Minimum number of items", value: "quantity" },
//                         { label: "Both — amount AND quantity", value: "both" },
//                         { label: "Either — amount OR quantity", value: "either" },
//                       ]}
//                       value={requirementType}
//                       onChange={setRequirementType}
//                     />

//                     {/* Amount field */}
//                     {(requirementType === "amount" || requirementType === "both" || requirementType === "either") && (
//                       <TextField
//                         label="Minimum order value"
//                         type="number"
//                         min={0}
//                         value={minOrderForShipping}
//                         onChange={setPositiveValue(setMinOrderForShipping)}
//                         autoComplete="off"
//                         prefix="$"
//                         placeholder="e.g. 100"
//                         helpText="Customers must spend at least this amount. Leave blank for no minimum."
//                       />
//                     )}

//                     {/* Quantity field */}
//                     {(requirementType === "quantity" || requirementType === "both" || requirementType === "either") && (
//                       <TextField
//                         label="Minimum number of items"
//                         type="number"
//                         min={1}
//                         value={minQuantityForShipping}
//                         onChange={(v) => {
//                           const num = parseInt(v);
//                           if (v === "" || num >= 0) setMinQuantityForShipping(v);
//                         }}
//                         autoComplete="off"
//                         suffix="items"
//                         placeholder="e.g. 3"
//                         helpText="Customers must have at least this many items in their cart."
//                       />
//                     )}

//                     {/* Info banner for "both" mode */}
//                     {requirementType === "both" && (
//                       <Banner tone="info">
//                         <p>Customer must meet <strong>both</strong> the amount AND quantity requirement to get free shipping.</p>
//                       </Banner>
//                     )}
//                     {requirementType === "either" && (
//                       <Banner tone="info">
//                         <p>Customer gets free shipping if they meet <strong>either</strong> the amount OR the quantity requirement — whichever comes first.</p>
//                       </Banner>
//                     )}

//                     {/* Geo target */}
//                     <Select
//                       label="Where does free shipping apply?"
//                       options={[
//                         { label: "Select an option", value: "" },
//                         { label: "Domestic only (same country as your store)", value: "domestic" },
//                         { label: "All zones (worldwide)", value: "all" },
//                       ]}
//                       value={geoTarget}
//                       onChange={setGeoTarget}
//                       helpText="Required. Choose whether free shipping applies only to your store's country, or worldwide."
//                     />
//                   </FormLayout>
//                 )}
//               </BlockStack>
//             </Card>

//             {/* Discount Combinations */}
//             <Card>
//               <BlockStack gap="400">
//                 <BlockStack gap="100">
//                   <Text as="h2" variant="headingMd">Discount combinations</Text>
//                   <Text as="p" variant="bodySm" tone="subdued">Control whether this discount can stack with other active discounts at checkout.</Text>
//                 </BlockStack>
//                 <BlockStack gap="300">
//                   <Checkbox label="Product discounts" helpText="Stack with product discount codes" checked={combineWithProducts} onChange={setCombineWithProducts} />
//                   <Checkbox label="Order discounts" helpText="Stack with order-level discount codes" checked={combineWithOrders} onChange={setCombineWithOrders} />
//                   <Checkbox label="Shipping discounts" helpText="Stack with other free shipping discount codes" checked={combineWithShipping} onChange={setCombineWithShipping} />
//                 </BlockStack>
//               </BlockStack>
//             </Card>

//             {/* Products */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Products</Text>
//                 <Select
//                   label="Applies to"
//                   helpText="Selecting products or collections below automatically updates this."
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
//                 {(appliesTo === "all" || appliesTo === "") && <Banner tone="info"><p>Discount will apply to all products in your store</p></Banner>}
//                 {appliesTo === "specific_products" && (
//                   <BlockStack gap="300">
//                     <InlineStack gap="200">
//                       <Button onClick={async () => {
//                         const selected = await shopify.resourcePicker({
//                           type: "product", multiple: true, action: "select",
//                           filter: { variants: false },
//                         });
//                         if (selected) {
//                           setSelectedProducts(prev => {
//                             const existingIds = new Set(prev.map(p => p.id));
//                             const newProducts = selected
//                               .filter((p: any) => !existingIds.has(p.id))
//                               .map((p: any) => ({
//                                 id: p.id,
//                                 title: p.title,
//                                 image: p.images?.[0]?.originalSrc || "",
//                                 variants: (p.variants || []).map((v: any) => ({
//                                   id: v.id,
//                                   title: v.title,
//                                   price: v.price || "0.00",
//                                   sku: v.sku || "",
//                                 })),
//                                 variantMode: 'all' as const,
//                                 selectedVariantIds: [],
//                                 showVariants: false,
//                               }));
//                             return [...prev, ...newProducts];
//                           setAppliesTo("specific_products"); // Auto-set when products selected
//                           });
//                         }
//                       }}>Browse products</Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedProducts([]); }}>
//                         or select all products
//                       </Button>
//                     </InlineStack>

//                     {selectedProducts.length > 0 && (
//                       <BlockStack gap="200">
//                         <Text as="p" variant="bodySm" fontWeight="bold">
//                           {selectedProducts.length} product(s) selected
//                         </Text>

//                         {selectedProducts.map((product, i) => (
//                           <Box key={product.id} background="bg-surface-secondary" borderRadius="200" padding="300">
//                             <BlockStack gap="200">

//                               {/* ── Product header row ── */}
//                               <InlineStack align="space-between" blockAlign="center">
//                                 <InlineStack gap="200" blockAlign="center">
//                                   <div style={{ width: "36px", height: "36px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
//                                     {product.image
//                                       ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//                                       : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>P</div>
//                                     }
//                                   </div>
//                                   <BlockStack gap="0">
//                                     <Text as="span" variant="bodySm" fontWeight="semibold">{product.title}</Text>
//                                     <Text as="span" variant="bodySm" tone="subdued">
//                                       {product.variantMode === 'all'
//                                         ? `All ${product.variants.length} variants`
//                                         : `${product.selectedVariantIds.length} of ${product.variants.length} variants`}
//                                     </Text>
//                                   </BlockStack>
//                                 </InlineStack>
//                                 <InlineStack gap="100">
//                                   <Button
//                                     size="slim" variant="plain"
//                                     onClick={() => loadVariants(product.id, i)}
//                                     loading={variantFetcher.state === "loading" && loadingVariantsFor === i}
//                                   >
//                                     {product.showVariants
//                                       ? "Hide variants"
//                                       : product.variants.length > 0
//                                         ? `Select variants (${product.variants.length})`
//                                         : "Select variants"}
//                                   </Button>
//                                   <Button size="slim" tone="critical"
//                                     onClick={() => {
//                                       const next = selectedProducts.filter((_, j) => j !== i);
//                                       setSelectedProducts(next);
//                                       if (next.length === 0) setAppliesTo("all"); // reset when no products
//                                     }}>
//                                     Remove
//                                   </Button>
//                                 </InlineStack>
//                               </InlineStack>

//                               {/* ── Variant selector (expanded) ── */}
//                               {product.showVariants && product.variants.length > 0 && (
//                                 <Box background="bg-surface" borderRadius="100" padding="300">
//                                   <BlockStack gap="200">
//                                     {/* All variants toggle */}
//                                     <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
//                                       <input
//                                         type="radio"
//                                         name={`variantMode-${i}`}
//                                         checked={product.variantMode === 'all'}
//                                         onChange={() => setSelectedProducts(prev =>
//                                           prev.map((p, j) => j === i ? { ...p, variantMode: 'all', selectedVariantIds: [] } : p)
//                                         )}
//                                       />
//                                       Apply to all {product.variants.length} variants
//                                     </label>

//                                     <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
//                                       <input
//                                         type="radio"
//                                         name={`variantMode-${i}`}
//                                         checked={product.variantMode === 'specific'}
//                                         onChange={() => setSelectedProducts(prev =>
//                                           prev.map((p, j) => j === i ? { ...p, variantMode: 'specific' } : p)
//                                         )}
//                                       />
//                                       Apply to specific variants only
//                                     </label>

//                                     {/* Variant checkboxes */}
//                                     {product.variantMode === 'specific' && (
//                                       <Box paddingInlineStart="400">
//                                         <BlockStack gap="100">
//                                           {product.variants.map((v: any) => {
//                                             const isChecked = product.selectedVariantIds.includes(v.id);
//                                             return (
//                                               <label key={v.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", padding: "4px 0" }}>
//                                                 <input
//                                                   type="checkbox"
//                                                   checked={isChecked}
//                                                   onChange={() => setSelectedProducts(prev =>
//                                                     prev.map((p, j) => {
//                                                       if (j !== i) return p;
//                                                       const ids = isChecked
//                                                         ? p.selectedVariantIds.filter(id => id !== v.id)
//                                                         : [...p.selectedVariantIds, v.id];
//                                                       return { ...p, selectedVariantIds: ids };
//                                                     })
//                                                   )}
//                                                 />
//                                                 <span style={{ flex: 1 }}>{v.title}</span>
//                                                 {v.sku && <span style={{ color: "#9ca3af", fontSize: "11px" }}>SKU: {v.sku}</span>}
//                                                 <span style={{ color: "#374151", fontWeight: "500" }}>${v.price}</span>
//                                               </label>
//                                             );
//                                           })}
//                                           {product.variantMode === 'specific' && product.selectedVariantIds.length === 0 && (
//                                             <Text as="p" variant="bodySm" tone="caution">
//                                               Select at least one variant, or switch to "All variants".
//                                             </Text>
//                                           )}
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
//                           setAppliesTo("specific_collections"); // Auto-set when collections picked
//                         }
//                       }}>Browse collections</Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedCollections([]); }}>or select all products</Button>
//                     </InlineStack>
//                     {selectedCollections.length > 0 && (
//                       <Box padding="300" background="bg-surface-secondary" borderRadius="200">
//                         <BlockStack gap="200">
//                           <Text as="p" variant="bodySm" fontWeight="bold">{selectedCollections.length} collection(s) selected</Text>
//                           {selectedCollections.map((collection, i) => (
//                             <InlineStack key={i} align="space-between" blockAlign="center">
//                               <InlineStack gap="200" blockAlign="center">
//                                 <div style={{ width: "32px", height: "32px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
//                                   {collection.image ? <img src={collection.image} alt={collection.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "C"}
//                                 </div>
//                                 <Text as="span" variant="bodySm">{collection.title}</Text>
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

//             {/* Schedule */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Schedule</Text>
//                 <Checkbox label="Start immediately" checked={startNow} onChange={() => {}} />
//                 <Checkbox label="Set end date" checked={hasEndDate} onChange={setHasEndDate} />
//                 {hasEndDate && <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />}
//               </BlockStack>
//             </Card>
//           </BlockStack>
//         </Layout.Section>

//         {/* Preview */}
//         <Layout.Section variant="oneThird">
//           <DiscountPreview
//             type={type} name={name} discountType={discountType} discountValue={discountValue}
//             tiers={tiers} cartTiers={cartTiers} freeShipping={freeShipping}
//             minOrderForShipping={minOrderForShipping} minQuantityForShipping={minQuantityForShipping}
//             requirementType={requirementType} appliesTo={appliesTo} status={status}
//             bxgyDiscountPct={bxgyDiscountPct}
//           />
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
import { useLoaderData, useNavigate, useSubmit, useActionData, useFetcher } from "@remix-run/react";
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
import { createShopifyDiscount } from "../discount.server";

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  bulk_price: "Bulk price editor",
  quantity_discount: "Quantity discount",
  buy_x_get_y: "Buy X Get Y",
  advanced_discount_code: "Advanced discount code",
  cart_goal: "Cart goal",
  shipping_discount: "Shipping discount",
};

const CAMPAIGN_TYPE_DESCRIPTIONS: Record<string, string> = {
  bulk_price: "Update products prices and compare at prices in bulk for promotions and sales.",
  quantity_discount: "Offer tiered discounts based on the quantity of items purchased.",
  buy_x_get_y: "Offer free or discounted items when customers buy selected products.",
  advanced_discount_code: "Offer order and shipping discounts with a single code.",
  cart_goal: "Offer discounts when customers reach a minimum cart value.",
  shipping_discount: "Offer different shipping discounts or free shipping promotions.",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "bulk_price";
  return json({ type });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const discountType = formData.get("discountType") as string;
  const discountValue = parseFloat((formData.get("discountValue") as string) || "0");
  const appliesTo = formData.get("appliesTo") as string;
  const status = formData.get("status") as string;
  const startNow = formData.get("startNow") === "true";
  const startDate = formData.get("startDate") as string;
  const hasEndDate = formData.get("hasEndDate") === "true";
  const endDate = formData.get("endDate") as string;
  const tiers = formData.get("tiers") as string;
  const bxgyDiscountPct = (formData.get("bxgyDiscountPct") as string) || null;
  const freeShipping = formData.get("freeShipping") === "true";
  const minOrderForShipping = formData.get("minOrderForShipping") as string;
  const minQuantityForShipping = formData.get("minQuantityForShipping") as string;
  const requirementType = (formData.get("requirementType") as string) || "amount";
  const geoTarget = formData.get("geoTarget") as string;
  const productIds = formData.get("productIds") as string;
  const collectionIds = formData.get("collectionIds") as string;
  const discountCode = formData.get("discountCode") as string;
  const combineWithProducts = formData.get("combineWithProducts") === "true";
  const combineWithOrders = formData.get("combineWithOrders") === "true";
  const combineWithShipping = formData.get("combineWithShipping") === "true";

  if (!name || name.trim() === "") {
    return json({ success: false, error: "Campaign name is required" });
  }

  const needsGeoTarget =
    type === "shipping_discount" ||
    (type === "advanced_discount_code" && discountType === "free_shipping");

  if (needsGeoTarget) {
    if (!geoTarget || (geoTarget !== "domestic" && geoTarget !== "all")) {
      return json({
        success: false,
        error: "Please choose where free shipping applies (Domestic or All zones).",
      });
    }
  }

  const campaignStartDate = startNow ? new Date() : startDate ? new Date(startDate) : new Date();
  const campaignEndDate = hasEndDate && endDate ? new Date(endDate) : null;
  const finalDiscountType = type === "shipping_discount" ? "free_shipping" : discountType;

  try {
    const shopifyResult = await createShopifyDiscount(admin, {
      name: name.trim(),
      type,
      discountType: finalDiscountType,
      discountValue: Math.max(0, discountValue || 0),
      bxgyDiscountPct: bxgyDiscountPct || null,
      appliesTo: appliesTo || "all",
      startDate: campaignStartDate,
      endDate: campaignEndDate,
      tiers: tiers || null,
      productIds: productIds || null,
      collectionIds: collectionIds || null,
      freeShipping,
      minOrderForShipping: minOrderForShipping || null,
      minQuantityForShipping: minQuantityForShipping || null,
      requirementType: requirementType || "amount",
      discountCode: discountCode || null,
      geoTarget: geoTarget || null,
      combineWithProducts,
      combineWithOrders,
      combineWithShipping,
    });

    if (!shopifyResult.success && shopifyResult.errors?.length) {
      const errorMsg = shopifyResult.errors.map((e: any) => e.message || e).join(", ");
      return json({ success: false, error: `Shopify error: ${errorMsg}` });
    }

    // Store the Shopify discount ID so webhooks can match reliably by ID
    // instead of fragile title matching.
    const shopifyDiscountId = shopifyResult.createdIds?.[0] || null;

    // Derive correct DB values based on requirementType:
    //   "amount"   → save to minimumAmount,   minimumQuantity = null
    //   "quantity" → save to minimumQuantity, minimumAmount   = null
    //   "both"     → save both fields
    const storedMinAmount = (requirementType === "quantity")
      ? null
      : minOrderForShipping ? parseFloat(minOrderForShipping) : null;

    const storedMinQty = (requirementType === "amount")
      ? null
      : minQuantityForShipping ? parseInt(minQuantityForShipping) : null;

    await db.campaign.create({
      data: {
        shop,
        name: name.trim(),
        type,
        status: status || "active",
        discountType: finalDiscountType,
        discountValue: Math.max(0, discountValue || 0),
        appliesTo: appliesTo || "all",
        startDate: campaignStartDate,
        endDate: campaignEndDate,
        tiers: tiers || null,
        minimumAmount:  storedMinAmount,   // null when requirementType = "quantity"
        minimumQuantity: storedMinQty,     // null when requirementType = "amount"
        requirementType: requirementType || "amount",  // store so proxy/widget can use OR vs AND logic
        geoTarget: geoTarget || null,
        productIds: productIds || null,
        collectionIds: collectionIds || null,
        combineWithProducts,
        combineWithOrders,
        combineWithShipping,
        shopifyDiscountId,                 // stored for reliable webhook matching
      },
    });

    return redirect("/app/campaigns");
  } catch (error: any) {
    console.error("Failed to create campaign:", error);
    // Surface the real error message so we can debug it
    const msg = error?.message || error?.toString() || "Unknown error";
    return json({ success: false, error: `Failed to create campaign: ${msg}` });
  }
};

/* ── Discount Preview ── */
function DiscountPreview({
  type, name, discountType, discountValue, tiers, cartTiers,
  freeShipping, minOrderForShipping, minQuantityForShipping, requirementType,
  appliesTo, status, bxgyDiscountPct,
}: {
  type: string; name: string; discountType: string; discountValue: string;
  tiers: { quantity: string; discount: string; discountType?: string }[];
  cartTiers: { amount: string; discount: string; discountType?: string }[];
  freeShipping: boolean; minOrderForShipping: string; minQuantityForShipping: string;
  requirementType: string; appliesTo: string; status: string;
  bxgyDiscountPct: string;
}) {
  const [cartQty, setCartQty] = useState(1);
  const samplePrice = 10.0;
  const discountVal = parseFloat(discountValue) || 0;

  const getQuantityDiscount = (qty: number) => {
    const validTiers = tiers.filter(t => t.quantity && t.discount)
      .map(t => ({ quantity: parseInt(t.quantity), discount: parseFloat(t.discount), discountType: t.discountType || "percentage" }))
      .filter(t => !isNaN(t.quantity) && !isNaN(t.discount)).sort((a, b) => b.quantity - a.quantity);
    return validTiers.find(t => qty >= t.quantity) || null;
  };

  const getCartGoalDiscount = (totalAmount: number) => {
    const validTiers = cartTiers.filter(t => t.amount && t.discount)
      .map(t => ({ amount: parseFloat(t.amount), discount: parseFloat(t.discount), discountType: t.discountType || "percentage" }))
      .filter(t => !isNaN(t.amount) && !isNaN(t.discount) && t.discount > 0).sort((a, b) => b.amount - a.amount);
    return validTiers.find(t => totalAmount >= t.amount) || null;
  };

  const cartTotal = samplePrice * cartQty;
  let discountPercent = 0, discountAmount = 0, finalTotal = cartTotal;
  const activeQuantityTier = type === "quantity_discount" ? getQuantityDiscount(cartQty) : null;
  const activeCartTier = type === "cart_goal" ? getCartGoalDiscount(cartTotal) : null;
  const quantityTierIsPerItem = appliesTo === "specific_products" || appliesTo === "specific_collections";
  if (type === "bulk_price") {
    if (discountType === "percentage") { discountPercent = discountVal; discountAmount = cartTotal * (discountVal / 100); }
    else if (discountType === "fixed_amount") { discountAmount = discountVal * cartQty; }
    else if (discountType === "new_price") { discountAmount = (samplePrice - discountVal) * cartQty; }
  } else if (type === "quantity_discount" && activeQuantityTier) {
    if (activeQuantityTier.discountType === "fixed_amount") {
      discountAmount = quantityTierIsPerItem
        ? activeQuantityTier.discount * cartQty
        : Math.min(activeQuantityTier.discount, cartTotal);
    } else {
      discountPercent = activeQuantityTier.discount;
      discountAmount = cartTotal * (discountPercent / 100);
    }
  } else if (type === "cart_goal" && activeCartTier) {
    if (activeCartTier.discountType === "fixed_amount") {
      discountAmount = Math.min(activeCartTier.discount, cartTotal);
    } else {
      discountPercent = activeCartTier.discount;
      discountAmount = cartTotal * (discountPercent / 100);
    }
  }
  discountAmount = Math.max(0, discountAmount);
  finalTotal = Math.max(0, cartTotal - discountAmount);
  const unitPrice = cartQty > 0 ? finalTotal / cartQty : samplePrice;
  const appliesToLabel = appliesTo === "all" ? "Applies to products and variants" :
    appliesTo === "specific_products" ? "Applies to specific products" : "Applies to specific collections";

  const shippingRequirementText = () => {
    const parts = [];
    if ((requirementType === "amount" || requirementType === "both" || requirementType === "either") && minOrderForShipping && parseFloat(minOrderForShipping) > 0)
      parts.push(`orders above $${minOrderForShipping}`);
    if ((requirementType === "quantity" || requirementType === "both" || requirementType === "either") && minQuantityForShipping && parseInt(minQuantityForShipping) > 0)
      parts.push(`${minQuantityForShipping}+ items in cart`);
    const connector = requirementType === "either" ? " OR " : " AND ";
    return parts.length > 0 ? `When: ${parts.join(connector)}` : "No minimum required";
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">Discount preview</Text>
        <Box background="bg-surface-secondary" borderRadius="200" padding="400">
          <BlockStack gap="300">
            <Text as="h3" variant="headingSm">On product page</Text>
            {type === "bulk_price" && discountVal > 0 && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">For products without "compare at price"</Text>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm">Before</Text>
                    <Text as="span" variant="bodySm">After</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="bold">${samplePrice.toFixed(2)}</Text>
                    <InlineStack gap="100">
                      <Text as="span" variant="bodyMd" fontWeight="bold">${unitPrice.toFixed(2)}</Text>
                      <Text as="span" variant="bodySm" tone="critical" textDecorationLine="line-through">${samplePrice.toFixed(2)}</Text>
                    </InlineStack>
                  </InlineStack>
                </BlockStack>
              </Box>
            )}
            {type === "quantity_discount" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="bold">Buy more, Save more!</Text>
                  {tiers.filter(t => t.quantity && t.discount).map((tier, i) => (
                    <InlineStack key={i} align="space-between">
                      <Text as="span" variant="bodySm">Buy {tier.quantity}+</Text>
                      <Badge tone="success">
                        {tier.discountType === "fixed_amount"
                          ? (quantityTierIsPerItem ? `Save $${tier.discount} each` : `Save $${tier.discount}`)
                          : `Save ${tier.discount}%`}
                      </Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Box>
            )}
            {type === "cart_goal" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="bold">Spend more, Save more!</Text>
                  {cartTiers.filter(t => t.amount && t.discount && parseFloat(t.discount) > 0).map((tier, i) => (
                    <InlineStack key={i} align="space-between">
                      <Text as="span" variant="bodySm">Spend ${tier.amount}+</Text>
                      <Badge tone="success">
                        {tier.discountType === "fixed_amount" ? `Save $${tier.discount}` : `Save ${tier.discount}%`}
                      </Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Box>
            )}
            {type === "shipping_discount" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="bold">Free shipping</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{shippingRequirementText()}</Text>
                </BlockStack>
              </Box>
            )}
            {type === "buy_x_get_y" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  Buy {discountValue || "X"}, Get 1 {discountType === "free" ? "Free" : `at ${bxgyDiscountPct || "?"}% off`}
                </Text>
              </Box>
            )}
            {type === "advanced_discount_code" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  {discountType === "free_shipping" ? "Free shipping with code" :
                    discountType === "percentage" ? `${discountVal}% off with code` : `$${discountVal} off with code`}
                </Text>
              </Box>
            )}
          </BlockStack>
        </Box>
        <Box background="bg-surface-secondary" borderRadius="200" padding="400">
          <BlockStack gap="300">
            <Text as="h3" variant="headingSm">On cart</Text>
            <Box padding="300" background="bg-surface" borderRadius="200">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <div style={{ width: "40px", height: "40px", background: "#f0f0f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold" }}>A</div>
                    <BlockStack gap="0">
                      <Text as="span" variant="bodySm" fontWeight="bold">Product A</Text>
                      <Text as="span" variant="bodySm" tone="subdued">${samplePrice.toFixed(2)}</Text>
                    </BlockStack>
                  </InlineStack>
                  <Text as="span" variant="bodySm" fontWeight="bold">${(samplePrice * cartQty).toFixed(2)}</Text>
                </InlineStack>
                <InlineStack align="center" gap="200" blockAlign="center">
                  <Button size="slim" onClick={() => setCartQty(Math.max(1, cartQty - 1))} disabled={cartQty <= 1}>−</Button>
                  <div style={{ minWidth: "36px", textAlign: "center" as const, padding: "4px 8px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "13px", fontWeight: "bold" }}>{cartQty}</div>
                  <Button size="slim" onClick={() => setCartQty(cartQty + 1)}>+</Button>
                </InlineStack>
                {type === "quantity_discount" && activeQuantityTier && (
                  <Box padding="200" background="bg-surface-success" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">
                      {activeQuantityTier.discountType === "fixed_amount"
                        ? (quantityTierIsPerItem
                            ? `$${activeQuantityTier.discount} off each item applied (qty: ${cartQty})`
                            : `$${activeQuantityTier.discount} off your order applied (qty: ${cartQty})`)
                        : `${activeQuantityTier.discount}% discount applied (qty: ${cartQty})`}
                    </Text>
                  </Box>
                )}
                {type === "cart_goal" && activeCartTier && (
                  <Box padding="200" background="bg-surface-success" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">
                      {activeCartTier.discountType === "fixed_amount"
                        ? `$${activeCartTier.discount} off your order (cart: $${cartTotal.toFixed(2)})`
                        : `${activeCartTier.discount}% discount applied (cart: $${cartTotal.toFixed(2)})`}
                    </Text>
                  </Box>
                )}
                <Divider />
                <InlineStack align="space-between">
                  <Text as="span" variant="bodySm">Total ({cartQty} items)</Text>
                  <Text as="span" variant="bodySm">${cartTotal.toFixed(2)}</Text>
                </InlineStack>
                {discountAmount > 0 && (
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm" tone="success">Saving {discountPercent > 0 ? `(${discountPercent}%)` : ""}</Text>
                    <Text as="span" variant="bodySm" tone="success">-${discountAmount.toFixed(2)}</Text>
                  </InlineStack>
                )}
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd" fontWeight="bold">Subtotal</Text>
                  <Text as="span" variant="bodyMd" fontWeight="bold">${finalTotal.toFixed(2)}</Text>
                </InlineStack>
              </BlockStack>
            </Box>
          </BlockStack>
        </Box>
        <Divider />
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">Summary</Text>
          <Text as="p" variant="bodySm" fontWeight="bold">{name || "No campaign name yet"}</Text>
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" fontWeight="bold">Campaign type</Text>
            <InlineStack gap="100"><span style={{ fontSize: "12px" }}>•</span><Text as="p" variant="bodySm">{CAMPAIGN_TYPE_LABELS[type]}</Text></InlineStack>
          </BlockStack>
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" fontWeight="bold">Details</Text>
            <InlineStack gap="100"><span style={{ fontSize: "12px" }}>•</span><Text as="p" variant="bodySm">{appliesToLabel}</Text></InlineStack>
          </BlockStack>
          <Divider />
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" fontWeight="bold">Need help?</Text>
            <Text as="p" variant="bodySm" tone="subdued">If you need assistance, click below for support.</Text>
            <Button size="slim" variant="plain" url="/app/helpandsupport">Contact support</Button>
          </BlockStack>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

/* ── Main Component ── */
export default function NewCampaign() {
  const { type } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [appliesTo, setAppliesTo] = useState("all");
  const [startNow, setStartNow] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("active");
  const [tiers, setTiers] = useState([
    { quantity: "2", discount: "5", discountType: "percentage" },
    { quantity: "4", discount: "10", discountType: "percentage" },
    { quantity: "8", discount: "15", discountType: "percentage" },
  ]);
  // Global discount type — all tiers share the same type
  const [tierDiscountType, setTierDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [cartTiers, setCartTiers] = useState([
    { amount: "50", discount: "5", discountType: "percentage" },
    { amount: "100", discount: "10", discountType: "percentage" },
    { amount: "150", discount: "15", discountType: "percentage" },
  ]);
  const [cartTierDiscountType, setCartTierDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [freeShipping] = useState(true);
  const [bxgyDiscountPct, setBxgyDiscountPct] = useState("10"); // separate state for BxGy discount %
  const [minOrderForShipping, setMinOrderForShipping] = useState("");
  const [minQuantityForShipping, setMinQuantityForShipping] = useState("");
  const [requirementType, setRequirementType] = useState("amount");
  const [geoTarget, setGeoTarget] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  // Enhanced product state — supports both all-variants and specific-variant selection
  const [selectedProducts, setSelectedProducts] = useState<{
    id: string;
    title: string;
    image: string;
    variants: { id: string; title: string; price: string; sku: string }[];
    variantMode: 'all' | 'specific';
    selectedVariantIds: string[];
    showVariants: boolean;
  }[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
  const [combineWithProducts, setCombineWithProducts] = useState(true);
  const [combineWithOrders, setCombineWithOrders] = useState(true);
  const [combineWithShipping, setCombineWithShipping] = useState(true);

  const shopify = useAppBridge();
  const variantFetcher = useFetcher<{ variants: any[] }>();

  // Load variants from the server for a product
  const loadVariants = (productId: string, productIdx: number) => {
    // Only fetch if we don't already have variants
    const product = selectedProducts[productIdx];
    if (product?.variants?.length > 0) {
      // Already have variants — just toggle open
      setSelectedProducts(prev =>
        prev.map((p, i) => i === productIdx ? { ...p, showVariants: !p.showVariants } : p)
      );
      return;
    }
    // Fetch variants from server
    variantFetcher.load(`/app/api/variants?productId=${encodeURIComponent(productId)}`);
    // Mark which product we're loading for
    setLoadingVariantsFor(productIdx);
  };

  const [loadingVariantsFor, setLoadingVariantsFor] = useState<number | null>(null);

  // When fetcher finishes, inject variants into that product
  if (
    variantFetcher.state === "idle" &&
    variantFetcher.data &&
    loadingVariantsFor !== null
  ) {
    const fetchedVariants = variantFetcher.data.variants || [];
    const idx = loadingVariantsFor;
    // Use a ref flag to avoid infinite re-render
    if (selectedProducts[idx] && selectedProducts[idx].variants.length === 0) {
      setSelectedProducts(prev =>
        prev.map((p, i) => i === idx
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
  const isFreeShippingCampaign = type === "shipping_discount";

  const setPositiveValue = (setter: (v: string) => void) => (val: string) => {
    const num = parseFloat(val);
    if (val === "" || num >= 0) setter(val);
  };

  const updateTier = (index: number, field: "quantity" | "discount", value: string) => {
    const num = parseFloat(value);
    if (value !== "" && num < 0) return;
    const n = [...tiers]; n[index][field] = value; setTiers(n);
  };

  const updateCartTier = (index: number, field: "amount" | "discount", value: string) => {
    const num = parseFloat(value);
    if (value !== "" && num < 0) return;
    const n = [...cartTiers]; n[index][field] = value; setCartTiers(n);
  };

  // Best-effort price ceiling for fixed-amount tiers, computed from product/variant
  // data already loaded in this form. Only "known" once every selected product has
  // its variant prices loaded — otherwise we'd understate the total and show a false
  // warning. The authoritative check happens server-side on save regardless.
  const getSelectedProductsPriceCeiling = (): { known: boolean; total: number } => {
    if (appliesTo !== "specific_products" || selectedProducts.length === 0) {
      return { known: false, total: 0 };
    }
    let total = 0;
    for (const p of selectedProducts) {
      const relevantVariants = p.variantMode === "specific"
        ? p.variants.filter(v => p.selectedVariantIds.includes(v.id))
        : p.variants;
      if (relevantVariants.length === 0) return { known: false, total: 0 };
      const prices = relevantVariants.map(v => parseFloat(v.price)).filter(n => !isNaN(n));
      if (prices.length === 0) return { known: false, total: 0 };
      total += Math.min(...prices);
    }
    return { known: true, total };
  };

  const priceCeiling = (type === "quantity_discount" && tierDiscountType === "fixed_amount") ? getSelectedProductsPriceCeiling() : { known: false, total: 0 };

  // Quantities that appear more than once across tiers — used for inline field errors
  const duplicateTierQtys = new Set(
    tiers
      .map((t) => t.quantity)
      .filter((q) => q !== "" && tiers.filter((t) => t.quantity === q).length > 1)
  );

  // Spend amounts that appear more than once across cart goal tiers
  const duplicateCartAmounts = new Set(
    cartTiers
      .map((t) => t.amount)
      .filter((a) => a !== "" && cartTiers.filter((t) => t.amount === a).length > 1)
  );

  const handleSave = () => {
    if (isFreeShippingCampaign && !geoTarget) {
      shopify.toast.show("Please choose where free shipping applies (Domestic or All zones).", { isError: true });
      return;
    }
    if (type === "quantity_discount") {
      const zeroQty = tiers.find((t) => !t.quantity || parseInt(t.quantity) <= 0);
      if (zeroQty) {
        shopify.toast.show("Minimum quantity must be greater than 0 for all tiers.", { isError: true });
        return;
      }
    }
    if (type === "quantity_discount" && duplicateTierQtys.size > 0) {
      shopify.toast.show("Each tier must have a unique minimum quantity. Remove or fix the duplicate quantities.", { isError: true });
      return;
    }
    if (type === "cart_goal" && duplicateCartAmounts.size > 0) {
      shopify.toast.show("Each cart goal tier must have a unique minimum spend amount.", { isError: true });
      return;
    }
    if (type === "quantity_discount" && priceCeiling.known) {
      const tooHigh = tiers.find((t) => tierDiscountType === "fixed_amount" && parseFloat(t.discount || "0") > priceCeiling.total);
      if (tooHigh) {
        shopify.toast.show(`Buy ${tooHigh.quantity}+ discount exceeds the selected products' combined price ($${priceCeiling.total.toFixed(2)}).`, { isError: true });
        return;
      }
    }
    const formData = new FormData();
    formData.append("name", name);
    formData.append("type", type);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue || "0");
    formData.append("appliesTo", appliesTo);
    formData.append("status", status);
    formData.append("startNow", String(startNow));
    formData.append("startDate", startDate);
    formData.append("hasEndDate", String(hasEndDate));
    formData.append("endDate", endDate);
    formData.append("freeShipping", String(freeShipping));
    formData.append("minOrderForShipping", minOrderForShipping);
    formData.append("minQuantityForShipping", minQuantityForShipping);
    formData.append("requirementType", requirementType);
    formData.append("geoTarget", geoTarget);
    formData.append("discountCode", discountCode);
    formData.append("combineWithProducts", String(combineWithProducts));
    formData.append("combineWithOrders", String(combineWithOrders));
    formData.append("combineWithShipping", String(combineWithShipping));
    if (selectedProducts.length > 0) {
      // Build IDs array: product GID if all variants selected, variant GIDs if specific
      const ids = selectedProducts.flatMap(p => {
        if (p.variantMode === 'all' || p.selectedVariantIds.length === 0) {
          return [p.id]; // product GID → applies to ALL variants
        }
        return p.selectedVariantIds; // variant GIDs → specific variants only
      });
      formData.append("productIds", JSON.stringify(ids));
    }
    if (selectedCollections.length > 0) formData.append("collectionIds", JSON.stringify(selectedCollections.map(c => c.id)));
    if (type === "buy_x_get_y") formData.append("bxgyDiscountPct", bxgyDiscountPct || "10");
    if (type === "quantity_discount") formData.append("tiers", JSON.stringify(tiers.map((t) => ({ ...t, discountType: tierDiscountType }))));
    else if (type === "cart_goal") formData.append("tiers", JSON.stringify(cartTiers.map((t) => ({ ...t, discountType: cartTierDiscountType }))));
    submit(formData, { method: "post" });
  };

  return (
    <Page
      backAction={{ content: "Choose campaign type", url: "/app/campaigns/create" }}
      title={`Create ${CAMPAIGN_TYPE_LABELS[type] || "Campaign"}`}
      primaryAction={{ content: "Save campaign", onAction: handleSave }}
      secondaryActions={[{ content: "Discard", onAction: () => navigate("/app/campaigns") }]}
    >
      {actionData && !actionData.success && (
        <Box paddingBlockEnd="400"><Banner tone="critical"><p>{actionData.error}</p></Banner></Box>
      )}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p><strong>{CAMPAIGN_TYPE_LABELS[type]}</strong> — {CAMPAIGN_TYPE_DESCRIPTIONS[type]}</p>
            </Banner>

            {/* Campaign Details */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Campaign details</Text>
                <TextField label="Campaign name" value={name} onChange={setName} autoComplete="off" placeholder="e.g. Summer Sale 2025" helpText="This name helps you identify the campaign internally." />
                <Select label="Status" options={[{ label: "Active", value: "active" }, { label: "Draft", value: "draft" }, { label: "Scheduled", value: "scheduled" }]} value={status} onChange={setStatus} />
              </BlockStack>
            </Card>

            {/* Discount Configuration */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Discount configuration</Text>

                {type === "bulk_price" && (
                  <FormLayout>
                    <Select label="Discount type" options={[{ label: "Percentage", value: "percentage" }, { label: "Fixed amount", value: "fixed_amount" }, { label: "Set new price", value: "new_price" }]} value={discountType} onChange={setDiscountType} />
                    <TextField label={discountType === "percentage" ? "Discount percentage" : "Amount"} type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" suffix={discountType === "percentage" ? "%" : "$"} placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 10.00"} />
                  </FormLayout>
                )}

                {type === "quantity_discount" && (
                  <BlockStack gap="400">
                    <Text as="p" variant="bodySm" tone="subdued">Set up tiered discounts based on quantity purchased.</Text>
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
                            type="number" min={0}
                            value={tier.quantity}
                            onChange={(v) => updateTier(i, "quantity", v)}
                            autoComplete="off"
                            prefix="Buy"
                            suffix="+"
                            error={
                              (tier.quantity === "0" || (tier.quantity !== "" && parseInt(tier.quantity) <= 0))
                                ? "Must be greater than 0"
                                : (tier.quantity && duplicateTierQtys.has(tier.quantity)
                                    ? "Duplicate — each tier needs a unique quantity"
                                    : undefined)
                            }
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={i === 0 ? "Discount value" : ""}
                            type="number"
                            min={0}
                            value={tier.discount}
                            onChange={(v) => updateTier(i, "discount", v)}
                            autoComplete="off"
                            prefix={tierDiscountType === "fixed_amount" ? "Save $" : "Save"}
                            suffix={tierDiscountType === "fixed_amount" ? undefined : "%"}
                            error={
                              tierDiscountType === "fixed_amount" && priceCeiling.known && parseFloat(tier.discount || "0") > priceCeiling.total
                                ? `Exceeds selected products' combined price ($${priceCeiling.total.toFixed(2)})`
                                : undefined
                            }
                          />
                        </div>
                        <Button tone="critical" size="slim" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} disabled={tiers.length <= 1}>Remove</Button>
                      </InlineStack>
                    ))}
                    {tierDiscountType === "fixed_amount" && !(appliesTo === "specific_products" || appliesTo === "specific_collections") && (
                      <Banner tone="info">
                        <p>With "Applies to: All products" (set below), Shopify requires fixed-amount tiers to apply once per order rather than per item. Choose "Specific products" or "Specific collections" below if you want the amount to apply per item instead.</p>
                      </Banner>
                    )}
                    <div><Button size="slim" onClick={() => setTiers([...tiers, { quantity: "", discount: "", discountType: tierDiscountType }])}>Add tier</Button></div>
                  </BlockStack>
                )}

                {type === "buy_x_get_y" && (
                  <FormLayout>
                    <TextField
                      label="Customer buys (quantity)"
                      type="number" min={1}
                      value={discountValue}
                      onChange={setPositiveValue(setDiscountValue)}
                      autoComplete="off"
                      placeholder="e.g. 2"
                      helpText="Number of items the customer must add to cart"
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
                        label="Discount on the free item (%)"
                        type="number" min={1} max={99}
                        value={bxgyDiscountPct}
                        onChange={(v) => {
                          const num = parseFloat(v);
                          if (v === "" || (num >= 0 && num <= 100)) setBxgyDiscountPct(v);
                        }}
                        autoComplete="off"
                        suffix="%"
                        placeholder="e.g. 50"
                        helpText="Percentage off the 'get' item. 100% = free."
                      />
                    )}
                  </FormLayout>
                )}

                {type === "advanced_discount_code" && (
                  <FormLayout>
                    <TextField label="Discount code" value={discountCode} onChange={setDiscountCode} autoComplete="off" placeholder="e.g. SAVE20" helpText="Customers will enter this code at checkout" />
                    <Button size="slim" onClick={() => {
                      let c = "";
                      for (let i = 0; i < 8; i++) c += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
                      setDiscountCode(c);
                    }}>Generate code</Button>
                    <Select label="Discount type" options={[{ label: "Percentage off", value: "percentage" }, { label: "Fixed amount off", value: "fixed_amount" }, { label: "Free shipping", value: "free_shipping" }]} value={discountType} onChange={setDiscountType} />
                    {discountType !== "free_shipping" && <TextField label="Discount value" type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" suffix={discountType === "percentage" ? "%" : "$"} />}
                    {discountType === "free_shipping" && (
                      <Select label="Where does free shipping apply?" options={[{ label: "Select an option", value: "" }, { label: "Domestic only (same country as your store)", value: "domestic" }, { label: "All zones (worldwide)", value: "all" }]} value={geoTarget} onChange={setGeoTarget} helpText="Required. Choose whether free shipping applies only to your store's country, or worldwide." />
                    )}
                  </FormLayout>
                )}

                {type === "cart_goal" && (
                  <BlockStack gap="400">
                    <Text as="p" variant="bodySm" tone="subdued">Set minimum cart values and their corresponding discounts.</Text>
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
                            type="number" min={0}
                            value={tier.amount}
                            onChange={(v) => updateCartTier(i, "amount", v)}
                            autoComplete="off"
                            prefix="$"
                            error={
                              tier.amount && duplicateCartAmounts.has(tier.amount)
                                ? "Duplicate — each tier needs a unique spend amount"
                                : undefined
                            }
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={i === 0 ? "Discount value" : ""}
                            type="number" min={0}
                            value={tier.discount}
                            onChange={(v) => updateCartTier(i, "discount", v)}
                            autoComplete="off"
                            prefix={cartTierDiscountType === "fixed_amount" ? "Save $" : "Save"}
                            suffix={cartTierDiscountType === "fixed_amount" ? undefined : "%"}
                          />
                        </div>
                        <Button tone="critical" size="slim" onClick={() => setCartTiers(cartTiers.filter((_, j) => j !== i))} disabled={cartTiers.length <= 1}>Remove</Button>
                      </InlineStack>
                    ))}
                    <div><Button size="slim" onClick={() => setCartTiers([...cartTiers, { amount: "", discount: "", discountType: cartTierDiscountType }])}>Add tier</Button></div>
                  </BlockStack>
                )}

                {/* ── Shipping Discount ── */}
                {type === "shipping_discount" && (
                  <FormLayout>
                    {/* Requirement type selector */}
                    <Select
                      label="Minimum requirement"
                      helpText="Choose what customers must reach to unlock free shipping."
                      options={[
                        { label: "Minimum purchase amount ($)", value: "amount" },
                        { label: "Minimum number of items", value: "quantity" },
                        { label: "Both — amount AND quantity", value: "both" },
                        { label: "Either — amount OR quantity", value: "either" },
                      ]}
                      value={requirementType}
                      onChange={setRequirementType}
                    />

                    {/* Amount field */}
                    {(requirementType === "amount" || requirementType === "both" || requirementType === "either") && (
                      <TextField
                        label="Minimum order value"
                        type="number"
                        min={0}
                        value={minOrderForShipping}
                        onChange={setPositiveValue(setMinOrderForShipping)}
                        autoComplete="off"
                        prefix="$"
                        placeholder="e.g. 100"
                        helpText="Customers must spend at least this amount. Leave blank for no minimum."
                      />
                    )}

                    {/* Quantity field */}
                    {(requirementType === "quantity" || requirementType === "both" || requirementType === "either") && (
                      <TextField
                        label="Minimum number of items"
                        type="number"
                        min={1}
                        value={minQuantityForShipping}
                        onChange={(v) => {
                          const num = parseInt(v);
                          if (v === "" || num >= 0) setMinQuantityForShipping(v);
                        }}
                        autoComplete="off"
                        suffix="items"
                        placeholder="e.g. 3"
                        helpText="Customers must have at least this many items in their cart."
                      />
                    )}

                    {/* Info banner for "both" mode */}
                    {requirementType === "both" && (
                      <Banner tone="info">
                        <p>Customer must meet <strong>both</strong> the amount AND quantity requirement to get free shipping.</p>
                      </Banner>
                    )}
                    {requirementType === "either" && (
                      <Banner tone="info">
                        <p>Customer gets free shipping if they meet <strong>either</strong> the amount OR the quantity requirement — whichever comes first.</p>
                      </Banner>
                    )}

                    {/* Geo target */}
                    <Select
                      label="Where does free shipping apply?"
                      options={[
                        { label: "Select an option", value: "" },
                        { label: "Domestic only (same country as your store)", value: "domestic" },
                        { label: "All zones (worldwide)", value: "all" },
                      ]}
                      value={geoTarget}
                      onChange={setGeoTarget}
                      helpText="Required. Choose whether free shipping applies only to your store's country, or worldwide."
                    />
                  </FormLayout>
                )}
              </BlockStack>
            </Card>

            {/* Discount Combinations */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">Discount combinations</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Control whether this discount can stack with other active discounts at checkout.</Text>
                </BlockStack>
                <BlockStack gap="300">
                  <Checkbox label="Product discounts" helpText="Stack with product discount codes" checked={combineWithProducts} onChange={setCombineWithProducts} />
                  <Checkbox label="Order discounts" helpText="Stack with order-level discount codes" checked={combineWithOrders} onChange={setCombineWithOrders} />
                  <Checkbox label="Shipping discounts" helpText="Stack with other free shipping discount codes" checked={combineWithShipping} onChange={setCombineWithShipping} />
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Products */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Products</Text>
                <Select
                  label="Applies to"
                  helpText="Selecting products or collections below automatically updates this."
                  options={[
                    { label: "All products", value: "all" },
                    { label: "Specific products", value: "specific_products" },
                    { label: "Specific collections", value: "specific_collections" },
                  ]}
                  value={appliesTo}
                  onChange={(val) => {
                    setAppliesTo(val);
                    if (val === "all") { setSelectedProducts([]); setSelectedCollections([]); }
                  }}
                />
                {(appliesTo === "all" || appliesTo === "") && <Banner tone="info"><p>Discount will apply to all products in your store</p></Banner>}
                {appliesTo === "specific_products" && (
                  <BlockStack gap="300">
                    <InlineStack gap="200">
                      <Button onClick={async () => {
                        const selected = await shopify.resourcePicker({
                          type: "product", multiple: true, action: "select",
                          filter: { variants: false },
                        });
                        if (selected) {
                          setSelectedProducts(prev => {
                            const existingIds = new Set(prev.map(p => p.id));
                            const newProducts = selected
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
                                variantMode: 'all' as const,
                                selectedVariantIds: [],
                                showVariants: false,
                              }));
                            return [...prev, ...newProducts];
                          setAppliesTo("specific_products"); // Auto-set when products selected
                          });
                        }
                      }}>Browse products</Button>
                      <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedProducts([]); }}>
                        or select all products
                      </Button>
                    </InlineStack>

                    {selectedProducts.length > 0 && (
                      <BlockStack gap="200">
                        <Text as="p" variant="bodySm" fontWeight="bold">
                          {selectedProducts.length} product(s) selected
                        </Text>

                        {selectedProducts.map((product, i) => (
                          <Box key={product.id} background="bg-surface-secondary" borderRadius="200" padding="300">
                            <BlockStack gap="200">

                              {/* ── Product header row ── */}
                              <InlineStack align="space-between" blockAlign="center">
                                <InlineStack gap="200" blockAlign="center">
                                  <div style={{ width: "36px", height: "36px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
                                    {product.image
                                      ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>P</div>
                                    }
                                  </div>
                                  <BlockStack gap="0">
                                    <Text as="span" variant="bodySm" fontWeight="semibold">{product.title}</Text>
                                    <Text as="span" variant="bodySm" tone="subdued">
                                      {product.variantMode === 'all'
                                        ? `All ${product.variants.length} variants`
                                        : `${product.selectedVariantIds.length} of ${product.variants.length} variants`}
                                    </Text>
                                  </BlockStack>
                                </InlineStack>
                                <InlineStack gap="100">
                                  <Button
                                    size="slim" variant="plain"
                                    onClick={() => loadVariants(product.id, i)}
                                    loading={variantFetcher.state === "loading" && loadingVariantsFor === i}
                                  >
                                    {product.showVariants
                                      ? "Hide variants"
                                      : product.variants.length > 0
                                        ? `Select variants (${product.variants.length})`
                                        : "Select variants"}
                                  </Button>
                                  <Button size="slim" tone="critical"
                                    onClick={() => {
                                      const next = selectedProducts.filter((_, j) => j !== i);
                                      setSelectedProducts(next);
                                      if (next.length === 0) setAppliesTo("all"); // reset when no products
                                    }}>
                                    Remove
                                  </Button>
                                </InlineStack>
                              </InlineStack>

                              {/* ── Variant selector (expanded) ── */}
                              {product.showVariants && product.variants.length > 0 && (
                                <Box background="bg-surface" borderRadius="100" padding="300">
                                  <BlockStack gap="200">
                                    {/* All variants toggle */}
                                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                                      <input
                                        type="radio"
                                        name={`variantMode-${i}`}
                                        checked={product.variantMode === 'all'}
                                        onChange={() => setSelectedProducts(prev =>
                                          prev.map((p, j) => j === i ? { ...p, variantMode: 'all', selectedVariantIds: [] } : p)
                                        )}
                                      />
                                      Apply to all {product.variants.length} variants
                                    </label>

                                    <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                                      <input
                                        type="radio"
                                        name={`variantMode-${i}`}
                                        checked={product.variantMode === 'specific'}
                                        onChange={() => setSelectedProducts(prev =>
                                          prev.map((p, j) => j === i ? { ...p, variantMode: 'specific' } : p)
                                        )}
                                      />
                                      Apply to specific variants only
                                    </label>

                                    {/* Variant checkboxes */}
                                    {product.variantMode === 'specific' && (
                                      <Box paddingInlineStart="400">
                                        <BlockStack gap="100">
                                          {product.variants.map((v: any) => {
                                            const isChecked = product.selectedVariantIds.includes(v.id);
                                            return (
                                              <label key={v.id} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", padding: "4px 0" }}>
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => setSelectedProducts(prev =>
                                                    prev.map((p, j) => {
                                                      if (j !== i) return p;
                                                      const ids = isChecked
                                                        ? p.selectedVariantIds.filter(id => id !== v.id)
                                                        : [...p.selectedVariantIds, v.id];
                                                      return { ...p, selectedVariantIds: ids };
                                                    })
                                                  )}
                                                />
                                                <span style={{ flex: 1 }}>{v.title}</span>
                                                {v.sku && <span style={{ color: "#9ca3af", fontSize: "11px" }}>SKU: {v.sku}</span>}
                                                <span style={{ color: "#374151", fontWeight: "500" }}>${v.price}</span>
                                              </label>
                                            );
                                          })}
                                          {product.variantMode === 'specific' && product.selectedVariantIds.length === 0 && (
                                            <Text as="p" variant="bodySm" tone="caution">
                                              Select at least one variant, or switch to "All variants".
                                            </Text>
                                          )}
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
                      <Button onClick={async () => {
                        const selected = await shopify.resourcePicker({ type: "collection", multiple: true, action: "select" });
                        if (selected && selected.length > 0) {
                          setSelectedCollections(selected.map((c: any) => ({ id: c.id, title: c.title, image: c.image?.originalSrc || "" })));
                          setAppliesTo("specific_collections"); // Auto-set when collections picked
                        }
                      }}>Browse collections</Button>
                      <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedCollections([]); }}>or select all products</Button>
                    </InlineStack>
                    {selectedCollections.length > 0 && (
                      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          <Text as="p" variant="bodySm" fontWeight="bold">{selectedCollections.length} collection(s) selected</Text>
                          {selectedCollections.map((collection, i) => (
                            <InlineStack key={i} align="space-between" blockAlign="center">
                              <InlineStack gap="200" blockAlign="center">
                                <div style={{ width: "32px", height: "32px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
                                  {collection.image ? <img src={collection.image} alt={collection.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "C"}
                                </div>
                                <Text as="span" variant="bodySm">{collection.title}</Text>
                              </InlineStack>
                              <Button size="slim" tone="critical" onClick={() => {
                                const next = selectedCollections.filter((_, j) => j !== i);
                                setSelectedCollections(next);
                                if (next.length === 0) setAppliesTo("all");
                              }}>Remove</Button>
                            </InlineStack>
                          ))}
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            {/* Schedule */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Schedule</Text>
                <Checkbox label="Start immediately" checked={startNow} onChange={() => {}} />
                <Checkbox label="Set end date" checked={hasEndDate} onChange={setHasEndDate} />
                {hasEndDate && <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Preview */}
        <Layout.Section variant="oneThird">
          <DiscountPreview
            type={type} name={name} discountType={discountType} discountValue={discountValue}
            tiers={tiers} cartTiers={cartTiers} freeShipping={freeShipping}
            minOrderForShipping={minOrderForShipping} minQuantityForShipping={minQuantityForShipping}
            requirementType={requirementType} appliesTo={appliesTo} status={status}
            bxgyDiscountPct={bxgyDiscountPct}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}