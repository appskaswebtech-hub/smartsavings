
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher, useRevalidator } from "@remix-run/react";
import {
  Page, Card, Text, BlockStack, InlineStack, Badge, Box, Divider,
  InlineGrid, Banner, Thumbnail,
} from "@shopify/polaris";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;
  const campaignId = params.id;

  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.shop !== shop) {
    throw new Response("Campaign not found", { status: 404 });
  }

  type ProductEntry = {
    id: string; title: string; image: string | null;
    variants: { id: string; title: string; price: string; sku: string }[];
    selectedVariants: "all" | { id: string; title: string; price: string; sku: string }[];
  };

  let productEntries: ProductEntry[] = [];
  let collectionNames: string[] = [];

  const hasProductIds = !!campaign.productIds && campaign.productIds !== "[]";
  const hasCollectionIds = !!campaign.collectionIds && campaign.collectionIds !== "[]";
  const effectiveAppliesTo =
    hasProductIds    ? "specific_products" :
    hasCollectionIds ? "specific_collections" :
    campaign.appliesTo || "all";

  if (effectiveAppliesTo === "specific_products" && campaign.productIds) {
    try {
      const ids = JSON.parse(campaign.productIds) as string[];
      const productGids = ids.filter(id => id.includes("/Product/") && !id.includes("/ProductVariant/"));
      const variantGids = ids.filter(id => id.includes("/ProductVariant/"));

      if (productGids.length > 0) {
        const q = productGids.slice(0, 20).map((id, i) =>
          `p${i}: product(id: "${id}") {
            id title featuredImage { url }
            variants(first: 100) { nodes { id title price sku } }
          }`
        ).join("\n");
        const res = await admin.graphql(`#graphql query { ${q} }`);
        const result = await res.json();
        for (const p of Object.values(result.data || {}) as any[]) {
          if (!p?.title) continue;
          productEntries.push({
            id: p.id, title: p.title,
            image: p.featuredImage?.url || null,
            variants: (p.variants?.nodes || []).map((v: any) => ({
              id: v.id, title: v.title, price: v.price, sku: v.sku || "",
            })),
            selectedVariants: "all",
          });
        }
      }

      if (variantGids.length > 0) {
        const q = variantGids.slice(0, 50).map((id, i) =>
          `v${i}: productVariant(id: "${id}") {
            id title price sku
            product { id title featuredImage { url } }
          }`
        ).join("\n");
        const res = await admin.graphql(`#graphql query { ${q} }`);
        const result = await res.json();
        const byProduct = new Map<string, ProductEntry>();
        for (const v of Object.values(result.data || {}) as any[]) {
          if (!v?.title || !v?.product) continue;
          const pid = v.product.id;
          if (!byProduct.has(pid)) {
            byProduct.set(pid, {
              id: pid, title: v.product.title,
              image: v.product.featuredImage?.url || null,
              variants: [], selectedVariants: [],
            });
          }
          (byProduct.get(pid)!.selectedVariants as any[]).push({
            id: v.id, title: v.title, price: v.price, sku: v.sku || "",
          });
        }
        productEntries.push(...byProduct.values());
      }
    } catch (e) {
      console.error("Failed to resolve products/variants:", e);
    }
  }

  if (effectiveAppliesTo === "specific_collections" && campaign.collectionIds) {
    try {
      const ids = JSON.parse(campaign.collectionIds) as string[];
      if (ids.length > 0) {
        const q = ids.slice(0, 20).map((id, i) => `c${i}: collection(id: "${id}") { title }`).join("\n");
        const res = await admin.graphql(`#graphql query { ${q} }`);
        const result = await res.json();
        collectionNames = Object.values(result.data || {}).filter((c: any) => c?.title).map((c: any) => c.title);
      }
    } catch {}
  }

  let tiers: any[] = [];
  if (campaign.tiers) { try { tiers = JSON.parse(campaign.tiers); } catch {} }

  let shopifyDiscounts: any[] = [];
  let shopifyProducts: { id: string; title: string; image: string | null; variants?: { id: string; title: string }[]; selectedVariants?: "all" | { id: string; title: string }[] }[] = [];

  try {
    const allRes = await admin.graphql(`#graphql
      query {
        discountNodes(first: 100) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticBasic {
                title status
                customerGets {
                  items {
                    ... on DiscountProducts {
                      products(first: 20) { nodes { id title featuredImage { url } } }
                      productVariants(first: 50) { nodes { id title product { id title featuredImage { url } } } }
                    }
                    ... on AllDiscountItems { allItems }
                  }
                }
              }
              ... on DiscountAutomaticBxgy {
                title status
                customerBuys {
                  items {
                    ... on DiscountProducts {
                      products(first: 20) { nodes { id title featuredImage { url } } }
                      productVariants(first: 50) { nodes { id title product { id title featuredImage { url } } } }
                    }
                    ... on AllDiscountItems { allItems }
                  }
                }
              }
              ... on DiscountAutomaticFreeShipping { title status }
              ... on DiscountAutomaticApp { title status }
              ... on DiscountCodeBasic {
                title status
                codes(first:1) { nodes { code } }
                customerGets {
                  items {
                    ... on DiscountProducts {
                      products(first: 20) { nodes { id title featuredImage { url } } }
                      productVariants(first: 50) { nodes { id title product { id title featuredImage { url } } } }
                    }
                    ... on AllDiscountItems { allItems }
                  }
                }
              }
              ... on DiscountCodeFreeShipping { title status codes(first:1) { nodes { code } } }
            }
          }
        }
      }`
    );
    const allResult = await allRes.json();
    const matchingNodes = (allResult.data?.discountNodes?.nodes || []).filter((n: any) => {
      const t = n.discount?.title || "";
      return t === campaign.name || t.startsWith(campaign.name + " (") || t.startsWith(campaign.name + " - ");
    });

    shopifyDiscounts = matchingNodes.map((n: any) => ({
      id: n.id, title: n.discount?.title,
      status: n.discount?.status, type: n.discount?.__typename,
      code: n.discount?.codes?.nodes?.[0]?.code || null,
    }));

    if (productEntries.length === 0) {
      const productMap = new Map<string, typeof shopifyProducts[0]>();
      const variantsByProduct = new Map<string, { id: string; title: string }[]>();

      for (const node of matchingNodes) {
        const itemSources = [
          node.discount?.customerBuys?.items,
          node.discount?.customerGets?.items,
        ].filter(Boolean);

        for (const items of itemSources) {
          if (!items || items.allItems === true) continue;
          for (const p of items.products?.nodes || []) {
            if (!productMap.has(p.id)) productMap.set(p.id, { id: p.id, title: p.title, image: p.featuredImage?.url || null });
          }
          for (const v of items.productVariants?.nodes || []) {
            const pid = v.product?.id; if (!pid) continue;
            if (!productMap.has(pid)) productMap.set(pid, { id: pid, title: v.product.title, image: v.product.featuredImage?.url || null });
            if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
            variantsByProduct.get(pid)!.push({ id: v.id, title: v.title });
          }
        }
      }

      for (const [pid, product] of productMap.entries()) {
        const specificVariants = variantsByProduct.get(pid);
        shopifyProducts.push({
          ...product, variants: [],
          selectedVariants: specificVariants?.length ? specificVariants : "all" as const,
        });
      }
    }
  } catch {}

  let emailSignups: { id: string; email: string; createdAt: string }[] = [];
  if (campaign.popupEnabled && campaign.type === "advanced_discount_code") {
    try {
      const rows = await db.popupSubmission.findMany({
        where: { shop, campaignId: campaign.id },
        orderBy: { createdAt: "desc" },
      });
      emailSignups = rows.map((r) => ({
        id: r.id,
        email: r.email,
        createdAt: new Date(r.createdAt).toLocaleString(),
      }));
    } catch {}
  }

  return json({
    campaign: {
      ...campaign,
      appliesTo: effectiveAppliesTo,
      startDate: campaign.startDate ? new Date(campaign.startDate).toLocaleString() : null,
      endDate: campaign.endDate ? new Date(campaign.endDate).toLocaleString() : null,
      createdAt: new Date(campaign.createdAt).toLocaleString(),
      updatedAt: new Date(campaign.updatedAt).toLocaleString(),
    },
    tiers, productEntries, shopifyProducts, collectionNames, shopifyDiscounts, emailSignups,
  });
};

