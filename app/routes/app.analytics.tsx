  // import { json, type LoaderFunctionArgs } from "@remix-run/node";
  // import { useLoaderData } from "@remix-run/react";
  // import {
  //   Page,
  //   Card,
  //   Text,
  //   BlockStack,
  //   InlineStack,  
  //   Banner,
  //   EmptyState,
  //   Link,
  //   Box,
  // } from "@shopify/polaris";
  // import { useState } from "react";
  // import { authenticate } from "../shopify.server";

  // export const loader = async ({ request }: LoaderFunctionArgs) => {
  //   await authenticate.admin(request);

  //   // TODO: Fetch analytics data
  //   return json({
  //     campaigns: [],
  //     hasAnalytics: false,
  //   });
  // };

  // export default function Analytics() {
  //   const { campaigns, hasAnalytics } = useLoaderData<typeof loader>();
  //   const [bannerDismissed, setBannerDismissed] = useState(false);

  //   return (
  //     <Page backAction={{ content: "Home", url: "/app" }} title="Analytics">
  //       <BlockStack gap="400">
  //         {/* Coming Soon Banner */}
  //         {!bannerDismissed && (
  //           <Banner
  //             title="More campaign analytics coming soon"
  //             tone="info"
  //             onDismiss={() => setBannerDismissed(true)}
  //           >
  //             <p>
  //               Analytics for Quantity discount, Cart goal, Shipping discount, Buy
  //               X Get Y, and Advanced discount codes will be available soon.{" "}
  //               <Link url="https://discounty.app" external>
  //                 Learn more
  //               </Link>
  //             </p>
  //           </Banner>
  //         )}

  //         {/* Analytics Content */}
  //         <Card>
  //           {!hasAnalytics || campaigns.length === 0 ? (
  //             <EmptyState
  //               heading="No campaigns found"
  //               image=""
  //             >
  //               <p>Try changing the filters or search term</p>
  //             </EmptyState>
  //           ) : (
  //             <BlockStack gap="400">
  //               {/* Analytics dashboard content will go here */}
  //               <Text as="p" variant="bodyMd">
  //                 Campaign analytics will appear here once you create and run
  //                 campaigns.
  //               </Text>
  //             </BlockStack>
  //           )}
  //         </Card>
  //       </BlockStack>
  //     </Page>
  //   );
  // }

//   import { json, type LoaderFunctionArgs } from "@remix-run/node";
// import { useLoaderData, useNavigate } from "@remix-run/react";
// import {
//   Page, Card, Text, BlockStack, InlineStack, Banner,
//   Box, Badge, Button, Divider, InlineGrid,
// } from "@shopify/polaris";
// import { useState } from "react";
// import { authenticate } from "../shopify.server";
// import db from "../db.server";

// // ── Loader ───────────────────────────────────────────────────────────────────
// export const loader = async ({ request }: LoaderFunctionArgs) => {
//   const { session, admin } = await authenticate.admin(request);
//   const { shop } = session;

//   // Only show analytics for campaigns that still exist in the DB.
//   // When a campaign is deleted from the campaign page it disappears here too.
//   const campaigns = await db.campaign.findMany({
//     where: { shop },
//     orderBy: { createdAt: "desc" },
//   });

//   if (campaigns.length === 0) {
//     return json({ historyEntries: [] });
//   }

//   type ProductEntry = { title: string; quantity: number; totalSaved: number };
//   type CampaignAgg  = {
//     totalOrders: number;
//     totalAmountSaved: number;
//     currency: string;
//     ordersSet: Set<string>;
//     products: Map<string, ProductEntry>;
//   };

//   const analyticsMap = new Map<string, CampaignAgg>();
//   for (const c of campaigns) {
//     analyticsMap.set(c.name, {
//       totalOrders: 0, totalAmountSaved: 0,
//       currency: "USD", ordersSet: new Set(), products: new Map(),
//     });
//   }

//   try {
//     const ordersRes = await admin.graphql(`#graphql
//       query {
//         orders(first: 250, reverse: true) {
//           nodes {
//             id
//             currencyCode
//             lineItems(first: 50) {
//               nodes {
//                 title
//                 quantity
//                 discountAllocations {
//                   allocatedAmount { amount currencyCode }
//                   discountApplication {
//                     ... on AutomaticDiscountApplication { title }
//                     ... on DiscountCodeApplication      { code  }
//                     ... on ManualDiscountApplication    { title }
//                     ... on ScriptDiscountApplication    { title }
//                   }
//                 }
//               }
//             }
//           }
//         }
//       }
//     `);
//     const ordersResult = await ordersRes.json();

