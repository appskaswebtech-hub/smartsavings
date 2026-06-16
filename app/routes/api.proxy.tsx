import { json, type LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

/**
 * App Proxy endpoint: /apps/smartdiscounts
 * Returns active campaign data as JSON for theme extension widgets.
 *
 * Key fields returned for shipping_discount campaigns:
 *   minimumAmount   — dollar threshold (null if not applicable)
 *   minimumQuantity — item count threshold (null if not applicable)
 *   requirementType — "amount" | "quantity" | "both" | "either"
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  const shop =
    request.headers.get("x-shopify-shop-domain") ||
    url.searchParams.get("shop") ||
    "";

  if (!shop) {
    return json({ campaigns: [] });
  }

  try {
    const campaigns = await db.campaign.findMany({
      where: { shop, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    const campaignData = campaigns.map((c) => {
      let tiers: any[] = [];
      if (c.tiers) {
        try { tiers = JSON.parse(c.tiers); } catch {}
      }

      let productIds: string[] = [];
      if (c.productIds) {
        try { productIds = JSON.parse(c.productIds); } catch {}
      }

      let collectionIds: string[] = [];
      if (c.collectionIds) {
        try { collectionIds = JSON.parse(c.collectionIds); } catch {}
      }

      // Derive requirementType for legacy campaigns that don't have it stored
      const storedType = (c as any).requirementType as string | null | undefined;
      let requirementType = storedType || "amount";
      if (!storedType) {
        // Legacy fallback: derive from which fields are set
        const hasAmount = c.minimumAmount != null && c.minimumAmount > 0;
        const hasQty   = c.minimumQuantity != null && c.minimumQuantity > 0;
        if (hasAmount && hasQty) requirementType = "both";  // can't tell both vs either for legacy
        else if (hasQty)         requirementType = "quantity";
        else                     requirementType = "amount";
      }

      return {
        name:            c.name,
        type:            c.type,
        status:          c.status,
        discountType:    c.discountType,
        discountValue:   c.discountValue,
        minimumAmount:   c.minimumAmount   ?? null,   // keep separate — DO NOT merge with minimumQuantity
        minimumQuantity: c.minimumQuantity ?? null,
        requirementType,
        geoTarget:       c.geoTarget,
        appliesTo:       c.appliesTo,
        tiers,
        productIds: productIds.map((id) => {
          const match = id.match(/\/(\d+)$/);
          return match ? match[1] : id;
        }),
        collectionIds: collectionIds.map((id) => {
          const match = id.match(/\/(\d+)$/);
          return match ? match[1] : id;
        }),
      };
    });

    return json({ campaigns: campaignData });
  } catch (error) {
    console.error("Proxy error:", error);
    return json({ campaigns: [] });
  }
};