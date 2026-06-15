import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page, Card, Text, BlockStack, InlineStack, Badge, Box, Divider, InlineGrid, Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;
  const campaignId = params.id;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign || campaign.shop !== shop) {
    throw new Response("Campaign not found", { status: 404 });
  }

  // Resolve product names
  let productNames: string[] = [];
  if (campaign.appliesTo === "specific_products" && campaign.productIds) {
    try {
      const ids = JSON.parse(campaign.productIds) as string[];
      if (ids.length > 0) {
        const queries = ids.slice(0, 20).map((id, i) => `p${i}: product(id: "${id}") { title handle featuredImage { url } }`).join("\n");
        const res = await admin.graphql(`#graphql query { ${queries} }`);
        const result = await res.json();
        productNames = Object.values(result.data || {})
          .filter((p: any) => p?.title)
          .map((p: any) => p.title);
      }
    } catch {}
  }

  // Resolve collection names
  let collectionNames: string[] = [];
  if (campaign.appliesTo === "specific_collections" && campaign.collectionIds) {
    try {
      const ids = JSON.parse(campaign.collectionIds) as string[];
      if (ids.length > 0) {
        const queries = ids.slice(0, 20).map((id, i) => `c${i}: collection(id: "${id}") { title handle }`).join("\n");
        const res = await admin.graphql(`#graphql query { ${queries} }`);
        const result = await res.json();
        collectionNames = Object.values(result.data || {})
          .filter((c: any) => c?.title)
          .map((c: any) => c.title);
      }
    } catch {}
  }

  // Parse tiers
  let tiers: any[] = [];
  if (campaign.tiers) {
    try { tiers = JSON.parse(campaign.tiers); } catch {}
  }

  // Check Shopify discount status
  let shopifyDiscounts: any[] = [];
  try {
    const allRes = await admin.graphql(
      `#graphql
      query {
        discountNodes(first: 100) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticBasic { title status startsAt endsAt }
              ... on DiscountAutomaticBxgy { title status startsAt endsAt }
              ... on DiscountAutomaticFreeShipping { title status startsAt endsAt }
              ... on DiscountCodeBasic { title status startsAt endsAt codes(first:1) { nodes { code } } }
              ... on DiscountCodeFreeShipping { title status startsAt endsAt codes(first:1) { nodes { code } } }
            }
          }
        }
      }`
    );
    const allResult = await allRes.json();
    const allNodes = allResult.data?.discountNodes?.nodes || [];
    shopifyDiscounts = allNodes.filter((n: any) => {
      const title = n.discount?.title || "";
      return title === campaign.name || title.startsWith(campaign.name + " (") || title.startsWith(campaign.name + " - ");
    }).map((n: any) => ({
      id: n.id,
      title: n.discount?.title,
      status: n.discount?.status,
      type: n.discount?.__typename,
      code: n.discount?.codes?.nodes?.[0]?.code || null,
    }));
  } catch {}

  return json({
    campaign: {
      ...campaign,
      startDate: campaign.startDate ? new Date(campaign.startDate).toLocaleString() : null,
      endDate: campaign.endDate ? new Date(campaign.endDate).toLocaleString() : null,
      createdAt: new Date(campaign.createdAt).toLocaleString(),
      updatedAt: new Date(campaign.updatedAt).toLocaleString(),
    },
    tiers,
    productNames,
    collectionNames,
    shopifyDiscounts,
  });
};

const TYPE_LABELS: Record<string, string> = {
  bulk_price: "Bulk Price Editor",
  quantity_discount: "Quantity Discount",
  buy_x_get_y: "Buy X Get Y",
  advanced_discount_code: "Advanced Discount Code",
  cart_goal: "Cart Goal",
  shipping_discount: "Shipping Discount",
};

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percentage: "Percentage",
  fixed_amount: "Fixed Amount",
  free_shipping: "Free Shipping",
  free: "Free",
};

