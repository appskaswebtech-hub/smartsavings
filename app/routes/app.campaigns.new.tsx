// import {
//   json,
//   redirect,
//   type LoaderFunctionArgs,
//   type ActionFunctionArgs,
// } from "@remix-run/node";
// import { useLoaderData, useNavigate, useSubmit, useActionData } from "@remix-run/react";
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
//   const freeShipping = formData.get("freeShipping") === "true";
//   const minOrderForShipping = formData.get("minOrderForShipping") as string;
//   const geoTarget = formData.get("geoTarget") as string;
//   const productIds = formData.get("productIds") as string;
//   const collectionIds = formData.get("collectionIds") as string;
//   const discountCode = formData.get("discountCode") as string;

//   if (!name || name.trim() === "") {
//     return json({ success: false, error: "Campaign name is required" });
//   }

//   // Free shipping campaigns require an explicit geo target
//   if (
//     (type === "shipping_discount" && freeShipping) ||
//     (type === "advanced_discount_code" && discountType === "free_shipping")
//   ) {
//     if (!geoTarget || (geoTarget !== "domestic" && geoTarget !== "all")) {
//       return json({
//         success: false,
//         error: "Please choose where free shipping applies (Domestic or All zones).",
//       });
//     }
//   }

//   const campaignStartDate = startNow ? new Date() : startDate ? new Date(startDate) : new Date();
//   const campaignEndDate = hasEndDate && endDate ? new Date(endDate) : null;
//   const finalDiscountType = type === "shipping_discount" && freeShipping ? "free_shipping" : discountType;

//   try {
//     // 1. Create discount on Shopify store via Admin API
//     const shopifyResult = await createShopifyDiscount(admin, {
//       name: name.trim(),
//       type,
//       discountType: finalDiscountType,
//       discountValue: Math.max(0, discountValue || 0),
//       appliesTo: appliesTo || "all",
//       status: status || "active",
//       startDate: campaignStartDate,
//       endDate: campaignEndDate,
//       tiers: tiers || null,
//       productIds: productIds || null,
//       collectionIds: collectionIds || null,
//       freeShipping,
//       minOrderForShipping: minOrderForShipping || null,
//       discountCode: discountCode || null,
//       geoTarget: geoTarget || null,
//     });

//     if (!shopifyResult.success && shopifyResult.errors?.length) {
//       const errorMsg = shopifyResult.errors.map((e: any) => e.message || e).join(", ");
//       return json({ success: false, error: `Shopify error: ${errorMsg}` });
//     }

//     // 2. Save campaign to local database with Shopify discount ID
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
//         minimumAmount: minOrderForShipping ? parseFloat(minOrderForShipping) : null,
//         geoTarget: geoTarget || null,
//         productIds: productIds || null,
//         collectionIds: collectionIds || null,
//       },
//     });

//     return redirect("/app/campaigns");
//   } catch (error) {
//     console.error("Failed to create campaign:", error);
//     return json({ success: false, error: "Failed to create campaign. Please try again." });
//   }
// };

// /* ── Discount Preview Component ──────────────────────── */

// function DiscountPreview({
//   type,
//   name,
//   discountType,
//   discountValue,
//   tiers,
//   cartTiers,
//   freeShipping,
//   minOrderForShipping,
//   appliesTo,
//   status,
// }: {
//   type: string;
//   name: string;
//   discountType: string;
//   discountValue: string;
//   tiers: { quantity: string; discount: string }[];
//   cartTiers: { amount: string; discount: string }[];
//   freeShipping: boolean;
//   minOrderForShipping: string;
//   appliesTo: string;
//   status: string;
// }) {
//   const [cartQty, setCartQty] = useState(1);
//   const samplePrice = 10.0;
//   const discountVal = parseFloat(discountValue) || 0;

//   const getQuantityDiscount = (qty: number) => {
//     const validTiers = tiers
//       .filter(t => t.quantity && t.discount)
//       .map(t => ({ quantity: parseInt(t.quantity), discount: parseFloat(t.discount) }))
//       .filter(t => !isNaN(t.quantity) && !isNaN(t.discount))
//       .sort((a, b) => b.quantity - a.quantity);
//     const match = validTiers.find(t => qty >= t.quantity);
//     return match ? match.discount : 0;
//   };

//   const getCartGoalDiscount = (totalAmount: number) => {
//     const validTiers = cartTiers
//       .filter(t => t.amount && t.discount)
//       .map(t => ({ amount: parseFloat(t.amount), discount: parseFloat(t.discount) }))
//       .filter(t => !isNaN(t.amount) && !isNaN(t.discount))
//       .sort((a, b) => b.amount - a.amount);
//     const match = validTiers.find(t => totalAmount >= t.amount);
//     return match ? match.discount : 0;
//   };

//   const cartTotal = samplePrice * cartQty;
//   let discountPercent = 0;
//   let discountAmount = 0;
//   let finalTotal = cartTotal;

//   if (type === "bulk_price") {
//     if (discountType === "percentage") {
//       discountPercent = discountVal;
//       discountAmount = cartTotal * (discountVal / 100);
//     } else if (discountType === "fixed_amount") {
//       discountAmount = discountVal * cartQty;
//     } else if (discountType === "new_price") {
//       discountAmount = (samplePrice - discountVal) * cartQty;
//     }
//   } else if (type === "quantity_discount") {
//     discountPercent = getQuantityDiscount(cartQty);
//     discountAmount = cartTotal * (discountPercent / 100);
//   } else if (type === "cart_goal") {
//     discountPercent = getCartGoalDiscount(cartTotal);
//     discountAmount = cartTotal * (discountPercent / 100);
//   }

//   discountAmount = Math.max(0, discountAmount);
//   finalTotal = Math.max(0, cartTotal - discountAmount);

//   const unitPrice = cartQty > 0 ? finalTotal / cartQty : samplePrice;

//   const appliesToLabel =
//     appliesTo === "all" ? "Applies to products and variants" :
//     appliesTo === "specific_products" ? "Applies to specific products" :
//     "Applies to specific collections";

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
//                   <Text as="p" variant="bodySm" tone="subdued">
//                     For products without "compare at price"
//                   </Text>
//                   <InlineStack align="space-between">
//                     <Text as="span" variant="bodySm">Before</Text>
//                     <Text as="span" variant="bodySm">After</Text>
//                   </InlineStack>
//                   <InlineStack align="space-between">
//                     <Text as="span" variant="bodyMd" fontWeight="bold">
//                       ${samplePrice.toFixed(2)}
//                     </Text>
//                     <InlineStack gap="100">
//                       <Text as="span" variant="bodyMd" fontWeight="bold">
//                         ${unitPrice.toFixed(2)}
//                       </Text>
//                       <Text as="span" variant="bodySm" tone="critical" textDecorationLine="line-through">
//                         ${samplePrice.toFixed(2)}
//                       </Text>
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
//                       <Badge tone="success">Save {tier.discount}%</Badge>
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
//                       <Badge tone="success">Save {tier.discount}%</Badge>
//                     </InlineStack>
//                   ))}
//                 </BlockStack>
//               </Box>
//             )}

//             {type === "shipping_discount" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <BlockStack gap="100">
//                   <Text as="p" variant="bodySm" fontWeight="bold">
//                     {freeShipping ? "Free shipping" : `$${discountVal} off shipping`}
//                   </Text>
//                   {minOrderForShipping && (
//                     <Text as="p" variant="bodySm" tone="subdued">
//                       On orders above ${minOrderForShipping}
//                     </Text>
//                   )}
//                 </BlockStack>
//               </Box>
//             )}