//     for (const order of ordersResult.data?.orders?.nodes || []) {
//       for (const lineItem of order.lineItems?.nodes || []) {
//         for (const alloc of lineItem.discountAllocations || []) {
//           const app = alloc.discountApplication;
//           const discTitle: string = app?.title || app?.code || "";
//           const amount = parseFloat(alloc.allocatedAmount?.amount || "0");
//           if (!discTitle || amount <= 0) continue;

//           // Match to a campaign: exact name OR tier sub-title
//           const matched = campaigns.find(c =>
//             discTitle === c.name ||
//             discTitle.startsWith(c.name + " (") ||
//             discTitle.startsWith(c.name + " - ")
//           );
//           if (!matched) continue;

//           const agg = analyticsMap.get(matched.name)!;
//           agg.currency = alloc.allocatedAmount?.currencyCode || "USD";
//           agg.totalAmountSaved += amount;

//           if (!agg.ordersSet.has(order.id)) {
//             agg.ordersSet.add(order.id);
//             agg.totalOrders++;
//           }

//           const prod = agg.products.get(lineItem.title);
//           if (prod) {
//             prod.quantity += lineItem.quantity;
//             prod.totalSaved += amount;
//           } else {
//             agg.products.set(lineItem.title, {
//               title: lineItem.title,
//               quantity: lineItem.quantity,
//               totalSaved: amount,
//             });
//           }
//         }
//       }
//     }
//   } catch (e) {
//     console.error("[SmartSavings] Analytics fetch error:", e);
//   }

//   const historyEntries = campaigns.map(c => {
//     const agg = analyticsMap.get(c.name);
//     return {
//       campaignId:       c.id,
//       parentTitle:      c.name,
//       campaignType:     c.type,
//       discountType:     c.discountType,
//       discountValue:    c.discountValue,
//       status:           c.status,
//       tiers:            c.tiers,
//       startDate:  c.startDate ? new Date(c.startDate).toLocaleDateString() : "—",
//       endDate:    c.endDate   ? new Date(c.endDate).toLocaleDateString()   : null,
//       totalOrders:      agg?.totalOrders      ?? 0,
//       totalAmountSaved: Number((agg?.totalAmountSaved ?? 0).toFixed(2)),
//       currency:         agg?.currency         ?? "USD",
//       productsApplied:  agg
//         ? Array.from(agg.products.values()).sort((a, b) => b.totalSaved - a.totalSaved)
//         : [],
//     };
//   });

//   return json({ historyEntries });
// };

// // ── Helpers ──────────────────────────────────────────────────────────────────

// const TYPE_LABELS: Record<string, string> = {
//   bulk_price: "Bulk price", quantity_discount: "Quantity discount",
//   buy_x_get_y: "Buy X Get Y", advanced_discount_code: "Discount code",
//   cart_goal: "Cart goal", shipping_discount: "Shipping",
// };

// function getDiscountLabel(c: any): string {
//   if (c.discountType === "free_shipping") return "Free shipping";
//   if ((c.campaignType === "quantity_discount" || c.campaignType === "cart_goal") && c.tiers) {
//     try {
//       const tiers = JSON.parse(c.tiers).filter((t: any) => parseFloat(t.discount) > 0);
//       if (tiers.length > 0) {
//         const labels = tiers.map((t: any) =>
//           t.discountType === "fixed_amount" ? `$${t.discount} off` : `${t.discount}%`
//         );
//         return `${tiers.length} tiers: ${labels.join(", ")}`;
//       }
//     } catch {}
//   }
//   if (c.discountType === "percentage")   return `${c.discountValue}% off`;
//   if (c.discountType === "fixed_amount") return `$${c.discountValue} off`;
//   return "—";
// }

