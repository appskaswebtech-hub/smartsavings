import { useState } from "react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  EmptyState,
  Badge,
  Button,
  Modal,
  DataTable,
  Divider,
  Box,
  Grid,
  Thumbnail,
  Icon,
  Tooltip,
  Filters,
  ChoiceList,
  Spinner,
} from "@shopify/polaris";
import {
  DeleteIcon,
  ViewIcon,
  ProductIcon,
  DiscountIcon,
  DeliveryIcon,
  OrderIcon,
  ChartVerticalIcon,
} from "@shopify/polaris-icons";

import { authenticate } from "../shopify.server";
import db from "../db.server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsRecord {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignType: string;
  campaignStatus: string;
  discountType: string;
  discountValue: number | null;
  startDate: string | null;
  endDate: string | null;
  appliesTo: string;
  productIds: string | null;
  collectionIds: string | null;
  totalOrders: number;
  totalRevenue: number;
  totalDiscountGiven: number;
  totalFreeShipping: number;
  totalItemsDiscounted: number;
  averageOrderValue: number;
  conversionRate: number;
  tierBreakdown: string | null;
  bxgyBreakdown: string | null;
  shippingBreakdown: string | null;
  topProducts: string | null;
  shopifyDiscountId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function campaignTypeLabel(type: string) {
  const labels: Record<string, string> = {
    quantity_discount: "Quantity Discount",
    bulk_price: "Bulk Price",
    cart_goal: "Cart Goal",
    buy_x_get_y: "Buy X Get Y",
    shipping_discount: "Shipping Discount",
    shipping_protection: "Shipping Protection",
  };
  return labels[type] ?? type;
}

function campaignTypeBadge(type: string): "info" | "success" | "warning" | "attention" | "new" {
  const tones: Record<string, "info" | "success" | "warning" | "attention" | "new"> = {
    quantity_discount: "info",
    bulk_price: "new",
    cart_goal: "success",
    buy_x_get_y: "attention",
    shipping_discount: "warning",
  };
  return tones[type] ?? "info";
}

