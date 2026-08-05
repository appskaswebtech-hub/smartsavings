import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useFetcher,
  useRevalidator,
} from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Box,
  Divider,
  InlineGrid,
  Banner,
  Thumbnail,
  EmptyState,
  ProgressBar,
  IndexTable,
  IndexFilters,
  useSetIndexFiltersMode,
  useIndexResourceState,
  ChoiceList,
  Button,
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
    const discountNodesQuery = `
      query($after: String) {
        discountNodes(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
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
                    ... on DiscountPercentage {
                      percentage
                    }
                    ... on DiscountAmount {
                      amount {
                        amount
                      }
                    }
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
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
                customerGets {
                  value {
                    ... on DiscountPercentage {
                      percentage
                    }
                    ... on DiscountAmount {
                      amount {
                        amount
                      }
                    }
                  }
                }
              }
              ... on DiscountCodeFreeShipping {
                title
                status
                startsAt
                endsAt
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
              }
              ... on DiscountCodeBxgy {
                title
                status
                startsAt
                endsAt
                codes(first: 1) {
                  nodes {
                    code
                  }
                }
              }
            }
          }
        }
      }
      `;

    const shopifyDiscounts: any[] = [];
    let afterCursor: string | null = null;
    let hasNextPage = true;
    let pageGuard = 0;

    while (hasNextPage && pageGuard < 20) {
      pageGuard++;
      const shopifyRes: any = await admin.graphql(discountNodesQuery, { variables: { after: afterCursor } });
      const shopifyResult: any = await shopifyRes.json();
      const page: any = shopifyResult.data?.discountNodes;
      shopifyDiscounts.push(...(page?.nodes || []));
      hasNextPage = !!page?.pageInfo?.hasNextPage;
      afterCursor = page?.pageInfo?.endCursor || null;
    }

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

    const existingNames = new Set(campaigns.map((c) => c.name));
    let importedCount = 0;

    for (const node of shopifyDiscounts) {
      const d = node.discount;
      if (!d?.title) continue;

      if (d.__typename === "DiscountAutomaticApp") continue;

      const isSubTierDiscount = /\((Buy \d+\+|Spend \$[\d.]+\+)/.test(d.title);
      if (isSubTierDiscount) continue;

      const alreadyExists = Array.from(existingNames).some(
        (name) =>
          d.title === name ||
          d.title.startsWith(name + " - ") ||
          d.title.startsWith(name + " (")
      );
      if (alreadyExists) continue;

      let type = "bulk_price";
      let discountType = "percentage";
      let discountValue = 0;
      const typename = d.__typename || "";
      const statusMap: Record<string, string> = {
        ACTIVE: "active",
        EXPIRED: "expired",
        SCHEDULED: "scheduled",
      };
      const status = statusMap[d.status] || "active";

      if (
        typename === "DiscountAutomaticFreeShipping" ||
        typename === "DiscountCodeFreeShipping"
      ) {
        type = "shipping_discount";
        discountType = "free_shipping";
      } else if (
        typename === "DiscountAutomaticBxgy" ||
        typename === "DiscountCodeBxgy"
      ) {
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

    if (importedCount > 0) syncMessage = `Imported ${importedCount} discount(s) from your store`;

    campaigns = await db.campaign.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    });

    // Only sync status (active/expired/scheduled) when a live match is found.
    // Deliberately never delete a local campaign here just because no match
    // was found — a missed match can be a transient false negative (the
    // 100-item page cap above, a read-after-write consistency lag right after
    // creation, a flaky GraphQL call) and deleting on that basis has caused
    // real data loss: Shopify discounts left live with no local record to
    // manage them. Reactive cleanup for genuinely-deleted discounts is handled
    // by app/routes/webhooks.discounts.delete.tsx instead.
    const toUpdate: { id: string; status: string }[] = [];

    for (const campaign of campaigns) {
      let hasOnShopify = false;
      let shopifyStatus: string | undefined;

      if (campaign.shopifyDiscountId && shopifyIdToStatus.has(campaign.shopifyDiscountId)) {
        hasOnShopify = true;
        shopifyStatus = shopifyIdToStatus.get(campaign.shopifyDiscountId);
      } else {
        hasOnShopify =
          shopifyTitles.has(campaign.name) ||
          Array.from(shopifyTitles).some(
            (t) =>
              t.startsWith(campaign.name + " (") ||
              t.startsWith(campaign.name + " - ")
          );
        if (hasOnShopify) shopifyStatus = shopifyStatusMap.get(campaign.name);
      }

      if (hasOnShopify && shopifyStatus) {
        const mapped =
          shopifyStatus === "ACTIVE"
            ? "active"
            : shopifyStatus === "EXPIRED"
            ? "expired"
            : shopifyStatus === "SCHEDULED"
            ? "scheduled"
            : null;
        if (mapped && mapped !== campaign.status) toUpdate.push({ id: campaign.id, status: mapped });
      }
    }

    for (const u of toUpdate) {
      await db.campaign.update({
        where: { id: u.id },
        data: { status: u.status },
      });
    }

    if (toUpdate.length > 0) {
      campaigns = await db.campaign.findMany({
        where: { shop },
        orderBy: { createdAt: "desc" },
      });
    }
  } catch (error) {
    console.error("Sync error:", error);
  }

  const activeVariantCount = await countDiscountedVariants(admin);

  const campaignData = await Promise.all(
    campaigns.map(async (c) => {
      let appliesToDisplay = "All products";
      let appliesToItems: string[] = [];

      if (c.appliesTo === "specific_products" && c.productIds) {
        try {
          const ids = JSON.parse(c.productIds) as string[];
          if (ids.length > 0) {
            const productQueries = ids
              .slice(0, 5)
              .map((id, i) => `p${i}: product(id: "${id}") { title }`)
              .join("\n");
            const res = await admin.graphql(`
              query {
                ${productQueries}
              }
            `);
            const result = await res.json();
            appliesToItems = Object.values(result.data || {})
              .filter((p: any) => p?.title)
              .map((p: any) => p.title);
            appliesToDisplay = `${ids.length} product${ids.length > 1 ? "s" : ""}`;
          }
        } catch {
          appliesToDisplay = "Specific products";
        }
      } else if (c.appliesTo === "specific_collections" && c.collectionIds) {
        try {
          const ids = JSON.parse(c.collectionIds) as string[];
          if (ids.length > 0) {
            const colQueries = ids
              .slice(0, 5)
              .map((id, i) => `c${i}: collection(id: "${id}") { title }`)
              .join("\n");
            const res = await admin.graphql(`
              query {
                ${colQueries}
              }
            `);
            const result = await res.json();
            appliesToItems = Object.values(result.data || {})
              .filter((c: any) => c?.title)
              .map((c: any) => c.title);
            appliesToDisplay = `${ids.length} collection${ids.length > 1 ? "s" : ""}`;
          }
        } catch {
          appliesToDisplay = "Specific collections";
        }
      }

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        status: c.status,
        discountType: c.discountType,
        discountValue: c.discountValue,
        discountedVariants: c.discountedVariants,
        startDate: c.startDate ? new Date(c.startDate).toLocaleDateString() : "—",
        endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : "No end date",
        appliesTo: c.appliesTo,
        tiers: c.tiers,
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

// ── Campaign operations ─────────────────────────────────────────────────────
// Shared by the single-row and bulk action branches so the two can't drift.
// Each runs its own Shopify discount lookup, so a bulk action costs one round
// trip per campaign — correctness over cleverness at realistic selection sizes.

type OpResult = { ok: boolean; message: string };

/** Removes the campaign from the app and every Shopify discount matching it. */
async function deleteCampaign(admin: any, campaignId: string): Promise<OpResult> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, message: "Campaign not found" };

  let shopifyDeleted = 0;
  let shopifyError = "";

  try {
    const directIds: string[] = [];
    const directTypenames: Record<string, string> = {};

    if (campaign.shopifyDiscountId) {
      const oneRes = await admin.graphql(
        `
        query oneDiscount($id: ID!) {
          discountNode(id: $id) {
            id
            discount {
              __typename
            }
          }
        }
      `,
        { variables: { id: campaign.shopifyDiscountId } }
      );
      const oneResult = await oneRes.json();
      const node = oneResult.data?.discountNode;
      if (node?.id && node?.discount?.__typename) {
        directIds.push(node.id);
        directTypenames[node.id] = node.discount.__typename;
      }
    }

    const searchRes = await admin.graphql(
      `
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
      }
    `,
      { variables: { query: `title:${campaign.name}*` } }
    );
    const searchResult = await searchRes.json();
    let nodes = searchResult.data?.discountNodes?.nodes || [];

    if (nodes.length === 0) {
      const allRes = await admin.graphql(
        `
        query {
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
        }
      `
      );
      const allResult = await allRes.json();
      nodes = allResult.data?.discountNodes?.nodes || [];
    }

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

    for (const id of idsToDelete) {
      const typename = idTypenames[id] || "";
      const isCode = typename.includes("Code");
      if (isCode) {
        const res = await admin.graphql(
          `
          mutation del($id: ID!) {
            discountCodeDelete(id: $id) {
              deletedCodeDiscountId
              userErrors {
                field
                message
              }
            }
          }
        `,
          { variables: { id } }
        );
        const r = await res.json();
        const ue = r.data?.discountCodeDelete?.userErrors || [];
        if (!ue.length) shopifyDeleted++;
        else shopifyError = ue.map((e: any) => e.message).join(", ");
      } else {
        const res = await admin.graphql(
          `
          mutation del($id: ID!) {
            discountAutomaticDelete(id: $id) {
              deletedAutomaticDiscountId
              userErrors {
                field
                message
              }
            }
          }
        `,
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
  return {
    ok: true,
    message:
      shopifyDeleted > 0
        ? `"${campaign.name}" deleted from app and store (${shopifyDeleted} discount(s) removed)`
        : `"${campaign.name}" deleted from app${shopifyError ? `. Store error: ${shopifyError}` : ""}`,
  };
}

/** Pauses or resumes a campaign and its Shopify discounts. */
async function setCampaignStatus(
  admin: any,
  campaignId: string,
  targetStatus?: "active" | "paused"
): Promise<OpResult> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, message: "Campaign not found" };

  // No target given = flip, which is what the per-row Pause/Resume button does.
  const newStatus = targetStatus ?? (campaign.status === "active" ? "paused" : "active");
  const errors: string[] = [];
  let toggledCount = 0;

  try {
    const allRes = await admin.graphql(
      `
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
      }
    `
    );
    const allResult = await allRes.json();
    const allNodes = allResult.data?.discountNodes?.nodes || [];

    const matchingNodes = allNodes.filter((node: any) => {
      if (campaign.shopifyDiscountId && node.id === campaign.shopifyDiscountId) return true;
      const title = node.discount?.title || "";
      return (
        title === campaign.name ||
        title.startsWith(campaign.name + " (") ||
        title.startsWith(campaign.name + " - ")
      );
    });

    for (const node of matchingNodes) {
      const title = node.discount?.title || "";
      const typename = node.discount?.__typename || "";
      const isCode = typename.includes("Code");

      try {
        if (newStatus === "paused") {
          if (isCode) {
            const res = await admin.graphql(
              `
              mutation deactivateCode($id: ID!) {
                discountCodeDeactivate(id: $id) {
                  codeDiscountNode { id }
                  userErrors { field message }
                }
              }
            `,
              { variables: { id: node.id } }
            );
            const r = await res.json();
            const ue = r.data?.discountCodeDeactivate?.userErrors || [];
            if (ue.length > 0) errors.push(`${title}: ${ue.map((e: any) => e.message).join(", ")}`);
            else toggledCount++;
          } else {
            const res = await admin.graphql(
              `
              mutation deactivateAuto($id: ID!) {
                discountAutomaticDeactivate(id: $id) {
                  automaticDiscountNode { id }
                  userErrors { field message }
                }
              }
            `,
              { variables: { id: node.id } }
            );
            const r = await res.json();
            const ue = r.data?.discountAutomaticDeactivate?.userErrors || [];
            if (ue.length > 0) {
              errors.push(`${title}: ${ue.map((e: any) => e.message).join(", ")}`);
              if (typename === "DiscountAutomaticBasic") {
                await admin.graphql(
                  `
                  mutation expireDiscount($id: ID!, $discount: DiscountAutomaticBasicInput!) {
                    discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $discount) {
                      automaticDiscountNode { id }
                      userErrors { field message }
                    }
                  }
                `,
                  { variables: { id: node.id, discount: { endsAt: "2020-01-01T00:00:00Z" } } }
                );
                toggledCount++;
              }
            } else {
              toggledCount++;
            }
          }
        } else {
          if (isCode) {
            const res = await admin.graphql(
              `
              mutation activateCode($id: ID!) {
                discountCodeActivate(id: $id) {
                  codeDiscountNode { id }
                  userErrors { field message }
                }
              }
            `,
              { variables: { id: node.id } }
            );
            const r = await res.json();
            const ue = r.data?.discountCodeActivate?.userErrors || [];
            if (ue.length > 0) errors.push(`${title}: ${ue.map((e: any) => e.message).join(", ")}`);
            else toggledCount++;
          } else {
            if (typename === "DiscountAutomaticBasic") {
              await admin.graphql(
                `
                mutation clearEndDate($id: ID!, $discount: DiscountAutomaticBasicInput!) {
                  discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $discount) {
                    automaticDiscountNode { id }
                    userErrors { field message }
                  }
                }
              `,
                { variables: { id: node.id, discount: { endsAt: null } } }
              );
            }
            const res = await admin.graphql(
              `
              mutation activateAuto($id: ID!) {
                discountAutomaticActivate(id: $id) {
                  automaticDiscountNode { id }
                  userErrors { field message }
                }
              }
            `,
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

  await db.campaign.update({
    where: { id: campaignId },
    data: { status: newStatus },
  });

  if (errors.length > 0) {
    return {
      ok: false,
      message: `Failed to ${newStatus === "paused" ? "pause" : "activate"}: ${errors.join("; ")}`,
    };
  }

  return {
    ok: true,
    message: `"${campaign.name}" ${newStatus === "active" ? "activated" : "paused"} successfully`,
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action") as string;
  const campaignId = formData.get("campaignId") as string;

  if (actionType === "delete" && campaignId) {
    const r = await deleteCampaign(admin, campaignId);
    return json({ success: r.ok, message: r.message });
  }

  if (actionType === "toggle_status" && campaignId) {
    const r = await setCampaignStatus(admin, campaignId);
    return json({ success: r.ok, message: r.message });
  }

  // Bulk actions loop server-side: firing one request per row from the browser
  // would race, and each operation already talks to Shopify several times.
  if (actionType === "bulk_delete" || actionType === "bulk_status") {
    let ids: string[] = [];
    try {
      ids = JSON.parse((formData.get("campaignIds") as string) || "[]");
    } catch {
      ids = [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return json({ success: false, message: "No campaigns selected." });
    }

    // Pause/Resume set an explicit status rather than flipping, so a mixed
    // selection all lands in the same state instead of swapping.
    const raw = formData.get("targetStatus");
    const targetStatus = raw === "active" || raw === "paused" ? raw : undefined;

    const failures: string[] = [];
    let done = 0;
    for (const id of ids) {
      const r =
        actionType === "bulk_delete"
          ? await deleteCampaign(admin, id)
          : await setCampaignStatus(admin, id, targetStatus);
      if (r.ok) done++;
      else failures.push(r.message);
    }

    const verb =
      actionType === "bulk_delete" ? "deleted" : targetStatus === "paused" ? "paused" : "resumed";
    const summary = `${done} campaign${done === 1 ? "" : "s"} ${verb}`;
    return json({
      success: failures.length === 0,
      message: failures.length
        ? `${summary}, ${failures.length} failed: ${failures.join("; ")}`
        : summary,
    });
  }

  return json({ success: true, message: "" });
};

const TYPE_LABELS: Record<string, string> = {
  bulk_price: "Bulk Price",
  quantity_discount: "Quantity Discount",
  buy_x_get_y: "Buy X Get Y",
  advanced_discount_code: "Discount Code",
  cart_goal: "Cart Goal",
  shipping_discount: "Shipping",
};

export default function Campaigns() {
  const { campaigns, plan, syncMessage } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const toggleFetcher = useFetcher<{ success: boolean; message: string }>();
  const deleteFetcher = useFetcher<{ success: boolean; message: string }>();

  const [selectedTab, setSelectedTab] = useState(0);
  const [showSyncBanner, setShowSyncBanner] = useState(!!syncMessage);
  const [showActionBanner, setShowActionBanner] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  // Filter state. Empty array = no constraint on that field, not "match nothing".
  const [queryValue, setQueryValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [discountFilter, setDiscountFilter] = useState<string[]>([]);
  const { mode, setMode } = useSetIndexFiltersMode();

  useEffect(() => {
    if (toggleFetcher.data?.message) {
      setActionMessage(toggleFetcher.data.message);
      setShowActionBanner(true);
    }
    if (toggleFetcher.state === "idle" && toggleFetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [toggleFetcher.state, toggleFetcher.data, revalidator]);

  useEffect(() => {
    if (deleteFetcher.data?.message) {
      setActionMessage(deleteFetcher.data.message);
      setShowActionBanner(true);
    }
    if (deleteFetcher.state === "idle" && deleteFetcher.data?.success) {
      navigate("/app/campaigns");
    }
  }, [deleteFetcher.state, deleteFetcher.data, navigate]);

  const tabs = [
    { id: "all", content: "All" },
    { id: "active", content: "Active" },
    { id: "scheduled", content: "Scheduled" },
    { id: "expired", content: "Expired" },
  ];

  const handleTabChange = useCallback((i: number) => setSelectedTab(i), []);

  // Tab and filters are ANDed. They can disagree (tab "Active" + status filter
  // "Paused" gives an empty list) — the tab is a coarse preset over the filters.
  const query = queryValue.trim().toLowerCase();
  const filtered = campaigns.filter((c: any) => {
    const tabOk =
      selectedTab === 1 ? c.status === "active"
      : selectedTab === 2 ? c.status === "scheduled"
      : selectedTab === 3 ? c.status === "expired"
      : true;
    return (
      tabOk &&
      (!query || (c.name || "").toLowerCase().includes(query)) &&
      (statusFilter.length === 0 || statusFilter.includes(c.status)) &&
      (typeFilter.length === 0 || typeFilter.includes(c.type)) &&
      (discountFilter.length === 0 || discountFilter.includes(c.discountType))
    );
  });

  const handleDelete = (id: string) => {
    if (!confirm("Delete this campaign from both the app AND your Shopify store?")) return;
    const fd = new FormData();
    fd.append("action", "delete");
    fd.append("campaignId", id);
    deleteFetcher.submit(fd, { method: "post", action: "/app/campaigns" });
  };

  const handleToggle = (id: string) => {
    const fd = new FormData();
    fd.append("action", "toggle_status");
    fd.append("campaignId", id);
    toggleFetcher.submit(fd, { method: "post", action: "/app/campaigns" });
  };

  // ── Selection and bulk actions ──
  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(filtered);

  // A row selected under one filter would stay selected after being filtered out
  // of view, so a bulk action could hit campaigns the merchant can no longer see.
  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab, queryValue, statusFilter, typeFilter, discountFilter]);

  const bulkDelete = () => {
    const n = selectedResources.length;
    if (!confirm(`Delete ${n} campaign${n === 1 ? "" : "s"} from both the app AND your Shopify store?`)) return;
    const fd = new FormData();
    fd.append("action", "bulk_delete");
    fd.append("campaignIds", JSON.stringify(selectedResources));
    deleteFetcher.submit(fd, { method: "post", action: "/app/campaigns" });
    clearSelection();
  };

  const bulkSetStatus = (targetStatus: "active" | "paused") => {
    const fd = new FormData();
    fd.append("action", "bulk_status");
    fd.append("campaignIds", JSON.stringify(selectedResources));
    fd.append("targetStatus", targetStatus);
    toggleFetcher.submit(fd, { method: "post", action: "/app/campaigns" });
    clearSelection();
  };

  // ── Filters ──
  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          allowMultiple
          choices={[
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Scheduled", value: "scheduled" },
            { label: "Expired", value: "expired" },
            { label: "Draft", value: "draft" },
          ]}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
      ),
      shortcut: true,
    },
    {
      key: "type",
      label: "Type",
      filter: (
        <ChoiceList
          title="Type"
          titleHidden
          allowMultiple
          // Reuse TYPE_LABELS so the filter can't drift from the Type column.
          choices={Object.entries(TYPE_LABELS).map(([value, label]) => ({ label, value }))}
          selected={typeFilter}
          onChange={setTypeFilter}
        />
      ),
      shortcut: true,
    },
    {
      key: "discount",
      label: "Discount type",
      filter: (
        <ChoiceList
          title="Discount type"
          titleHidden
          allowMultiple
          choices={[
            { label: "Percentage off", value: "percentage" },
            { label: "Fixed amount off", value: "fixed_amount" },
            { label: "Free shipping", value: "free_shipping" },
          ]}
          selected={discountFilter}
          onChange={setDiscountFilter}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters: { key: string; label: string; onRemove: () => void }[] = [];
  if (statusFilter.length)
    appliedFilters.push({
      key: "status",
      label: `Status: ${statusFilter.join(", ")}`,
      onRemove: () => setStatusFilter([]),
    });
  if (typeFilter.length)
    appliedFilters.push({
      key: "type",
      label: `Type: ${typeFilter.map((t) => TYPE_LABELS[t] || t).join(", ")}`,
      onRemove: () => setTypeFilter([]),
    });
  if (discountFilter.length)
    appliedFilters.push({
      key: "discount",
      label: `Discount: ${discountFilter.join(", ")}`,
      onRemove: () => setDiscountFilter([]),
    });

  const clearAllFilters = () => {
    setQueryValue("");
    setStatusFilter([]);
    setTypeFilter([]);
    setDiscountFilter([]);
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
        const validTiers = tiers.filter((t: any) => parseFloat(t.discount) > 0);
        if (validTiers.length === 0) return "No active tiers";
        const label = validTiers
          .map((t: any) =>
            t.discountType === "fixed_amount" ? `$${t.discount} off` : `${t.discount}%`
          )
          .join(", ");
        return `${validTiers.length} tier${validTiers.length !== 1 ? "s" : ""}: ${label}`;
      } catch {}
    }
    if (c.type === "buy_x_get_y") return `Buy ${c.discountValue || "X"} Get 1`;
    if (c.discountType === "percentage") return `${c.discountValue}% off`;
    if (c.discountType === "fixed_amount") return `$${c.discountValue} off`;
    return String(c.discountValue || "—");
  };

  const isToggling = toggleFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";

  return (
    <Page
      backAction={{ content: "Home", url: "/app" }}
      title="Campaigns"
      primaryAction={{
        content: "Create campaign",
        onAction: () => navigate("/app/campaigns/create"),
      }}
    >
      <BlockStack gap="600">
        {showSyncBanner && syncMessage && (
          <Banner tone="info" onDismiss={() => setShowSyncBanner(false)}>
            <p>🔄 {syncMessage}</p>
          </Banner>
        )}

        {showActionBanner && actionMessage && (
          <Banner
            tone={toggleFetcher.data?.success || deleteFetcher.data?.success ? "success" : "critical"}
            onDismiss={() => setShowActionBanner(false)}
          >
            <p>{actionMessage}</p>
          </Banner>
        )}

        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">
                Current plan:
              </Text>
              <Text as="span" variant="headingSm" fontWeight="bold">
                {plan.name}
              </Text>
            </BlockStack>

            <InlineStack gap="200" blockAlign="center">
              <Box width="200px">
                <ProgressBar
                  progress={Math.min(100, (plan.activeVariants / plan.maxVariants) * 100)}
                  size="small"
                  tone="primary"
                />
              </Box>
              <BlockStack gap="0">
                <Text as="span" variant="bodySm" tone="subdued">
                  Active discounted variants
                </Text>
                <Text as="span" variant="headingSm" fontWeight="bold">
                  {plan.activeVariants}/{plan.maxVariants}
                </Text>
              </BlockStack>
            </InlineStack>

            <InlineStack gap="200" blockAlign="center">
              <Box width="200px">
                <ProgressBar
                  progress={Math.min(100, (plan.createdCampaigns / plan.maxCampaigns) * 100)}
                  size="small"
                  tone="primary"
                />
              </Box>
              <BlockStack gap="0">
                <Text as="span" variant="bodySm" tone="subdued">
                  Created campaigns
                </Text>
                <Text as="span" variant="headingSm" fontWeight="bold">
                  {plan.createdCampaigns}/{plan.maxCampaigns}
                </Text>
              </BlockStack>
            </InlineStack>
          </InlineStack>
        </Card>

        <Card padding="0">
          <IndexFilters
            tabs={tabs}
            selected={selectedTab}
            onSelect={handleTabChange}
            queryValue={queryValue}
            queryPlaceholder="Search campaigns by name"
            onQueryChange={setQueryValue}
            onQueryClear={() => setQueryValue("")}
            filters={filters}
            appliedFilters={appliedFilters}
            onClearAll={clearAllFilters}
            mode={mode}
            setMode={setMode}
            cancelAction={{ onAction: clearAllFilters, disabled: false, loading: false }}
          />
          <div>
            <Box padding="400">
              {filtered.length === 0 ? (
                <EmptyState heading="Create a discount campaign" image="">
                  <p>Create campaigns to apply discounts to your products automatically</p>
                  <Box paddingBlockStart="400">
                    <Button variant="primary" onClick={() => navigate("/app/campaigns/create")}>
                      Create campaign
                    </Button>
                  </Box>
                </EmptyState>
              ) : (
                <IndexTable
                  itemCount={filtered.length}
                  headings={[
                    { title: "Campaign" },
                    { title: "Type" },
                    { title: "Discount" },
                    { title: "Applies to" },
                    { title: "Status" },
                    { title: "Start date" },
                    { title: "End date" },
                    { title: "Actions" },
                  ]}
                  selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
                  onSelectionChange={handleSelectionChange}
                  promotedBulkActions={[
                    { content: "Pause", onAction: () => bulkSetStatus("paused") },
                    { content: "Resume", onAction: () => bulkSetStatus("active") },
                    // Polaris 13 bulk actions have no destructive styling; the
                    // confirm() in bulkDelete is what guards this.
                    { content: "Delete", onAction: bulkDelete },
                  ]}
                >
                  {filtered.map((c: any, i: number) => (
                    <IndexTable.Row
                      id={c.id}
                      key={c.id}
                      position={i}
                      selected={selectedResources.includes(c.id)}
                    >
                      <IndexTable.Cell>
                        <Button variant="plain" onClick={() => navigate(`/app/campaigns/${c.id}`)}>
                          {c.name}
                        </Button>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge>{TYPE_LABELS[c.type] || c.type}</Badge>
                      </IndexTable.Cell>
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
                          <Button size="slim" onClick={() => navigate(`/app/campaigns/edit/${c.id}`)}>
                            Edit
                          </Button>
                          <Button
                            size="slim"
                            loading={isToggling}
                            onClick={() => handleToggle(c.id)}
                          >
                            {c.status === "active" ? "Pause" : "Activate"}
                          </Button>
                          <Button
                            size="slim"
                            tone="critical"
                            loading={isDeleting}
                            onClick={() => handleDelete(c.id)}
                          >
                            Delete
                          </Button>
                        </InlineStack>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </Box>
          </div>
        </Card>
      </BlockStack>
    </Page>
  );
}