//             {type === "buy_x_get_y" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <Text as="p" variant="bodySm" fontWeight="bold">
//                   Buy {discountValue || "X"}, Get 1 {discountType === "free" ? "Free" : `at ${discountVal}% off`}
//                 </Text>
//               </Box>
//             )}

//             {type === "advanced_discount_code" && (
//               <Box padding="200" background="bg-surface" borderRadius="200">
//                 <Text as="p" variant="bodySm" fontWeight="bold">
//                   {discountType === "free_shipping"
//                     ? "Free shipping with code"
//                     : discountType === "percentage"
//                     ? `${discountVal}% off with code`
//                     : `$${discountVal} off with code`}
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
//                     <div style={{
//                       width: "40px", height: "40px", background: "#f0f0f0",
//                       borderRadius: "6px", display: "flex", alignItems: "center",
//                       justifyContent: "center", fontSize: "11px", fontWeight: "bold",
//                     }}>
//                       A
//                     </div>
//                     <BlockStack gap="0">
//                       <Text as="span" variant="bodySm" fontWeight="bold">Product A</Text>
//                       <Text as="span" variant="bodySm" tone="subdued">${samplePrice.toFixed(2)}</Text>
//                     </BlockStack>
//                   </InlineStack>
//                   <Text as="span" variant="bodySm" fontWeight="bold">${(samplePrice * cartQty).toFixed(2)}</Text>
//                 </InlineStack>

//                 <InlineStack align="center" gap="200" blockAlign="center">
//                   <Button
//                     size="slim"
//                     onClick={() => setCartQty(Math.max(1, cartQty - 1))}
//                     disabled={cartQty <= 1}
//                   >
//                     −
//                   </Button>
//                   <div style={{
//                     minWidth: "36px", textAlign: "center" as const,
//                     padding: "4px 8px", border: "1px solid #ccc",
//                     borderRadius: "6px", fontSize: "13px", fontWeight: "bold",
//                   }}>
//                     {cartQty}
//                   </div>
//                   <Button size="slim" onClick={() => setCartQty(cartQty + 1)}>
//                     +
//                   </Button>
//                 </InlineStack>

//                 {type === "quantity_discount" && discountPercent > 0 && (
//                   <Box padding="200" background="bg-surface-success" borderRadius="200">
//                     <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">
//                       {discountPercent}% discount applied (qty: {cartQty})
//                     </Text>
//                   </Box>
//                 )}
//                 {type === "quantity_discount" && discountPercent === 0 && tiers.some(t => t.quantity && t.discount) && (
//                   <Box padding="200" background="bg-surface-warning" borderRadius="200">
//                     <Text as="p" variant="bodySm" tone="caution" alignment="center">
//                       Add {parseInt(tiers.filter(t => t.quantity)[0]?.quantity || "2") - cartQty} more to unlock {tiers.filter(t => t.discount)[0]?.discount}% off
//                     </Text>
//                   </Box>
//                 )}

//                 {type === "cart_goal" && discountPercent > 0 && (
//                   <Box padding="200" background="bg-surface-success" borderRadius="200">
//                     <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">
//                       {discountPercent}% discount applied (cart: ${cartTotal.toFixed(2)})
//                     </Text>
//                   </Box>
//                 )}
//                 {type === "cart_goal" && discountPercent === 0 && cartTiers.some(t => t.amount && t.discount) && (
//                   <Box padding="200" background="bg-surface-warning" borderRadius="200">
//                     <Text as="p" variant="bodySm" tone="caution" alignment="center">
//                       Spend ${(parseFloat(cartTiers.filter(t => t.amount)[0]?.amount || "50") - cartTotal).toFixed(2)} more to unlock {cartTiers.filter(t => t.discount)[0]?.discount}% off
//                     </Text>
//                   </Box>
//                 )}

//                 <Divider />

//                 <InlineStack align="space-between">
//                   <Text as="span" variant="bodySm">Total ({cartQty} items)</Text>
//                   <Text as="span" variant="bodySm">${cartTotal.toFixed(2)}</Text>
//                 </InlineStack>

//                 {discountAmount > 0 && (
//                   <InlineStack align="space-between">
//                     <Text as="span" variant="bodySm" tone="success">
//                       Saving {discountPercent > 0 ? `(${discountPercent}%)` : ""}
//                     </Text>
//                     <Text as="span" variant="bodySm" tone="success">
//                       -${discountAmount.toFixed(2)}
//                     </Text>
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
//           <Text as="p" variant="bodySm" fontWeight="bold">
//             {name || "No campaign name yet"}
//           </Text>

//           <BlockStack gap="100">
//             <Text as="p" variant="bodySm" fontWeight="bold">Campaign type</Text>
//             <InlineStack gap="100">
//               <span style={{ fontSize: "12px" }}>•</span>
//               <Text as="p" variant="bodySm">{CAMPAIGN_TYPE_LABELS[type]}</Text>
//             </InlineStack>
//             <InlineStack gap="100">
//               <span style={{ fontSize: "12px" }}>•</span>
//               <Text as="p" variant="bodySm">
//                 {type === "bulk_price" && discountType === "percentage" && `${discountVal}% off`}
//                 {type === "bulk_price" && discountType === "fixed_amount" && `$${discountVal} off`}
//                 {type === "bulk_price" && discountType === "new_price" && `New price: $${discountVal}`}
//                 {type === "quantity_discount" && `${tiers.filter(t => t.quantity && t.discount).length} tier(s)`}
//                 {type === "cart_goal" && `${cartTiers.filter(t => t.amount && t.discount).length} tier(s)`}
//                 {type === "shipping_discount" && (freeShipping ? "Free shipping" : `$${discountVal} off shipping`)}
//                 {type === "buy_x_get_y" && `Buy ${discountValue || "X"} Get 1`}
//                 {type === "advanced_discount_code" && (discountType === "free_shipping" ? "Free shipping" : `${discountVal}${discountType === "percentage" ? "%" : "$"} off`)}
//               </Text>
//             </InlineStack>
//           </BlockStack>

//           <BlockStack gap="100">
//             <Text as="p" variant="bodySm" fontWeight="bold">Details</Text>
//             <InlineStack gap="100">
//               <span style={{ fontSize: "12px" }}>•</span>
//               <Text as="p" variant="bodySm">{appliesToLabel}</Text>
//             </InlineStack>
//             <InlineStack gap="100">
//               <span style={{ fontSize: "12px" }}>•</span>
//               <Text as="p" variant="bodySm">
//                 Start: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
//               </Text>
//             </InlineStack>
//           </BlockStack>

//           <Divider />

//           <BlockStack gap="100">
//             <Text as="p" variant="bodySm" fontWeight="bold">Need help?</Text>
//             <Text as="p" variant="bodySm" tone="subdued">
//               If you need assistance, click below for support.
//             </Text>
//             <Button size="slim" variant="plain" url="/app/helpandsupport">
//               Contact support
//             </Button>
//           </BlockStack>
//         </BlockStack>
//       </BlockStack>
//     </Card>
//   );
// }

// /* ── Main Component ──────────────────────────────────── */

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
//   const [tiers, setTiers] = useState([
//     { quantity: "2", discount: "5" },
//     { quantity: "4", discount: "10" },
//     { quantity: "8", discount: "15" },
//   ]);
//   const [cartTiers, setCartTiers] = useState([
//     { amount: "50", discount: "5" },
//     { amount: "100", discount: "10" },
//     { amount: "150", discount: "15" },
//   ]);
//   const [freeShipping, setFreeShipping] = useState(true);
//   const [minOrderForShipping, setMinOrderForShipping] = useState("100");
//   const [geoTarget, setGeoTarget] = useState(""); // "" | "domestic" | "all"
//   const [discountCode, setDiscountCode] = useState("");
//   const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
//   const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
//   const shopify = useAppBridge();

