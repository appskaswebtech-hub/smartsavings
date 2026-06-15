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
  const freeShipping = formData.get("freeShipping") === "true";
  const minOrderForShipping = formData.get("minOrderForShipping") as string;
  const geoTarget = formData.get("geoTarget") as string;
  const productIds = formData.get("productIds") as string;
  const collectionIds = formData.get("collectionIds") as string;
  const discountCode = formData.get("discountCode") as string;

  // Discount combination settings
  const combineWithProducts = formData.get("combineWithProducts") === "true";
  const combineWithOrders = formData.get("combineWithOrders") === "true";
  const combineWithShipping = formData.get("combineWithShipping") === "true";

  if (!name || name.trim() === "") {
    return json({ success: false, error: "Campaign name is required" });
  }

  // Geo-target required for any free shipping discount.
  // shipping_discount is always free shipping.
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
  const finalDiscountType =
    type === "shipping_discount" && freeShipping ? "free_shipping" : discountType;

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
      collectionIds: collectionIds || null,
      freeShipping,
      minOrderForShipping: minOrderForShipping || null,
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
        combineWithProducts,
        combineWithOrders,
        combineWithShipping,
      },
    });

    return redirect("/app/campaigns");
  } catch (error) {
    console.error("Failed to create campaign:", error);
    return json({ success: false, error: "Failed to create campaign. Please try again." });
  }
};

