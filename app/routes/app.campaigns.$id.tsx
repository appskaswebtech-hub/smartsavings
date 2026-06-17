import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page, Card, Text, BlockStack, InlineStack, Badge, Box, Divider,
  InlineGrid, Banner, Thumbnail,
} from "@shopify/polaris";
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

  // ── Resolve products AND variants ──────────────────────────────────
  type ProductEntry = {
    id: string; title: string; image: string | null;
    variants: { id: string; title: string; price: string; sku: string }[];
    selectedVariants: "all" | { id: string; title: string; price: string; sku: string }[];
  };

  let productEntries: ProductEntry[] = [];
  let collectionNames: string[] = [];

  // Derive effective appliesTo: productIds/collectionIds take priority
  // over the stored appliesTo field (legacy campaigns may have wrong appliesTo).
  const hasProductIds = !!campaign.productIds && campaign.productIds !== "[]";
  const hasCollectionIds = !!campaign.collectionIds && campaign.collectionIds !== "[]";
  const effectiveAppliesTo =
    hasProductIds     ? "specific_products" :
    hasCollectionIds  ? "specific_collections" :
    campaign.appliesTo || "all";

  if (effectiveAppliesTo === "specific_products" && campaign.productIds) {
    try {
      const ids = JSON.parse(campaign.productIds) as string[];

      // Separate product GIDs from variant GIDs
      const productGids = ids.filter(id => id.includes("/Product/") && !id.includes("/ProductVariant/"));
      const variantGids = ids.filter(id => id.includes("/ProductVariant/"));

      // ── Fetch products (all-variant selections) ──
      if (productGids.length > 0) {
        const q = productGids.slice(0, 20).map((id, i) =>
          `p${i}: product(id: "${id}") {
            id title
            featuredImage { url }
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

      // ── Fetch specific variants ──
      if (variantGids.length > 0) {
        const q = variantGids.slice(0, 50).map((id, i) =>
          `v${i}: productVariant(id: "${id}") {
            id title price sku
            product { id title featuredImage { url } }
          }`
        ).join("\n");
        const res = await admin.graphql(`#graphql query { ${q} }`);
        const result = await res.json();

        // Group by parent product
        const byProduct = new Map<string, ProductEntry>();
        for (const v of Object.values(result.data || {}) as any[]) {
          if (!v?.title || !v?.product) continue;
          const pid = v.product.id;
          if (!byProduct.has(pid)) {
            byProduct.set(pid, {
              id: pid, title: v.product.title,
              image: v.product.featuredImage?.url || null,
              variants: [],
              selectedVariants: [],
            });
          }
          (byProduct.get(pid)!.selectedVariants as any[]).push({
            id: v.id, title: v.title,
            price: v.price, sku: v.sku || "",
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

  // Parse tiers
  let tiers: any[] = [];
  if (campaign.tiers) { try { tiers = JSON.parse(campaign.tiers); } catch {} }

  // Shopify discount status + product data from the actual Shopify discount
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
                      products(first: 20) {
                        nodes { id title featuredImage { url } }
                      }
                      productVariants(first: 50) {
                        nodes {
                          id title
                          product { id title featuredImage { url } }
                        }
                      }
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
                      products(first: 20) {
                        nodes { id title featuredImage { url } }
                      }
                      productVariants(first: 50) {
                        nodes {
                          id title
                          product { id title featuredImage { url } }
                        }
                      }
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
                      products(first: 20) {
                        nodes { id title featuredImage { url } }
                      }
                      productVariants(first: 50) {
                        nodes {
                          id title
                          product { id title featuredImage { url } }
                        }
                      }
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

    // ── Extract product data from Shopify discount items ──
    // This is the source of truth when productIds is null in our DB.
    if (productEntries.length === 0) {
      const productMap = new Map<string, typeof shopifyProducts[0]>();
      const variantsByProduct = new Map<string, { id: string; title: string }[]>();

      for (const node of matchingNodes) {
        // Check both customerBuys.items (BxGy) and customerGets.items (Basic/Code discounts)
        // BxGy: products are in customerBuys (what customer must buy)
        // Basic: products are in customerGets (what customer receives the discount on)
        const itemSources = [
          node.discount?.customerBuys?.items,
          node.discount?.customerGets?.items,
        ].filter(Boolean);

        for (const items of itemSources) {
          if (!items) continue;

          // All-products discount — skip
          if (items.allItems === true) continue;

          // Specific products
          for (const p of items.products?.nodes || []) {
            if (!productMap.has(p.id)) {
              productMap.set(p.id, { id: p.id, title: p.title, image: p.featuredImage?.url || null });
            }
          }

          // Specific variants — group by parent product
          for (const v of items.productVariants?.nodes || []) {
            const pid = v.product?.id;
            if (!pid) continue;
            if (!productMap.has(pid)) {
              productMap.set(pid, { id: pid, title: v.product.title, image: v.product.featuredImage?.url || null });
            }
            if (!variantsByProduct.has(pid)) variantsByProduct.set(pid, []);
            variantsByProduct.get(pid)!.push({ id: v.id, title: v.title });
          }
        } // end itemSources loop
      } // end matchingNodes loop

      // Build shopifyProducts — normalized to match productEntries shape
      for (const [pid, product] of productMap.entries()) {
        const specificVariants = variantsByProduct.get(pid);
        shopifyProducts.push({
          ...product,
          // variants = specific variants selected, or empty when whole product is selected
          variants: [],
          // selectedVariants: "all" when whole product is targeted,
          // or array of specific variants when individual variants are targeted
          selectedVariants: specificVariants && specificVariants.length > 0
            ? specificVariants
            : "all" as const,
        });
      }
    }
  } catch {}

  return json({
    campaign: {
      ...campaign,
      appliesTo: effectiveAppliesTo,
      startDate: campaign.startDate ? new Date(campaign.startDate).toLocaleString() : null,
      endDate: campaign.endDate ? new Date(campaign.endDate).toLocaleString() : null,
      createdAt: new Date(campaign.createdAt).toLocaleString(),
      updatedAt: new Date(campaign.updatedAt).toLocaleString(),
    },
    tiers,
    productEntries,
    shopifyProducts,     // products fetched directly from Shopify discount
    collectionNames,
    shopifyDiscounts,
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
  const { campaign, tiers, productEntries, shopifyProducts, collectionNames, shopifyDiscounts } = useLoaderData<typeof loader>();

  // Use DB products if available, otherwise fall back to Shopify-fetched products
  const displayProducts = productEntries.length > 0 ? productEntries : shopifyProducts;
  const navigate = useNavigate();

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
    if (discountType === "free_shipping") return "Free Shipping";
    if (discountType === "percentage") return `${discountValue}% off`;
    if (discountType === "fixed_amount") return `$${discountValue} off`;
    if (tiers.length > 0) return `${tiers.length} tiers`;
    return String(discountValue || "—");
  };

  return (
    <Page
      backAction={{ content: "Campaigns", url: "/app/campaigns" }}
      title={campaign.name}
      titleMetadata={getStatusBadge(campaign.status)}
      primaryAction={{
        content: campaign.status === "active" ? "Pause" : "Activate",
        onAction: () => {
          const fd = new FormData();
          fd.append("action", "toggle_status");
          fd.append("campaignId", campaign.id);
          fetch("/app/campaigns", { method: "POST", body: fd })
            .then(() => window.location.reload());
        },
      }}
      secondaryActions={[{
        content: "Delete", destructive: true,
        onAction: () => {
          if (confirm("Delete this campaign from both the app and Shopify store?")) {
            const fd = new FormData();
            fd.append("action", "delete");
            fd.append("campaignId", campaign.id);
            fetch("/app/campaigns", { method: "POST", body: fd })
              .then(() => navigate("/app/campaigns"));
          }
        },
      }]}
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
                  {DISCOUNT_TYPE_LABELS[campaign.discountType] || campaign.discountType}
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
                    : campaign.appliesTo === "specific_products"
                    ? "Specific products"
                    : campaign.appliesTo === "specific_collections" && collectionNames.length > 0
                    ? `${collectionNames.length} specific collection(s)`
                    : campaign.appliesTo === "specific_collections"
                    ? "Specific collections"
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
                    <span style={{ flex: 1, color: "#16a34a", fontWeight: "600" }}>{tier.discount}% off</span>
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
              {campaign.appliesTo === "specific_products"
                ? "Selected Products & Variants"
                : campaign.appliesTo === "specific_collections"
                ? "Selected Collections"
                : "Products"}
            </Text>
            <Divider />

            {(campaign.appliesTo === "all" || !campaign.appliesTo) && (
              <Banner tone="info">
                <p>This discount applies to <strong>all products</strong> in your store.</p>
              </Banner>
            )}

            {/* Specific products — but no product details available even from Shopify */}
            {campaign.appliesTo === "specific_products" && displayProducts.length === 0 && (
              <Banner tone="warning">
                <p>
                  This discount applies to <strong>specific products</strong>, but product details
                  could not be loaded. The selected products may have been deleted from your store.
                </p>
              </Banner>
            )}

            {/* Products with variant breakdown */}
            {campaign.appliesTo === "specific_products" && displayProducts.length > 0 && (
              <BlockStack gap="300">
                {displayProducts.map((product: any) => (
                  <Box key={product.id} background="bg-surface-secondary" borderRadius="200" padding="400">
                    <BlockStack gap="300">
                      {/* Product header */}
                      <InlineStack gap="300" blockAlign="center">
                        {product.image
                          ? <Thumbnail source={product.image} alt={product.title} size="small" />
                          : <Box width="40px" minHeight="40px" background="bg-surface" borderRadius="100" />
                        }
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

                      {/* Variant list */}
                      {product.selectedVariants === "all" ? (
                        (product.variants || []).length > 0 ? (
                          /* Show all variants when available */
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
                        /* Show only selected variants */
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

            {/* Collections */}
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