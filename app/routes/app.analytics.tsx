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
          <div
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
            <div style={{ color: "#fff", display: "flex" }}>
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
                  <Text as="p" variant="bodyMd" textDecorationLine="inherit">
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
    <Page title="Analytics" subtitle="Campaign performance — data is retained even after campaigns are deleted.">
      <BlockStack gap="400">

        {/* Banner */}
        {!bannerDismissed && (
          <Banner
            title="Connect Shopify Orders API for real-time metrics"
            tone="info"
            onDismiss={() => setBannerDismissed(true)}
          >
            <p>
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
                <p>Create campaigns to start tracking analytics. Records are kept even after campaigns are deleted.</p>
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
  );
}