const TYPE_LABELS: Record<string, string> = {
  bulk_price: "Bulk Price Editor", quantity_discount: "Quantity Discount",
  buy_x_get_y: "Buy X Get Y", advanced_discount_code: "Advanced Discount Code",
  cart_goal: "Cart Goal", shipping_discount: "Shipping Discount",
};

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percentage: "Percentage", fixed_amount: "Fixed Amount",
  free_shipping: "Free Shipping", free: "Free",
};

export default function CampaignDetail() {
  const { campaign, tiers, productEntries, shopifyProducts, collectionNames, shopifyDiscounts, emailSignups } = useLoaderData<typeof loader>();
  const displayProducts = productEntries.length > 0 ? productEntries : shopifyProducts;
  const navigate = useNavigate();

  // ── useFetcher for Pause/Activate — keeps Shopify embedded auth context ──
  const toggleFetcher = useFetcher<{ success: boolean }>();
  const deleteFetcher = useFetcher<{ success: boolean }>();
  const revalidator = useRevalidator();

  // After a successful toggle, revalidate the loader (stays inside the embedded session)
  useEffect(() => {
    if (toggleFetcher.state === "idle" && toggleFetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [toggleFetcher.state, toggleFetcher.data]);

  // Navigate as soon as delete is submitting — before Remix runs any loaders.
  // "loading" is too late (loader already ran and threw 404).
  // "submitting" fires the instant deleteFetcher.submit() is called, before the
  // server responds, so the current route unmounts cleanly and the 404 never shows.
  useEffect(() => {
    if (deleteFetcher.state === "submitting") {
      navigate("/app/campaigns");
    }
  }, [deleteFetcher.state, navigate]);

  const handleToggle = () => {
    const fd = new FormData();
    fd.append("action", "toggle_status");
    fd.append("campaignId", campaign.id);
    // Post to the campaigns list page action via Remix's fetcher (preserves auth)
    toggleFetcher.submit(fd, { method: "post", action: "/app/campaigns" });
  };

  const handleDelete = () => {
    if (!confirm("Delete this campaign from both the app and Shopify store?")) return;
    const fd = new FormData();
    fd.append("action", "delete");
    fd.append("campaignId", campaign.id);
    deleteFetcher.submit(fd, { method: "post", action: "/app/campaigns" });
  };

  const getStatusBadge = (s: string) => {
    const map: Record<string, any> = {
      active:    <Badge tone="success">Active</Badge>,
      scheduled: <Badge tone="info">Scheduled</Badge>,
      expired:   <Badge>Expired</Badge>,
      paused:    <Badge tone="warning">Paused</Badge>,
      ACTIVE:    <Badge tone="success">Active</Badge>,
      EXPIRED:   <Badge>Expired</Badge>,
      SCHEDULED: <Badge tone="info">Scheduled</Badge>,
    };
    return map[s] || <Badge>{s}</Badge>;
  };

  const discountDisplay = () => {
    const { discountType, discountValue } = campaign;
    if (tiers.length > 0) return `${tiers.length} tier${tiers.length > 1 ? "s" : ""}`;
    if (discountType === "free_shipping") return "Free Shipping";
    if (discountType === "percentage") return `${discountValue}% off`;
    if (discountType === "fixed_amount") return `$${discountValue} off`;
    return String(discountValue || "—");
  };

  const isToggling = toggleFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";

  return (
    <Page
      backAction={{ content: "Campaigns", url: "/app/campaigns" }}
      title={campaign.name}
      titleMetadata={getStatusBadge(campaign.status)}
      primaryAction={{
        content: isToggling
          ? (campaign.status === "active" ? "Pausing…" : "Activating…")
          : (campaign.status === "active" ? "Pause" : "Activate"),
        loading: isToggling,
        onAction: handleToggle,
      }}
      secondaryActions={[
        {
          content: "Edit",
          onAction: () => navigate(`/app/campaigns/edit/${campaign.id}`),
        },
        {
          content: isDeleting ? "Deleting…" : "Delete",
          destructive: true,
          loading: isDeleting,
          onAction: handleDelete,
        }
      ]}
    >
      <BlockStack gap="400">

        {/* ── Overview ── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Campaign Overview</Text>
            <InlineGrid columns={2} gap="400">
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Campaign Name</Text>
                <Text as="span" variant="bodyMd" fontWeight="bold">{campaign.name}</Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Campaign Type</Text>
                <Text as="span" variant="bodyMd">{TYPE_LABELS[campaign.type] || campaign.type}</Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Discount Type</Text>
                <Text as="span" variant="bodyMd">
                  {tiers.length > 0 ? "Tiered (see below)" : (DISCOUNT_TYPE_LABELS[campaign.discountType] || campaign.discountType)}
                </Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Discount Value</Text>
                <Text as="span" variant="bodyMd" fontWeight="semibold">{discountDisplay()}</Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Status</Text>
                {getStatusBadge(campaign.status)}
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Applies To</Text>
                <Text as="span" variant="bodyMd">
                  {campaign.appliesTo === "specific_products" && productEntries.length > 0
                    ? `${productEntries.length} specific product(s)`
                    : campaign.appliesTo === "specific_products" ? "Specific products"
                    : campaign.appliesTo === "specific_collections" && collectionNames.length > 0
                    ? `${collectionNames.length} specific collection(s)`
                    : campaign.appliesTo === "specific_collections" ? "Specific collections"
                    : "All products"}
                </Text>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* ── Schedule ── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Schedule</Text>
            <InlineGrid columns={2} gap="400">
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Start Date</Text>
                <Text as="span" variant="bodyMd">{campaign.startDate || "Immediately"}</Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">End Date</Text>
                <Text as="span" variant="bodyMd">{campaign.endDate || "No end date"}</Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Created</Text>
                <Text as="span" variant="bodyMd">{campaign.createdAt}</Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Last Updated</Text>
                <Text as="span" variant="bodyMd">{campaign.updatedAt}</Text>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* ── Tiers ── */}
        {tiers.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                {campaign.type === "cart_goal" ? "Spending Tiers" : "Quantity Tiers"}
              </Text>
              <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ display: "flex", padding: "10px 16px", fontWeight: "bold", fontSize: "13px", background: "#f5f5f5", borderBottom: "1px solid #e0e0e0" }}>
                  <span style={{ flex: 1 }}>{campaign.type === "cart_goal" ? "Minimum Spend" : "Minimum Quantity"}</span>
                  <span style={{ flex: 1 }}>Discount</span>
                </div>
                {tiers.map((tier: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", padding: "10px 16px", fontSize: "13px", borderBottom: idx < tiers.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <span style={{ flex: 1 }}>
                      {campaign.type === "cart_goal" ? `$${tier.amount || tier.spend}+` : `${tier.quantity || tier.qty}+ items`}
                    </span>
                    <span style={{ flex: 1, color: "#16a34a", fontWeight: "600" }}>
                      {tier.discountType === "fixed_amount" ? `$${tier.discount} off` : `${tier.discount}% off`}
                    </span>
                  </div>
                ))}
              </div>
            </BlockStack>
          </Card>
        )}

        {/* ── Products / Variants / Collections ── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              {campaign.appliesTo === "specific_products" ? "Selected Products & Variants"
                : campaign.appliesTo === "specific_collections" ? "Selected Collections"
                : "Products"}
            </Text>
            <Divider />

            {(campaign.appliesTo === "all" || !campaign.appliesTo) && (
              <Banner tone="info"><p>This discount applies to <strong>all products</strong> in your store.</p></Banner>
            )}

            {campaign.appliesTo === "specific_products" && displayProducts.length === 0 && (
              <Banner tone="warning">
                <p>This discount applies to <strong>specific products</strong>, but product details could not be loaded.</p>
              </Banner>
            )}

            {campaign.appliesTo === "specific_products" && displayProducts.length > 0 && (
              <BlockStack gap="300">
                {displayProducts.map((product: any) => (
                  <Box key={product.id} background="bg-surface-secondary" borderRadius="200" padding="400">
                    <BlockStack gap="300">
                      <InlineStack gap="300" blockAlign="center">
                        {product.image
                          ? <Thumbnail source={product.image} alt={product.title} size="small" />
                          : <Box width="40px" minHeight="40px" background="bg-surface" borderRadius="100" />}
                        <BlockStack gap="0">
                          <Text as="p" variant="bodyMd" fontWeight="bold">{product.title}</Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {product.selectedVariants === "all"
                              ? `All ${product.variants.length} variants`
                              : `${product.selectedVariants.length} of ${product.variants.length} variants selected`}
                          </Text>
                        </BlockStack>
                        <Badge tone={product.selectedVariants === "all" ? "success" : "info"}>
                          {product.selectedVariants === "all" ? "All variants" : `${product.selectedVariants.length} variant(s)`}
                        </Badge>
                      </InlineStack>

                      {product.selectedVariants === "all" ? (
                        (product.variants || []).length > 0 ? (
                          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                            <Text as="p" variant="bodySm" tone="subdued" fontWeight="semibold">All variants included:</Text>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "8px" }}>
                              {(product.variants || []).slice(0, 10).map((v: any) => (
                                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                                  <span>{v.title}</span>
                                  {v.price && <span style={{ color: "#6b7280", marginLeft: "auto" }}>${v.price}</span>}
                                </div>
                              ))}
                              {(product.variants || []).length > 10 && (
                                <Text as="p" variant="bodySm" tone="subdued">+{(product.variants || []).length - 10} more</Text>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "10px" }}>
                            <Text as="p" variant="bodySm" tone="subdued">Applies to all variants of this product</Text>
                          </div>
                        )
                      ) : (
                        Array.isArray(product.selectedVariants) && product.selectedVariants.length > 0 ? (
                          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                            <Text as="p" variant="bodySm" tone="subdued" fontWeight="semibold">Selected variants only:</Text>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "8px" }}>
                              {(product.selectedVariants as any[]).map((v: any) => (
                                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                                  <span>{v.title}</span>
                                  {v.price && <span style={{ color: "#6b7280", marginLeft: "auto" }}>${v.price}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "10px" }}>
                            <Text as="p" variant="bodySm" tone="subdued">Applies to all variants of this product</Text>
                          </div>
                        )
                      )}
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>
            )}

            {campaign.appliesTo === "specific_collections" && collectionNames.length > 0 && (
              <BlockStack gap="200">
                {collectionNames.map((name, idx) => (
                  <InlineStack key={idx} gap="200" blockAlign="center">
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6366F1" }} />
                    <Text as="span" variant="bodyMd">{name}</Text>
                  </InlineStack>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {/* ── Discount Popup summary ── */}
        {campaign.type === "advanced_discount_code" && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Discount Popup</Text>
              <InlineStack gap="400" wrap>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Status</Text>
                  {(campaign as any).popupEnabled
                    ? <Badge tone="success">Enabled</Badge>
                    : <Badge tone="critical">Disabled</Badge>}
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Shows after</Text>
                  <Text as="p" variant="bodyMd">
                    {(campaign as any).popupDelaySeconds == null
                      ? "Theme default"
                      : `${(campaign as any).popupDelaySeconds} seconds`}
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Re-show after closing</Text>
                  <Text as="p" variant="bodyMd">
                    {(campaign as any).popupFrequencyValue ?? 24} {(campaign as any).popupFrequencyUnit ?? "hours"}
                  </Text>
                </BlockStack>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Heading</Text>
                  <Text as="p" variant="bodyMd">{(campaign as any).popupHeading || "—"}</Text>
                </BlockStack>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* ── Popup email signups ── */}
        {campaign.type === "advanced_discount_code" && (campaign as any).popupEnabled && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Popup email signups</Text>
                <Badge tone="info">{emailSignups.length} signups</Badge>
              </InlineStack>
              {emailSignups.length === 0 ? (
                <Banner tone="info">
                  <p>No signups yet. When shoppers submit their email in the storefront popup, they'll appear here.</p>
                </Banner>
              ) : (
                <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ display: "flex", padding: "10px 16px", fontWeight: "bold", fontSize: "13px", background: "#f5f5f5", borderBottom: "1px solid #e0e0e0" }}>
                    <span style={{ flex: 3 }}>Email</span>
                    <span style={{ flex: 2 }}>Signed up</span>
                  </div>
                  {emailSignups.map((s: any, idx: number) => (
                    <div key={s.id} style={{ display: "flex", padding: "10px 16px", fontSize: "13px", borderBottom: idx < emailSignups.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                      <span style={{ flex: 3 }}>{s.email}</span>
                      <span style={{ flex: 2, color: "#666" }}>{s.createdAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </BlockStack>
          </Card>
        )}

        {/* ── Shopify Discounts ── */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Shopify Store Discounts</Text>
            {shopifyDiscounts.length > 0 ? (
              <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ display: "flex", padding: "10px 16px", fontWeight: "bold", fontSize: "13px", background: "#f5f5f5", borderBottom: "1px solid #e0e0e0" }}>
                  <span style={{ flex: 2 }}>Discount Name</span>
                  <span style={{ flex: 1 }}>Type</span>
                  <span style={{ flex: 1 }}>Status</span>
                  {shopifyDiscounts.some((d: any) => d.code) && <span style={{ flex: 1 }}>Code</span>}
                </div>
                {shopifyDiscounts.map((d: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", padding: "10px 16px", fontSize: "13px", borderBottom: idx < shopifyDiscounts.length - 1 ? "1px solid #f0f0f0" : "none", alignItems: "center" }}>
                    <span style={{ flex: 2, fontWeight: "600" }}>{d.title}</span>
                    <span style={{ flex: 1, fontSize: "12px", color: "#666" }}>
                      {(d.type || "").replace("Discount", "").replace("Automatic", "Auto ").replace("Code", "Code ")}
                    </span>
                    <span style={{ flex: 1 }}>{getStatusBadge(d.status)}</span>
                    {shopifyDiscounts.some((dd: any) => dd.code) && (
                      <span style={{ flex: 1 }}>{d.code ? <Badge>{d.code}</Badge> : "—"}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Banner tone="warning">
                <p>No matching discounts found on Shopify. The discount may have been deleted from the store.</p>
              </Banner>
            )}
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}