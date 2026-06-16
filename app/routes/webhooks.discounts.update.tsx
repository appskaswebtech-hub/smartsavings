// import type { ActionFunctionArgs } from "@remix-run/node";
// import { authenticate } from "../shopify.server";
// import db from "../db.server";

// export const action = async ({ request }: ActionFunctionArgs) => {
//   const { shop, topic, payload } = await authenticate.webhook(request);

//   console.log(`Received ${topic} webhook for ${shop}`);

//   if (!shop) {
//     return new Response("Shop not found", { status: 400 });
//   }

//   try {
//     const discountTitle = payload?.title;
//     const discountStatus = payload?.status;

//     if (discountTitle && discountStatus) {
//       // Map Shopify status to our app status
//       const statusMap: Record<string, string> = {
//         ACTIVE: "active",
//         EXPIRED: "expired",
//         SCHEDULED: "scheduled",
//       };
//       const newStatus = statusMap[discountStatus] || "paused";

//       // Update exact match
//       const updated = await db.campaign.updateMany({
//         where: { shop, name: discountTitle },
//         data: { status: newStatus },
//       });

//       if (updated.count > 0) {
//         console.log(`Updated campaign "${discountTitle}" status to ${newStatus}`);
//         return new Response("OK", { status: 200 });
//       }

//       // Check tiered discounts (title starts with campaign name)
//       const allCampaigns = await db.campaign.findMany({ where: { shop } });
//       for (const campaign of allCampaigns) {
//         if (discountTitle.startsWith(campaign.name + " - ")) {
//           await db.campaign.update({
//             where: { id: campaign.id },
//             data: { status: newStatus },
//           });
//           console.log(`Updated tiered campaign "${campaign.name}" status to ${newStatus}`);
//           break;
//         }
//       }
//     }
//   } catch (error) {
//     console.error("Error processing discount update webhook:", error);
//   }

//   return new Response("OK", { status: 200 });
// };


import { authenticate } from "../shopify.server";
import db from "../db.server";
import type { ActionFunctionArgs } from "@remix-run/node";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] ${topic} for shop: ${shop}`);
  console.log(`[Webhook] Payload: ${JSON.stringify(payload, null, 2)}`);

  if (topic !== "DISCOUNTS_UPDATE" && topic !== "discounts/update") {
    return new Response("Unhandled topic", { status: 200 });
  }

  try {
    // Shopify sends the discount's admin GID as admin_graphql_api_id
    // e.g. "gid://shopify/DiscountAutomaticNode/12345"
    const shopifyDiscountId: string | null =
      payload?.admin_graphql_api_id || null;

    const discountTitle: string =
      payload?.title || payload?.discount?.title || "";

    const rawStatus: string =
      (payload?.status || payload?.discount?.status || "").toUpperCase();

    // Map Shopify status → our status
    const statusMap: Record<string, string> = {
      ACTIVE:    "active",
      SCHEDULED: "scheduled",
      EXPIRED:   "expired",
      DISABLED:  "paused",
    };
    const newStatus = statusMap[rawStatus] || null;

    if (!newStatus) {
      console.log(`[Webhook] Unknown status "${rawStatus}" — skipping`);
      return new Response("OK", { status: 200 });
    }

    let updateCount = 0;

    // ── Strategy 1: Match by Shopify discount ID (most reliable) ──────────
    if (shopifyDiscountId) {
      const result = await db.campaign.updateMany({
        where: { shop, shopifyDiscountId },
        data:  { status: newStatus },
      });
      updateCount = result.count;
      console.log(`[Webhook] ID match "${shopifyDiscountId}": updated ${updateCount} campaigns`);
    }

    // ── Strategy 2: Fallback — match by exact title ───────────────────────
    if (updateCount === 0 && discountTitle) {
      const result = await db.campaign.updateMany({
        where: { shop, name: discountTitle },
        data:  { status: newStatus },
      });
      updateCount = result.count;
      console.log(`[Webhook] Title match "${discountTitle}": updated ${updateCount} campaigns`);
    }

    // ── Strategy 3: Fallback — partial title match (e.g. tiered discounts) ─
    if (updateCount === 0 && discountTitle) {
      // Tiers are saved as "CampaignName (Buy 2+ Save 5%)" etc.
      // Strip the suffix and match the base name
      const baseName = discountTitle.replace(/\s*\(.*\)$/, "").trim();
      if (baseName && baseName !== discountTitle) {
        const result = await db.campaign.updateMany({
          where: { shop, name: { startsWith: baseName } },
          data:  { status: newStatus },
        });
        updateCount = result.count;
        console.log(`[Webhook] Base-name match "${baseName}": updated ${updateCount} campaigns`);
      }
    }

    if (updateCount === 0) {
      console.warn(`[Webhook] No campaigns matched for shop=${shop} id=${shopifyDiscountId} title="${discountTitle}"`);
    }
  } catch (error) {
    console.error(`[Webhook] Error processing discount update:`, error);
  }

  return new Response("OK", { status: 200 });
};