// function StatusBadge({ status }: { status: string }) {
//   const map: Record<string, any> = {
//     active:    <Badge tone="success">Active</Badge>,
//     paused:    <Badge tone="warning">Paused</Badge>,
//     expired:   <Badge tone="attention">Expired</Badge>,
//     scheduled: <Badge tone="info">Scheduled</Badge>,
//     draft:     <Badge>Draft</Badge>,
//   };
//   return map[(status || "").toLowerCase()] || <Badge>{status}</Badge>;
// }

// // ── Component ─────────────────────────────────────────────────────────────────
// export default function Analytics() {
//   // Default to empty array so reduce() never crashes if loader returns unexpectedly
//   const { historyEntries = [] } = useLoaderData<typeof loader>();
//   const navigate = useNavigate();
//   const [expandedIds, setExpandedIds]     = useState<Set<string>>(new Set());
//   const [bannerDismissed, setBannerDismissed] = useState(false);

//   const toggle = (id: string) =>
//     setExpandedIds(prev => {
//       const n = new Set(prev);
//       n.has(id) ? n.delete(id) : n.add(id);
//       return n;
//     });

//   const totalOrders = historyEntries.reduce((s, e) => s + e.totalOrders, 0);
//   const totalSaved  = historyEntries.reduce((s, e) => s + e.totalAmountSaved, 0);

//   return (
//     <Page
//       backAction={{ content: "Home", url: "/app" }}
//       title="Analytics"
//       subtitle="Discount performance across all campaigns"
//     >
//       <BlockStack gap="500">

//         {!bannerDismissed && (
//           <Banner tone="info" onDismiss={() => setBannerDismissed(true)}>
//             <p>Analytics show order data for your current campaigns. Deleting a campaign removes it from this view.</p>
//           </Banner>
//         )}

//         {/* ── Summary cards ── */}
//         <InlineGrid columns={3} gap="400">
//           <Card>
//             <BlockStack gap="100">
//               <Text as="p" variant="bodySm" tone="subdued">Total campaigns</Text>
//               <Text as="p" variant="heading2xl">{historyEntries.length}</Text>
//             </BlockStack>
//           </Card>
//           <Card>
//             <BlockStack gap="100">
//               <Text as="p" variant="bodySm" tone="subdued">Orders with discounts</Text>
//               <Text as="p" variant="heading2xl">{totalOrders}</Text>
//             </BlockStack>
//           </Card>
//           <Card>
//             <BlockStack gap="100">
//               <Text as="p" variant="bodySm" tone="subdued">Total savings given</Text>
//               <Text as="p" variant="heading2xl">
//                 <span style={{ color: "#008060" }}>${totalSaved.toFixed(2)}</span>
//               </Text>
//             </BlockStack>
//           </Card>
//         </InlineGrid>

//         {/* ── Per-campaign cards ── */}
//         {historyEntries.length === 0 ? (
//           <Card>
//             <Box padding="800">
//               <BlockStack gap="200" inlineAlign="center">
//                 <Text as="p" variant="headingSm">No campaigns yet</Text>
//                 <Text as="p" variant="bodySm" tone="subdued">
//                   Create campaigns and process orders to see analytics here.
//                 </Text>
//               </BlockStack>
//             </Box>
//           </Card>
//         ) : (
//           <BlockStack gap="400">
//             {historyEntries.map(entry => {
//               const isExpanded = expandedIds.has(entry.campaignId);
//               const hasProducts = entry.productsApplied.length > 0;

//               return (
//                 <Card key={entry.campaignId}>
//                   <BlockStack gap="400">

//                     {/* Header */}
//                     <InlineStack align="space-between" blockAlign="start">
//                       <BlockStack gap="100">
//                         <InlineStack gap="200" blockAlign="center" wrap>
//                           <Text as="h2" variant="headingSm" fontWeight="bold">
//                             {entry.parentTitle}
//                           </Text>
//                           <StatusBadge status={entry.status} />
//                           <Badge>{TYPE_LABELS[entry.campaignType] || entry.campaignType}</Badge>
//                         </InlineStack>
//                         <Text as="p" variant="bodySm" tone="subdued">
//                           {getDiscountLabel(entry)}
//                         </Text>
//                       </BlockStack>

