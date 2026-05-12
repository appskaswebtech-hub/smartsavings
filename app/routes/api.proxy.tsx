// import { json, type LoaderFunctionArgs } from "@remix-run/node";
// import db from "../db.server";

// /**
//  * App Proxy endpoint: /apps/smartdiscounts
//  * Returns active campaign data as JSON for theme extension widgets.
//  * Called by the storefront JavaScript in the discount table and cart goal blocks.
//  */
// export const loader = async ({ request }: LoaderFunctionArgs) => {
//   const url = new URL(request.url);
//   const shop = url.searchParams.get("shop") || "";

//   if (!shop) {
//     return json({ campaigns: [] }, {
//       headers: { "Access-Control-Allow-Origin": "*" },
//     });
//   }

//   try {
//     const campaigns = await db.campaign.findMany({
//       where: { shop, status: "active" },
//       orderBy: { createdAt: "desc" },
//     });

//     const campaignData = campaigns.map((c) => {
//       let tiers: any[] = [];
//       if (c.tiers) {
//         try { tiers = JSON.parse(c.tiers); } catch {}
//       }

//       let productIds: string[] = [];
//       if (c.productIds) {
//         try { productIds = JSON.parse(c.productIds); } catch {}
//       }

//       let collectionIds: string[] = [];
//       if (c.collectionIds) {
//         try { collectionIds = JSON.parse(c.collectionIds); } catch {}
//       }

//       return {
//         name: c.name,
//         type: c.type,
//         status: c.status,
//         discountType: c.discountType,
//         discountValue: c.discountValue,
//         appliesTo: c.appliesTo,
//         tiers,
//         productIds: productIds.map((id) => {
//           // Extract numeric ID from GID
//           const match = id.match(/\/(\d+)$/);
//           return match ? match[1] : id;
//         }),
//         collectionIds: collectionIds.map((id) => {
//           const match = id.match(/\/(\d+)$/);
//           return match ? match[1] : id;
//         }),
//       };
//     });

//     return json({ campaigns: campaignData }, {
//       headers: {
//         "Access-Control-Allow-Origin": "*",
//         "Content-Type": "application/json",
//       },
//     });
//   } catch (error) {
//     console.error("Proxy error:", error);
//     return json({ campaigns: [] }, {
//       headers: { "Access-Control-Allow-Origin": "*" },
//     });
//   }
// };



import { json, type LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // ✅ FIXED shop detection
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

      return {
        name: c.name,
        type: c.type,
        status: c.status,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minimumAmount: c.minimumAmount ?? c.minimumQuantity ?? null,
        geoTarget: c.geoTarget,
        appliesTo: c.appliesTo,
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