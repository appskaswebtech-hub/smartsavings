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
import { useLoaderData, useNavigate, useSubmit, useActionData, useNavigation } from "@remix-run/react";
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
import { buildEmailHtml, discountLabel, newBlock, type EmailBlock } from "../lib/emailTemplate";
import { EmailBlockEditor } from "../components/EmailBlockEditor";
import { EmailPreview } from "../components/EmailPreview";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { createShopifyDiscount } from "../discount.server";
import { validateTiers, validateCartGoalTiers } from "../lib/validateTiers";

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
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "bulk_price";
  return json({ type, shop: session.shop });
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
  const minQuantityForShipping = formData.get("minQuantityForShipping") as string;
  const requirementType = (formData.get("requirementType") as string) || "amount";
  const geoTarget = formData.get("geoTarget") as string;
  // Persist only the minimum(s) the chosen mode uses, so a stale value from a
  // hidden field can't leak into the stored campaign.
  const storedMinAmount =
    requirementType === "quantity" ? null : minOrderForShipping ? parseFloat(minOrderForShipping) : null;
  const storedMinQty =
    requirementType === "amount" ? null : minQuantityForShipping ? parseInt(minQuantityForShipping, 10) : null;
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
  const emailContent = (formData.get("emailContent") as string) || null;
  // Left blank means "use the theme app-embed default", so keep it null — 0 is a
  // real value (show immediately) and must stay distinguishable from unset.
  const popupDelaySecondsRaw = ((formData.get("popupDelaySeconds") as string) || "").trim();
  const popupDelaySeconds =
    popupDelaySecondsRaw && !isNaN(parseInt(popupDelaySecondsRaw, 10))
      ? Math.max(0, parseInt(popupDelaySecondsRaw, 10))
      : null;
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
      minQuantityForShipping: minQuantityForShipping || null,
      requirementType,
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
        minimumAmount: storedMinAmount,
        minimumQuantity: storedMinQty,
        requirementType,
        geoTarget: geoTarget || null,
        productIds: productIds || null,
        collectionIds: collectionIds || null,
        discountCode: discountCode || null,
        popupEnabled,
        popupPages: popupEnabled ? popupPagesRaw || null : null,
        popupHeading: popupEnabled ? popupHeading : null,
        popupDescription: popupEnabled ? popupDescription : null,
        popupButtonText: popupEnabled ? popupButtonText : null,
        emailContent: popupEnabled ? emailContent : null,
        popupDelaySeconds: popupEnabled ? popupDelaySeconds : null,
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
  tierDiscountType,
  cartTierDiscountType,
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
  cartTiers: { requirementType?: string; amount: string; quantity?: string; discount: string }[];
  tierDiscountType: "percentage" | "fixed_amount";
  cartTierDiscountType: "percentage" | "fixed_amount";
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
      .map(t => ({ quantity: parseInt(t.quantity), discount: parseFloat(t.discount) }))
      // Numeric, not truthiness: tier fields are strings and "0" is truthy.
      .filter(t => t.quantity > 0 && t.discount > 0)
      .sort((a, b) => b.quantity - a.quantity);
    const match = validTiers.find(t => qty >= t.quantity);
    return match ? match.discount : 0;
  };

  // Does a cart-goal tier's requirement pass for a given cart amount + item count?
  const cartTierMet = (t: any, totalAmount: number, qty: number) => {
    const amt = parseFloat(t.amount);
    const q = parseInt(t.quantity, 10);
    const amountOk = amt > 0 && totalAmount >= amt;
    const qtyOk = q > 0 && qty >= q;
    switch (t.requirementType) {
      case "quantity": return qtyOk;
      case "both": return amountOk && qtyOk;
      case "either": return amountOk || qtyOk;
      default: return amountOk; // amount
    }
  };

  const getCartGoalDiscount = (totalAmount: number, qty: number) => {
    const matches = cartTiers
      .filter(t => parseFloat(t.discount) > 0 && cartTierMet(t, totalAmount, qty))
      .map(t => parseFloat(t.discount));
    return matches.length ? Math.max(...matches) : 0;
  };

  // Tiers that are actually offers. Numeric comparison, not truthiness: these
  // fields are strings and "0" is truthy, so a 0/0 placeholder row would
  // otherwise count as a live tier here and in the badges below.
  const liveTiers = tiers.filter(
    (t) => parseFloat(t.quantity) > 0 && parseFloat(t.discount) > 0
  );
  const liveCartTiers = cartTiers.filter((t) => {
    if (!(parseFloat(t.discount) > 0)) return false;
    const hasAmount = parseFloat(t.amount) > 0;
    const hasQty = parseInt(t.quantity ?? "", 10) > 0;
    switch (t.requirementType) {
      case "quantity": return hasQty;
      case "both": return hasAmount && hasQty;
      case "either": return hasAmount || hasQty;
      default: return hasAmount;
    }
  });

  // "Spend $X+" / "Buy Y+ items" / combined, per the tier's requirement type.
  const cartTierThreshold = (t: any) => {
    const amt = `Spend $${t.amount}+`;
    const qty = `Buy ${t.quantity}+ items`;
    switch (t.requirementType) {
      case "quantity": return qty;
      case "both": return `${amt} and ${qty}`;
      case "either": return `${amt} or ${qty}`;
      default: return amt;
    }
  };

  // "Save 5%" vs "Save $5" — one string, so <Badge> gets a single child.
  const tierLabel = (v: string, dt: "percentage" | "fixed_amount") =>
    dt === "fixed_amount" ? `Save $${v}` : `Save ${v}%`;
  const offLabel = (v: string | number, dt: "percentage" | "fixed_amount") =>
    dt === "fixed_amount" ? `$${v} off` : `${v}% off`;

  const cartTotal = samplePrice * cartQty;
  let discountPercent = 0;
  let discountAmount = 0;
  let finalTotal = cartTotal;
  // The raw tier number that matched (percent or dollars) — used for the banners,
  // which can't key off discountPercent since that stays 0 for fixed amounts.
  let activeTierValue = 0;

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
    activeTierValue = getQuantityDiscount(cartQty);
    if (tierDiscountType === "fixed_amount") {
      // Mirrors the backend: per-item only when specific items are targeted,
      // otherwise the amount comes off the order once.
      discountAmount = appliesTo === "all" ? activeTierValue : activeTierValue * cartQty;
    } else {
      discountPercent = activeTierValue;
      discountAmount = cartTotal * (activeTierValue / 100);
    }
  } else if (type === "cart_goal") {
    activeTierValue = getCartGoalDiscount(cartTotal, cartQty);
    if (cartTierDiscountType === "fixed_amount") {
      // Cart goal always targets all items, so it never applies per item.
      discountAmount = activeTierValue;
    } else {
      discountPercent = activeTierValue;
      discountAmount = cartTotal * (activeTierValue / 100);
    }
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
                  {liveTiers.map((tier, i) => (
                    <InlineStack key={i} align="space-between">
                      <Text as="span" variant="bodySm">Buy {tier.quantity}+</Text>
                      <Badge tone="success">{tierLabel(tier.discount, tierDiscountType)}</Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Box>
            )}

            {type === "cart_goal" && (
              <Box padding="200" background="bg-surface" borderRadius="200">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="bold">Spend more, Save more!</Text>
                  {liveCartTiers.map((tier, i) => (
                    <InlineStack key={i} align="space-between">
                      <Text as="span" variant="bodySm">{cartTierThreshold(tier)}</Text>
                      <Badge tone="success">{tierLabel(tier.discount, cartTierDiscountType)}</Badge>
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

                {type === "quantity_discount" && activeTierValue > 0 && (
                  <Box padding="200" background="bg-surface-success" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">
                      {offLabel(activeTierValue, tierDiscountType)} discount applied (qty: {cartQty})
                    </Text>
                  </Box>
                )}
                {type === "quantity_discount" && activeTierValue === 0 && liveTiers.length > 0 && (
                  <Box padding="200" background="bg-surface-warning" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="caution" alignment="center">
                      Add {parseInt(liveTiers[0]?.quantity || "2") - cartQty} more to unlock {offLabel(liveTiers[0]?.discount ?? "", tierDiscountType)}
                    </Text>
                  </Box>
                )}
                {type === "cart_goal" && activeTierValue > 0 && (
                  <Box padding="200" background="bg-surface-success" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">
                      {offLabel(activeTierValue, cartTierDiscountType)} discount applied (cart: ${cartTotal.toFixed(2)})
                    </Text>
                  </Box>
                )}
                {type === "cart_goal" && activeTierValue === 0 && liveCartTiers.length > 0 && (
                  <Box padding="200" background="bg-surface-warning" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="caution" alignment="center">
                      {cartTierThreshold(liveCartTiers[0])} to unlock {offLabel(liveCartTiers[0]?.discount ?? "", cartTierDiscountType)}
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
                {type === "quantity_discount" && `${liveTiers.length} tier(s)`}
                {type === "cart_goal" && `${liveCartTiers.length} tier(s)`}
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
  const { type, shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  // Drives the Save button's spinner. "submitting" is true only while the action
  // runs — a plain Discard navigation is a GET ("loading"), so it won't trigger it.
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [appliesTo, setAppliesTo] = useState("all");
  const [startNow, setStartNow] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("active");
  // Tier discount type is campaign-level (one setting for every tier), matching
  // the edit page. It gets stamped onto each tier when the form is submitted.
  const [tierDiscountType, setTierDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [cartTierDiscountType, setCartTierDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [tiers, setTiers] = useState([
    { quantity: "2", discount: "5" },
    { quantity: "4", discount: "10" },
    { quantity: "8", discount: "15" },
  ]);
  // Each cart-goal tier carries its own requirementType + both possible thresholds.
  const [cartTiers, setCartTiers] = useState([
    { requirementType: "amount", amount: "50", quantity: "", discount: "5" },
    { requirementType: "amount", amount: "100", quantity: "", discount: "10" },
    { requirementType: "amount", amount: "150", quantity: "", discount: "15" },
  ]);
  const [freeShipping, setFreeShipping] = useState(true);
  const [minOrderForShipping, setMinOrderForShipping] = useState("100");
  // amount | quantity | both | either — which minimum(s) gate the free shipping.
  const [requirementType, setRequirementType] = useState("amount");
  const [minQuantityForShipping, setMinQuantityForShipping] = useState("");
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
  // Block-based content of the code email (separate from the on-site popup text above).
  const [emailBlocks, setEmailBlocks] = useState<EmailBlock[]>(() => [
    newBlock("heading"),
    newBlock("text"),
    newBlock("code"),
    newBlock("button"),
  ]);
  // Live preview, built from the same template the sender uses.
  const emailPreviewHtml = buildEmailHtml({
    code: discountCode || "SAMPLE10",
    discountLabel: discountLabel(discountType, parseFloat(discountValue) || null),
    shop,
    blocks: emailBlocks,
  });
  const [popupDelaySeconds, setPopupDelaySeconds] = useState("");
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

  const updateCartTier = (
    index: number,
    field: "amount" | "quantity" | "discount" | "requirementType",
    value: string
  ) => {
    if (field !== "requirementType" && value !== "" && parseFloat(value) < 0) return;
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

    // Shipping: the field(s) the chosen requirement type needs must be filled.
    if (type === "shipping_discount") {
      const needsAmount = ["amount", "both", "either"].includes(requirementType);
      const needsQty = ["quantity", "both", "either"].includes(requirementType);
      const amountOk = parseFloat(minOrderForShipping) > 0;
      const qtyOk = parseInt(minQuantityForShipping, 10) > 0;
      // "either" only needs one of the two; the rest need every field they show.
      const ok =
        requirementType === "either"
          ? amountOk || qtyOk
          : (!needsAmount || amountOk) && (!needsQty || qtyOk);
      if (!ok) {
        shopify.toast.show(
          requirementType === "either"
            ? "Enter a minimum order value or a minimum quantity."
            : "Enter a value for each minimum requirement.",
          { isError: true }
        );
        return;
      }
    }

    // Popup requires at least one target page when enabled
    if (type === "advanced_discount_code" && popupEnabled && popupPages.length === 0) {
      shopify.toast.show("Select at least one page to show the discount popup on.", {
        isError: true,
      });
      return;
    }

    // Tiered campaigns: at least 1 valid tier, no duplicate thresholds, <= 25 tiers.
    if (type === "quantity_discount") {
      const tierError = validateTiers(tiers, "quantity", "Buy quantity");
      if (tierError) {
        shopify.toast.show(tierError, { isError: true });
        return;
      }
    }
    // Cart goal tiers each pick their own requirement type (amount/quantity/both/either).
    if (type === "cart_goal") {
      const tierError = validateCartGoalTiers(cartTiers);
      if (tierError) {
        shopify.toast.show(tierError, { isError: true });
        return;
      }
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
    formData.append("minQuantityForShipping", minQuantityForShipping);
    formData.append("requirementType", requirementType);
    formData.append("geoTarget", geoTarget);
    formData.append("discountCode", discountCode);

    // Email-capture popup (advanced_discount_code only)
    if (type === "advanced_discount_code") {
      formData.append("popupEnabled", String(popupEnabled));
      formData.append("popupPages", JSON.stringify(popupPages));
      formData.append("popupHeading", popupHeading);
      formData.append("popupDescription", popupDescription);
      formData.append("popupButtonText", popupButtonText);
      formData.append("popupDelaySeconds", popupDelaySeconds);
      formData.append("popupFrequencyValue", popupFrequencyValue);
      formData.append("popupFrequencyUnit", popupFrequencyUnit);
      formData.append("emailContent", JSON.stringify({ blocks: emailBlocks }));
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
    // Stamp the campaign-level discount type onto every tier — discount.server.ts
    // and the storefront widgets read it per tier.
    if (type === "quantity_discount")
      formData.append(
        "tiers",
        JSON.stringify(tiers.map((t) => ({ ...t, discountType: tierDiscountType })))
      );
    else if (type === "cart_goal")
      formData.append(
        "tiers",
        JSON.stringify(cartTiers.map((t) => ({ ...t, discountType: cartTierDiscountType })))
      );

    submit(formData, { method: "post" });
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <Page
      backAction={{ content: "Choose campaign type", url: "/app/campaigns/create" }}
      title={`Create ${CAMPAIGN_TYPE_LABELS[type] || "Campaign"}`}
      primaryAction={{
        content: "Save campaign",
        onAction: handleSave,
        loading: isSubmitting,
        disabled: isSubmitting,
      }}
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
                    <Select
                      label="Discount type"
                      options={[
                        { label: "Percentage off", value: "percentage" },
                        { label: "Fixed amount off", value: "fixed_amount" },
                      ]}
                      value={tierDiscountType}
                      onChange={(v) => setTierDiscountType(v as "percentage" | "fixed_amount")}
                      helpText={
                        tierDiscountType === "fixed_amount"
                          ? "Applies to all products: the amount comes off the order once. Scoped to specific products: it comes off each qualifying item."
                          : undefined
                      }
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
                    <Select
                      label="Discount type"
                      options={[
                        { label: "Percentage off", value: "percentage" },
                        { label: "Fixed amount off", value: "fixed_amount" },
                      ]}
                      value={cartTierDiscountType}
                      onChange={(v) => setCartTierDiscountType(v as "percentage" | "fixed_amount")}
                    />
                    {cartTiers.map((tier, i) => {
                      const showAmount = ["amount", "both", "either"].includes(tier.requirementType);
                      const showQty = ["quantity", "both", "either"].includes(tier.requirementType);
                      return (
                        <Box key={i} padding="300" borderColor="border" borderWidth="025" borderRadius="200">
                          <BlockStack gap="200">
                            <InlineStack gap="200" align="space-between" blockAlign="center">
                              <Text as="span" variant="bodySm" fontWeight="medium">Tier {i + 1}</Text>
                              <Button
                                tone="critical"
                                size="slim"
                                onClick={() => setCartTiers(cartTiers.filter((_, j) => j !== i))}
                                disabled={cartTiers.length <= 1}
                              >
                                Remove
                              </Button>
                            </InlineStack>
                            <Select
                              label="Requirement"
                              labelHidden
                              options={[
                                { label: "Minimum order value", value: "amount" },
                                { label: "Minimum quantity", value: "quantity" },
                                { label: "Minimum order value and minimum quantity", value: "both" },
                                { label: "Minimum order value or minimum quantity", value: "either" },
                              ]}
                              value={tier.requirementType}
                              onChange={(v) => updateCartTier(i, "requirementType", v)}
                              helpText={
                                tier.requirementType === "both"
                                  ? "Shopify enforces the order value at checkout; the quantity is shown to shoppers but not yet enforced for “and”."
                                  : undefined
                              }
                            />
                            <InlineStack gap="200" blockAlign="end">
                              {showAmount && (
                                <div style={{ flex: 1 }}>
                                  <TextField
                                    label="Min order value"
                                    type="number"
                                    min={0}
                                    value={tier.amount}
                                    onChange={(v) => updateCartTier(i, "amount", v)}
                                    autoComplete="off"
                                    prefix="$"
                                  />
                                </div>
                              )}
                              {showQty && (
                                <div style={{ flex: 1 }}>
                                  <TextField
                                    label="Min quantity"
                                    type="number"
                                    min={1}
                                    value={tier.quantity}
                                    onChange={(v) => updateCartTier(i, "quantity", v)}
                                    autoComplete="off"
                                    suffix="items"
                                  />
                                </div>
                              )}
                              <div style={{ flex: 1 }}>
                                <TextField
                                  label="Discount"
                                  type="number"
                                  min={0}
                                  value={tier.discount}
                                  onChange={(v) => updateCartTier(i, "discount", v)}
                                  autoComplete="off"
                                  prefix={cartTierDiscountType === "fixed_amount" ? "Save $" : "Save"}
                                  suffix={cartTierDiscountType === "fixed_amount" ? undefined : "%"}
                                />
                              </div>
                            </InlineStack>
                          </BlockStack>
                        </Box>
                      );
                    })}
                    <div>
                      <Button
                        size="slim"
                        onClick={() =>
                          setCartTiers([
                            ...cartTiers,
                            { requirementType: "amount", amount: "", quantity: "", discount: "" },
                          ])
                        }
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
                    <Select
                      label="Minimum requirement"
                      options={[
                        { label: "Minimum order value", value: "amount" },
                        { label: "Minimum quantity", value: "quantity" },
                        { label: "Minimum order value and minimum quantity", value: "both" },
                        { label: "Minimum order value or minimum quantity", value: "either" },
                      ]}
                      value={requirementType}
                      onChange={setRequirementType}
                      helpText={
                        requirementType === "both"
                          ? "Shopify enforces the order value at checkout; the quantity is shown to shoppers but not yet enforced for “and”."
                          : undefined
                      }
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
                        placeholder="e.g. 100"
                      />
                    )}
                    {(requirementType === "quantity" ||
                      requirementType === "both" ||
                      requirementType === "either") && (
                      <TextField
                        label="Minimum quantity"
                        type="number"
                        min={1}
                        value={minQuantityForShipping}
                        onChange={(v) => {
                          const n = parseInt(v);
                          if (v === "" || n >= 0) setMinQuantityForShipping(v);
                        }}
                        autoComplete="off"
                        suffix="items"
                        placeholder="e.g. 3"
                      />
                    )}
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

                      <Divider />

                      <BlockStack gap="200">
                        <Text as="p" variant="bodySm" fontWeight="bold">
                          Email content
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          The email a shopper receives with their code — separate from the popup text above. Build it from blocks.
                        </Text>
                        <EmailBlockEditor blocks={emailBlocks} onChange={setEmailBlocks} />
                        <EmailPreview html={emailPreviewHtml} labelVariant="bodySm" labelWeight="bold" />
                      </BlockStack>

                      <BlockStack gap="200">
                        <Text as="p" variant="bodySm" fontWeight="bold">
                          Show popup after
                        </Text>
                        <InlineStack gap="200" blockAlign="end">
                          <div style={{ width: "120px" }}>
                            <TextField
                              label=""
                              type="number"
                              min={0}
                              suffix="seconds"
                              value={popupDelaySeconds}
                              onChange={setPositiveValue(setPopupDelaySeconds)}
                              autoComplete="off"
                            />
                          </div>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          How long to wait after the page loads before the popup appears. Leave
                          blank to use the delay set on the Discount popup app embed in your theme.
                        </Text>
                      </BlockStack>

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
            tierDiscountType={tierDiscountType}
            cartTierDiscountType={cartTierDiscountType}
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