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

      // For tiered discounts (quantity/cart goal), the Shopify discount title
      // is formatted as "CampaignName - Buy X+" or "CampaignName - Spend $X+"
      // Check if the deleted discount title starts with any campaign name
      const allCampaigns = await db.campaign.findMany({
        where: { shop },
      });

      for (const campaign of allCampaigns) {
        if (discountTitle.startsWith(campaign.name)) {
          // Check if this is a tiered discount by seeing if other Shopify discounts
          // with the same campaign prefix still exist
          // For simplicity, we mark the campaign as expired instead of deleting
          // since deleting one tier shouldn't delete the whole campaign
          
          // But if user explicitly deleted from Shopify, they probably want it gone
          // So check if this is a single-discount campaign (not tiered)
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