//   const setPositiveValue = (setter: (v: string) => void) => (val: string) => {
//     const num = parseFloat(val);
//     if (val === "" || (num >= 0)) setter(val);
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
//     // Free shipping requires an explicit geo choice
//     const isFreeShippingCampaign =
//       (type === "shipping_discount" && freeShipping) ||
//       (type === "advanced_discount_code" && discountType === "free_shipping");
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
//     formData.append("geoTarget", geoTarget);
//     formData.append("discountCode", discountCode);
//     if (selectedProducts.length > 0) {
//       formData.append("productIds", JSON.stringify(selectedProducts.map(p => p.id)));
//     }
//     if (selectedCollections.length > 0) {
//       formData.append("collectionIds", JSON.stringify(selectedCollections.map(c => c.id)));
//     }
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
//       {actionData && !actionData.success && <Box paddingBlockEnd="400"><Banner tone="critical"><p>{actionData.error}</p></Banner></Box>}

//       <Layout>
//         {/* Left Column - Form */}
//         <Layout.Section>
//           <BlockStack gap="400">
//             <Banner tone="info"><p><strong>{CAMPAIGN_TYPE_LABELS[type]}</strong> — {CAMPAIGN_TYPE_DESCRIPTIONS[type]}</p></Banner>

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
//                     <TextField label="Customer buys (quantity)" type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" placeholder="e.g. 2" />
//                     <Select label="Customer gets" options={[{ label: "Free item", value: "free" }, { label: "Discounted item", value: "discounted" }]} value={discountType} onChange={setDiscountType} />
//                     {discountType === "discounted" && <TextField label="Discount on item (%)" type="number" min={0} max={100} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" suffix="%" />}
//                   </FormLayout>
//                 )}

//                 {type === "advanced_discount_code" && (
//                   <FormLayout>
//                     <TextField label="Discount code" value={discountCode} onChange={setDiscountCode} autoComplete="off" placeholder="e.g. SAVE20" helpText="Customers will enter this code at checkout" />
//                     <Button size="slim" onClick={() => { let c = ""; for (let i = 0; i < 8; i++) c += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]; setDiscountCode(c); }}>Generate code</Button>
//                     <Select label="Discount type" options={[{ label: "Percentage off", value: "percentage" }, { label: "Fixed amount off", value: "fixed_amount" }, { label: "Free shipping", value: "free_shipping" }]} value={discountType} onChange={setDiscountType} />
//                     {discountType !== "free_shipping" && <TextField label="Discount value" type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" suffix={discountType === "percentage" ? "%" : "$"} />}
//                     {discountType === "free_shipping" && (
//                       <Select
//                         label="Where does free shipping apply?"
//                         options={[
//                           { label: "Select an option", value: "" },
//                           { label: "Domestic only (same country as your store)", value: "domestic" },
//                           { label: "All zones (worldwide)", value: "all" },
//                         ]}
//                         value={geoTarget}
//                         onChange={setGeoTarget}
//                         helpText="Required. Choose whether free shipping applies only to customers in your store's country, or worldwide."
//                       />
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

//                 {type === "shipping_discount" && (
//                   <FormLayout>
//                     <Checkbox label="Free shipping" checked={freeShipping} onChange={setFreeShipping} />
//                     {!freeShipping && <TextField label="Shipping discount" type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" prefix="$" />}
//                     <TextField label="Minimum order value" type="number" min={0} value={minOrderForShipping} onChange={setPositiveValue(setMinOrderForShipping)} autoComplete="off" prefix="$" placeholder="e.g. 100" />
//                     {freeShipping && (
//                       <Select
//                         label="Where does free shipping apply?"
//                         options={[
//                           { label: "Select an option", value: "" },
//                           { label: "Domestic only (same country as your store)", value: "domestic" },
//                           { label: "All zones (worldwide)", value: "all" },
//                         ]}
//                         value={geoTarget}
//                         onChange={setGeoTarget}
//                         helpText="Required. Choose whether free shipping applies only to customers in your store's country, or worldwide."
//                       />
//                     )}
//                   </FormLayout>
//                 )}
//               </BlockStack>
//             </Card>

//             {/* Products */}
//             <Card>
//               <BlockStack gap="400">
//                 <Text as="h2" variant="headingMd">Products</Text>
//                 <Select label="Applies to" options={[
//                   { label: "Select Options", value: "" },
//                   { label: "Specific products", value: "specific_products" },
//                   { label: "Specific collections", value: "specific_collections" }]} value={appliesTo} onChange={(val) => { setAppliesTo(val); if (val === "all") { setSelectedProducts([]); setSelectedCollections([]); } }} />

//                 {appliesTo === "all" && (
//                   <Banner tone="info">
//                     <p>Discount will apply to all products in your store</p>
//                   </Banner>
//                 )}

//                 {appliesTo === "specific_products" && (
//                   <BlockStack gap="300">
//                     <InlineStack gap="200">
//                       <Button onClick={async () => {
//                         const selected = await shopify.resourcePicker({
//                           type: "product",
//                           multiple: true,
//                           action: "select",
//                           filter: { variants: false },
//                         });
//                         if (selected) {
//                           setSelectedProducts(selected.map((p: any) => ({
//                             id: p.id,
//                             title: p.title,
//                             image: p.images?.[0]?.originalSrc || "",
//                             variants: p.variants?.length || 0,
//                           })));
//                         }
//                       }}>
//                         Browse products
//                       </Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedProducts([]); }}>
//                         or select all products
//                       </Button>
//                     </InlineStack>
//                     {selectedProducts.length > 0 && (
//                       <Box padding="300" background="bg-surface-secondary" borderRadius="200">
//                         <BlockStack gap="200">
//                           <Text as="p" variant="bodySm" fontWeight="bold">
//                             {selectedProducts.length} product(s) selected
//                           </Text>
//                           {selectedProducts.map((product, i) => (
//                             <InlineStack key={i} align="space-between" blockAlign="center">
//                               <InlineStack gap="200" blockAlign="center">
//                                 <div style={{
//                                   width: "32px", height: "32px", background: "#f0f0f0",
//                                   borderRadius: "4px", overflow: "hidden", display: "flex",
//                                   alignItems: "center", justifyContent: "center", fontSize: "10px",
//                                 }}>
//                                   {product.image ? (
//                                     <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//                                   ) : "P"}
//                                 </div>
//                                 <Text as="span" variant="bodySm">{product.title}</Text>
//                               </InlineStack>
//                               <Button size="slim" tone="critical" onClick={() => setSelectedProducts(selectedProducts.filter((_, j) => j !== i))}>
//                                 Remove
//                               </Button>
//                             </InlineStack>
//                           ))}
//                         </BlockStack>
//                       </Box>
//                     )}
//                   </BlockStack>
//                 )}