//                       {/* Stats + View button */}
//                       <InlineStack gap="400" blockAlign="center">
//                         <BlockStack gap="0" inlineAlign="end">
//                           <Text as="p" variant="bodySm" tone="subdued">Orders</Text>
//                           <Text as="p" variant="headingMd" fontWeight="bold">
//                             {entry.totalOrders}
//                           </Text>
//                         </BlockStack>
//                         <BlockStack gap="0" inlineAlign="end">
//                           <Text as="p" variant="bodySm" tone="subdued">Total saved</Text>
//                           <Text as="p" variant="headingMd" fontWeight="bold">
//                             <span style={{ color: "#008060" }}>
//                               ${entry.totalAmountSaved.toFixed(2)}
//                             </span>
//                           </Text>
//                         </BlockStack>
//                         <Button
//                           size="slim"
//                           onClick={() => navigate(`/app/campaigns/${entry.campaignId}`)}
//                         >
//                           View
//                         </Button>
//                       </InlineStack>
//                     </InlineStack>

//                     <Divider />

//                     {/* Dates */}
//                     <InlineGrid columns={2} gap="400">
//                       <BlockStack gap="050">
//                         <Text as="p" variant="bodySm" tone="subdued">Start date</Text>
//                         <Text as="p" variant="bodyMd">{entry.startDate}</Text>
//                       </BlockStack>
//                       <BlockStack gap="050">
//                         <Text as="p" variant="bodySm" tone="subdued">End date</Text>
//                         <Text as="p" variant="bodyMd">
//                           {entry.endDate ?? (entry.status === "active" ? "No end date" : "—")}
//                         </Text>
//                       </BlockStack>
//                     </InlineGrid>

//                     {/* Products breakdown */}
//                     {hasProducts ? (
//                       <BlockStack gap="200">
//                         <Button variant="plain" onClick={() => toggle(entry.campaignId)}>
//                           {isExpanded ? "▾" : "▸"}&nbsp;
//                           {entry.productsApplied.length} product
//                           {entry.productsApplied.length !== 1 ? "s" : ""} received this discount
//                         </Button>

//                         {isExpanded && (
//                           <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="hidden">
//                             <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", padding: "8px 16px", fontWeight: 700, fontSize: "12px", color: "#6d7175", background: "#f6f6f7", borderBottom: "1px solid #e1e3e5", textTransform: "uppercase", letterSpacing: "0.04em" }}>
//                               <span>Product</span>
//                               <span style={{ textAlign: "right" }}>Qty sold</span>
//                               <span style={{ textAlign: "right" }}>Total saved</span>
//                             </div>
//                             {entry.productsApplied.map((p, idx) => (
//                               <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", padding: "10px 16px", fontSize: "13px", borderBottom: idx < entry.productsApplied.length - 1 ? "1px solid #f1f2f3" : "none", alignItems: "center" }}>
//                                 <span style={{ fontWeight: 500 }}>{p.title}</span>
//                                 <span style={{ textAlign: "right", color: "#6d7175" }}>{p.quantity}</span>
//                                 <span style={{ textAlign: "right", color: "#008060", fontWeight: 600 }}>
//                                   ${p.totalSaved.toFixed(2)}
//                                 </span>
//                               </div>
//                             ))}
//                           </Box>
//                         )}
//                       </BlockStack>
//                     ) : (
//                       <Text as="p" variant="bodySm" tone="subdued">
//                         No orders with this discount yet.
//                       </Text>
//                     )}

//                   </BlockStack>
//                 </Card>
//               );
//             })}
//           </BlockStack>
//         )}
//       </BlockStack>
//     </Page>
//   );
// }