/* ── Discount Preview Component ──────────────────────── */

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
                  <Text as="p" variant="bodySm" fontWeight="bold">Free shipping</Text>
                  {minOrderForShipping && parseFloat(minOrderForShipping) > 0 && (
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

                {type === "quantity_discount" && discountPercent > 0 && (
                  <Box padding="200" background="bg-surface-success" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">{discountPercent}% discount applied (qty: {cartQty})</Text>
                  </Box>
                )}
                {type === "quantity_discount" && discountPercent === 0 && tiers.some(t => t.quantity && t.discount) && (
                  <Box padding="200" background="bg-surface-warning" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="caution" alignment="center">Add {parseInt(tiers.filter(t => t.quantity)[0]?.quantity || "2") - cartQty} more to unlock {tiers.filter(t => t.discount)[0]?.discount}% off</Text>
                  </Box>
                )}
                {type === "cart_goal" && discountPercent > 0 && (
                  <Box padding="200" background="bg-surface-success" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="success" alignment="center" fontWeight="bold">{discountPercent}% discount applied (cart: ${cartTotal.toFixed(2)})</Text>
                  </Box>
                )}
                {type === "cart_goal" && discountPercent === 0 && cartTiers.some(t => t.amount && t.discount) && (
                  <Box padding="200" background="bg-surface-warning" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="caution" alignment="center">Spend ${(parseFloat(cartTiers.filter(t => t.amount)[0]?.amount || "50") - cartTotal).toFixed(2)} more to unlock {cartTiers.filter(t => t.discount)[0]?.discount}% off</Text>
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
                {type === "shipping_discount" && "Free shipping"}
                {type === "buy_x_get_y" && `Buy ${discountValue || "X"} Get 1`}
                {type === "advanced_discount_code" && (
                  discountType === "free_shipping" ? "Free shipping" :
                  discountType === "percentage" ? `${discountVal}% off` :
                  `$${discountVal} off`
                )}
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

/* ── Main Component ──────────────────────────────────── */

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
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<any[]>([]);

  // Discount combination settings — all on by default
  const [combineWithProducts, setCombineWithProducts] = useState(true);
  const [combineWithOrders, setCombineWithOrders] = useState(true);
  const [combineWithShipping, setCombineWithShipping] = useState(true);

  const shopify = useAppBridge();

  // Geo-target validation needed when creating a free shipping discount node.
  // shipping_discount is always free shipping — no checkbox needed.
  const isFreeShippingCampaign =
    type === "shipping_discount" ||
    (type === "advanced_discount_code" && discountType === "free_shipping");

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

  const handleSave = () => {
    if (isFreeShippingCampaign && !geoTarget) {
      shopify.toast.show("Please choose where free shipping applies (Domestic or All zones).", { isError: true });
      return;
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
    formData.append("combineWithProducts", String(combineWithProducts));
    formData.append("combineWithOrders", String(combineWithOrders));
    formData.append("combineWithShipping", String(combineWithShipping));
    if (selectedProducts.length > 0) {
      formData.append("productIds", JSON.stringify(selectedProducts.map(p => p.id)));
    }
    if (selectedCollections.length > 0) {
      formData.append("collectionIds", JSON.stringify(selectedCollections.map(c => c.id)));
    }
    if (type === "quantity_discount") formData.append("tiers", JSON.stringify(tiers));
    else if (type === "cart_goal") formData.append("tiers", JSON.stringify(cartTiers));
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
        <Box paddingBlockEnd="400">
          <Banner tone="critical"><p>{actionData.error}</p></Banner>
        </Box>
      )}

      <Layout>
        {/* ── Left Column ── */}
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              <p><strong>{CAMPAIGN_TYPE_LABELS[type]}</strong> — {CAMPAIGN_TYPE_DESCRIPTIONS[type]}</p>
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
                    <Text as="p" variant="bodySm" tone="subdued">Set up tiered discounts based on quantity purchased.</Text>
                    {tiers.map((tier, i) => (
                      <InlineStack key={i} gap="200" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <TextField label={i === 0 ? "Min quantity" : ""} type="number" min={0} value={tier.quantity} onChange={(v) => updateTier(i, "quantity", v)} autoComplete="off" prefix="Buy" suffix="+" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField label={i === 0 ? "Discount %" : ""} type="number" min={0} value={tier.discount} onChange={(v) => updateTier(i, "discount", v)} autoComplete="off" prefix="Save" suffix="%" />
                        </div>
                        <Button tone="critical" size="slim" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} disabled={tiers.length <= 1}>Remove</Button>
                      </InlineStack>
                    ))}
                    <div><Button size="slim" onClick={() => setTiers([...tiers, { quantity: "", discount: "" }])}>Add tier</Button></div>
                  </BlockStack>
                )}

                {type === "buy_x_get_y" && (
                  <FormLayout>
                    <TextField label="Customer buys (quantity)" type="number" min={0} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" placeholder="e.g. 2" />
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
                      <TextField label="Discount on item (%)" type="number" min={0} max={100} value={discountValue} onChange={setPositiveValue(setDiscountValue)} autoComplete="off" suffix="%" />
                    )}
                  </FormLayout>
                )}

                {/* ── Advanced Discount Code ── */}
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
                    <Button size="slim" onClick={() => {
                      let c = "";
                      for (let i = 0; i < 8; i++) c += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
                      setDiscountCode(c);
                    }}>
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
                        helpText="Required. Choose whether free shipping applies only to your store's country, or worldwide."
                      />
                    )}
                  </FormLayout>
                )}

                {type === "cart_goal" && (
                  <BlockStack gap="400">
                    <Text as="p" variant="bodySm" tone="subdued">Set minimum cart values and their corresponding discounts.</Text>
                    {cartTiers.map((tier, i) => (
                      <InlineStack key={i} gap="200" blockAlign="end">
                        <div style={{ flex: 1 }}>
                          <TextField label={i === 0 ? "Min cart value" : ""} type="number" min={0} value={tier.amount} onChange={(v) => updateCartTier(i, "amount", v)} autoComplete="off" prefix="$" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField label={i === 0 ? "Discount %" : ""} type="number" min={0} value={tier.discount} onChange={(v) => updateCartTier(i, "discount", v)} autoComplete="off" prefix="Save" suffix="%" />
                        </div>
                        <Button tone="critical" size="slim" onClick={() => setCartTiers(cartTiers.filter((_, j) => j !== i))} disabled={cartTiers.length <= 1}>Remove</Button>
                      </InlineStack>
                    ))}
                    <div><Button size="slim" onClick={() => setCartTiers([...cartTiers, { amount: "", discount: "" }])}>Add tier</Button></div>
                  </BlockStack>
                )}

                {type === "shipping_discount" && (
                  <FormLayout>
                    <TextField
                      label="Minimum order value"
                      type="number"
                      min={0}
                      value={minOrderForShipping}
                      onChange={setPositiveValue(setMinOrderForShipping)}
                      autoComplete="off"
                      prefix="$"
                      placeholder="e.g. 100"
                      helpText="Customers must reach this amount to unlock free shipping. Leave at 0 for no minimum."
                    />
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
                  <Text as="p" variant="bodySm" tone="subdued">
                    Control whether this discount can stack with other active discounts at checkout.
                  </Text>
                </BlockStack>
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
                    helpText="Stack with other free shipping discount codes"
                    checked={combineWithShipping}
                    onChange={setCombineWithShipping}
                  />
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Products */}
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
                    if (val === "all") { setSelectedProducts([]); setSelectedCollections([]); }
                  }}
                />

                {appliesTo === "all" && (
                  <Banner tone="info"><p>Discount will apply to all products in your store</p></Banner>
                )}

                {appliesTo === "specific_products" && (
                  <BlockStack gap="300">
                    <InlineStack gap="200">
                      <Button onClick={async () => {
                        const selected = await shopify.resourcePicker({ type: "product", multiple: true, action: "select", filter: { variants: false } });
                        if (selected) {
                          setSelectedProducts(selected.map((p: any) => ({
                            id: p.id,
                            title: p.title,
                            image: p.images?.[0]?.originalSrc || "",
                            variants: p.variants?.length || 0,
                          })));
                        }
                      }}>Browse products</Button>
                      <Button variant="plain" onClick={() => { setAppliesTo("all"); setSelectedProducts([]); }}>or select all products</Button>
                    </InlineStack>
                    {selectedProducts.length > 0 && (
                      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          <Text as="p" variant="bodySm" fontWeight="bold">{selectedProducts.length} product(s) selected</Text>
                          {selectedProducts.map((product, i) => (
                            <InlineStack key={i} align="space-between" blockAlign="center">
                              <InlineStack gap="200" blockAlign="center">
                                <div style={{ width: "32px", height: "32px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
                                  {product.image ? <img src={product.image} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "P"}
                                </div>
                                <Text as="span" variant="bodySm">{product.title}</Text>
                              </InlineStack>
                              <Button size="slim" tone="critical" onClick={() => setSelectedProducts(selectedProducts.filter((_, j) => j !== i))}>Remove</Button>
                            </InlineStack>
                          ))}
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                )}

                {appliesTo === "specific_collections" && (
                  <BlockStack gap="300">
                    <InlineStack gap="200">
                      <Button onClick={async () => {
                        const selected = await shopify.resourcePicker({ type: "collection", multiple: true, action: "select" });
                        if (selected) {
                          setSelectedCollections(selected.map((c: any) => ({
                            id: c.id,
                            title: c.title,
                            image: c.image?.originalSrc || "",
                          })));
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
                              <Button size="slim" tone="critical" onClick={() => setSelectedCollections(selectedCollections.filter((_, j) => j !== i))}>Remove</Button>
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
                <Checkbox label="Start immediately" checked={startNow} onChange={setStartNow} />
                {!startNow && <TextField label="Start date" type="date" value={startDate} onChange={setStartDate} autoComplete="off" />}
                <Checkbox label="Set end date" checked={hasEndDate} onChange={setHasEndDate} />
                {hasEndDate && <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* ── Right Column — Preview ── */}
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