export default function CampaignDetail() {
  const { campaign, tiers, productNames, collectionNames, shopifyDiscounts } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const getStatusBadge = (s: string) => {
    const map: Record<string, any> = {
      active: <Badge tone="success">Active</Badge>,
      scheduled: <Badge tone="info">Scheduled</Badge>,
      expired: <Badge>Expired</Badge>,
      paused: <Badge tone="warning">Paused</Badge>,
      ACTIVE: <Badge tone="success">Active</Badge>,
      EXPIRED: <Badge>Expired</Badge>,
      SCHEDULED: <Badge tone="info">Scheduled</Badge>,
    };
    return map[s] || <Badge>{s}</Badge>;
  };

  return (
    <Page
      backAction={{ content: "Campaigns", url: "/app/campaigns" }}
      title={campaign.name}
      titleMetadata={getStatusBadge(campaign.status)}
      secondaryActions={[
        { content: "Delete", destructive: true, onAction: () => {
          if (confirm("Delete this campaign from both the app and Shopify store?")) {
            const fd = new FormData();
            fd.append("action", "delete");
            fd.append("campaignId", campaign.id);
            fetch("/app/campaigns", { method: "POST", body: fd }).then(() => navigate("/app/campaigns"));
          }
        }},
      ]}
      primaryAction={{
        content: campaign.status === "active" ? "Pause" : "Activate",
        onAction: () => {
          const fd = new FormData();
          fd.append("action", "toggle_status");
          fd.append("campaignId", campaign.id);
          fetch("/app/campaigns", { method: "POST", body: fd }).then(() => window.location.reload());
        },
      }}
    >
      <BlockStack gap="400">
        {/* Overview */}
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
                <Text as="span" variant="bodyMd">{DISCOUNT_TYPE_LABELS[campaign.discountType] || campaign.discountType}</Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Discount Value</Text>
                <Text as="span" variant="bodyMd">
                  {campaign.discountType === "free_shipping" ? "Free Shipping" :
                   campaign.discountType === "percentage" ? `${campaign.discountValue}%` :
                   `$${campaign.discountValue}`}
                </Text>
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Status</Text>
                {getStatusBadge(campaign.status)}
              </BlockStack>
              <BlockStack gap="200">
                <Text as="span" variant="bodySm" tone="subdued">Applies To</Text>
                <Text as="span" variant="bodyMd">
                  {campaign.appliesTo === "all" ? "All products" :
                   campaign.appliesTo === "specific_products" ? `${productNames.length} specific product(s)` :
                   campaign.appliesTo === "specific_collections" ? `${collectionNames.length} specific collection(s)` :
                   campaign.appliesTo}
                </Text>
              </BlockStack>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* Schedule */}
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

        {/* Tiers */}
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
                      {campaign.type === "cart_goal"
                        ? `$${tier.amount || tier.spend}+`
                        : `${tier.quantity || tier.qty}+ items`}
                    </span>
                    <span style={{ flex: 1, color: "#10B981", fontWeight: "600" }}>
                      {tier.discount}% off
                    </span>
                  </div>
                ))}
              </div>
            </BlockStack>
          </Card>
        )}

        {/* Products / Collections */}
        {(productNames.length > 0 || collectionNames.length > 0) && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                {productNames.length > 0 ? "Selected Products" : "Selected Collections"}
              </Text>
              <BlockStack gap="200">
                {productNames.map((name, idx) => (
                  <InlineStack key={idx} gap="200" blockAlign="center">
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
                    <Text as="span" variant="bodyMd">{name}</Text>
                  </InlineStack>
                ))}
                {collectionNames.map((name, idx) => (
                  <InlineStack key={idx} gap="200" blockAlign="center">
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6366F1" }} />
                    <Text as="span" variant="bodyMd">{name}</Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        )}

        {campaign.appliesTo === "all" && (
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">Products</Text>
              <Banner tone="info">
                <p>This discount applies to all products in your store.</p>
              </Banner>
            </BlockStack>
          </Card>
        )}

        {/* Shopify Discounts */}
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
                      <span style={{ flex: 1 }}>
                        {d.code ? <Badge>{d.code}</Badge> : "—"}
                      </span>
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