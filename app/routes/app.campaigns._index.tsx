import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useActionData } from "@remix-run/react";
import {
  Page, Card, Text, BlockStack, InlineStack, Button, Box, Tabs,
  EmptyState, ProgressBar, IndexTable, Badge, Banner,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { countDiscountedVariants } from "../variants.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;

  let campaigns = await db.campaign.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  let syncMessage = "";

  try {
    // Fetch ALL discounts from Shopify with full details
    const shopifyRes = await admin.graphql(
      `#graphql
      query allDiscounts {
        discountNodes(first: 100) {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticBasic {
                title
                status
                startsAt
                endsAt
                customerGets {
                  value {
                    ... on DiscountPercentage { percentage }
                    ... on DiscountAmount { amount { amount } }
                  }
                }
              }
              ... on DiscountAutomaticBxgy {
                title
                status
                startsAt
                endsAt
              }
              ... on DiscountAutomaticFreeShipping {
                title
                status
                startsAt
                endsAt
              }
              ... on DiscountAutomaticApp {
                title
                status
                startsAt
                endsAt
                appDiscountType {
                  functionId
                  title
                }
              }
              ... on DiscountCodeBasic {
                title
                status
                startsAt
                endsAt
                codes(first: 1) { nodes { code } }
                customerGets {
                  value {
                    ... on DiscountPercentage { percentage }
                    ... on DiscountAmount { amount { amount } }
                  }
                }
              }
              ... on DiscountCodeFreeShipping {
                title
                status
                startsAt
                endsAt
                codes(first: 1) { nodes { code } }
              }
              ... on DiscountCodeBxgy {
                title
                status
                startsAt
                endsAt
                codes(first: 1) { nodes { code } }
              }
            }
          }
        }
      }`
    );
    const shopifyResult = await shopifyRes.json();
    const shopifyDiscounts = shopifyResult.data?.discountNodes?.nodes || [];

    // Build TWO lookup maps: by node id AND by title.
    // ID match is more reliable (works for app discounts too); title is a fallback.
    const shopifyIdToStatus = new Map<string, string>();
    const shopifyTitles = new Set<string>();
    const shopifyStatusMap = new Map<string, string>();

    for (const node of shopifyDiscounts) {
      const title = node.discount?.title;
      const status = node.discount?.status;
      if (node.id && status) shopifyIdToStatus.set(node.id, status);
      if (title) {
        shopifyTitles.add(title);
        if (status) shopifyStatusMap.set(title, status);
      }
    }

    // ── IMPORT: Shopify discounts → App ──
    const existingNames = new Set(campaigns.map((c) => c.name));
    let importedCount = 0;

    for (const node of shopifyDiscounts) {
      const d = node.discount;
      if (!d?.title) continue;

      // Skip App-function discounts in auto-import — managed by our own create flow.
      if (d.__typename === "DiscountAutomaticApp") continue;

      const alreadyExists = Array.from(existingNames).some(
        (name) => d.title === name || d.title.startsWith(name + " - ") || d.title.startsWith(name + " (")
      );
      if (alreadyExists) continue;

      let type = "bulk_price";
      let discountType = "percentage";
      let discountValue = 0;
      const typename = d.__typename || "";
      const statusMap: Record<string, string> = {
        ACTIVE: "active", EXPIRED: "expired", SCHEDULED: "scheduled",
      };
      const status = statusMap[d.status] || "active";

      if (typename === "DiscountAutomaticFreeShipping" || typename === "DiscountCodeFreeShipping") {
        type = "shipping_discount";
        discountType = "free_shipping";
      } else if (typename === "DiscountAutomaticBxgy" || typename === "DiscountCodeBxgy") {
        type = "buy_x_get_y";
        discountType = "percentage";
      } else if (typename === "DiscountCodeBasic") {
        type = "advanced_discount_code";
        const value = d.customerGets?.value;
        if (value?.percentage != null) {
          discountType = "percentage";
          discountValue = Math.round(value.percentage * 100);
        } else if (value?.amount?.amount != null) {
          discountType = "fixed_amount";
          discountValue = parseFloat(value.amount.amount);
        }
      } else {
        const value = d.customerGets?.value;
        if (value?.percentage != null) {
          discountType = "percentage";
          discountValue = Math.round(value.percentage * 100);
        } else if (value?.amount?.amount != null) {
          discountType = "fixed_amount";
          discountValue = parseFloat(value.amount.amount);
        }
      }

      try {
        await db.campaign.create({
          data: {
            shop,
            name: d.title,
            type,
            status,
            discountType,
            discountValue,
            appliesTo: "all",
            startDate: d.startsAt ? new Date(d.startsAt) : new Date(),
            endDate: d.endsAt ? new Date(d.endsAt) : null,
          },
        });
        existingNames.add(d.title);
        importedCount++;
      } catch (err) {
        console.error(`Failed to import: ${d.title}`, err);
      }
    }

    if (importedCount > 0) {
      syncMessage = `Imported ${importedCount} discount(s) from your store`;
    }

    // ── DELETE: Remove campaigns whose discounts no longer exist on Shopify ──
    // Match by shopifyDiscountId when available; fall back to name match.
    campaigns = await db.campaign.findMany({ where: { shop }, orderBy: { createdAt: "desc" } });

    const toDelete: string[] = [];
    const toUpdate: { id: string; status: string }[] = [];

    for (const campaign of campaigns) {
      let hasOnShopify = false;
      let shopifyStatus: string | undefined;

      // Preferred: direct ID match (works for app discounts and any campaign
      // created since shopifyDiscountId was added to the schema).
      if (campaign.shopifyDiscountId && shopifyIdToStatus.has(campaign.shopifyDiscountId)) {
        hasOnShopify = true;
        shopifyStatus = shopifyIdToStatus.get(campaign.shopifyDiscountId);
      } else {
        // Fallback: legacy name match
        hasOnShopify = shopifyTitles.has(campaign.name) ||
          Array.from(shopifyTitles).some((t) =>
            t.startsWith(campaign.name + " (") || t.startsWith(campaign.name + " - ")
          );
        if (hasOnShopify) shopifyStatus = shopifyStatusMap.get(campaign.name);
      }

      if (!hasOnShopify) {
        toDelete.push(campaign.id);
      } else if (shopifyStatus) {
        const mapped =
          shopifyStatus === "ACTIVE" ? "active" :
          shopifyStatus === "EXPIRED" ? "expired" :
          shopifyStatus === "SCHEDULED" ? "scheduled" : null;
        if (mapped && mapped !== campaign.status) {
          toUpdate.push({ id: campaign.id, status: mapped });
        }
      }
    }

    if (toDelete.length > 0) {
      await db.campaign.deleteMany({ where: { id: { in: toDelete } } });
      const delMsg = `${toDelete.length} campaign(s) removed (deleted from store)`;
      syncMessage = syncMessage ? `${syncMessage}. ${delMsg}` : delMsg;
    }
    for (const u of toUpdate) {
      await db.campaign.update({ where: { id: u.id }, data: { status: u.status } });
    }

    // Final re-fetch
    campaigns = await db.campaign.findMany({ where: { shop }, orderBy: { createdAt: "desc" } });
  } catch (error) {
    console.error("Sync error:", error);
  }

  const activeVariantCount = await countDiscountedVariants(admin);

  // Resolve product/collection names for display
  const campaignData = await Promise.all(
    campaigns.map(async (c) => {
      let appliesToDisplay = "All products";
      let appliesToItems: string[] = [];

      if (c.appliesTo === "specific_products" && c.productIds) {
        try {
          const ids = JSON.parse(c.productIds) as string[];
          if (ids.length > 0) {
            const productQueries = ids.slice(0, 5).map((id, i) => `p${i}: product(id: "${id}") { title }`).join("\n");
            const res = await admin.graphql(`#graphql query { ${productQueries} }`);
            const result = await res.json();
            appliesToItems = Object.values(result.data || {})
              .filter((p: any) => p?.title)
              .map((p: any) => p.title);
            appliesToDisplay = `${ids.length} product${ids.length > 1 ? "s" : ""}`;
          }
        } catch (e) {
          appliesToDisplay = "Specific products";
        }
      } else if (c.appliesTo === "specific_collections" && c.collectionIds) {
        try {
          const ids = JSON.parse(c.collectionIds) as string[];
          if (ids.length > 0) {
            const colQueries = ids.slice(0, 5).map((id, i) => `c${i}: collection(id: "${id}") { title }`).join("\n");
            const res = await admin.graphql(`#graphql query { ${colQueries} }`);
            const result = await res.json();
            appliesToItems = Object.values(result.data || {})
              .filter((c: any) => c?.title)
              .map((c: any) => c.title);
            appliesToDisplay = `${ids.length} collection${ids.length > 1 ? "s" : ""}`;
          }
        } catch (e) {
          appliesToDisplay = "Specific collections";
        }
      }

      return {
        id: c.id, name: c.name, type: c.type, status: c.status,
        discountType: c.discountType, discountValue: c.discountValue,
        discountedVariants: c.discountedVariants,
        startDate: c.startDate ? new Date(c.startDate).toLocaleDateString() : "—",
        endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : "No end date",
        appliesTo: c.appliesTo, tiers: c.tiers,
        shopifyDiscountId: c.shopifyDiscountId,
        appliesToDisplay,
        appliesToItems,
      };
    })
  );

  return json({
    syncMessage,
    campaigns: campaignData,
    plan: {
      name: "Starter",
      activeVariants: activeVariantCount,
      maxVariants: 10,
      createdCampaigns: campaigns.length,
      maxCampaigns: 3,
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;
  const formData = await request.formData();
  const actionType = formData.get("action") as string;
  const campaignId = formData.get("campaignId") as string;

  if (actionType === "delete" && campaignId) {
    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    if (campaign) {
      let shopifyDeleted = 0;
      let shopifyError = "";

      try {
        // If we have the discount node id saved, delete that directly.
        // This is the reliable path for app-function discounts.
        const directIds: string[] = [];
        const directTypenames: Record<string, string> = {};

        if (campaign.shopifyDiscountId) {
          // Look up the typename so we know which delete mutation to use
          const oneRes = await admin.graphql(
            `#graphql
            query oneDiscount($id: ID!) {
              discountNode(id: $id) {
                id
                discount {
                  __typename
                }
              }
            }`,
            { variables: { id: campaign.shopifyDiscountId } }
          );
          const oneResult = await oneRes.json();
          const node = oneResult.data?.discountNode;
          if (node?.id && node?.discount?.__typename) {
            directIds.push(node.id);
            directTypenames[node.id] = node.discount.__typename;
          }
        }

        // ALSO do the legacy title search (covers tiered campaigns + legacy data
        // without shopifyDiscountId). De-duplicate by id at the end.
        const searchRes = await admin.graphql(
          `#graphql
          query searchDiscounts($query: String!) {
            discountNodes(first: 100, query: $query) {
              nodes {
                id
                discount {
                  __typename
                  ... on DiscountAutomaticBasic { title }
                  ... on DiscountAutomaticBxgy { title }
                  ... on DiscountAutomaticFreeShipping { title }
                  ... on DiscountAutomaticApp { title }
                  ... on DiscountCodeBasic { title }
                  ... on DiscountCodeFreeShipping { title }
                  ... on DiscountCodeBxgy { title }
                }
              }
            }
          }`,
          { variables: { query: `title:${campaign.name}*` } }
        );
        const searchResult = await searchRes.json();
        let nodes = searchResult.data?.discountNodes?.nodes || [];

        // Fallback: fetch all discounts if search returned nothing
        if (nodes.length === 0) {
          const allRes = await admin.graphql(
            `#graphql query {
              discountNodes(first: 100) {
                nodes {
                  id
                  discount {
                    __typename
                    ... on DiscountAutomaticBasic { title }
                    ... on DiscountAutomaticBxgy { title }
                    ... on DiscountAutomaticFreeShipping { title }
                    ... on DiscountAutomaticApp { title }
                    ... on DiscountCodeBasic { title }
                    ... on DiscountCodeFreeShipping { title }
                    ... on DiscountCodeBxgy { title }
                  }
                }
              }
            }`
          );
          const allResult = await allRes.json();
          nodes = allResult.data?.discountNodes?.nodes || [];
        }

        // Merge direct-id matches and title matches, deduped
        const idsToDelete = new Set<string>(directIds);
        const idTypenames: Record<string, string> = { ...directTypenames };

        for (const node of nodes) {
          const title = node.discount?.title || "";
          const typename = node.discount?.__typename || "";
          if (
            title === campaign.name ||
            title.startsWith(campaign.name + " - ") ||
            title.startsWith(campaign.name + " (")
          ) {
            idsToDelete.add(node.id);
            idTypenames[node.id] = typename;
          }
        }

        // Now delete each one with the right mutation
        for (const id of idsToDelete) {
          const typename = idTypenames[id] || "";
          const isCode = typename.includes("Code");

          if (isCode) {
            const res = await admin.graphql(
              `#graphql
              mutation del($id: ID!) {
                discountCodeDelete(id: $id) {
                  deletedCodeDiscountId
                  userErrors { field message }
                }
              }`,
              { variables: { id } }
            );
            const r = await res.json();
            const ue = r.data?.discountCodeDelete?.userErrors || [];
            if (!ue.length) shopifyDeleted++;
            else shopifyError = ue.map((e: any) => e.message).join(", ");
          } else {
            // Both DiscountAutomaticBasic / Bxgy / FreeShipping / App
            // all use discountAutomaticDelete
            const res = await admin.graphql(
              `#graphql
              mutation del($id: ID!) {
                discountAutomaticDelete(id: $id) {
                  deletedAutomaticDiscountId
                  userErrors { field message }
                }
              }`,
              { variables: { id } }
            );
            const r = await res.json();
            const ue = r.data?.discountAutomaticDelete?.userErrors || [];
            if (!ue.length) shopifyDeleted++;
            else shopifyError = ue.map((e: any) => e.message).join(", ");
          }
        }
      } catch (error) {
        console.error("Error deleting from Shopify:", error);
        shopifyError = String(error);
      }

      await db.campaign.delete({ where: { id: campaignId } });
      return json({
        success: true,
        message: shopifyDeleted > 0
          ? `"${campaign.name}" deleted from app and store (${shopifyDeleted} discount(s) removed)`
          : `"${campaign.name}" deleted from app${shopifyError ? `. Store error: ${shopifyError}` : ""}`,
      });
    }
  }

  if (actionType === "toggle_status" && campaignId) {
    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    if (campaign) {
      const newStatus = campaign.status === "active" ? "paused" : "active";
      const errors: string[] = [];
      let toggledCount = 0;

      try {
        // Fetch ALL discounts (search-by-title is unreliable)
        const allRes = await admin.graphql(
          `#graphql
          query {
            discountNodes(first: 250) {
              nodes {
                id
                discount {
                  __typename
                  ... on DiscountAutomaticBasic { title status }
                  ... on DiscountAutomaticBxgy { title status }
                  ... on DiscountAutomaticFreeShipping { title status }
                  ... on DiscountAutomaticApp { title status }
                  ... on DiscountCodeBasic { title status }
                  ... on DiscountCodeFreeShipping { title status }
                }
              }
            }
          }`
        );
        const allResult = await allRes.json();
        const allNodes = allResult.data?.discountNodes?.nodes || [];

        // Match: direct id first, then name fallback
        const matchingNodes = allNodes.filter((node: any) => {
          if (campaign.shopifyDiscountId && node.id === campaign.shopifyDiscountId) return true;
          const title = node.discount?.title || "";
          return (
            title === campaign.name ||
            title.startsWith(campaign.name + " (") ||
            title.startsWith(campaign.name + " - ")
          );
        });

        console.log(`Found ${matchingNodes.length} Shopify discounts matching "${campaign.name}"`);

        for (const node of matchingNodes) {
          const title = node.discount?.title || "";
          const typename = node.discount?.__typename || "";
          const isCode = typename.includes("Code");

          try {
            if (newStatus === "paused") {
              if (isCode) {
                const res = await admin.graphql(
                  `#graphql
                  mutation deactivateCode($id: ID!) {
                    discountCodeDeactivate(id: $id) {
                      codeDiscountNode { id }
                      userErrors { field message }
                    }
                  }`,
                  { variables: { id: node.id } }
                );
                const r = await res.json();
                const ue = r.data?.discountCodeDeactivate?.userErrors || [];
                if (ue.length > 0) errors.push(`${title}: ${ue.map((e: any) => e.message).join(", ")}`);
                else toggledCount++;
              } else {
                const res = await admin.graphql(
                  `#graphql
                  mutation deactivateAuto($id: ID!) {
                    discountAutomaticDeactivate(id: $id) {
                      automaticDiscountNode { id }
                      userErrors { field message }
                    }
                  }`,
                  { variables: { id: node.id } }
                );
                const r = await res.json();
                const ue = r.data?.discountAutomaticDeactivate?.userErrors || [];
                if (ue.length > 0) {
                  errors.push(`${title}: ${ue.map((e: any) => e.message).join(", ")}`);
                  // Fallback: set end date to past (only works for Basic discounts).
                  // App discounts don't support this fallback; the deactivate
                  // call should normally succeed for them.
                  if (typename === "DiscountAutomaticBasic") {
                    console.log(`Deactivate failed for "${title}", trying end date fallback...`);
                    await admin.graphql(
                      `#graphql
                      mutation expireDiscount($id: ID!, $discount: DiscountAutomaticBasicInput!) {
                        discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $discount) {
                          automaticDiscountNode { id }
                          userErrors { field message }
                        }
                      }`,
                      { variables: { id: node.id, discount: { endsAt: "2020-01-01T00:00:00Z" } } }
                    );
                    toggledCount++;
                  }
                } else {
                  toggledCount++;
                }
              }
            } else {
              // Activate
              if (isCode) {
                const res = await admin.graphql(
                  `#graphql
                  mutation activateCode($id: ID!) {
                    discountCodeActivate(id: $id) {
                      codeDiscountNode { id }
                      userErrors { field message }
                    }
                  }`,
                  { variables: { id: node.id } }
                );
                const r = await res.json();
                const ue = r.data?.discountCodeActivate?.userErrors || [];
                if (ue.length > 0) errors.push(`${title}: ${ue.map((e: any) => e.message).join(", ")}`);
                else toggledCount++;
              } else {
                // Clear stale endsAt for Basic discounts; safe no-op for others
                if (typename === "DiscountAutomaticBasic") {
                  await admin.graphql(
                    `#graphql
                    mutation clearEndDate($id: ID!, $discount: DiscountAutomaticBasicInput!) {
                      discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $discount) {
                        automaticDiscountNode { id }
                        userErrors { field message }
                      }
                    }`,
                    { variables: { id: node.id, discount: { endsAt: null } } }
                  );
                }
                const res = await admin.graphql(
                  `#graphql
                  mutation activateAuto($id: ID!) {
                    discountAutomaticActivate(id: $id) {
                      automaticDiscountNode { id }
                      userErrors { field message }
                    }
                  }`,
                  { variables: { id: node.id } }
                );
                const r = await res.json();
                const ue = r.data?.discountAutomaticActivate?.userErrors || [];
                if (ue.length > 0) errors.push(`${title}: ${ue.map((e: any) => e.message).join(", ")}`);
                else toggledCount++;
              }
            }
          } catch (err) {
            console.error(`Error toggling "${title}":`, err);
            errors.push(`${title}: ${String(err)}`);
          }
        }
      } catch (error) {
        console.error("Error fetching Shopify discounts:", error);
      }

      await db.campaign.update({ where: { id: campaignId }, data: { status: newStatus } });

      if (errors.length > 0) {
        console.error("Toggle errors:", errors);
        return json({ success: false, message: `Failed to ${newStatus === "paused" ? "pause" : "activate"}: ${errors.join("; ")}` });
      }
      return json({ success: true, message: `"${campaign.name}" ${newStatus === "active" ? "activated" : "paused"} successfully` });
    }
  }

  return json({ success: true, message: "" });
};

const TYPE_LABELS: Record<string, string> = {
  bulk_price: "Bulk price", quantity_discount: "Quantity discount",
  buy_x_get_y: "Buy X Get Y", advanced_discount_code: "Discount code",
  cart_goal: "Cart goal", shipping_discount: "Shipping",
};

export default function Campaigns()   {
  const { campaigns, plan, syncMessage } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [selectedTab, setSelectedTab] = useState(0);
  const [showSyncBanner, setShowSyncBanner] = useState(!!syncMessage);
  const [showActionBanner, setShowActionBanner] = useState(false);

  useEffect(() => { if (actionData?.message) setShowActionBanner(true); }, [actionData]);

  const tabs = [
    { id: "all", content: "All" },
    { id: "active", content: "Active" },
    { id: "scheduled", content: "Scheduled" },
    { id: "expired", content: "Expired" },
  ];

  const handleTabChange = useCallback((i: number) => setSelectedTab(i), []);

  const filtered = campaigns.filter((c: any) => {
    switch (selectedTab) {
      case 1: return c.status === "active";
      case 2: return c.status === "scheduled";
      case 3: return c.status === "expired";
      default: return true;
    }
  });

  const handleDelete = (id: string) => {
    if (confirm("Delete this campaign from both the app AND your Shopify store?")) {
      const fd = new FormData();
      fd.append("action", "delete");
      fd.append("campaignId", id);
      submit(fd, { method: "post" });
    }
  };

  const handleToggle = (id: string) => {
    const fd = new FormData();
    fd.append("action", "toggle_status");
    fd.append("campaignId", id);
    submit(fd, { method: "post" });
  };

  const getStatusBadge = (s: string) => {
    const map: Record<string, any> = {
      active: <Badge tone="success">Active</Badge>,
      scheduled: <Badge tone="info">Scheduled</Badge>,
      expired: <Badge>Expired</Badge>,
      paused: <Badge tone="warning">Paused</Badge>,
      draft: <Badge tone="new">Draft</Badge>,
    };
    return map[s] || <Badge>{s}</Badge>;
  };

  const getDiscountDisplay = (c: any) => {
    if (c.discountType === "free_shipping") return "Free shipping";
    if ((c.type === "quantity_discount" || c.type === "cart_goal") && c.tiers) {
      try {
        const tiers = JSON.parse(c.tiers);
        return `${tiers.length} tiers: ${tiers.map((t: any) => `${t.discount}%`).join(", ")}`;
      } catch {}
    }
    if (c.type === "buy_x_get_y") return `Buy ${c.discountValue || "X"} Get 1`;
    if (c.discountType === "percentage") return `${c.discountValue}% off`;
    if (c.discountType === "fixed_amount") return `$${c.discountValue} off`;
    return String(c.discountValue || "—");
  };

  return (
    <Page backAction={{ content: "Home", url: "/app" }} title="Campaigns"
      primaryAction={{ content: "Create campaign", onAction: () => navigate("/app/campaigns/create") }}>
      <BlockStack gap="600">
        {showSyncBanner && syncMessage && (
          <Banner tone="info" onDismiss={() => setShowSyncBanner(false)}>
            <p>🔄 {syncMessage}</p>
          </Banner>
        )}
        {showActionBanner && actionData?.message && (
          <Banner tone={actionData.success ? "success" : "critical"} onDismiss={() => setShowActionBanner(false)}>
            <p>{actionData.message}</p>
          </Banner>
        )}

        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">Current plan:</Text>
              <Text as="span" variant="headingSm" fontWeight="bold">{plan.name}</Text>
            </BlockStack>
            <InlineStack gap="200" blockAlign="center">
              <Box width="200px"><ProgressBar progress={Math.min(100, (plan.activeVariants / plan.maxVariants) * 100)} size="small" tone="primary" /></Box>
              <BlockStack gap="0">
                <Text as="span" variant="bodySm" tone="subdued">Active discounted variants</Text>
                <Text as="span" variant="headingSm" fontWeight="bold">{plan.activeVariants}/{plan.maxVariants}</Text>
              </BlockStack>
            </InlineStack>
            <InlineStack gap="200" blockAlign="center">
              <Box width="200px"><ProgressBar progress={Math.min(100, (plan.createdCampaigns / plan.maxCampaigns) * 100)} size="small" tone="primary" /></Box>
              <BlockStack gap="0">
                <Text as="span" variant="bodySm" tone="subdued">Created campaigns</Text>
                <Text as="span" variant="headingSm" fontWeight="bold">{plan.createdCampaigns}/{plan.maxCampaigns}</Text>
              </BlockStack>
            </InlineStack>
          </InlineStack>
        </Card>

        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
            <Box padding="400">
              {filtered.length === 0 ? (
                <EmptyState heading="Create a discount campaign" image="">
                  <p>Create campaigns to apply discounts to your products automatically</p>
                  <Box paddingBlockStart="400">
                    <Button variant="primary" onClick={() => navigate("/app/campaigns/create")}>Create campaign</Button>
                  </Box>
                </EmptyState>
              ) : (
                <IndexTable
                  itemCount={filtered.length}
                  headings={[
                    { title: "Campaign" }, { title: "Type" }, { title: "Discount" },
                    { title: "Applies to" },
                    { title: "Status" }, { title: "Start date" }, { title: "End date" },
                    { title: "Actions" },
                  ]}
                  selectable={false}
                >
                  {filtered.map((c: any, i: number) => (
                    <IndexTable.Row id={c.id} key={c.id} position={i}>
                      <IndexTable.Cell>
                        <Button variant="plain" onClick={() => navigate(`/app/campaigns/${c.id}`)}>
                          <Text as="span" variant="bodyMd" fontWeight="bold">{c.name}</Text>
                        </Button>
                      </IndexTable.Cell>
                      <IndexTable.Cell><Badge>{TYPE_LABELS[c.type] || c.type}</Badge></IndexTable.Cell>
                      <IndexTable.Cell>{getDiscountDisplay(c)}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <BlockStack gap="100">
                          <Text as="span" variant="bodySm" fontWeight="semibold">
                            {c.appliesToDisplay}
                          </Text>
                          {c.appliesToItems && c.appliesToItems.length > 0 && (
                            <BlockStack gap="0">
                              {c.appliesToItems.slice(0, 3).map((item: string, idx: number) => (
                                <Text key={idx} as="span" variant="bodySm" tone="subdued">
                                  {item}
                                </Text>
                              ))}
                              {c.appliesToItems.length > 3 && (
                                <Text as="span" variant="bodySm" tone="subdued">
                                  +{c.appliesToItems.length - 3} more
                                </Text>
                              )}
                            </BlockStack>
                          )}
                        </BlockStack>
                      </IndexTable.Cell>
                      <IndexTable.Cell>{getStatusBadge(c.status)}</IndexTable.Cell>
                      <IndexTable.Cell>{c.startDate}</IndexTable.Cell>
                      <IndexTable.Cell>{c.endDate}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <InlineStack gap="200">
                          <Button size="slim" onClick={() => handleToggle(c.id)}>
                            {c.status === "active" ? "Pause" : "Activate"}
                          </Button>
                          <Button size="slim" tone="critical" onClick={() => handleDelete(c.id)}>Delete</Button>
                        </InlineStack>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </Box>
          </Tabs>
        </Card>
      </BlockStack>
    </Page>
  );
}