import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page, Card, Text, BlockStack, InlineStack, Banner,
  Box, Badge, Button, Divider, InlineGrid,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ── Loader ───────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;

  // Only show analytics for campaigns that still exist in the DB.
  // When a campaign is deleted from the campaign page it disappears here too.
  const campaigns = await db.campaign.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  if (campaigns.length === 0) {
    return json({ historyEntries: [] });
  }

  type ProductEntry = { title: string; quantity: number; totalSaved: number };
  type CampaignAgg  = {
    totalOrders: number;
    totalAmountSaved: number;
    currency: string;
    ordersSet: Set<string>;
    products: Map<string, ProductEntry>;
  };

  const analyticsMap = new Map<string, CampaignAgg>();
  for (const c of campaigns) {
    analyticsMap.set(c.name, {
      totalOrders: 0, totalAmountSaved: 0,
      currency: "USD", ordersSet: new Set(), products: new Map(),
    });
  }

  try {
    const ordersRes = await admin.graphql(`#graphql
      query {
        orders(first: 250, reverse: true) {
          nodes {
            id
            currencyCode
            totalDiscountsSet { shopMoney { amount currencyCode } }
            discountApplications(first: 10) {
              nodes {
                allocationMethod
                targetType
                value {
                  ... on PricingPercentageValue { percentage }
                  ... on MoneyV2 { amount currencyCode }
                }
                ... on AutomaticDiscountApplication { title }
                ... on DiscountCodeApplication      { code  }
                ... on ManualDiscountApplication    { title }
                ... on ScriptDiscountApplication    { title }
              }
            }
            lineItems(first: 50) {
              nodes {
                title
                quantity
                discountAllocations {
                  allocatedAmount { amount currencyCode }
                  discountApplication {
                    ... on AutomaticDiscountApplication { title }
                    ... on DiscountCodeApplication      { code  }
                    ... on ManualDiscountApplication    { title }
                    ... on ScriptDiscountApplication    { title }
                  }
                }
              }
            }
          }
        }
      }
    `);
    const ordersResult = await ordersRes.json();

    for (const order of ordersResult.data?.orders?.nodes || []) {
      const orderCurrency = order.currencyCode || "USD";

      // ── Pass 1: collect discount titles applied to this order ──
      const orderDiscountTitles = new Set<string>();
      for (const app of order.discountApplications?.nodes || []) {
        const t: string = app?.title || app?.code || "";
        if (t) orderDiscountTitles.add(t);
      }

      // ── Find which of our campaigns matched this order ──
      // A campaign matches if its name (or any of its tier sub-titles) appear
      // in the order's discount applications.
      const matchedCampaigns = new Set<string>();
      for (const discTitle of orderDiscountTitles) {
        const matched = campaigns.find(c =>
          discTitle === c.name ||
          discTitle.startsWith(c.name + " (") ||
          discTitle.startsWith(c.name + " - ")
        );
        if (matched) matchedCampaigns.add(matched.name);
      }

      if (matchedCampaigns.size === 0) continue;

      // ── Pass 2: attribute line-item savings to matched campaigns ──
      // Try precise per-line-item allocation first; fall back to order total
      // divided evenly if allocations don't carry a discountApplication title.
      let preciseTotal = 0;
      const preciseByProduct = new Map<string, { quantity: number; saved: number }>();

      for (const lineItem of order.lineItems?.nodes || []) {
        for (const alloc of lineItem.discountAllocations || []) {
          const app = alloc.discountApplication;
          const discTitle: string = app?.title || app?.code || "";
          const amount = parseFloat(alloc.allocatedAmount?.amount || "0");
          if (amount <= 0) continue;

          // Check if this allocation belongs to one of our matched campaigns
          const matchedCampaign = discTitle
            ? campaigns.find(c =>
                discTitle === c.name ||
                discTitle.startsWith(c.name + " (") ||
                discTitle.startsWith(c.name + " - "))
            : null;

          // If we can identify the campaign, attribute it directly
          const targetCampaignName = matchedCampaign?.name ?? (matchedCampaigns.size === 1 ? [...matchedCampaigns][0] : null);
          if (!targetCampaignName) continue;

          const agg = analyticsMap.get(targetCampaignName)!;
          agg.currency = alloc.allocatedAmount?.currencyCode || orderCurrency;
          agg.totalAmountSaved += amount;
          preciseTotal += amount;

          if (!agg.ordersSet.has(order.id)) {
            agg.ordersSet.add(order.id);
            agg.totalOrders++;
          }

          const prod = agg.products.get(lineItem.title);
          if (prod) {
            prod.quantity += lineItem.quantity;
            prod.totalSaved += amount;
          } else {
            agg.products.set(lineItem.title, {
              title: lineItem.title, quantity: lineItem.quantity, totalSaved: amount,
            });
          }
        }
      }

      // ── Fallback: if line-item allocations gave us nothing (some API versions
      //    omit discountApplication on allocations), attribute the order's total
      //    discount to the single matched campaign. Only used when exactly ONE
      //    campaign matched, to avoid double-counting.
      if (preciseTotal === 0 && matchedCampaigns.size === 1) {
        const campaignName = [...matchedCampaigns][0];
        const orderTotal = parseFloat(order.totalDiscountsSet?.shopMoney?.amount || "0");
        if (orderTotal > 0) {
          const agg = analyticsMap.get(campaignName)!;
          agg.currency = order.totalDiscountsSet?.shopMoney?.currencyCode || orderCurrency;
          agg.totalAmountSaved += orderTotal;
          if (!agg.ordersSet.has(order.id)) {
            agg.ordersSet.add(order.id);
            agg.totalOrders++;
          }
        }
      }
    }
  } catch (e) {
    console.error("[SmartSavings] Analytics fetch error:", e);
  }

  const historyEntries = campaigns.map(c => {
    const agg = analyticsMap.get(c.name);
    return {
      campaignId:       c.id,
      parentTitle:      c.name,
      campaignType:     c.type,
      discountType:     c.discountType,
      discountValue:    c.discountValue,
      status:           c.status,
      tiers:            c.tiers,
      startDate:  c.startDate ? new Date(c.startDate).toLocaleDateString() : "—",
      endDate:    c.endDate   ? new Date(c.endDate).toLocaleDateString()   : null,
      totalOrders:      agg?.totalOrders      ?? 0,
      totalAmountSaved: Number((agg?.totalAmountSaved ?? 0).toFixed(2)),
      currency:         agg?.currency         ?? "USD",
      productsApplied:  agg
        ? Array.from(agg.products.values()).sort((a, b) => b.totalSaved - a.totalSaved)
        : [],
    };
  });

  return json({ historyEntries });
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  bulk_price: "Bulk price", quantity_discount: "Quantity discount",
  buy_x_get_y: "Buy X Get Y", advanced_discount_code: "Discount code",
  cart_goal: "Cart goal", shipping_discount: "Shipping",
};

