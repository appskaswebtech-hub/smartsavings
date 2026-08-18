import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log("Payload:", JSON.stringify(payload));

  if (!shop) {
    return new Response("Shop not found", { status: 400 });
  }

  try {
    // The payload contains the deleted discount's admin_graphql_api_id
    // Format: "gid://shopify/DiscountAutomaticNode/123" or "gid://shopify/DiscountCodeNode/123"
    const discountTitle = payload?.title;
    const discountId = payload?.admin_graphql_api_id;

    if (discountTitle) {
      // Find campaigns matching this discount title in our database
      // For quantity/cart goal discounts, the title format is "CampaignName - Buy X+" or "CampaignName - Spend $X+"
      // So we need to check if any campaign name is a prefix of the deleted discount title

      // First try exact match
      const exactMatch = await db.campaign.findMany({
        where: { shop, name: discountTitle },
      });

      if (exactMatch.length > 0) {
        await db.campaign.deleteMany({
          where: { shop, name: discountTitle },
        });
        console.log(`Deleted campaign(s) with exact name match: ${discountTitle}`);
        return new Response("OK", { status: 200 });
      }

      // Fallback for LEGACY tiered campaigns only. Those created one Shopify
      // discount per tier, titled "CampaignName (Buy X+ …)" / "(Spend $X+ …)",
      // so deleting one tier shouldn't delete the whole campaign — it's marked
      // expired instead.
      //
      // Tiered campaigns on the current scheme are a single discount titled
      // exactly the campaign name, so the exact-match branch above handles them
      // and this loop never sees them.
      const allCampaigns = await db.campaign.findMany({
        where: { shop },
      });

      for (const campaign of allCampaigns) {
        if (discountTitle.startsWith(campaign.name)) {
          if (
            campaign.type !== "quantity_discount" &&
            campaign.type !== "cart_goal"
          ) {
            await db.campaign.delete({ where: { id: campaign.id } });
            console.log(`Deleted campaign: ${campaign.name}`);
          } else {
            // For tiered campaigns, mark as expired since one tier was removed
            await db.campaign.update({
              where: { id: campaign.id },
              data: { status: "expired" },
            });
            console.log(`Marked tiered campaign as expired: ${campaign.name}`);
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error("Error processing discount delete webhook:", error);
  }

  return new Response("OK", { status: 200 });
};