//                 {appliesTo === "specific_collections" && (
//                   <BlockStack gap="300">
//                     <InlineStack gap="200">
//                       <Button onClick={async () => {
//                         const selected = await shopify.resourcePicker({
//                           type: "collection",
//                           multiple: true,
//                           action: "select",
//                         });
//                         if (selected) {
//                           setSelectedCollections(selected.map((c: any) => ({
//                             id: c.id,
//                             title: c.title,
//                             image: c.image?.originalSrc || "",
//                           })));
//                         }
//                       }}>
//                         Browse collections
//                       </Button>
//                       <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedCollections([]); }}>
//                         or select all products
//                       </Button>
//                     </InlineStack>
//                     {selectedCollections.length > 0 && (
//                       <Box padding="300" background="bg-surface-secondary" borderRadius="200">
//                         <BlockStack gap="200">
//                           <Text as="p" variant="bodySm" fontWeight="bold">
//                             {selectedCollections.length} collection(s) selected
//                           </Text>
//                           {selectedCollections.map((collection, i) => (
//                             <InlineStack key={i} align="space-between" blockAlign="center">
//                               <InlineStack gap="200" blockAlign="center">
//                                 <div style={{
//                                   width: "32px", height: "32px", background: "#f0f0f0",
//                                   borderRadius: "4px", overflow: "hidden", display: "flex",
//                                   alignItems: "center", justifyContent: "center", fontSize: "10px",
//                                 }}>
//                                   {collection.image ? (
//                                     <img src={collection.image} alt={collection.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//                                   ) : "C"}
//                                 </div>
//                                 <Text as="span" variant="bodySm">{collection.title}</Text>
//                               </InlineStack>
//                               <Button size="slim" tone="critical" onClick={() => setSelectedCollections(selectedCollections.filter((_, j) => j !== i))}>
//                                 Remove
//                               </Button>
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
//                 <Checkbox label="Start immediately" checked={startNow} onChange={setStartNow} />
//                 {!startNow && <TextField label="Start date" type="date" value={startDate} onChange={setStartDate} autoComplete="off" />}
//                 <Checkbox label="Set end date" checked={hasEndDate} onChange={setHasEndDate} />
//                 {hasEndDate && <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />}
//               </BlockStack>
//             </Card>
//           </BlockStack>
//         </Layout.Section>

//         {/* Right Column - Preview */}
//         <Layout.Section variant="oneThird">
//           <DiscountPreview
//             type={type}
//             name={name}
//             discountType={discountType}
//             discountValue={discountValue}
//             tiers={tiers}
//             cartTiers={cartTiers}
//             freeShipping={freeShipping}
//             minOrderForShipping={minOrderForShipping}
//             appliesTo={appliesTo}
//             status={status}
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
import { useLoaderData, useNavigate, useSubmit, useActionData } from "@remix-run/react";
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
  Icon,
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
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

// ── Types ────────────────────────────────────────────────────

interface SelectedVariant {
  id: string;
  title: string;
  sku?: string;
  price?: string;
}

interface SelectedProduct {
  id: string;
  title: string;
  image: string;
  variants: SelectedVariant[];
  /** IDs of variants the user has checked — undefined means "all" */
  selectedVariantIds: string[] | null;
  expanded: boolean;
}

// ── Loader / Action ──────────────────────────────────────────

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
  const freeShipping = formData.get("freeShipping") === "true";
  const minOrderForShipping = formData.get("minOrderForShipping") as string;
  const geoTarget = formData.get("geoTarget") as string;
  const productIds = formData.get("productIds") as string;
  const variantIds = formData.get("variantIds") as string;
  const collectionIds = formData.get("collectionIds") as string;
  const discountCode = formData.get("discountCode") as string;

  // Email-capture popup (advanced_discount_code only)
  const popupEnabled = formData.get("popupEnabled") === "true";
  const popupPagesRaw = (formData.get("popupPages") as string) || "";
  const popupHeading = (formData.get("popupHeading") as string) || null;
  const popupDescription = (formData.get("popupDescription") as string) || null;
  const popupButtonText = (formData.get("popupButtonText") as string) || null;
  const popupFrequencyValueRaw = formData.get("popupFrequencyValue") as string;
  const popupFrequencyValue =
    popupFrequencyValueRaw && !isNaN(parseInt(popupFrequencyValueRaw, 10))
      ? parseInt(popupFrequencyValueRaw, 10)
      : null;
  const popupFrequencyUnit = (formData.get("popupFrequencyUnit") as string) || null;

  if (!name || name.trim() === "") {
    return json({ success: false, error: "Campaign name is required" });
  }

  // A popup can only email a code that exists
  if (type === "advanced_discount_code" && popupEnabled) {
    let pages: string[] = [];
    try { pages = JSON.parse(popupPagesRaw); } catch {}
    if (pages.length === 0) {
      return json({
        success: false,
        error: "Select at least one page to show the discount popup on.",
      });
    }
    if (!discountCode || discountCode.trim() === "") {
      return json({
        success: false,
        error: "A discount code is required to use the email popup.",
      });
    }
  }

  if (
    (type === "shipping_discount" && freeShipping) ||
    (type === "advanced_discount_code" && discountType === "free_shipping")
  ) {
    if (!geoTarget || (geoTarget !== "domestic" && geoTarget !== "all")) {
      return json({
        success: false,
        error: "Please choose where free shipping applies (Domestic or All zones).",
      });
    }
  }

  const campaignStartDate = startNow ? new Date() : startDate ? new Date(startDate) : new Date();
  const campaignEndDate = hasEndDate && endDate ? new Date(endDate) : null;
  const finalDiscountType = type === "shipping_discount" && freeShipping ? "free_shipping" : discountType;

  try {
    const shopifyResult = await createShopifyDiscount(admin, {
      name: name.trim(),
      type,
      discountType: finalDiscountType,
      discountValue: Math.max(0, discountValue || 0),
      appliesTo: appliesTo || "all",
      status: status || "active",
      startDate: campaignStartDate,
      endDate: campaignEndDate,
      tiers: tiers || null,
      productIds: productIds || null,
      variantIds: variantIds || null,
      collectionIds: collectionIds || null,
      freeShipping,
      minOrderForShipping: minOrderForShipping || null,
      discountCode: discountCode || null,
      geoTarget: geoTarget || null,
    });

    if (!shopifyResult.success && shopifyResult.errors?.length) {
      const errorMsg = shopifyResult.errors.map((e: any) => e.message || e).join(", ");
      return json({ success: false, error: `Shopify error: ${errorMsg}` });
    }

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
        minimumAmount: minOrderForShipping ? parseFloat(minOrderForShipping) : null,
        geoTarget: geoTarget || null,
        productIds: productIds || null,
        collectionIds: collectionIds || null,
        discountCode: discountCode || null,
        popupEnabled,
        popupPages: popupEnabled ? popupPagesRaw || null : null,
        popupHeading: popupEnabled ? popupHeading : null,
        popupDescription: popupEnabled ? popupDescription : null,
        popupButtonText: popupEnabled ? popupButtonText : null,
        popupFrequencyValue: popupEnabled ? popupFrequencyValue : null,
        popupFrequencyUnit: popupEnabled ? popupFrequencyUnit : null,
      },
    });

    return redirect("/app/campaigns");
  } catch (error) {
    console.error("Failed to create campaign:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: `Failed to create campaign: ${detail}` });
  }
};

// ── ProductVariantSelector ───────────────────────────────────
// Shows a selected product row with an optional expandable variant list.