function getDiscountLabel(c: any): string {
  if (c.discountType === "free_shipping") return "Free shipping";
  if ((c.campaignType === "quantity_discount" || c.campaignType === "cart_goal") && c.tiers) {
    try {
      const tiers = JSON.parse(c.tiers).filter((t: any) => parseFloat(t.discount) > 0);
      if (tiers.length > 0) {
        const labels = tiers.map((t: any) =>
          t.discountType === "fixed_amount" ? `$${t.discount} off` : `${t.discount}%`
        );
        return `${tiers.length} tiers: ${labels.join(", ")}`;
      }
    } catch {}
  }
  if (c.discountType === "percentage")   return `${c.discountValue}% off`;
  if (c.discountType === "fixed_amount") return `$${c.discountValue} off`;
  return "—";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, any> = {
    active:    <Badge tone="success">Active</Badge>,
    paused:    <Badge tone="warning">Paused</Badge>,
    expired:   <Badge tone="attention">Expired</Badge>,
    scheduled: <Badge tone="info">Scheduled</Badge>,
    draft:     <Badge>Draft</Badge>,
  };
  return map[(status || "").toLowerCase()] || <Badge>{status}</Badge>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  // Default to empty array so reduce() never crashes if loader returns unexpectedly
  const { historyEntries = [] } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [expandedIds, setExpandedIds]     = useState<Set<string>>(new Set());
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const toggle = (id: string) =>
    setExpandedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const totalOrders = historyEntries.reduce((s, e) => s + e.totalOrders, 0);
  const totalSaved  = historyEntries.reduce((s, e) => s + e.totalAmountSaved, 0);

  return (
    <Page
      backAction={{ content: "Home", url: "/app" }}
      title="Analytics"
      subtitle="Discount performance across all campaigns"
    >
      <BlockStack gap="500">

        {!bannerDismissed && (
          <Banner tone="info" onDismiss={() => setBannerDismissed(true)}>
            <p>Analytics show order data for your current campaigns. Deleting a campaign removes it from this view.</p>
          </Banner>
        )}

        {/* ── Summary cards ── */}
        <InlineGrid columns={3} gap="400">
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Total campaigns</Text>
              <Text as="p" variant="heading2xl">{historyEntries.length}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Orders with discounts</Text>
              <Text as="p" variant="heading2xl">{totalOrders}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Total savings given</Text>
              <Text as="p" variant="heading2xl">
                <span style={{ color: "#008060" }}>${totalSaved.toFixed(2)}</span>
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* ── Per-campaign cards ── */}
        {historyEntries.length === 0 ? (
          <Card>
            <Box padding="800">
              <BlockStack gap="200" inlineAlign="center">
                <Text as="p" variant="headingSm">No campaigns yet</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Create campaigns and process orders to see analytics here.
                </Text>
              </BlockStack>
            </Box>
          </Card>
        ) : (
          <BlockStack gap="400">
            {historyEntries.map(entry => {
              const isExpanded = expandedIds.has(entry.campaignId);
              const hasProducts = entry.productsApplied.length > 0;

              return (
                <Card key={entry.campaignId}>
                  <BlockStack gap="400">

                    {/* Header */}
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center" wrap>
                          <Text as="h2" variant="headingSm" fontWeight="bold">
                            {entry.parentTitle}
                          </Text>
                          <StatusBadge status={entry.status} />
                          <Badge>{TYPE_LABELS[entry.campaignType] || entry.campaignType}</Badge>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {getDiscountLabel(entry)}
                        </Text>
                      </BlockStack>

                      {/* View button */}
                      <Button
                        size="slim"
                        onClick={() => navigate(`/app/campaigns/${entry.campaignId}`)}
                      >
                        View
                      </Button>
                    </InlineStack>

                    {/* ── Key stats row ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div style={{ background: "#f0fdf4", borderRadius: "8px", padding: "16px", textAlign: "center", border: "1px solid #bbf7d0" }}>
                        <Text as="p" variant="bodySm" tone="subdued">Total Discount Saved</Text>
                        <Text as="p" variant="headingXl" fontWeight="bold">
                          <span style={{ color: "#16a34a" }}>${entry.totalAmountSaved.toFixed(2)}</span>
                        </Text>
                      </div>
                      <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "16px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                        <Text as="p" variant="bodySm" tone="subdued">Orders with Discount</Text>
                        <Text as="p" variant="headingXl" fontWeight="bold">{entry.totalOrders}</Text>
                      </div>
                    </div>

                    <Divider />

                    {/* Dates */}
                    <InlineGrid columns={2} gap="400">
                      <BlockStack gap="050">
                        <Text as="p" variant="bodySm" tone="subdued">Start date</Text>
                        <Text as="p" variant="bodyMd">{entry.startDate}</Text>
                      </BlockStack>
                      <BlockStack gap="050">
                        <Text as="p" variant="bodySm" tone="subdued">End date</Text>
                        <Text as="p" variant="bodyMd">
                          {entry.endDate ?? (entry.status === "active" ? "No end date" : "—")}
                        </Text>
                      </BlockStack>
                    </InlineGrid>

                    {/* Products breakdown */}
                    {hasProducts ? (
                      <BlockStack gap="200">
                        <Button variant="plain" onClick={() => toggle(entry.campaignId)}>
                          {isExpanded ? "▾" : "▸"}&nbsp;
                          {entry.productsApplied.length} product
                          {entry.productsApplied.length !== 1 ? "s" : ""} received this discount
                        </Button>

                        {isExpanded && (
                          <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="hidden">
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", padding: "8px 16px", fontWeight: 700, fontSize: "12px", color: "#6d7175", background: "#f6f6f7", borderBottom: "1px solid #e1e3e5", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              <span>Product</span>
                              <span style={{ textAlign: "right" }}>Qty sold</span>
                              <span style={{ textAlign: "right" }}>Total saved</span>
                            </div>
                            {entry.productsApplied.map((p, idx) => (
                              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px", padding: "10px 16px", fontSize: "13px", borderBottom: idx < entry.productsApplied.length - 1 ? "1px solid #f1f2f3" : "none", alignItems: "center" }}>
                                <span style={{ fontWeight: 500 }}>{p.title}</span>
                                <span style={{ textAlign: "right", color: "#6d7175" }}>{p.quantity}</span>
                                <span style={{ textAlign: "right", color: "#008060", fontWeight: 600 }}>
                                  ${p.totalSaved.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </Box>
                        )}
                      </BlockStack>
                    ) : (
                      <Text as="p" variant="bodySm" tone="subdued">
                        No orders with this discount yet.
                      </Text>
                    )}

                  </BlockStack>
                </Card>
              );
            })}
          </BlockStack>
        )}
      </BlockStack>
    </Page>
  );
}