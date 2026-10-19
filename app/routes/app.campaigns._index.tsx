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
import { useState, useCallback, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { countDiscountedVariants } from "../variants.server";
import {
  createShopifyDiscount,
  deleteShopifyDiscountsByIds,
  findMatchingDiscountIds,
} from "../discount.server";
import {
  SHIPPING_PROTECTION,
  describeProtectionFees,
  parseProtectionConfig,
} from "../lib/shippingProtection";
import {
  findProtectionConflict,
  protectionProductIdsInUse,
  syncShippingProtection,
} from "../shippingProtection.server";
import { sweepProtectionProducts } from "../shippingProtectionProduct.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;

  let campaigns = await db.campaign.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  let syncMessage = "";
  // Campaigns still backed by the pre-Function per-tier native discounts. Those
  // can't combine with each other, so two of them never apply to the same cart.
  let legacyTierCampaigns: { id: string; name: string }[] = [];

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

    // A tiered campaign is on the old scheme when a discount titled
    // "<name> (Buy 3+ …)" / "<name> (Spend $100+ …)" is still a native basic
    // discount. The Function scheme creates a single DiscountAutomaticApp titled
    // exactly "<name>", so nothing here matches once a campaign is migrated.
    legacyTierCampaigns = campaigns
      .filter(
        (c) =>
          (c.type === "quantity_discount" || c.type === "cart_goal") &&
          shopifyDiscounts.some(
            (node) =>
              node.discount?.__typename === "DiscountAutomaticBasic" &&
              typeof node.discount?.title === "string" &&
              node.discount.title.startsWith(c.name + " (")
          )
      )
      .map((c) => ({ id: c.id, name: c.name }));

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
        protectionConfig: c.protectionConfig,
        shopifyDiscountId: c.shopifyDiscountId,
        appliesToDisplay,
        appliesToItems,
      };
    })
  );

  return json({
    syncMessage,
    campaigns: campaignData,
    legacyTierCampaigns,
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

  // No Shopify discount to remove — just unpublish its storefront config.
  if (campaign.type === SHIPPING_PROTECTION) {
    await db.campaign.delete({ where: { id: campaignId } });
    const syncErrors = await syncShippingProtection(admin, campaign.shop);
    // Its "Premium Shipping Protection" products go too — and so does anything
    // the app made for a campaign that no longer exists (only tagged products).
    const deleted = parseProtectionConfig(campaign.protectionConfig, campaign.discountValue);
    syncErrors.push(
      ...(await sweepProtectionProducts(admin, await protectionProductIdsInUse(campaign.shop), [
        deleted?.feeProductId,
        deleted?.componentProductId,
      ]))
    );
    return {
      ok: true,
      message: syncErrors.length
        ? `"${campaign.name}" deleted from app. Store error: ${syncErrors.join(", ")}`
        : `"${campaign.name}" deleted`,
    };
  }

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

  // No Shopify discount to (de)activate — republish the storefront config.
  if (campaign.type === SHIPPING_PROTECTION) {
    if (newStatus === "active") {
      const config = parseProtectionConfig(campaign.protectionConfig, campaign.discountValue);
      const conflict = await findProtectionConflict(
        campaign.shop,
        { appliesTo: config?.appliesTo ?? "all", products: config?.products ?? [] },
        campaign.id
      );
      if (conflict) return { ok: false, message: conflict };
    }
    await db.campaign.update({ where: { id: campaignId }, data: { status: newStatus } });
    const syncErrors = await syncShippingProtection(admin, campaign.shop);
    if (syncErrors.length > 0) {
      await db.campaign.update({ where: { id: campaignId }, data: { status: campaign.status } });
      await syncShippingProtection(admin, campaign.shop);
      return {
        ok: false,
        message: `Failed to ${newStatus === "paused" ? "pause" : "activate"}: ${syncErrors.join("; ")}`,
      };
    }
    return {
      ok: true,
      message: `"${campaign.name}" ${newStatus === "active" ? "activated" : "paused"} successfully`,
    };
  }

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
              // Deactivate can refuse (e.g. an already-past end date). Forcing the
              // end date into the past takes the discount out of circulation
              // either way — but the update mutation differs per discount type.
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
              } else if (typename === "DiscountAutomaticApp") {
                await admin.graphql(
                  `
                  mutation expireAppDiscount($id: ID!, $discount: DiscountAutomaticAppInput!) {
                    discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $discount) {
                      automaticAppDiscount { discountId }
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
            // Clear any end date a previous pause forced into the past, or
            // activate will just re-expire the discount.
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
            } else if (typename === "DiscountAutomaticApp") {
              await admin.graphql(
                `
                mutation clearAppEndDate($id: ID!, $discount: DiscountAutomaticAppInput!) {
                  discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $discount) {
                    automaticAppDiscount { discountId }
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

/**
 * Rebuilds a tiered campaign's Shopify discounts on the Function scheme.
 *
 * Campaigns created before the switch own one native discount per tier, and
 * those are created with combinesWith.productDiscounts: false — so two such
 * campaigns can never both apply to one cart. This replaces them with the single
 * function-backed discount, which is the same delete-then-recreate the edit page
 * performs on save; merchants just shouldn't have to re-save every campaign.
 *
 * Deliberately an explicit action rather than something the loader does on view:
 * it deletes live discounts, and a partial failure leaves the campaign with none.
 */
async function migrateCampaignToFunction(admin: any, campaignId: string): Promise<OpResult> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, message: "Campaign not found" };
  if (campaign.type !== "quantity_discount" && campaign.type !== "cart_goal") {
    return { ok: false, message: `"${campaign.name}" is not a tiered campaign.` };
  }

  let oldIds: string[];
  try {
    // Must run BEFORE creating the replacement — it matches on title prefix, and
    // the replacement carries the same name.
    oldIds = await findMatchingDiscountIds(admin, campaign.name);
  } catch (err) {
    console.error(`migrate lookup failed for "${campaign.name}":`, err);
    return { ok: false, message: `Could not look up "${campaign.name}" in Shopify.` };
  }

  const deleteErrors = await deleteShopifyDiscountsByIds(admin, oldIds);
  if (deleteErrors.length) {
    return {
      ok: false,
      message: `"${campaign.name}": ${deleteErrors.join("; ")}`,
    };
  }

  const result = await createShopifyDiscount(admin, {
    name: campaign.name,
    type: campaign.type,
    discountType: campaign.discountType,
    discountValue: campaign.discountValue ?? 0,
    appliesTo: campaign.appliesTo,
    // Both are nullable in the schema but required downstream. A tiered campaign
    // gets its value from the tiers, not discountValue, and a missing start date
    // means "already running".
    startDate: campaign.startDate ?? new Date(),
    endDate: campaign.endDate,
    tiers: campaign.tiers,
    productIds: campaign.productIds,
    collectionIds: campaign.collectionIds,
    combineWithProducts: campaign.combineWithProducts,
    combineWithOrders: campaign.combineWithOrders,
    combineWithShipping: campaign.combineWithShipping,
    freeShipping: false,
    minOrderForShipping: null,
    minQuantityForShipping: null,
    requirementType: campaign.requirementType,
    discountCode: campaign.discountCode,
    geoTarget: campaign.geoTarget,
  });

  if (!result.success) {
    // The old discounts are already gone, so leave the campaign pointing at
    // nothing rather than at a stale id the merchant can no longer act on.
    await db.campaign.update({
      where: { id: campaignId },
      data: { shopifyDiscountId: null },
    });
    if (result.createdIds?.length) {
      await deleteShopifyDiscountsByIds(admin, result.createdIds);
    }
    return {
      ok: false,
      message: `"${campaign.name}" could not be rebuilt: ${result.errors.join("; ")}. Open the campaign and save it to retry.`,
    };
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: { shopifyDiscountId: result.createdIds?.[0] ?? null },
  });

  return { ok: true, message: `"${campaign.name}" updated` };
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

  if (actionType === "migrate_tiers") {
    let ids: string[] = [];
    try {
      ids = JSON.parse((formData.get("campaignIds") as string) || "[]");
    } catch {
      ids = [];
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return json({ success: false, message: "Nothing to update." });
    }

    const failures: string[] = [];
    let done = 0;
    for (const id of ids) {
      const r = await migrateCampaignToFunction(admin, id);
      if (r.ok) done++;
      else failures.push(r.message);
    }

    const summary = `${done} campaign${done === 1 ? "" : "s"} updated`;
    return json({
      success: failures.length === 0,
      message: failures.length
        ? `${summary}, ${failures.length} failed: ${failures.join("; ")}`
        : summary,
    });
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
  shipping_protection: "Shipping Protection",
};

export default function Campaigns() {
  const { campaigns, plan, syncMessage, legacyTierCampaigns } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  const toggleFetcher = useFetcher<{ success: boolean; message: string }>();
  const deleteFetcher = useFetcher<{ success: boolean; message: string }>();
  const migrateFetcher = useFetcher<{ success: boolean; message: string }>();

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

  useEffect(() => {
    if (migrateFetcher.data?.message) {
      setActionMessage(migrateFetcher.data.message);
      setShowActionBanner(true);
    }
    // Revalidate on failure too: a partial run still changed some campaigns, and
    // the banner should drop the ones that succeeded.
    if (migrateFetcher.state === "idle" && migrateFetcher.data) {
      revalidator.revalidate();
    }
  }, [migrateFetcher.state, migrateFetcher.data, revalidator]);

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
    if (c.type === SHIPPING_PROTECTION) {
      return describeProtectionFees(parseProtectionConfig(c.protectionConfig, c.discountValue));
    }
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

  // ── Custom table UI state (design layer over the same handlers) ──
  type SelType = Parameters<typeof handleSelectionChange>[0];
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const headerCheckRef = useRef<HTMLInputElement>(null);

  const visibleSelected = filtered.filter((c: any) => selectedResources.includes(c.id)).length;
  const allVisibleSelected = filtered.length > 0 && visibleSelected === filtered.length;
  const someVisibleSelected = visibleSelected > 0 && !allVisibleSelected;

  useEffect(() => {
    if (headerCheckRef.current) headerCheckRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  // Close the filter panel / row menu on an outside click.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (filtersOpen && filtersRef.current && !filtersRef.current.contains(target)) {
        setFiltersOpen(false);
      }
      if (openMenuId && !target.closest(".ss-camp__menu-wrap")) setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [filtersOpen, openMenuId]);

  const toggleAllVisible = () =>
    handleSelectionChange("page" as SelType, !allVisibleSelected);
  const toggleRow = (id: string, checked: boolean) =>
    handleSelectionChange("single" as SelType, checked, id);

  const variantsProgress = Math.min(100, (plan.activeVariants / plan.maxVariants) * 100);
  const campaignsProgress = Math.min(100, (plan.createdCampaigns / plan.maxCampaigns) * 100);

  return (
    <Page fullWidth>
      <style>{campaignStyles}</style>
      <BlockStack gap="600">
        <div className="ss-camp">
          {/* Header */}
          <div className="ss-camp__hero">
            <div className="ss-camp__hero-art" aria-hidden="true">
              <CouponIllustration />
            </div>
            <div className="ss-camp__hero-text">
              <div className="ss-camp__title-row">
                <button
                  type="button"
                  className="ss-camp__back"
                  aria-label="Back to Home"
                  onClick={() => navigate("/app")}
                >
                  <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <h1 className="ss-camp__title">Campaigns</h1>
              </div>
              <p className="ss-camp__subtitle">
                Manage your discount campaigns, track performance and create new campaigns.
              </p>
            </div>
            <button
              type="button"
              className="ss-camp__create"
              onClick={() => navigate("/app/campaigns/create")}
            >
              <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M10 4v12M4 10h12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
              Create campaign
            </button>
          </div>

          <div className="ss-camp__banners">
            {showSyncBanner && syncMessage && (
              <Banner tone="info" onDismiss={() => setShowSyncBanner(false)}>
                <p className="ss-campaigns-index__p">🔄 {syncMessage}</p>
              </Banner>
            )}

            {showActionBanner && actionMessage && (
              <Banner
                tone={
                  toggleFetcher.data?.success ||
                  deleteFetcher.data?.success ||
                  migrateFetcher.data?.success
                    ? "success"
                    : "critical"
                }
                onDismiss={() => setShowActionBanner(false)}
              >
                <p className="ss-campaigns-index__p-2">{actionMessage}</p>
              </Banner>
            )}

            {legacyTierCampaigns.length > 0 && (
              <Banner tone="warning">
                <BlockStack gap="200">
                  <p className="ss-campaigns-index__p-3">
                    {legacyTierCampaigns.length === 1
                      ? `"${legacyTierCampaigns[0].name}" is`
                      : `${legacyTierCampaigns.length} campaigns are`}{" "}
                    using an older discount setup that can&rsquo;t combine with your other
                    campaigns — only one of them will apply to any given cart. Updating
                    rebuilds them in Shopify; your tiers and targeting stay the same.
                  </p>
                  <InlineStack>
                    <Button
                      loading={migrateFetcher.state !== "idle"}
                      onClick={() =>
                        migrateFetcher.submit(
                          {
                            action: "migrate_tiers",
                            campaignIds: JSON.stringify(legacyTierCampaigns.map((c) => c.id)),
                          },
                          { method: "post" }
                        )
                      }
                    >
                      Update {legacyTierCampaigns.length === 1 ? "campaign" : "campaigns"}
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Banner>
            )}
          </div>

          {/* Plan overview */}
          <div className="ss-camp__plan">
            <div className="ss-camp__plan-col">
              <div className="ss-camp__plan-icon ss-camp__plan-icon--orange" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24">
                  <path d="M3 7.5l4.5 4L12 5l4.5 6.5L21 7.5 19.2 18H4.8L3 7.5z" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M5 20.5h14" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="ss-camp__plan-info">
                <span className="ss-camp__plan-label">Current plan</span>
                <span className="ss-camp__plan-value">{plan.name}</span>
              </div>
              <button
                type="button"
                className="ss-camp__upgrade"
                onClick={() => navigate("/app/plans")}
              >
                Upgrade
              </button>
            </div>

            <div className="ss-camp__plan-col">
              <div className="ss-camp__plan-icon ss-camp__plan-icon--blue" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24">
                  <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" fill="none" stroke="#1F5EFF" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M4 7.5l8 4.5 8-4.5M12 12v9" fill="none" stroke="#1F5EFF" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="ss-camp__plan-info ss-camp__plan-info--grow">
                <span className="ss-camp__plan-label">Active discounted variants</span>
                <div className="ss-camp__plan-progress">
                  <span className="ss-camp__plan-value">
                    {plan.activeVariants}/{plan.maxVariants}
                  </span>
                  <div className="ss-camp__bar" role="progressbar" aria-valuenow={Math.round(variantsProgress)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="ss-camp__bar-fill" style={{ width: `${Math.max(variantsProgress, 4)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="ss-camp__plan-col">
              <div className="ss-camp__plan-icon ss-camp__plan-icon--blue" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24">
                  <rect x="5" y="3" width="14" height="18" rx="2.5" fill="none" stroke="#1F5EFF" strokeWidth="1.8" />
                  <path d="M8.5 8h7M8.5 12h7M8.5 16h4" stroke="#1F5EFF" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <div className="ss-camp__plan-info ss-camp__plan-info--grow">
                <span className="ss-camp__plan-label">Created campaigns</span>
                <div className="ss-camp__plan-progress">
                  <span className="ss-camp__plan-value">
                    {plan.createdCampaigns}/{plan.maxCampaigns}
                  </span>
                  <div className="ss-camp__bar" role="progressbar" aria-valuenow={Math.round(campaignsProgress)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="ss-camp__bar-fill" style={{ width: `${Math.max(campaignsProgress, 4)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Campaign list */}
          <div className="ss-camp__list">
            <div className="ss-camp__toolbar">
              <div className="ss-camp__tabs" role="tablist">
                {tabs.map((tab, i) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedTab === i}
                    className={`ss-camp__tab${selectedTab === i ? " ss-camp__tab--active" : ""}`}
                    onClick={() => handleTabChange(i)}
                  >
                    {tab.content}
                  </button>
                ))}
                <button
                  type="button"
                  className="ss-camp__tab ss-camp__tab--add"
                  aria-label="Add filter"
                  onClick={() => setFiltersOpen(true)}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M10 4v12M4 10h12" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="ss-camp__tools" ref={filtersRef}>
                <label className="ss-camp__search">
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="9" cy="9" r="5.5" fill="none" stroke="#374151" strokeWidth="1.8" />
                    <path d="M13.2 13.2L17 17" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    className="ss-camp__search-input"
                    placeholder="Search campaigns..."
                    aria-label="Search campaigns by name"
                    value={queryValue}
                    onChange={(e) => setQueryValue(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={`ss-camp__filter-btn${filtersOpen || appliedFilters.length ? " ss-camp__filter-btn--on" : ""}`}
                  aria-label="Filter campaigns"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((o) => !o)}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M3 4h14l-5.5 6.5V16l-3 1.5v-7L3 4z" fill="none" stroke="#374151" strokeWidth="1.7" strokeLinejoin="round" />
                  </svg>
                  {appliedFilters.length > 0 && <span className="ss-camp__filter-count">{appliedFilters.length}</span>}
                </button>

                {filtersOpen && (
                  <div className="ss-camp__filter-panel">
                    {filters.map((f) => (
                      <div key={f.key} className="ss-camp__filter-group">
                        <span className="ss-camp__filter-title">{f.label}</span>
                        {f.filter}
                      </div>
                    ))}
                    <div className="ss-camp__filter-footer">
                      <button type="button" className="ss-camp__text-btn" onClick={clearAllFilters}>
                        Clear all
                      </button>
                      <button type="button" className="ss-camp__btn" onClick={() => setFiltersOpen(false)}>
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {appliedFilters.length > 0 && (
              <div className="ss-camp__chips">
                {appliedFilters.map((f) => (
                  <span key={f.key} className="ss-camp__chip">
                    {f.label}
                    <button type="button" aria-label={`Remove ${f.label}`} onClick={f.onRemove}>
                      ×
                    </button>
                  </span>
                ))}
                <button type="button" className="ss-camp__text-btn" onClick={clearAllFilters}>
                  Clear all
                </button>
              </div>
            )}

            {selectedResources.length > 0 && (
              <div className="ss-camp__bulk">
                <span className="ss-camp__bulk-count">
                  {allResourcesSelected ? "All" : selectedResources.length} selected
                </span>
                <button type="button" className="ss-camp__btn" disabled={isToggling} onClick={() => bulkSetStatus("paused")}>
                  Pause
                </button>
                <button type="button" className="ss-camp__btn" disabled={isToggling} onClick={() => bulkSetStatus("active")}>
                  Resume
                </button>
                <button type="button" className="ss-camp__btn ss-camp__btn--danger" disabled={isDeleting} onClick={bulkDelete}>
                  Delete
                </button>
                <button type="button" className="ss-camp__text-btn" onClick={clearSelection}>
                  Clear selection
                </button>
              </div>
            )}

            <div className="ss-campaigns-index__div-create-campaigns-to">
              {filtered.length === 0 ? (
                <Box padding="400">
                  <EmptyState heading="Create a discount campaign" image="">
                    <p className="ss-campaigns-index__p-create-campaigns-to">Create campaigns to apply discounts to your products automatically</p>
                    <Box paddingBlockStart="400">
                      <Button variant="primary" onClick={() => navigate("/app/campaigns/create")}>
                        Create campaign
                      </Button>
                    </Box>
                  </EmptyState>
                </Box>
              ) : (
                <div className="ss-camp__table-wrap">
                  <table className="ss-camp__table">
                    <thead>
                      <tr className="ss-camp__head-row">
                        <th className="ss-camp__th ss-camp__th--check">
                          <input
                            ref={headerCheckRef}
                            type="checkbox"
                            className="ss-camp__check"
                            aria-label="Select all campaigns"
                            checked={allVisibleSelected}
                            onChange={toggleAllVisible}
                          />
                        </th>
                        <th className="ss-camp__th">Campaign</th>
                        <th className="ss-camp__th">Type</th>
                        <th className="ss-camp__th">Discount</th>
                        <th className="ss-camp__th">Applies to</th>
                        <th className="ss-camp__th">Status</th>
                        <th className="ss-camp__th">Start date</th>
                        <th className="ss-camp__th">End date</th>
                        <th className="ss-camp__th">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c: any) => {
                        const meta = TYPE_META[c.type] || TYPE_META.bulk_price;
                        const isSelected = selectedResources.includes(c.id);
                        return (
                          <tr key={c.id} className={`ss-camp__row${isSelected ? " ss-camp__row--selected" : ""}`}>
                            <td className="ss-camp__td ss-camp__td--check">
                              <input
                                type="checkbox"
                                className="ss-camp__check"
                                aria-label={`Select ${c.name}`}
                                checked={isSelected}
                                onChange={(e) => toggleRow(c.id, e.target.checked)}
                              />
                            </td>
                            <td className="ss-camp__td ss-camp__td--name">
                              <div className="ss-camp__name-cell">
                                <span className={`ss-camp__type-icon ss-camp__tone--${meta.tone}`} aria-hidden="true">
                                  <TypeIcon type={c.type} />
                                </span>
                                <div className="ss-camp__name-text">
                                  <button
                                    type="button"
                                    className="ss-camp__name"
                                    onClick={() => navigate(`/app/campaigns/${c.id}`)}
                                  >
                                    {c.name}
                                  </button>
                                  <span className="ss-camp__name-sub">{meta.subtitle}</span>
                                </div>
                              </div>
                            </td>
                            <td className="ss-camp__td" data-label="Type">
                              <span className={`ss-camp__type-pill ss-camp__tone--${meta.tone}`}>
                                {TYPE_LABELS[c.type] || c.type}
                              </span>
                            </td>
                            <td className="ss-camp__td ss-camp__td--muted" data-label="Discount">{getDiscountDisplay(c)}</td>
                            <td className="ss-camp__td" data-label="Applies to">
                              <span className="ss-camp__applies">{c.appliesToDisplay}</span>
                              {c.appliesToItems && c.appliesToItems.length > 0 && (
                                <span className="ss-camp__applies-items">
                                  {c.appliesToItems.slice(0, 3).map((item: string, idx: number) => (
                                    <span key={idx} className="ss-camp__applies-item">{item}</span>
                                  ))}
                                  {c.appliesToItems.length > 3 && (
                                    <span className="ss-camp__applies-item">+{c.appliesToItems.length - 3} more</span>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="ss-camp__td" data-label="Status">
                              <span className={`ss-camp__status ss-camp__status--${c.status}`}>
                                <span className="ss-camp__status-dot" />
                                {STATUS_LABELS[c.status] || c.status}
                              </span>
                            </td>
                            <td className="ss-camp__td ss-camp__td--muted" data-label="Start date">{c.startDate}</td>
                            <td className="ss-camp__td ss-camp__td--muted" data-label="End date">{c.endDate}</td>
                            <td className="ss-camp__td ss-camp__td--actions">
                              <div className="ss-camp__actions">
                                <button
                                  type="button"
                                  className="ss-camp__btn"
                                  onClick={() => navigate(`/app/campaigns/edit/${c.id}`)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="ss-camp__btn ss-camp__btn--toggle"
                                  disabled={isToggling}
                                  onClick={() => handleToggle(c.id)}
                                >
                                  {isToggling ? "…" : c.status === "active" ? "Pause" : "Activate"}
                                </button>
                                <div className="ss-camp__menu-wrap">
                                  <button
                                    type="button"
                                    className="ss-camp__btn ss-camp__btn--icon"
                                    aria-label={`More actions for ${c.name}`}
                                    aria-expanded={openMenuId === c.id}
                                    onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                                  >
                                    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                                      <circle cx="4.5" cy="10" r="1.7" fill="#111827" />
                                      <circle cx="10" cy="10" r="1.7" fill="#111827" />
                                      <circle cx="15.5" cy="10" r="1.7" fill="#111827" />
                                    </svg>
                                  </button>
                                  {openMenuId === c.id && (
                                    <div className="ss-camp__menu" role="menu">
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="ss-camp__menu-item"
                                        onClick={() => { setOpenMenuId(null); navigate(`/app/campaigns/${c.id}`); }}
                                      >
                                        View details
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="ss-camp__menu-item ss-camp__menu-item--danger"
                                        disabled={isDeleting}
                                        onClick={() => { setOpenMenuId(null); handleDelete(c.id); }}
                                      >
                                        {isDeleting ? "Deleting…" : "Delete"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </BlockStack>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Campaigns page design helpers                                       */
/* ------------------------------------------------------------------ */

const TYPE_META: Record<string, { tone: string; subtitle: string }> = {
  bulk_price: { tone: "orange", subtitle: "Auto discount campaign" },
  quantity_discount: { tone: "green", subtitle: "Quantity discount campaign" },
  buy_x_get_y: { tone: "blue", subtitle: "BOGO discount" },
  advanced_discount_code: { tone: "amber", subtitle: "Discount code campaign" },
  cart_goal: { tone: "teal", subtitle: "Cart goal campaign" },
  shipping_discount: { tone: "purple", subtitle: "Free shipping campaign" },
  shipping_protection: { tone: "slate", subtitle: "Shipping protection" },
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  paused: "Paused",
  draft: "Draft",
};

function TypeIcon({ type }: { type: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "buy_x_get_y":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7.5A1.5 1.5 0 014.5 6h15A1.5 1.5 0 0121 7.5V10a2 2 0 000 4v2.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5V14a2 2 0 000-4V7.5z" {...common} />
          <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" {...common} />
        </svg>
      );
    case "bulk_price":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 12.2V4.5a1 1 0 011-1h7.7l8.3 8.3a1.4 1.4 0 010 2l-6.2 6.2a1.4 1.4 0 01-2 0L3.5 12.2z" {...common} />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" />
        </svg>
      );
    case "shipping_discount":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" {...common} />
          <circle cx="6.5" cy="17" r="1.8" {...common} />
          <circle cx="17" cy="17" r="1.8" {...common} />
        </svg>
      );
    case "advanced_discount_code":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6L6 18" {...common} />
          <circle cx="7.5" cy="7.5" r="2.5" {...common} />
          <circle cx="16.5" cy="16.5" r="2.5" {...common} />
        </svg>
      );
    case "quantity_discount":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5" {...common} />
        </svg>
      );
    case "cart_goal":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H6.4" {...common} />
          <circle cx="9" cy="19" r="1.5" {...common} />
          <circle cx="17" cy="19" r="1.5" {...common} />
        </svg>
      );
    case "shipping_protection":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6L12 3z" {...common} />
          <path d="M8.8 12l2.2 2.2 4.2-4.4" {...common} />
        </svg>
      );
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6L6 18" {...common} />
          <circle cx="7.5" cy="7.5" r="2.5" {...common} />
          <circle cx="16.5" cy="16.5" r="2.5" {...common} />
        </svg>
      );
  }
}

function CouponIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 420 200" preserveAspectRatio="xMaxYMin meet">
      <defs>
        <linearGradient id="ssCampBlob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8EEFF" />
          <stop offset="1" stopColor="#D6E1FF" />
        </linearGradient>
        <linearGradient id="ssCampCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E4EBFF" />
        </linearGradient>
        <linearGradient id="ssCampBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F7FFF" />
          <stop offset="1" stopColor="#1F55EC" />
        </linearGradient>
        <linearGradient id="ssCampJar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C9D6FF" />
          <stop offset="1" stopColor="#A9BEFF" />
        </linearGradient>
      </defs>
      <path d="M20 200C50 140 110 110 180 112c70 2 100-50 160-70 40-13 70-6 80 0v158H20z" fill="url(#ssCampBlob)" />
      <path d="M260 40c20-16 50-20 76-8" stroke="#DCE5FF" strokeWidth="12" fill="none" strokeLinecap="round" />
      {/* jar behind card */}
      <rect x="232" y="48" width="44" height="64" rx="12" fill="url(#ssCampJar)" />
      <rect x="236" y="40" width="36" height="14" rx="6" fill="#B8C8FF" />
      {/* coupon card */}
      <g transform="rotate(-10 250 120)">
        <rect x="168" y="76" width="140" height="98" rx="16" fill="url(#ssCampCard)" />
        <rect x="190" y="106" width="34" height="30" rx="6" fill="#DCE5FF" />
      </g>
      <g transform="rotate(-10 262 124)">
        <rect x="228" y="96" width="78" height="64" rx="10" fill="url(#ssCampBlue)" />
        <circle cx="228" cy="128" r="9" fill="#F3F6FF" />
        <text x="270" y="140" textAnchor="middle" fontSize="34" fontWeight="700" fill="#fff" fontFamily="inherit">%</text>
      </g>
      {/* accents */}
      <circle cx="262" cy="18" r="9" fill="none" stroke="#8FA9F5" strokeWidth="3" />
      <path d="M170 56l12 4-8 8z" fill="#3B6CF6" />
      <path d="M314 150c10-6 22 0 20 12-2 9-14 12-20 5" fill="none" stroke="#3B6CF6" strokeWidth="3" strokeLinecap="round" />
      <path d="M306 150l6 3-6 4" fill="none" stroke="#3B6CF6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const campaignStyles = `
.ss-camp {
  --c-blue: #1F5EFF;
  --c-blue-dark: #0B4BF0;
  --c-ink: #0B1220;
  --c-muted: #4B5563;
  --c-line: #E8ECF3;
  color: var(--c-ink);
  background: linear-gradient(180deg, #F3F6FE 0%, #F6F8FC 30%, #F7F8FB 100%);
  border-radius: 20px;
  padding: 20px 18px 26px;
  position: relative;
  overflow: hidden;
}
  .Polaris-Page.Polaris-Page--fullWidth {
    background: linear-gradient(180deg, #F3F6FE 0%, #F6F8FC 30%, #F7F8FB 100%) !important;
}
    .Polaris-Page__Content {
    max-width: 1300px !important;
    margin: 0 auto;
}
.ss-camp * { box-sizing: border-box; }
.ss-camp button, .ss-camp input { font-family: inherit; }

/* header */
.ss-camp__hero { position: relative; display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; min-height: 150px; padding: 36px 0 0; }
.ss-camp__hero-art { position: absolute; top: -10px; right: 0px; width: min(40%, 420px); height: 190px; pointer-events: none; }
.ss-camp__hero-text { position: relative; z-index: 1; min-width: 0; }
.ss-camp__title-row { display: flex; align-items: center; gap: 14px; }
.ss-camp__back { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; background: none; border-radius: 10px; cursor: pointer; }
.ss-camp__back:hover { background: rgba(15, 23, 42, 0.06); }
.ss-camp__title { margin: 0; font-size: clamp(26px, 3vw, 32px); font-weight: 800; letter-spacing: -0.02em; }
.ss-camp__subtitle { margin: 10px 0 0 50px; font-size: 16px; color: #374151; }
.ss-camp__create {
  position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 12px; flex-shrink: 0;
  padding: 0 26px; min-height: 52px; border: 0; border-radius: 10px; cursor: pointer;
  background: var(--c-blue-dark); color: #fff; font-size: 17px; font-weight: 600;
  box-shadow: 0 8px 20px rgba(11, 75, 240, 0.25);
}
.ss-camp__create:hover { background: #0940D1; }

.ss-camp__banners { position: relative; z-index: 2; display: flex; flex-direction: column; gap: 12px; }
.ss-camp__banners:not(:empty) { margin-bottom: 16px; }

/* plan bar */
.ss-camp__plan {
  position: relative; z-index: 2; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  background: #fff; border-radius: 16px; padding: 20px 22px; box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06); margin-top: 50px;
}
.ss-camp__plan-col { display: flex; align-items: center; gap: 18px; padding: 0 28px; min-width: 0; }
.ss-camp__plan-col:first-child { padding-left: 0; }
.ss-camp__plan-col + .ss-camp__plan-col { border-left: 2px solid #E5E7EB; }
.ss-camp__plan-icon { flex-shrink: 0; width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.ss-camp__plan-icon svg { width: 28px; height: 28px; }
.ss-camp__plan-icon--orange { background: #FFF1DD; }
.ss-camp__plan-icon--blue { background: #E7EEFF; }
.ss-camp__plan-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ss-camp__plan-info--grow { flex: 1; }
.ss-camp__plan-label { font-size: 15px; color: #4B5563; }
.ss-camp__plan-value { font-size: 19px; font-weight: 800; white-space: nowrap; }
.ss-camp__upgrade {
  margin-left: auto; padding: 0 20px; min-height: 44px; border: 0; border-radius: 10px; cursor: pointer;
  background: #EEEBFF; color: #3B2BDB; font-size: 17px; font-weight: 700;
}
.ss-camp__upgrade:hover { background: #E3DEFF; }
.ss-camp__plan-progress { display: flex; align-items: center; gap: 22px; }
.ss-camp__bar { flex: 1; height: 11px; background: #E5E7EB; border-radius: 999px; overflow: hidden; }
.ss-camp__bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--c-blue-dark), var(--c-blue)); transition: width .4s ease; }

/* list card */
.ss-camp__list { margin-top: 26px; background: #fff; border-radius: 16px; padding: 18px 18px 8px; box-shadow: 0 6px 24px rgba(15, 23, 42, 0.05); }
.ss-camp__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid var(--c-line); }
.ss-camp__tabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ss-camp__tab {
  position: relative; padding: 0 22px; min-height: 48px; border: 0; background: none; cursor: pointer;
  font-size: 16px; color: #374151; border-radius: 10px 10px 0 0;
}
.ss-camp__tab:hover { color: var(--c-ink); background: #F5F7FB; }
.ss-camp__tab--active { background: #E9F0FF; color: var(--c-blue-dark); font-weight: 700; font-size: 18px; }
.ss-camp__tab--active::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 3px; border-radius: 3px; background: var(--c-blue-dark); }
.ss-camp__tab--active:hover { background: #E9F0FF; color: var(--c-blue-dark); }
.ss-camp__tab--add { padding: 0 14px; display: inline-flex; align-items: center; }

.ss-camp__tools { position: relative; display: flex; align-items: center; gap: 10px; padding-bottom: 8px; }
.ss-camp__search {
  display: flex; align-items: center; gap: 10px; width: 210px; max-width: 100%; height: 42px; padding: 0 12px;
  border: 1px solid #D1D5DB; border-radius: 8px; background: #fff; cursor: text;
}
.ss-camp__search:focus-within { border-color: var(--c-blue); box-shadow: 0 0 0 3px rgba(31, 94, 255, 0.12); }
.ss-camp__search svg { flex-shrink: 0; }
.ss-camp__search-input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font-size: 15px; color: var(--c-ink); }
.ss-camp__search-input::placeholder { color: #9CA3AF; }
.ss-camp__filter-btn {
  position: relative; display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px;
  border: 1px solid #D1D5DB; border-radius: 8px; background: #fff; cursor: pointer;
}
.ss-camp__filter-btn:hover, .ss-camp__filter-btn--on { background: #F3F6FF; border-color: #B9C8F5; }
.ss-camp__filter-count {
  position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  background: var(--c-blue-dark); color: #fff; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center;
}
.ss-camp__filter-panel {
  position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; width: 300px; max-height: 70vh; overflow: auto;
  background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 14px 40px rgba(15, 23, 42, 0.16);
  display: flex; flex-direction: column; gap: 14px;
}
.ss-camp__filter-group { display: flex; flex-direction: column; gap: 6px; }
.ss-camp__filter-group + .ss-camp__filter-group { border-top: 1px solid var(--c-line); padding-top: 12px; }
.ss-camp__filter-title { font-size: 13px; font-weight: 700; color: var(--c-ink); }
.ss-camp__filter-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--c-line); padding-top: 12px; }

.ss-camp__chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 4px 0; }
.ss-camp__chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 12px; border-radius: 999px; background: #EEF3FF; color: #1E3A8A; font-size: 13px; }
.ss-camp__chip button { border: 0; background: none; cursor: pointer; font-size: 16px; line-height: 1; color: #1E3A8A; padding: 0 4px; }

.ss-camp__bulk { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; padding: 10px 14px; border-radius: 12px; background: #EEF3FF; }
.ss-camp__bulk-count { font-weight: 700; margin-right: 6px; }

/* buttons */
.ss-camp__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; padding: 0 16px;
  border: 1px solid #D1D5DB; border-radius: 8px; background: #fff; color: var(--c-ink);
  font-size: 15px; font-weight: 500; cursor: pointer; white-space: nowrap;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.ss-camp__btn:hover { background: #F9FAFB; border-color: #9CA3AF; }
.ss-camp__btn:disabled { opacity: .55; cursor: default; }
.ss-camp__btn--toggle { min-width: 80px; }
.ss-camp__btn--icon { width: 40px; padding: 0; }
.ss-camp__btn--danger { color: #B91C1C; border-color: #FCA5A5; }
.ss-camp__btn--danger:hover { background: #FEF2F2; border-color: #F87171; }
.ss-camp__text-btn { border: 0; background: none; padding: 4px 6px; color: var(--c-blue-dark); font-size: 14px; font-weight: 600; cursor: pointer; }
.ss-camp__text-btn:hover { text-decoration: underline; }
.ss-camp button:focus-visible, .ss-camp input:focus-visible { outline: 2px solid var(--c-blue); outline-offset: 2px; }

/* table */
.ss-camp__table-wrap { overflow-x: auto; margin-top: 14px; }
.ss-camp__table { width: 100%; min-width: 1000px; border-collapse: separate; border-spacing: 0; }
.ss-camp__head-row .ss-camp__th { background: #F4F6FA; }
.ss-camp__head-row .ss-camp__th:first-child { border-radius: 12px 0 0 12px; }
.ss-camp__head-row .ss-camp__th:last-child { border-radius: 0 12px 12px 0; }
.ss-camp__th { text-align: left; padding: 18px 10px; font-size: 14px; font-weight: 500; color: #1F2937; white-space: nowrap; }
.ss-camp__th--check, .ss-camp__td--check { width: 48px; padding-left: 8px; padding-right: 4px; }
.ss-camp__td { padding: 20px 10px; font-size: 14px; vertical-align: middle; border-bottom: 1px solid var(--c-line); }
.ss-camp__row:last-child .ss-camp__td { border-bottom: 0; }
.ss-camp__row:hover .ss-camp__td { background: #FAFBFE; }
.ss-camp__row--selected .ss-camp__td, .ss-camp__row--selected:hover .ss-camp__td { background: #F2F6FF; }
.ss-camp__td--muted { color: #4B5563; white-space: nowrap; }
.ss-camp__check { width: 20px; height: 20px; margin: 0; accent-color: var(--c-blue-dark); cursor: pointer; }

.ss-camp__name-cell { display: flex; align-items: center; gap: 12px; min-width: 230px; }
.ss-camp__type-icon { flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
.ss-camp__name-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ss-camp__name {
  border: 0; background: none; padding: 0; text-align: left; cursor: pointer;
  color: var(--c-blue-dark); font-size: 12.5px; font-weight: 600; max-width: 230px; overflow-wrap: break-word; word-break: break-word;
}
.ss-camp__name:hover { text-decoration: underline; }
.ss-camp__name-sub { font-size: 13px; color: #4B5563; }

.ss-camp__type-pill { display: inline-block; padding: 7px 12px; border-radius: 8px; font-size: 14px; white-space: nowrap; }
.ss-camp__tone--blue { background: #E8F0FF; color: #1D4ED8; }
.ss-camp__tone--orange { background: #FFF0E0; color: #B45309; }
.ss-camp__tone--amber { background: #FFF2E2; color: #C2410C; }
.ss-camp__tone--purple { background: #F1EBFF; color: #6D28D9; }
.ss-camp__tone--green { background: #E7F8EE; color: #15803D; }
.ss-camp__tone--teal { background: #E2F7F5; color: #0F766E; }
.ss-camp__tone--slate { background: #EEF1F5; color: #334155; }
.ss-camp__type-icon.ss-camp__tone--orange { background: #FFE9EC; color: #E11D48; }
.ss-camp__type-icon.ss-camp__tone--blue { background: #E8F0FF; color: #2563EB; }

.ss-camp__applies { display: block; font-weight: 700; white-space: nowrap; }
.ss-camp__applies-items { display: flex; flex-direction: column; margin-top: 4px; }
.ss-camp__applies-item { font-size: 12px; color: #6B7280; }

.ss-camp__status { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 8px; font-size: 14px; white-space: nowrap; background: #EEF1F5; color: #374151; }
.ss-camp__status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.ss-camp__status--active { background: #E3F8EA; color: #15803D; }
.ss-camp__status--scheduled { background: #E6EFFF; color: #1D4ED8; }
.ss-camp__status--paused { background: #FFF4D6; color: #A16207; }
.ss-camp__status--draft { background: #F1EBFF; color: #6D28D9; }
.ss-camp__status--expired { background: #EEF1F5; color: #4B5563; }

.ss-camp__actions { display: flex; align-items: center; gap: 8px; padding-right: 4px; }
.ss-camp__menu-wrap { position: relative; }
.ss-camp__menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 30; min-width: 170px; padding: 6px;
  background: #fff; border-radius: 10px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
}
.ss-camp__menu-item {
  display: block; width: 100%; text-align: left; padding: 9px 12px; border: 0; background: none;
  border-radius: 7px; font-size: 14px; color: var(--c-ink); cursor: pointer;
}
.ss-camp__menu-item:hover { background: #F3F6FF; }
.ss-camp__menu-item--danger { color: #B91C1C; }
.ss-camp__menu-item--danger:hover { background: #FEF2F2; }
.ss-camp__menu-item:disabled { opacity: .55; cursor: default; }

/* responsive */
@media (max-width: 1100px) {
  .ss-camp__hero-art { right: 0; opacity: .5; }
  .ss-camp__plan { grid-template-columns: minmax(0, 1fr); row-gap: 16px; }
  .ss-camp__plan-col { padding: 0; }
  .ss-camp__plan-col + .ss-camp__plan-col { border-left: 0; border-top: 2px solid #E5E7EB; padding-top: 16px; }
}
/* Tablets and phones: the 9-column table becomes a list of cards, two per row
   on iPads and one per row on phones. Each cell shows its data-label. */
@media (max-width: 1024px) {
  .ss-camp__table-wrap { overflow: visible; }
  .ss-camp__table, .ss-camp__table thead { display: block; min-width: 0; }
  /* The header shrinks to its "select all" checkbox. */
  .ss-camp__head-row { display: flex; align-items: center; }
  .ss-camp__head-row .ss-camp__th { display: none; }
  .ss-camp__head-row .ss-camp__th--check {
    display: flex; align-items: center; gap: 10px; width: auto;
    padding: 0 4px 12px; background: none; border-radius: 0;
  }
  .ss-camp__th--check::after { content: "Select all"; font-weight: 500; color: #374151; }
  .ss-camp__table tbody { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .ss-camp__row {
    position: relative; display: flex; flex-direction: column; min-width: 0;
    padding: 14px; border: 1px solid var(--c-line); border-radius: 14px; background: #fff;
  }
  .ss-camp__row--selected { background: #F2F6FF; border-color: #C7D7FE; }
  .ss-camp__row .ss-camp__td,
  .ss-camp__row:hover .ss-camp__td,
  .ss-camp__row--selected .ss-camp__td,
  .ss-camp__row--selected:hover .ss-camp__td { background: none; }
  .ss-camp__td {
    display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 2px 12px;
    padding: 6px 0; border-bottom: 0; white-space: normal; text-align: right;
  }
  .ss-camp__td::before { content: attr(data-label); grid-column: 1; text-align: left; font-size: 13px; color: #6B7280; }
  .ss-camp__td:not([data-label])::before { content: none; }
  .ss-camp__td > * { grid-column: 2; justify-self: end; }
  .ss-camp__applies-items { align-items: flex-end; }
  .ss-camp__td--check { position: absolute; top: 14px; right: 14px; display: block; width: auto; padding: 0; }
  .ss-camp__td--name { display: block; padding: 0 34px 8px 0; text-align: left; }
  .ss-camp__name-cell { min-width: 0; }
  .ss-camp__name { max-width: none; font-size: 15px; }
  .ss-camp__td--actions { display: block; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--c-line); }
  .ss-camp__td--actions .ss-camp__actions { padding-right: 0; }
  .ss-camp__td--actions .ss-camp__btn:not(.ss-camp__btn--icon) { flex: 1; }
}
@media (max-width: 700px) {
  .ss-camp__table tbody { grid-template-columns: minmax(0, 1fr); }
}
@media (pointer: coarse) {
  .ss-camp__check { width: 22px; height: 22px; }
}
@media (max-width: 700px) {
  .ss-camp { padding: 14px 10px 20px; }
  .ss-camp__hero { flex-direction: column; padding-top: 10px; min-height: 0; margin-bottom: 18px; }
  .ss-camp__subtitle { margin-left: 0; font-size: 15px; }
  .ss-camp__create { width: 100%; justify-content: center; }
  .ss-camp__hero-art { width: 70%; opacity: .35; }
  .ss-camp__plan { padding: 16px; }
  .ss-camp__list { padding: 12px 10px 6px; }
  .ss-camp__tools { width: 100%; }
  .ss-camp__search { flex: 1; width: auto; }
  .ss-camp__tabs { flex-wrap: nowrap; overflow-x: auto; max-width: 100%; }
  .ss-camp__tab { padding: 0 12px; font-size: 15px; flex-shrink: 0; }
  .ss-camp__tab--active { font-size: 16px; }
  .ss-camp__filter-panel { width: min(300px, calc(100vw - 48px)); }
}
`;