function ProductVariantSelector({
  product,
  onToggleExpand,
  onToggleVariant,
  onToggleAllVariants,
  onRemove,
}: {
  product: SelectedProduct;
  onToggleExpand: (id: string) => void;
  onToggleVariant: (productId: string, variantId: string) => void;
  onToggleAllVariants: (productId: string) => void;
  onRemove: (id: string) => void;
}) {
  const hasVariants = product.variants.length > 0;
  const allSelected =
    !product.selectedVariantIds ||
    product.selectedVariantIds.length === product.variants.length;
  const someSelected =
    product.selectedVariantIds !== null &&
    product.selectedVariantIds.length > 0 &&
    product.selectedVariantIds.length < product.variants.length;

  // Human-readable variant summary shown in the collapsed row
  const variantSummary = (() => {
    if (!hasVariants) return null;
    if (allSelected) return `All ${product.variants.length} variants`;
    if (!product.selectedVariantIds || product.selectedVariantIds.length === 0)
      return "No variants selected";
    return `${product.selectedVariantIds.length} of ${product.variants.length} variants`;
  })();

  return (
    <Box
      background="bg-surface"
      borderRadius="200"
      borderWidth="025"
      borderColor="border"
    >
      {/* Product row */}
      <Box padding="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <div
              style={{
                width: "36px",
                height: "36px",
                background: "#f0f0f0",
                borderRadius: "6px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                flexShrink: 0,
              }}
            >
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                "P"
              )}
            </div>

            <BlockStack gap="0">
              <Text as="span" variant="bodySm" fontWeight="bold">
                {product.title}
              </Text>
              {variantSummary && (
                <Text as="span" variant="bodySm" tone="subdued">
                  {variantSummary}
                </Text>
              )}
            </BlockStack>
          </InlineStack>

          <InlineStack gap="200" blockAlign="center">
            {hasVariants && (
              <Button
                size="slim"
                variant="plain"
                icon={product.expanded ? ChevronUpIcon : ChevronDownIcon}
                onClick={() => onToggleExpand(product.id)}
                accessibilityLabel={
                  product.expanded ? "Collapse variants" : "Expand variants"
                }
              >
                {product.expanded ? "Hide variants" : "Select variants"}
              </Button>
            )}
            <Button
              size="slim"
              tone="critical"
              variant="plain"
              onClick={() => onRemove(product.id)}
            >
              Remove
            </Button>
          </InlineStack>
        </InlineStack>
      </Box>

      {/* Variant list (expanded) */}
      {hasVariants && product.expanded && (
        <>
          <Divider />
          <Box
            paddingInlineStart="300"
            paddingInlineEnd="300"
            paddingBlockStart="200"
            paddingBlockEnd="200"
            background="bg-surface-secondary"
          >
            <BlockStack gap="0">
              {/* "Select all" row */}
              <Box paddingBlockStart="100" paddingBlockEnd="100">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    padding: "6px 8px",
                    borderRadius: "6px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={() => onToggleAllVariants(product.id)}
                    style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#000" }}
                  />
                  <Text as="span" variant="bodySm" fontWeight="bold">
                    All variants
                  </Text>
                </label>
              </Box>

              <Divider />

              {/* Individual variant rows */}
              {product.variants.map((variant) => {
                const isChecked =
                  !product.selectedVariantIds ||
                  product.selectedVariantIds.includes(variant.id);
                return (
                  <label
                    key={variant.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      cursor: "pointer",
                      padding: "6px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleVariant(product.id, variant.id)}
                      style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#000" }}
                    />
                    <div style={{ flex: 1 }}>
                      <Text as="span" variant="bodySm">
                        {variant.title}
                      </Text>
                    </div>
                    {variant.sku && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {variant.sku}
                      </Text>
                    )}
                    {variant.price && (
                      <Badge>${variant.price}</Badge>
                    )}
                  </label>
                );
              })}
            </BlockStack>
          </Box>
        </>
      )}
    </Box>
  );
}

// ── DiscountPreview (unchanged) ──────────────────────────────

