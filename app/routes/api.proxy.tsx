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



import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { sendDiscountCodeEmail } from "../email.server";
import { discountLabel } from "../lib/emailTemplate";

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

    // All widget customizations for this shop → { [widgetType]: config }
    // Powers the shared layout system (sd-widget-layout.js) and the popup/code-input styling.
    const customizations: Record<string, any> = {};
    try {
      const rows = await db.widgetCustomization.findMany({ where: { shop } });
      for (const row of rows) {
        try { customizations[row.widgetType] = JSON.parse(row.config); } catch {}
      }
    } catch {}

    const popupStyle = customizations["discount_popup"] ?? null;
    const codeInputStyle = customizations["discount_code_input"] ?? null;

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

      let popupPages: string[] = [];
      if (c.popupPages) {
        try { popupPages = JSON.parse(c.popupPages); } catch {}
      }

      return {
        id: c.id,
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
        // Email-capture popup config (NOTE: discountCode is intentionally NOT exposed here)
        popupEnabled: c.popupEnabled,
        popupPages,
        popupHeading: c.popupHeading,
        popupDescription: c.popupDescription,
        popupButtonText: c.popupButtonText,
        popupDelaySeconds: c.popupDelaySeconds,
        popupFrequencyValue: c.popupFrequencyValue,
        popupFrequencyUnit: c.popupFrequencyUnit,
      };
    });

    return json({ campaigns: campaignData, popupStyle, codeInputStyle, customizations });
  } catch (error) {
    console.error("Proxy error:", error);
    return json({ campaigns: [], popupStyle: null, codeInputStyle: null, customizations: {} });
  }
};

/**
 * POST /apps/smartdiscounts
 * Storefront email-capture popup submission. Validates the shop via the app-proxy
 * signature, emails the discount code via Gmail SMTP, records the submission, and
 * best-effort creates a Shopify customer.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  let admin: any;
  let shop = "";
  try {
    const auth = await authenticate.public.appProxy(request);
    admin = auth.admin;
    shop = auth.session?.shop || "";
  } catch (error) {
    console.error("Proxy action auth error:", error);
    return json({ success: false, error: "Unauthorized request." }, { status: 401 });
  }

  if (!shop) {
    return json({ success: false, error: "Missing shop." }, { status: 400 });
  }

  // Accept both form-encoded and JSON bodies
  let email = "";
  let campaignId = "";
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      email = (body.email || "").toString().trim().toLowerCase();
      campaignId = (body.campaignId || "").toString().trim();
    } else {
      const form = await request.formData();
      email = ((form.get("email") as string) || "").trim().toLowerCase();
      campaignId = ((form.get("campaignId") as string) || "").trim();
    }
  } catch {
    return json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) {
    return json({ success: false, error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!campaignId) {
    return json({ success: false, error: "Missing campaign." }, { status: 400 });
  }

  // Look up the campaign and confirm it's an eligible, popup-enabled code campaign
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (
    !campaign ||
    campaign.shop !== shop ||
    campaign.type !== "advanced_discount_code" ||
    !campaign.popupEnabled ||
    !campaign.discountCode
  ) {
    return json({ success: false, error: "This offer is no longer available." }, { status: 404 });
  }

  // Email content authored on the campaign. Newer campaigns store { blocks };
  // older ones store fixed fields; the template renders whichever is present, and
  // falls back to the on-site popup text if neither exists.
  let emailContent: {
    blocks?: any[];
    heading?: string;
    body?: string;
    buttonText?: string;
    buttonUrl?: string;
    footer?: string;
  } = {};
  if (campaign.emailContent) {
    try { emailContent = JSON.parse(campaign.emailContent); } catch {}
  }

  // Send the code via Gmail SMTP
  const emailResult = await sendDiscountCodeEmail({
    to: email,
    code: campaign.discountCode,
    campaignName: campaign.name,
    discountLabel: discountLabel(campaign.discountType, campaign.discountValue),
    shop,
    blocks: Array.isArray(emailContent.blocks) ? emailContent.blocks : undefined,
    heading: emailContent.heading || campaign.popupHeading,
    body: emailContent.body || campaign.popupDescription,
    buttonText: emailContent.buttonText,
    buttonUrl: emailContent.buttonUrl,
    footer: emailContent.footer,
  });

  if (!emailResult.success) {
    return json({ success: false, error: emailResult.error || "Could not send the email." }, { status: 502 });
  }

  // Record the submission (non-fatal on failure)
  try {
    await db.popupSubmission.create({
      data: { shop, campaignId, email, code: campaign.discountCode },
    });
  } catch (error) {
    console.error("PopupSubmission save error:", error);
  }

  // Best-effort: create a Shopify customer with marketing consent
  try {
    await admin.graphql(
      `#graphql
      mutation createCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            email,
            emailMarketingConsent: {
              marketingState: "SUBSCRIBED",
              marketingOptInLevel: "SINGLE_OPT_IN",
            },
            tags: ["smartsavings-popup"],
          },
        },
      }
    );
  } catch (error) {
    // Customer may already exist — that's fine, the email was still sent
    console.error("customerCreate error (non-fatal):", error);
  }

  return json({ success: true, message: "Check your inbox — your discount code is on its way!" });
};