function statusBadge(status: string): "success" | "warning" | "critical" | "info" {
  const tones: Record<string, "success" | "warning" | "critical" | "info"> = {
    active: "success",
    scheduled: "info",
    paused: "warning",
    expired: "critical",
    deleted: "critical",
    draft: "info",
  };
  return tones[status] ?? "info";
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function discountLabel(record: AnalyticsRecord) {
  if (record.discountType === "free_shipping") return "Free Shipping";
  if (record.discountType === "percentage") return `${record.discountValue ?? 0}% off`;
  if (record.discountType === "fixed_amount") return `${formatCurrency(record.discountValue ?? 0)} off`;
  return "—";
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  // Fetch all non-deleted analytics records for this shop
  const analytics = await db.campaignAnalytics.findMany({
    where: { shop, isDeleted: false },
    orderBy: { updatedAt: "desc" },
  });

  // Also snapshot any active campaigns that don't have an analytics record yet
  const campaigns = await db.campaign.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  // Upsert analytics records for campaigns that don't have one
  for (const campaign of campaigns) {
    const existing = analytics.find((a) => a.campaignId === campaign.id);
    if (!existing) {
      await db.campaignAnalytics.create({
        data: {
          shop,
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignType: campaign.type,
          campaignStatus: campaign.status,
          discountType: campaign.discountType,
          discountValue: campaign.discountValue,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          appliesTo: campaign.appliesTo,
          productIds: campaign.productIds,
          collectionIds: campaign.collectionIds,
          shopifyDiscountId: campaign.shopifyDiscountId,
          // Real metrics would come from Shopify Orders API
          // These are placeholder values — wire up Shopify Orders API for real data
          totalOrders: 0,
          totalRevenue: 0,
          totalDiscountGiven: 0,
          totalFreeShipping: 0,
          totalItemsDiscounted: 0,
          averageOrderValue: 0,
          conversionRate: 0,
        },
      });
    } else {
      // Update snapshot fields in case campaign was edited
      await db.campaignAnalytics.update({
        where: { id: existing.id },
        data: {
          campaignName: campaign.name,
          campaignStatus: campaign.status,
          discountType: campaign.discountType,
          discountValue: campaign.discountValue,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          appliesTo: campaign.appliesTo,
          productIds: campaign.productIds,
          collectionIds: campaign.collectionIds,
          shopifyDiscountId: campaign.shopifyDiscountId,
        },
      });
    }
  }

  // Re-fetch updated analytics
  const updatedAnalytics = await db.campaignAnalytics.findMany({
    where: { shop, isDeleted: false },
    orderBy: { updatedAt: "desc" },
  });

  // Summary stats
  const totalDiscountGiven = updatedAnalytics.reduce((s, a) => s + a.totalDiscountGiven, 0);
  const totalFreeShipping = updatedAnalytics.reduce((s, a) => s + a.totalFreeShipping, 0);
  const totalOrders = updatedAnalytics.reduce((s, a) => s + a.totalOrders, 0);
  const totalRevenue = updatedAnalytics.reduce((s, a) => s + a.totalRevenue, 0);

  return json({
    analytics: updatedAnalytics.map((a) => ({
      ...a,
      startDate: a.startDate?.toISOString() ?? null,
      endDate: a.endDate?.toISOString() ?? null,
      deletedAt: a.deletedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    summary: { totalDiscountGiven, totalFreeShipping, totalOrders, totalRevenue },
  });
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const analyticsId = formData.get("analyticsId") as string;

  if (intent === "delete") {
    await db.campaignAnalytics.update({
      where: { id: analyticsId, shop },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    return json({ success: true });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType;
  color: string;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200" align="start" blockAlign="center">
          <div className="ss-analytics__div-row"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div className="ss-analytics__div-row-2" style={{ color: "#fff", display: "flex" }}>
              <Icon source={icon} />
            </div>
          </div>
          <Text as="p" variant="bodySm" tone="subdued">
            {label}
          </Text>
        </InlineStack>
        <Text as="p" variant="headingLg" fontWeight="bold">
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}

// ─── Analytics Detail Modal ───────────────────────────────────────────────────

function AnalyticsModal({
  record,
  open,
  onClose,
}: {
  record: AnalyticsRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!record) return null;

  const products: Array<{ id: string; title: string; image?: string }> = record.productIds
    ? JSON.parse(record.productIds)
    : [];

  const collections: Array<{ id: string; title: string }> = record.collectionIds
    ? JSON.parse(record.collectionIds)
    : [];

  const topProducts: Array<{
    productId: string;
    title: string;
    ordersCount: number;
    discountTotal: number;
  }> = record.topProducts ? JSON.parse(record.topProducts) : [];

  const tiers: Array<{ qty: number; discount: number; usageCount: number }> = record.tierBreakdown
    ? JSON.parse(record.tierBreakdown)
    : [];

  const bxgy: { buyQty: number; getQty: number; usageCount: number; freeItemsGiven: number } | null =
    record.bxgyBreakdown ? JSON.parse(record.bxgyBreakdown) : null;

  const shipping: { domestic: number; international: number; totalOrders: number } | null =
    record.shippingBreakdown ? JSON.parse(record.shippingBreakdown) : null;

  return (
    <>
      <style>{customizationStyles}</style>
      <Modal
        open={open}
        onClose={onClose}
        title={`Analytics — ${record.campaignName}`}
        size="large"
        primaryAction={{ content: "Close", onAction: onClose }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {/* Campaign Info */}
            <InlineStack gap="200" wrap>
              <Badge tone={campaignTypeBadge(record.campaignType)}>
                {campaignTypeLabel(record.campaignType)}
              </Badge>
              <Badge tone={statusBadge(record.campaignStatus)}>
                {record.campaignStatus.charAt(0).toUpperCase() + record.campaignStatus.slice(1)}
              </Badge>
              <Text as="span" variant="bodySm" tone="subdued">
                {formatDate(record.startDate)} → {formatDate(record.endDate)}
              </Text>
            </InlineStack>

            <Divider />

            {/* Performance Metrics */}
            <Text as="h3" variant="headingMd">Performance Metrics</Text>
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                <Card>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Total Orders</Text>
                    <Text as="p" variant="headingMd" fontWeight="bold">{record.totalOrders}</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                <Card>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Total Revenue</Text>
                    <Text as="p" variant="headingMd" fontWeight="bold">{formatCurrency(record.totalRevenue)}</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                <Card>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Discount Given</Text>
                    <Text as="p" variant="headingMd" fontWeight="bold">{formatCurrency(record.totalDiscountGiven)}</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                <Card>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Avg Order Value</Text>
                    <Text as="p" variant="headingMd" fontWeight="bold">{formatCurrency(record.averageOrderValue)}</Text>
                  </BlockStack>
                </Card>
              </Grid.Cell>
            </Grid>

            {/* Discount Details */}
            <Divider />
            <Text as="h3" variant="headingMd">Discount Details</Text>
            <Card>
              <BlockStack gap="200">
                <InlineStack gap="400" wrap>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Discount Type</Text>
                    <Text as="p" variant="bodyMd">{discountLabel(record)}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Applies To</Text>
                    <Text as="p" variant="bodyMd" textDecorationLine="none">
                      {record.appliesTo === "all"
                        ? "All products"
                        : record.appliesTo === "specific_products"
                          ? `${products.length} product(s)`
                          : `${collections.length} collection(s)`}
                    </Text>
                  </BlockStack>
                  {record.discountType === "free_shipping" && (
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Free Shipping Value</Text>
                      <Text as="p" variant="bodyMd">{formatCurrency(record.totalFreeShipping)}</Text>
                    </BlockStack>
                  )}
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Items Discounted</Text>
                    <Text as="p" variant="bodyMd">{record.totalItemsDiscounted}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">Conversion Rate</Text>
                    <Text as="p" variant="bodyMd">{record.conversionRate.toFixed(1)}%</Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Products Applied To */}
            {products.length > 0 && (
              <>
                <Divider />
                <Text as="h3" variant="headingMd">Products Applied To</Text>
                <Card>
                  <BlockStack gap="300">
                    {products.map((p) => (
                      <InlineStack key={p.id} gap="300" align="start" blockAlign="center">
                        <Thumbnail
                          source={p.image ?? ProductIcon}
                          alt={p.title}
                          size="small"
                        />
                        <Text as="p" variant="bodyMd">{p.title}</Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </Card>
              </>
            )}

            {/* Collections */}
            {collections.length > 0 && (
              <>
                <Divider />
                <Text as="h3" variant="headingMd">Collections Applied To</Text>
                <Card>
                  <BlockStack gap="200">
                    {collections.map((c) => (
                      <Text key={c.id} as="p" variant="bodyMd">• {c.title}</Text>
                    ))}
                  </BlockStack>
                </Card>
              </>
            )}

            {/* Tier Breakdown */}
            {tiers.length > 0 && (
              <>
                <Divider />
                <Text as="h3" variant="headingMd">Tier Breakdown</Text>
                <DataTable
                  columnContentTypes={["text", "text", "numeric"]}
                  headings={["Min Quantity", "Discount", "Times Used"]}
                  rows={tiers.map((t) => [
                    `${t.qty}+ items`,
                    record.discountType === "percentage" ? `${t.discount}%` : formatCurrency(t.discount),
                    t.usageCount.toString(),
                  ])}
                />
              </>
            )}

            {/* Buy X Get Y Breakdown */}
            {bxgy && (
              <>
                <Divider />
                <Text as="h3" variant="headingMd">Buy X Get Y Breakdown</Text>
                <Card>
                  <InlineStack gap="400" wrap>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Buy Quantity</Text>
                      <Text as="p" variant="bodyMd">{bxgy.buyQty}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Get Quantity</Text>
                      <Text as="p" variant="bodyMd">{bxgy.getQty}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Times Used</Text>
                      <Text as="p" variant="bodyMd">{bxgy.usageCount}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Free Items Given</Text>
                      <Text as="p" variant="bodyMd">{bxgy.freeItemsGiven}</Text>
                    </BlockStack>
                  </InlineStack>
                </Card>
              </>
            )}

            {/* Shipping Discount Breakdown */}
            {shipping && (
              <>
                <Divider />
                <Text as="h3" variant="headingMd">Shipping Discount Breakdown</Text>
                <Card>
                  <InlineStack gap="400" wrap>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Domestic Orders</Text>
                      <Text as="p" variant="bodyMd">{shipping.domestic}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">International Orders</Text>
                      <Text as="p" variant="bodyMd">{shipping.international}</Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">Total Shipping Waived</Text>
                      <Text as="p" variant="bodyMd">{formatCurrency(record.totalFreeShipping)}</Text>
                    </BlockStack>
                  </InlineStack>
                </Card>
              </>
            )}

            {/* Top Products by Usage */}
            {topProducts.length > 0 && (
              <>
                <Divider />
                <Text as="h3" variant="headingMd">Top Products by Discount Usage</Text>
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric"]}
                  headings={["Product", "Orders", "Discount Total"]}
                  rows={topProducts.map((p) => [
                    p.title,
                    p.ordersCount.toString(),
                    formatCurrency(p.discountTotal),
                  ])}
                />
              </>
            )}

            {/* Metadata */}
            <Divider />
            <InlineStack gap="400" wrap>
              <Text as="p" variant="bodySm" tone="subdued">
                First tracked: {formatDate(record.createdAt)}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Last updated: {formatDate(record.updatedAt)}
              </Text>
              {record.shopifyDiscountId && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Shopify ID: {record.shopifyDiscountId}
                </Text>
              )}
            </InlineStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}

// ─── Analytics Page ───────────────────────────────────────────────────────────

export default function Analytics() {
  const { analytics, summary } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AnalyticsRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const isDeleting = fetcher.state !== "idle";

  function handleView(record: AnalyticsRecord) {
    setSelectedRecord(record);
    setModalOpen(true);
  }

  function handleDeleteConfirm(id: string) {
    setDeleteConfirmId(id);
  }

  function handleDelete() {
    if (!deleteConfirmId) return;
    fetcher.submit(
      { intent: "delete", analyticsId: deleteConfirmId },
      { method: "POST" }
    );
    setDeleteConfirmId(null);
  }

  // Filter analytics
  const filtered = analytics.filter((a) => {
    if (typeFilter.length > 0 && !typeFilter.includes(a.campaignType)) return false;
    if (statusFilter.length > 0 && !statusFilter.includes(a.campaignStatus)) return false;
    return true;
  });

  return (
    <>
      <style>{`
    body {
    background: radial-gradient(ellipse at 76% 3%, rgba(151, 190, 255, .28) 0, rgba(151, 190, 255, 0) 30%), radial-gradient(ellipse at 87% 100%, rgba(173, 201, 255, .24) 0, rgba(173, 201, 255, 0) 28%), linear-gradient(135deg, #f4f8ff 0%, #edf5ff 52%, #f8fbff 100%);
}
        .Polaris-Page {
          max-width: 1300px !important;
          margin: 0 auto;
        }
/* Page canvas */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) {
  position: relative;
  max-width: 1500px;
  margin: 0 auto;
  padding: 28px 30px 34px;
  isolation: isolate;
  color: #101b3c;
  // background:
  //   radial-gradient(ellipse at 76% 3%, rgba(151, 190, 255, .28) 0, rgba(151, 190, 255, 0) 30%),
  //   radial-gradient(ellipse at 87% 100%, rgba(173, 201, 255, .24) 0, rgba(173, 201, 255, 0) 28%),
  //   linear-gradient(135deg, #f4f8ff 0%, #edf5ff 52%, #f8fbff 100%);
  border-radius: 22px;
  overflow: hidden;
}

.Polaris-Page:has(.ss-analytics__p-order-counts-revenue)::before,
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue)::after {
  content: "";
  position: absolute;
  z-index: -1;
  pointer-events: none;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, .7);
  transform: rotate(-28deg);
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue)::before {
  width: 470px;
  height: 250px;
  top: -120px;
  right: -70px;
  box-shadow: 0 0 0 35px rgba(255,255,255,.12), 0 0 0 75px rgba(255,255,255,.1), 0 0 0 115px rgba(255,255,255,.08);
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue)::after {
  width: 390px;
  height: 180px;
  right: -90px;
  bottom: -105px;
  box-shadow: 0 0 0 32px rgba(255,255,255,.22), 0 0 0 68px rgba(255,255,255,.15);
}

/* Header */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) > .Polaris-Box:first-child {
  padding: 22px 18px 24px !important;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Page-Header__Row {
  align-items: center;
}
  span.Polaris-Text--root.Polaris-Text--bodySm.Polaris-Text--medium {
    font-size: 14px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Header-Title__TitleWithSubtitle {
  color: #101a3b;
  font-size: clamp(28px, 3vw, 30px) !important;
  font-weight: 800;
  letter-spacing: -1.2px;
  line-height: 1.15;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Header-Title__SubTitle {
  margin-top: 8px;
  color: #52658f;
  font-size: 15px;
}

/* Shopify API notice banner */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Banner--withinPage {
  margin: 0 0 16px;
  overflow: hidden;
  border: 1px solid #d7e7ff;
  border-radius: 16px;
  background: linear-gradient(110deg, rgba(224, 238, 255, .96), rgba(244, 249, 255, .98));
  box-shadow: 0 3px 10px rgba(45, 94, 170, .07), inset 0 0 0 3px rgba(255,255,255,.7);
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Banner--withinPage > .Polaris-Box > .Polaris-BlockStack > .Polaris-Box:first-child {
  background: transparent !important;
  color: #0864f7 !important;
  padding: 18px 22px 2px !important;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Banner--withinPage h2 {
  color: #075ef5;
  font-size: 15px;
  font-weight: 700;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .ss-analytics__p-order-counts-revenue {
  margin: 0;
  color: #6880ad;
  font-size: 14px;
  line-height: 1.5;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Banner--withinPage > .Polaris-Box > .Polaris-BlockStack > .Polaris-Box:last-child {
  padding: 4px 22px 20px !important;
}

/* KPI cards */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 0 0 18px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell {
    min-width: 0;
    padding: 0 !important;
    grid-column-end: span 1;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell > .Polaris-ShadowBevel,
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell > .Polaris-ShadowBevel > .Polaris-Box {
  height: 100%;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell > .Polaris-ShadowBevel {
  border: 1px solid #dce9ff;
  border-radius: 16px;
  background: rgba(255,255,255,.92);
  box-shadow: 0 3px 10px rgba(54, 96, 157, .055);
  transition: transform .2s ease, box-shadow .2s ease;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell > .Polaris-ShadowBevel:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(54, 96, 157, .1);
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .Polaris-ShadowBevel .Polaris-Box {
  padding: 18px 19px !important;
  background: transparent !important;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .Polaris-BlockStack {
  gap: 7px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .Polaris-InlineStack {
  gap: 12px;
  align-items: center;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .ss-analytics__div-row {
  width: 46px !important;
  height: 46px !important;
  flex: 0 0 46px;
  border-radius: 12px !important;
  box-shadow: 0 5px 12px rgba(35, 93, 190, .12);
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .ss-analytics__div-row .Polaris-Icon,
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .ss-analytics__div-row svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .Polaris-Text--bodySm {
  color: #40527c;
  font-size: 13px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .Polaris-Text--headingLg {
  color: #101a3c;
  font-size: 27px;
  line-height: 1.15;
  letter-spacing: -.7px;
  font-weight: 800;
}

/* Campaign analytics panel */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) > .Polaris-ShadowBevel {
  overflow: hidden;
  border: 1px solid #dce8ff;
  border-radius: 18px;
  background: rgba(255,255,255,.94);
  box-shadow: 0 4px 12px rgba(54, 96, 157, .055);
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) > .Polaris-ShadowBevel > .Polaris-Box {
  padding: 22px 20px 18px !important;
  background: transparent !important;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) > .Polaris-ShadowBevel h2 {
  color: #111a35;
  font-size: 20px;
  line-height: 1.3;
  font-weight: 750;
  letter-spacing: -.35px;
}

/* Search field and Add filter */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Filters__Container {
  margin: 0 0 16px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Filters__Container > .Polaris-Box {
  padding: 0 !important;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Filters__SearchField {
  flex: 1 1 400px;
  min-width: 180px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-TextField__Input {
  min-height: 42px;
  color: #24365f;

}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-TextField__Input::placeholder {
  color: #8b9cbd;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-TextField__Backdrop {
  border: 1px solid #d4e0f7;
  border-radius: 10px;
  box-shadow: 0 2px 5px rgba(43, 76, 132, .04);
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Filters__AddFilter {
  min-height: 42px;
  padding: 0 14px;
  color: #334a78;
  border: 1px solid #d4e0f7;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 5px rgba(43, 76, 132, .04);
  font-size: 13px;
  transition: background .18s ease, border-color .18s ease;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Filters__AddFilter:hover {
  background: #f2f7ff;
  border-color: #a8c7ff;
}

/* Table */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable__Navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 8px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable {
  overflow: hidden;
  border-radius: 12px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable__ScrollContainer {
  overflow-x: auto;
  border-radius: 12px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable__Table {
  width: 100%;
  min-width: 920px;
  border-collapse: separate;
  border-spacing: 0;
  color: #3d4f78;
  font-size: 13px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable__Cell {
  padding: 14px 12px;
  vertical-align: middle;
  border-bottom: 1px solid #e6edf8;
  background: transparent;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) thead .Polaris-DataTable__Cell--header {
  padding-top: 15px;
  padding-bottom: 15px;
  color: #27395f;
  background: #f2f6fd;
  font-weight: 600;
  white-space: nowrap;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) thead .Polaris-DataTable__Cell--header:first-child {
  border-radius: 10px 0 0 10px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) thead .Polaris-DataTable__Cell--header:last-child {
  border-radius: 0 10px 10px 0;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) tbody tr {
  transition: background .16s ease;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) tbody tr:hover {
  background: #f8fbff;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) tbody tr:last-child .Polaris-DataTable__Cell {
  border-bottom: 0;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable__Cell--firstColumn p:first-child {
  color: #075fff;
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable__Cell--firstColumn p:last-child {
  margin-top: 4px;
  color: #8192b5;
  font-size: 12px;
  white-space: nowrap;
}

/* Type and status badges */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Badge {
  display: inline-flex;
  align-items: center;
  min-height: 29px;
  padding: 5px 10px;
  border: 0;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Badge--toneInfo {
  color: #075fe9;
  background: #e2efff;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Badge--toneSuccess {
  color: #008e68;
  background: #d6faed;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Badge--toneWarning,
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Badge--toneAttention {
  color: #6e24d9;
  background: #f0e4ff;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Badge--toneNew {
  color: #9b4b00;
  background: #fff0df;
}

/* View / delete action buttons */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable__Cell .Polaris-InlineStack {
  flex-wrap: nowrap;
  gap: 7px;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Button--iconOnly {
  min-width: 39px;
  min-height: 39px;
  padding: 8px;
  border: 1px solid #d9e4f8;
  border-radius: 10px;
  color: #334a78;
  background: #fff;
  box-shadow: 0 2px 4px rgba(34, 65, 119, .06);
  transition: transform .16s ease, box-shadow .16s ease;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Button--iconOnly:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(34, 65, 119, .12);
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Button--toneCritical,
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) button[aria-label*="Delete"] {
  color: #f1264b;
  border-color: #ffdce3;
  background: #fff5f7;
}

/* Table scroll controls */
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable__Navigation .Polaris-Button {
  border: 0;
  background: transparent;
  box-shadow: none;
}
.Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-DataTable__Navigation .Polaris-Button svg {
  fill: #304a80;
}

// /* Keyboard accessibility */
// .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) button:focus-visible,
// .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) input:focus-visible {
//   outline: 3px solid rgba(35, 111, 255, .28);
//   outline-offset: 2px;
// }

/* Tablet and mobile */
@media (max-width: 1000px) {
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) {
    padding: 18px 16px 24px;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) > .Polaris-ShadowBevel > .Polaris-Box {
    padding: 18px 14px !important;
  }
}
@media (max-width: 560px) {
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) {
    padding: 10px;
    border-radius: 12px;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) > .Polaris-Box:first-child {
    padding: 16px 6px 18px !important;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Header-Title__TitleWithSubtitle {
    font-size: 29px;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Header-Title__SubTitle {
    font-size: 13px;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid {
    gap: 10px;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .Polaris-ShadowBevel .Polaris-Box {
    padding: 13px !important;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .ss-analytics__div-row {
    width: 38px !important;
    height: 38px !important;
    flex-basis: 38px;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Grid-Cell .Polaris-Text--headingLg {
    font-size: 22px;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Banner--withinPage > .Polaris-Box > .Polaris-BlockStack > .Polaris-Box:first-child {
    padding: 14px 14px 2px !important;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) .Polaris-Banner--withinPage > .Polaris-Box > .Polaris-BlockStack > .Polaris-Box:last-child {
    padding: 4px 14px 15px !important;
  }
  .Polaris-Page:has(.ss-analytics__p-order-counts-revenue) > .Polaris-ShadowBevel h2 {
    font-size: 18px;
  }
}

      `}</style>
      <Page title="Analytics" subtitle="Campaign performance — data is retained even after campaigns are deleted.">
      <BlockStack gap="400">

        {/* Banner */}
        {!bannerDismissed && (
          <Banner
            title="Connect Shopify Orders API for real-time metrics"
            tone="info"
            onDismiss={() => setBannerDismissed(true)}
          >
            <p className="ss-analytics__p-order-counts-revenue">
              Order counts, revenue, and discount totals are populated when you wire up the Shopify Orders API.
              Campaign structure data (products, tiers, settings) is tracked automatically.
            </p>
          </Banner>
        )}

        {/* Summary Stats */}
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <StatCard
              label="Total Orders"
              value={summary.totalOrders.toString()}
              icon={OrderIcon}
              color="#1D9E75"
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <StatCard
              label="Total Revenue"
              value={formatCurrency(summary.totalRevenue)}
              icon={ChartVerticalIcon}
              color="#534AB7"
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <StatCard
              label="Discount Given"
              value={formatCurrency(summary.totalDiscountGiven)}
              icon={DiscountIcon}
              color="#185FA5"
            />
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <StatCard
              label="Free Shipping Value"
              value={formatCurrency(summary.totalFreeShipping)}
              icon={DeliveryIcon}
              color="#BA7517"
            />
          </Grid.Cell>
        </Grid>

        {/* Campaign Analytics Table */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Campaign Analytics</Text>

            {/* Filters */}
            <Filters
              queryValue=""
              queryPlaceholder="Search campaigns..."
              filters={[
                {
                  key: "type",
                  label: "Campaign Type",
                  filter: (
                    <ChoiceList
                      title="Campaign Type"
                      titleHidden
                      choices={[
                        { label: "Quantity Discount", value: "quantity_discount" },
                        { label: "Bulk Price", value: "bulk_price" },
                        { label: "Cart Goal", value: "cart_goal" },
                        { label: "Buy X Get Y", value: "buy_x_get_y" },
                        { label: "Shipping Discount", value: "shipping_discount" },
                        { label: "Shipping Protection", value: "shipping_protection" },
                      ]}
                      selected={typeFilter}
                      onChange={setTypeFilter}
                      allowMultiple
                    />
                  ),
                  shortcut: true,
                },
                {
                  key: "status",
                  label: "Status",
                  filter: (
                    <ChoiceList
                      title="Status"
                      titleHidden
                      choices={[
                        { label: "Active", value: "active" },
                        { label: "Paused", value: "paused" },
                        { label: "Expired", value: "expired" },
                        { label: "Draft", value: "draft" },
                        { label: "Deleted", value: "deleted" },
                      ]}
                      selected={statusFilter}
                      onChange={setStatusFilter}
                      allowMultiple
                    />
                  ),
                  shortcut: true,
                },
              ]}
              appliedFilters={[
                ...(typeFilter.length > 0
                  ? [{ key: "type", label: `Type: ${typeFilter.join(", ")}`, onRemove: () => setTypeFilter([]) }]
                  : []),
                ...(statusFilter.length > 0
                  ? [{ key: "status", label: `Status: ${statusFilter.join(", ")}`, onRemove: () => setStatusFilter([]) }]
                  : []),
              ]}
              onQueryChange={() => {}}
              onQueryClear={() => {}}
              onClearAll={() => { setTypeFilter([]); setStatusFilter([]); }}
            />

            {filtered.length === 0 ? (
              <EmptyState
                heading="No analytics records found"
                image=""
              >
                <p className="ss-analytics__p-create-campaigns-to">Create campaigns to start tracking analytics. Records are kept even after campaigns are deleted.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "numeric", "numeric", "numeric", "text"]}
                headings={[
                  "Campaign",
                  "Type",
                  "Status",
                  "Discount",
                  "Orders",
                  "Revenue",
                  "Discount Given",
                  "Actions",
                ]}
                rows={filtered.map((record) => [
                  // Campaign name + date range
                  <BlockStack gap="100" key={record.id}>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">{record.campaignName}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {formatDate(record.startDate)} → {formatDate(record.endDate)}
                    </Text>
                  </BlockStack>,

                  // Type badge
                  <Badge tone={campaignTypeBadge(record.campaignType)} key={record.id}>
                    {campaignTypeLabel(record.campaignType)}
                  </Badge>,

                  // Status badge
                  <Badge tone={statusBadge(record.campaignStatus)} key={record.id}>
                    {record.campaignStatus.charAt(0).toUpperCase() + record.campaignStatus.slice(1)}
                  </Badge>,

                  // Discount
                  discountLabel(record),

                  // Orders
                  record.totalOrders,

                  // Revenue
                  formatCurrency(record.totalRevenue),

                  // Discount given
                  formatCurrency(record.totalDiscountGiven),

                  // Actions
                  <InlineStack gap="200" key={record.id}>
                    <Tooltip content="View full analysis">
                      <Button
                        icon={ViewIcon}
                        size="slim"
                        onClick={() => handleView(record as AnalyticsRecord)}
                        accessibilityLabel="View analysis"
                      />
                    </Tooltip>
                    <Tooltip content="Delete analysis record">
                      <Button
                        icon={DeleteIcon}
                        size="slim"
                        tone="critical"
                        onClick={() => handleDeleteConfirm(record.id)}
                        loading={isDeleting && deleteConfirmId === record.id}
                        accessibilityLabel="Delete analysis"
                      />
                    </Tooltip>
                  </InlineStack>,
                ])}
              />
            )}
          </BlockStack>
        </Card>

        {/* Delete Confirmation Modal */}
        <Modal
          open={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          title="Delete analytics record?"
          primaryAction={{
            content: "Delete",
            destructive: true,
            loading: isDeleting,
            onAction: handleDelete,
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setDeleteConfirmId(null) },
          ]}
        >
          <Modal.Section>
            <Text as="p" variant="bodyMd">
              This will permanently remove the analytics record for this campaign.
              This action cannot be undone.
            </Text>
          </Modal.Section>
        </Modal>

        {/* Analytics Detail Modal */}
        <AnalyticsModal
          record={selectedRecord}
          open={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedRecord(null); }}
        />

      </BlockStack>
      </Page>
    </>
  );

}
const customizationStyles = `



`;