function DiscountPreview({
  type,
  name,
  discountType,
  discountValue,
  tiers,
  cartTiers,
  freeShipping,
  minOrderForShipping,
  appliesTo,
  status,
}: {
  type: string;
  name: string;
  discountType: string;
  discountValue: string;
  tiers: { quantity: string; discount: string }[];
  cartTiers: { amount: string; discount: string }[];
  freeShipping: boolean;
  minOrderForShipping: string;
  appliesTo: string;
  status: string;
}) {
  const [cartQty, setCartQty] = useState(1);
  const samplePrice = 10.0;
  const discountVal = parseFloat(discountValue) || 0;

  const getQuantityDiscount = (qty: number) => {
    const validTiers = tiers
      .filter(t => t.quantity && t.discount)
      .map(t => ({ quantity: parseInt(t.quantity), discount: parseFloat(t.discount) }))
      .filter(t => !isNaN(t.quantity) && !isNaN(t.discount))
      .sort((a, b) => b.quantity - a.quantity);
    const match = validTiers.find(t => qty >= t.quantity);
    return match ? match.discount : 0;
  };

  const getCartGoalDiscount = (totalAmount: number) => {
    const validTiers = cartTiers
      .filter(t => t.amount && t.discount)
      .map(t => ({ amount: parseFloat(t.amount), discount: parseFloat(t.discount) }))
      .filter(t => !isNaN(t.amount) && !isNaN(t.discount))
      .sort((a, b) => b.amount - a.amount);
    const match = validTiers.find(t => totalAmount >= t.amount);
    return match ? match.discount : 0;
  };

  const cartTotal = samplePrice * cartQty;
  let discountPercent = 0;
  let discountAmount = 0;
  let finalTotal = cartTotal;

  if (type === "bulk_price") {
    if (discountType === "percentage") {
      discountPercent = discountVal;
      discountAmount = cartTotal * (discountVal / 100);
    } else if (discountType === "fixed_amount") {
      discountAmount = discountVal * cartQty;
    } else if (discountType === "new_price") {
      discountAmount = (samplePrice - discountVal) * cartQty;
    }
  } else if (type === "quantity_discount") {
    discountPercent = getQuantityDiscount(cartQty);
    discountAmount = cartTotal * (discountPercent / 100);
  } else if (type === "cart_goal") {
    discountPercent = getCartGoalDiscount(cartTotal);
    discountAmount = cartTotal * (discountPercent / 100);
  }

  discountAmount = Math.max(0, discountAmount);
  finalTotal = Math.max(0, cartTotal - discountAmount);
  const unitPrice = cartQty > 0 ? finalTotal / cartQty : samplePrice;

  const appliesToLabel =
    appliesTo === "all" ? "Applies to products and variants" :
    appliesTo === "specific_products" ? "Applies to specific products" :
    "Applies to specific collections";

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
                      <Badge tone="success">Save {tier.discount}%</Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Box>
            )}

            {type === "cart_goal" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="bold">Spend more, Save more!</Text>
                  {cartTiers.filter(t => t.amount && t.discount).map((tier, i) => (
                    <InlineStack key={i} align="space-between">
                      <Text as="span" variant="bodySm">Spend ${tier.amount}+</Text>
                      <Badge tone="success">Save {tier.discount}%</Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Box>
            )}

            {type === "shipping_discount" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="bold">
                    {freeShipping ? "Free shipping" : `$${discountVal} off shipping`}
                  </Text>
                  {minOrderForShipping && (
                    <Text as="p" variant="bodySm" tone="subdued">On orders above ${minOrderForShipping}</Text>
                  )}
                </BlockStack>
              </Box>
            )}

            {type === "buy_x_get_y" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  Buy {discountValue || "X"}, Get 1 {discountType === "free" ? "Free" : `at ${discountVal}% off`}
                </Text>
              </Box>
            )}

            {type === "advanced_discount_code" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  {discountType === "free_shipping"
                    ? "Free shipping with code"
                    : discountType === "percentage"
                    ? `${discountVal}% off with code`
                    : `$${discountVal} off with code`}
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
                    <div style={{
                      width: "40px", height: "40px", background: "#f0f0f0",
                      borderRadius: "6px", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "11px", fontWeight: "bold",
                    }}>A</div>
                    <BlockStack gap="0">
                      <Text as="span" variant="bodySm" fontWeight="bold">Product A</Text>
                      <Text as="span" variant="bodySm" tone="subdued">${samplePrice.toFixed(2)}</Text>
                    </BlockStack>
                  </InlineStack>
                  <Text as="span" variant="bodySm" fontWeight="bold">${(samplePrice * cartQty).toFixed(2)}</Text>
                </InlineStack>

                <InlineStack align="center" gap="200" blockAlign="center">
                  <Button size="slim" onClick={() => setCartQty(Math.max(1, cartQty - 1))} disabled={cartQty <= 1}>−</Button>
                  <div style={{
                    minWidth: "36px", textAlign: "center" as const,
                    padding: "4px 8px", border: "1px solid #ccc",
                    borderRadius: "6px", fontSize: "13px", fontWeight: "bold",
                  }}>{cartQty}</div>
                  <Button size="slim" onClick={() => setCartQty(cartQty + 1)}>+</Button>
                </InlineStack>

                {type === "quantity_discount" && discountPercent > 0 && (
                  <Box padding="200" background="bg-surface-success" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">
                      {discountPercent}% discount applied (qty: {cartQty})
                    </Text>
                  </Box>
                )}
                {type === "quantity_discount" && discountPercent === 0 && tiers.some(t => t.quantity && t.discount) && (
                  <Box padding="200" background="bg-surface-warning" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="caution" alignment="center">
                      Add {parseInt(tiers.filter(t => t.quantity)[0]?.quantity || "2") - cartQty} more to unlock {tiers.filter(t => t.discount)[0]?.discount}% off
                    </Text>
                  </Box>
                )}
                {type === "cart_goal" && discountPercent > 0 && (
                  <Box padding="200" background="bg-surface-success" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">
                      {discountPercent}% discount applied (cart: ${cartTotal.toFixed(2)})
                    </Text>
                  </Box>
                )}
                {type === "cart_goal" && discountPercent === 0 && cartTiers.some(t => t.amount && t.discount) && (
                  <Box padding="200" background="bg-surface-warning" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="caution" alignment="center">
                      Spend ${(parseFloat(cartTiers.filter(t => t.amount)[0]?.amount || "50") - cartTotal).toFixed(2)} more to unlock {cartTiers.filter(t => t.discount)[0]?.discount}% off
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
                    <Text as="span" variant="bodySm" tone="success">
                      Saving {discountPercent > 0 ? `(${discountPercent}%)` : ""}
                    </Text>
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
            <InlineStack gap="100">
              <span style={{ fontSize: "12px" }}>•</span>
              <Text as="p" variant="bodySm">{CAMPAIGN_TYPE_LABELS[type]}</Text>
            </InlineStack>
            <InlineStack gap="100">
              <span style={{ fontSize: "12px" }}>•</span>
              <Text as="p" variant="bodySm">
                {type === "bulk_price" && discountType === "percentage" && `${discountVal}% off`}
                {type === "bulk_price" && discountType === "fixed_amount" && `$${discountVal} off`}
                {type === "bulk_price" && discountType === "new_price" && `New price: $${discountVal}`}
                {type === "quantity_discount" && `${tiers.filter(t => t.quantity && t.discount).length} tier(s)`}
                {type === "cart_goal" && `${cartTiers.filter(t => t.amount && t.discount).length} tier(s)`}
                {type === "shipping_discount" && (freeShipping ? "Free shipping" : `$${discountVal} off shipping`)}
                {type === "buy_x_get_y" && `Buy ${discountValue || "X"} Get 1`}
                {type === "advanced_discount_code" && (discountType === "free_shipping" ? "Free shipping" : `${discountVal}${discountType === "percentage" ? "%" : "$"} off`)}
              </Text>
            </InlineStack>
          </BlockStack>

          <BlockStack gap="100">
            <Text as="p" variant="bodySm" fontWeight="bold">Details</Text>
            <InlineStack gap="100">
              <span style={{ fontSize: "12px" }}>•</span>
              <Text as="p" variant="bodySm">{appliesToLabel}</Text>
            </InlineStack>
            <InlineStack gap="100">
              <span style={{ fontSize: "12px" }}>•</span>
              <Text as="p" variant="bodySm">
                Start: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </InlineStack>
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

// ── Main Component ────────────────────────────────────────────

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
    { quantity: "2", discount: "5" },
    { quantity: "4", discount: "10" },
    { quantity: "8", discount: "15" },
  ]);
  const [cartTiers, setCartTiers] = useState([
    { amount: "50", discount: "5" },
    { amount: "100", discount: "10" },
    { amount: "150", discount: "15" },
  ]);
  const [freeShipping, setFreeShipping] = useState(true);
  const [minOrderForShipping, setMinOrderForShipping] = useState("100");
  const [geoTarget, setGeoTarget] = useState("");
  const [discountCode, setDiscountCode] = useState("");

  // ── Email-capture popup state (advanced_discount_code only) ──
  const [popupEnabled, setPopupEnabled] = useState(false);
  const [popupPages, setPopupPages] = useState<string[]>(["all"]);
  const [popupHeading, setPopupHeading] = useState("Get your discount code");
  const [popupDescription, setPopupDescription] = useState(
    "Enter your email and we'll send your exclusive discount code straight to your inbox."
  );
  const [popupButtonText, setPopupButtonText] = useState("Email me the code");
  const [popupFrequencyValue, setPopupFrequencyValue] = useState("24");
  const [popupFrequencyUnit, setPopupFrequencyUnit] = useState("hours");

  // ── Product / variant selection state ───────────────────────
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<any[]>([]);

  const shopify = useAppBridge();

  // ── Helpers ──────────────────────────────────────────────────

  const setPositiveValue = (setter: (v: string) => void) => (val: string) => {
    const num = parseFloat(val);
    if (val === "" || num >= 0) setter(val);
  };

  const updateTier = (index: number, field: "quantity" | "discount", value: string) => {
    if (value !== "" && parseFloat(value) < 0) return;
    const n = [...tiers]; n[index][field] = value; setTiers(n);
  };

  const updateCartTier = (index: number, field: "amount" | "discount", value: string) => {
    if (value !== "" && parseFloat(value) < 0) return;
    const n = [...cartTiers]; n[index][field] = value; setCartTiers(n);
  };

  // ── Variant selection handlers ───────────────────────────────

  /** Toggle the expand/collapse of variant list for a product */
  const handleToggleExpand = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, expanded: !p.expanded } : p
      )
    );
  };

  /**
   * Toggle a single variant for a product.
   * `null` selectedVariantIds means "all selected".
   * When the user unchecks one, we switch to an explicit list.
   */
  const handleToggleVariant = (productId: string, variantId: string) => {
    setSelectedProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;

        // Currently "all selected" (null) → build explicit list minus this one
        if (p.selectedVariantIds === null) {
          const allExcept = p.variants
            .map((v) => v.id)
            .filter((id) => id !== variantId);
          return { ...p, selectedVariantIds: allExcept };
        }

        // Toggle within existing explicit list
        const has = p.selectedVariantIds.includes(variantId);
        const next = has
          ? p.selectedVariantIds.filter((id) => id !== variantId)
          : [...p.selectedVariantIds, variantId];

        // If all variants are now selected, go back to null (all)
        const isAllSelected = next.length === p.variants.length;
        return { ...p, selectedVariantIds: isAllSelected ? null : next };
      })
    );
  };

  /** Toggle between "all variants" and "none" */
  const handleToggleAllVariants = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const allSelected =
          p.selectedVariantIds === null ||
          p.selectedVariantIds.length === p.variants.length;
        return {
          ...p,
          selectedVariantIds: allSelected
            ? [] // deselect all
            : null, // select all (null = all)
        };
      })
    );
  };

  /** Remove a product from the selection */
  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // ── Derived counts for the summary label ────────────────────

  const totalSelectedVariants = selectedProducts.reduce((sum, p) => {
    if (!p.variants.length) return sum + 1; // product without variants counts as 1
    return sum + (p.selectedVariantIds === null ? p.variants.length : p.selectedVariantIds.length);
  }, 0);

  // ── Popup page selection handler ─────────────────────────────
  // "all" is mutually exclusive with the specific-page keys.
  const togglePopupPage = (key: string) => (checked: boolean) => {
    setPopupPages((prev) => {
      if (key === "all") return checked ? ["all"] : [];
      const withoutAll = prev.filter((p) => p !== "all");
      return checked
        ? [...withoutAll, key]
        : withoutAll.filter((p) => p !== key);
    });
  };

  // ── Form submission ──────────────────────────────────────────

  const handleSave = () => {
    const isFreeShippingCampaign =
      (type === "shipping_discount" && freeShipping) ||
      (type === "advanced_discount_code" && discountType === "free_shipping");
    if (isFreeShippingCampaign && !geoTarget) {
      shopify.toast.show("Please choose where free shipping applies (Domestic or All zones).", {
        isError: true,
      });
      return;
    }

    // Popup requires at least one target page when enabled
    if (type === "advanced_discount_code" && popupEnabled && popupPages.length === 0) {
      shopify.toast.show("Select at least one page to show the discount popup on.", {
        isError: true,
      });
      return;
    }

    // Collect variant IDs for products that have a specific variant selection
    const explicitVariantIds: string[] = [];
    for (const p of selectedProducts) {
      if (p.variants.length > 0 && p.selectedVariantIds !== null) {
        explicitVariantIds.push(...p.selectedVariantIds);
      }
      // null means "all variants" → no explicit IDs needed; the product ID covers it
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
    formData.append("geoTarget", geoTarget);
    formData.append("discountCode", discountCode);

    // Email-capture popup (advanced_discount_code only)
    if (type === "advanced_discount_code") {
      formData.append("popupEnabled", String(popupEnabled));
      formData.append("popupPages", JSON.stringify(popupPages));
      formData.append("popupHeading", popupHeading);
      formData.append("popupDescription", popupDescription);
      formData.append("popupButtonText", popupButtonText);
      formData.append("popupFrequencyValue", popupFrequencyValue);
      formData.append("popupFrequencyUnit", popupFrequencyUnit);
    }

    if (selectedProducts.length > 0) {
      formData.append("productIds", JSON.stringify(selectedProducts.map((p) => p.id)));
    }
    if (explicitVariantIds.length > 0) {
      formData.append("variantIds", JSON.stringify(explicitVariantIds));
    }
    if (selectedCollections.length > 0) {
      formData.append("collectionIds", JSON.stringify(selectedCollections.map((c) => c.id)));
    }
    if (type === "quantity_discount") formData.append("tiers", JSON.stringify(tiers));
    else if (type === "cart_goal") formData.append("tiers", JSON.stringify(cartTiers));

    submit(formData, { method: "post" });
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <Page
      backAction={{ content: "Choose campaign type", url: "/app/campaigns/create" }}
      title={`Create ${CAMPAIGN_TYPE_LABELS[type] || "Campaign"}`}
      primaryAction={{ content: "Save campaign", onAction: handleSave }}
      secondaryActions={[{ content: "Discard", onAction: () => navigate("/app/campaigns") }]}
    >
      {actionData && !actionData.success && (
        <Box paddingBlockEnd="400">
          <Banner tone="critical"><p>{actionData.error}</p></Banner>
        </Box>
      )}

      <Layout>
        {/* ── Left Column ─────────────────────────────────── */}
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p>
                <strong>{CAMPAIGN_TYPE_LABELS[type]}</strong> — {CAMPAIGN_TYPE_DESCRIPTIONS[type]}
              </p>
            </Banner>

            {/* Campaign Details */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Campaign details</Text>
                <TextField
                  label="Campaign name"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                  placeholder="e.g. Summer Sale 2025"
                  helpText="This name helps you identify the campaign internally."
                />
                <Select
                  label="Status"
                  options={[
                    { label: "Active", value: "active" },
                    { label: "Draft", value: "draft" },
                    { label: "Scheduled", value: "scheduled" },
                  ]}
                  value={status}
                  onChange={setStatus}
                />
              </BlockStack>
            </Card>

            {/* Discount Configuration */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Discount configuration</Text>

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
                      placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 10.00"}
                    />
                  </FormLayout>
                )}

                {type === "quantity_discount" && (
                  <BlockStack gap="400">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Set up tiered discounts based on quantity purchased.
                    </Text>
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
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={i === 0 ? "Discount %" : ""}
                            type="number"
                            min={0}
                            value={tier.discount}
                            onChange={(v) => updateTier(i, "discount", v)}
                            autoComplete="off"
                            prefix="Save"
                            suffix="%"
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
                    <div>
                      <Button
                        size="slim"
                        onClick={() => setTiers([...tiers, { quantity: "", discount: "" }])}
                      >
                        Add tier
                      </Button>
                    </div>
                  </BlockStack>
                )}

                {type === "buy_x_get_y" && (
                  <FormLayout>
                    <TextField
                      label="Customer buys (quantity)"
                      type="number"
                      min={0}
                      value={discountValue}
                      onChange={setPositiveValue(setDiscountValue)}
                      autoComplete="off"
                      placeholder="e.g. 2"
                    />
                    <Select
                      label="Customer gets"
                      options={[
                        { label: "Free item", value: "free" },
                        { label: "Discounted item", value: "discounted" },
                      ]}
                      value={discountType}
                      onChange={setDiscountType}
                    />
                    {discountType === "discounted" && (
                      <TextField
                        label="Discount on item (%)"
                        type="number"
                        min={0}
                        max={100}
                        value={discountValue}
                        onChange={setPositiveValue(setDiscountValue)}
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
                      helpText="Customers will enter this code at checkout"
                    />
                    <Button
                      size="slim"
                      onClick={() => {
                        let c = "";
                        for (let i = 0; i < 8; i++)
                          c += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
                        setDiscountCode(c);
                      }}
                    >
                      Generate code
                    </Button>
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
                          { label: "Domestic only (same country as your store)", value: "domestic" },
                          { label: "All zones (worldwide)", value: "all" },
                        ]}
                        value={geoTarget}
                        onChange={setGeoTarget}
                        helpText="Required. Choose whether free shipping applies only to customers in your store's country, or worldwide."
                      />
                    )}
                  </FormLayout>
                )}

                {type === "cart_goal" && (
                  <BlockStack gap="400">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Set minimum cart values and their corresponding discounts.
                    </Text>
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
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField
                            label={i === 0 ? "Discount %" : ""}
                            type="number"
                            min={0}
                            value={tier.discount}
                            onChange={(v) => updateCartTier(i, "discount", v)}
                            autoComplete="off"
                            prefix="Save"
                            suffix="%"
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
                    <div>
                      <Button
                        size="slim"
                        onClick={() => setCartTiers([...cartTiers, { amount: "", discount: "" }])}
                      >
                        Add tier
                      </Button>
                    </div>
                  </BlockStack>
                )}

                {type === "shipping_discount" && (
                  <FormLayout>
                    <Checkbox label="Free shipping" checked={freeShipping} onChange={setFreeShipping} />
                    {!freeShipping && (
                      <TextField
                        label="Shipping discount"
                        type="number"
                        min={0}
                        value={discountValue}
                        onChange={setPositiveValue(setDiscountValue)}
                        autoComplete="off"
                        prefix="$"
                      />
                    )}
                    <TextField
                      label="Minimum order value"
                      type="number"
                      min={0}
                      value={minOrderForShipping}
                      onChange={setPositiveValue(setMinOrderForShipping)}
                      autoComplete="off"
                      prefix="$"
                      placeholder="e.g. 100"
                    />
                    {freeShipping && (
                      <Select
                        label="Where does free shipping apply?"
                        options={[
                          { label: "Select an option", value: "" },
                          { label: "Domestic only (same country as your store)", value: "domestic" },
                          { label: "All zones (worldwide)", value: "all" },
                        ]}
                        value={geoTarget}
                        onChange={setGeoTarget}
                        helpText="Required. Choose whether free shipping applies only to customers in your store's country, or worldwide."
                      />
                    )}
                  </FormLayout>
                )}
              </BlockStack>
            </Card>

            {/* ── Products Card ─────────────────────────────── */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Products</Text>

                <Select
                  label="Applies to"
                  options={[
                    { label: "Select Options", value: "" },
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

                {appliesTo === "all" && (
                  <Banner tone="info">
                    <p>Discount will apply to all products in your store</p>
                  </Banner>
                )}

                {/* ── Specific products ──────────────────────── */}
                {appliesTo === "specific_products" && (
                  <BlockStack gap="300">
                    <InlineStack gap="200">
                      <Button
                        onClick={async () => {
                          // Open the resource picker WITHOUT filtering out variants so
                          // the returned product objects include their variants array.
                          const picked = await shopify.resourcePicker({
                            type: "product",
                            multiple: true,
                            action: "select",
                            // Intentionally NOT passing filter: { variants: false }
                            // so that variants are returned in the payload.
                          });

                          if (picked) {
                            setSelectedProducts((prev) => {
                              const existingIds = new Set(prev.map((p) => p.id));
                              const incoming: SelectedProduct[] = picked
                                .filter((p: any) => !existingIds.has(p.id))
                                .map((p: any) => ({
                                  id: p.id,
                                  title: p.title,
                                  image: p.images?.[0]?.originalSrc || "",
                                  variants: (p.variants || []).map((v: any) => ({
                                    id: v.id,
                                    title: v.title,
                                    sku: v.sku || "",
                                    price: v.price || "",
                                  })),
                                  // null → "all variants selected" by default
                                  selectedVariantIds: null,
                                  expanded: false,
                                }));
                              return [...prev, ...incoming];
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

                    {/* Selected products list */}
                    {selectedProducts.length > 0 && (
                      <BlockStack gap="300">
                        {/* Summary line */}
                        <Text as="p" variant="bodySm" tone="subdued">
                          {selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""} selected
                          {totalSelectedVariants > 0 &&
                            ` · ${totalSelectedVariants} variant${totalSelectedVariants !== 1 ? "s" : ""}`}
                        </Text>

                        {/* Per-product rows with variant selector */}
                        {selectedProducts.map((product) => (
                          <ProductVariantSelector
                            key={product.id}
                            product={product}
                            onToggleExpand={handleToggleExpand}
                            onToggleVariant={handleToggleVariant}
                            onToggleAllVariants={handleToggleAllVariants}
                            onRemove={handleRemoveProduct}
                          />
                        ))}
                      </BlockStack>
                    )}
                  </BlockStack>
                )}

                {/* ── Specific collections ───────────────────── */}
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
                          if (selected) {
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
                      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          <Text as="p" variant="bodySm" fontWeight="bold">
                            {selectedCollections.length} collection(s) selected
                          </Text>
                          {selectedCollections.map((collection, i) => (
                            <InlineStack key={i} align="space-between" blockAlign="center">
                              <InlineStack gap="200" blockAlign="center">
                                <div style={{
                                  width: "32px", height: "32px", background: "#f0f0f0",
                                  borderRadius: "4px", overflow: "hidden", display: "flex",
                                  alignItems: "center", justifyContent: "center", fontSize: "10px",
                                }}>
                                  {collection.image ? (
                                    <img src={collection.image} alt={collection.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : "C"}
                                </div>
                                <Text as="span" variant="bodySm">{collection.title}</Text>
                              </InlineStack>
                              <Button
                                size="slim"
                                tone="critical"
                                onClick={() =>
                                  setSelectedCollections(selectedCollections.filter((_, j) => j !== i))
                                }
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

            {/* ── Discount popup (advanced_discount_code only) ─── */}
            {type === "advanced_discount_code" && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Discount popup</Text>
                  <Checkbox
                    label="Show a popup that collects emails and sends this discount code"
                    checked={popupEnabled}
                    onChange={setPopupEnabled}
                    helpText="Shoppers enter their email in a storefront popup and receive the code by email."
                  />

                  {popupEnabled && (
                    <BlockStack gap="400">
                      <BlockStack gap="200">
                        <Text as="p" variant="bodySm" fontWeight="bold">
                          Show popup on
                        </Text>
                        <Checkbox
                          label="All pages"
                          checked={popupPages.includes("all")}
                          onChange={togglePopupPage("all")}
                        />
                        <Checkbox
                          label="Home page"
                          checked={popupPages.includes("index")}
                          disabled={popupPages.includes("all")}
                          onChange={togglePopupPage("index")}
                        />
                        <Checkbox
                          label="Product pages"
                          checked={popupPages.includes("product")}
                          disabled={popupPages.includes("all")}
                          onChange={togglePopupPage("product")}
                        />
                        <Checkbox
                          label="Collection pages"
                          checked={popupPages.includes("collection")}
                          disabled={popupPages.includes("all")}
                          onChange={togglePopupPage("collection")}
                        />
                        <Checkbox
                          label="Cart page"
                          checked={popupPages.includes("cart")}
                          disabled={popupPages.includes("all")}
                          onChange={togglePopupPage("cart")}
                        />
                      </BlockStack>

                      <FormLayout>
                        <TextField
                          label="Popup heading"
                          value={popupHeading}
                          onChange={setPopupHeading}
                          autoComplete="off"
                        />
                        <TextField
                          label="Popup description"
                          value={popupDescription}
                          onChange={setPopupDescription}
                          autoComplete="off"
                          multiline={2}
                        />
                        <TextField
                          label="Button text"
                          value={popupButtonText}
                          onChange={setPopupButtonText}
                          autoComplete="off"
                        />
                      </FormLayout>

                      <BlockStack gap="200">
                        <Text as="p" variant="bodySm" fontWeight="bold">
                          Show popup again after the shopper closes it
                        </Text>
                        <InlineStack gap="200" blockAlign="end">
                          <div style={{ width: "120px" }}>
                            <TextField
                              label=""
                              type="number"
                              min={0}
                              value={popupFrequencyValue}
                              onChange={setPositiveValue(setPopupFrequencyValue)}
                              autoComplete="off"
                            />
                          </div>
                          <div style={{ width: "160px" }}>
                            <Select
                              label=""
                              options={[
                                { label: "Minutes", value: "minutes" },
                                { label: "Hours", value: "hours" },
                              ]}
                              value={popupFrequencyUnit}
                              onChange={setPopupFrequencyUnit}
                            />
                          </div>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          If a shopper dismisses the popup, it won't show again until this much time has
                          passed. Shoppers who submit their email won't see it again.
                        </Text>
                      </BlockStack>

                      <Banner tone="info">
                        <p>
                          Enable the <strong>Discount popup</strong> app embed in your theme
                          (Online Store → Themes → Customize → App embeds) for it to appear on
                          your storefront.
                        </p>
                      </Banner>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            )}

            {/* Schedule */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Schedule</Text>
                <Checkbox label="Start immediately" checked={startNow} onChange={setStartNow} />
                {!startNow && (
                  <TextField label="Start date" type="date" value={startDate} onChange={setStartDate} autoComplete="off" />
                )}
                <Checkbox label="Set end date" checked={hasEndDate} onChange={setHasEndDate} />
                {hasEndDate && (
                  <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* ── Right Column ─────────────────────────────────── */}
        <Layout.Section variant="oneThird">
          <DiscountPreview
            type={type}
            name={name}
            discountType={discountType}
            discountValue={discountValue}
            tiers={tiers}
            cartTiers={cartTiers}
            freeShipping={freeShipping}
            minOrderForShipping={minOrderForShipping}
            appliesTo={appliesTo}
            status={status}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}