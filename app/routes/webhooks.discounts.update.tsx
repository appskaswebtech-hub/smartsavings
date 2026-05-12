import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!shop) {
    return new Response("Shop not found", { status: 400 });
  }

  try {
    const discountTitle = payload?.title;
    const discountStatus = payload?.status;

    if (discountTitle && discountStatus) {
      // Map Shopify status to our app status
      const statusMap: Record<string, string> = {
        ACTIVE: "active",
        EXPIRED: "expired",
        SCHEDULED: "scheduled",
      };
      const newStatus = statusMap[discountStatus] || "paused";

      // Update exact match
      const updated = await db.campaign.updateMany({
        where: { shop, name: discountTitle },
        data: { status: newStatus },
      });

      if (updated.count > 0) {
        console.log(`Updated campaign "${discountTitle}" status to ${newStatus}`);
        return new Response("OK", { status: 200 });
      }

      // Check tiered discounts (title starts with campaign name)
      const allCampaigns = await db.campaign.findMany({ where: { shop } });
      for (const campaign of allCampaigns) {
        if (discountTitle.startsWith(campaign.name + " - ")) {
          await db.campaign.update({
            where: { id: campaign.id },
            data: { status: newStatus },
          });
          console.log(`Updated tiered campaign "${campaign.name}" status to ${newStatus}`);
          break;
        }
      }
    }
  } catch (error) {
    console.error("Error processing discount update webhook:", error);
  }

  return new Response("OK", { status: 200 });
};