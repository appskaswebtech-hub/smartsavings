import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import db from "./db.server";
import {
  SHIPPING_PROTECTION,
  isProtectionPublishable,
  parseProtectionConfig,
  protectionConflict,
  type ProtectionConfig,
} from "./lib/shippingProtection";

/**
 * Publishes the shop's active Shipping protection campaign to the two places
 * the storefront reads it from:
 *
 *   1. Shop metafield $app:smartsavings/shipping_protection — the checkout UI
 *      extension (extensions/shipping-protection-checkout) renders from it.
 *   2. The same metafield on this app's CartTransform — the
 *      shipping-protection-transform function prices the fee line from it.
 *
 * Both hold every active, publishable campaign ({ campaigns: [...] }) — a shop
 * can run several, each covering different products. With none active both
 * metafields are removed, which hides the widget and stops the pricing.
 *
 * Idempotent: every create/edit/pause/resume/delete of a protection campaign
 * calls it, so none of those paths needs its own Shopify logic. Returns error
 * messages (empty on success).
 */

const NAMESPACE = "$app:smartsavings";
const KEY = "shipping_protection";
// "name" in extensions/shipping-protection-transform/locales/en.default.json.
const TRANSFORM_FUNCTION_TITLE = "shipping-protection-transform";

async function gql(admin: AdminApiContext, query: string, variables?: Record<string, unknown>) {
  const res = await admin.graphql(query, variables ? { variables } : undefined);
  return res.json();
}

async function findTransformFunctionId(admin: AdminApiContext): Promise<string | null> {
  const data = await gql(
    admin,
    `#graphql
    query ShippingProtectionFunctions {
      shopifyFunctions(first: 25) {
        nodes { id apiType title }
      }
    }`
  );
  const nodes: { id: string; apiType: string; title: string }[] =
    data?.data?.shopifyFunctions?.nodes || [];
  return (
    nodes.find((n) => n.apiType === "cart_transform" && n.title === TRANSFORM_FUNCTION_TITLE)?.id ??
    null
  );
}

/** Returns the id of this app's CartTransform, creating it on first use. */
async function ensureCartTransform(admin: AdminApiContext): Promise<{ id: string | null; error?: string }> {
  const functionId = await findTransformFunctionId(admin);
  if (!functionId) {
    return {
      id: null,
      error: "The shipping protection pricing function isn't deployed yet. Deploy the app and try again.",
    };
  }

  const existing = await gql(
    admin,
    `#graphql
    query ShippingProtectionTransforms {
      cartTransforms(first: 25) { nodes { id functionId } }
    }`
  );
  const nodes: { id: string; functionId: string }[] = existing?.data?.cartTransforms?.nodes || [];
  const match = nodes.find((n) => n.functionId === functionId);
  if (match) return { id: match.id };

  const created = await gql(
    admin,
    `#graphql
    mutation ShippingProtectionTransformCreate($functionId: String!) {
      cartTransformCreate(functionId: $functionId, blockOnFailure: false) {
        cartTransform { id }
        userErrors { field message }
      }
    }`,
    { functionId }
  );
  const result = created?.data?.cartTransformCreate;
  if (result?.userErrors?.length) {
    return { id: null, error: result.userErrors.map((e: any) => e.message).join(", ") };
  }
  return { id: result?.cartTransform?.id ?? null };
}

async function getShopGid(admin: AdminApiContext): Promise<string | null> {
  const data = await gql(admin, `#graphql
    query ShippingProtectionShopId { shop { id } }`);
  return data?.data?.shop?.id ?? null;
}

async function setJsonMetafields(
  admin: AdminApiContext,
  entries: { ownerId: string; value: unknown }[]
): Promise<string[]> {
  const data = await gql(
    admin,
    `#graphql
    mutation ShippingProtectionMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      metafields: entries.map((e) => ({
        ownerId: e.ownerId,
        namespace: NAMESPACE,
        key: KEY,
        type: "json",
        value: JSON.stringify(e.value),
      })),
    }
  );
  return (data?.data?.metafieldsSet?.userErrors || []).map((e: any) => e.message);
}

async function deleteMetafields(admin: AdminApiContext, ownerIds: string[]): Promise<string[]> {
  const data = await gql(
    admin,
    `#graphql
    mutation ShippingProtectionMetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
      metafieldsDelete(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    { metafields: ownerIds.map((ownerId) => ({ ownerId, namespace: NAMESPACE, key: KEY })) }
  );
  return (data?.data?.metafieldsDelete?.userErrors || []).map((e: any) => e.message);
}

export async function syncShippingProtection(admin: AdminApiContext, shop: string): Promise<string[]> {
  try {
    // Several campaigns can be active, each covering different products
    // (protectionConflict keeps them from overlapping).
    const campaigns = await db.campaign.findMany({
      where: { shop, type: SHIPPING_PROTECTION, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    // Incomplete configs (e.g. converted from an older shape with no fee product
    // yet) are left out, never half-published.
    const live = campaigns
      .map((campaign) => ({
        campaign,
        config: parseProtectionConfig(campaign.protectionConfig, campaign.discountValue),
      }))
      .filter((entry): entry is { campaign: (typeof campaigns)[number]; config: ProtectionConfig } =>
        isProtectionPublishable(entry.config)
      );

    const shopId = await getShopGid(admin);
    if (!shopId) return ["Couldn't read the shop from Shopify."];

    if (live.length === 0) {
      const ownerIds = [shopId];
      // Only look the transform up — never create one just to clear it.
      const functionId = await findTransformFunctionId(admin);
      if (functionId) {
        const existing = await gql(admin, `#graphql
          query ShippingProtectionTransformsForClear { cartTransforms(first: 25) { nodes { id functionId } } }`);
        const match = (existing?.data?.cartTransforms?.nodes || []).find(
          (n: any) => n.functionId === functionId
        );
        if (match) ownerIds.push(match.id);
      }
      return deleteMetafields(admin, ownerIds);
    }

    const transform = await ensureCartTransform(admin);
    if (!transform.id) return [transform.error || "Couldn't set up the shipping protection pricing function."];

    const productIdsOf = (config: ProtectionConfig) =>
      config.appliesTo === "all" ? [] : config.products.map((p) => p.productId);

    return setJsonMetafields(admin, [
      {
        ownerId: shopId,
        value: {
          campaigns: live.map(({ campaign, config }) => ({
            heading: config.heading,
            title: config.title,
            subtitle: config.subtitle,
            description: config.description,
            pricingType: config.pricingType,
            percentage: config.percentage,
            fixedAmount: config.fixedAmount,
            currencyCode: config.currencyCode,
            feeProductId: config.feeProductId,
            feeVariantId: config.feeVariantId,
            imageUrl: config.feeImageUrl || null,
            appliesTo: config.appliesTo,
            productIds: productIdsOf(config),
            startsAt: campaign.startDate ? campaign.startDate.toISOString() : null,
            endsAt: campaign.endDate ? campaign.endDate.toISOString() : null,
          })),
        },
      },
      {
        ownerId: transform.id,
        value: {
          campaigns: live.map(({ config }) => ({
            feeProductId: config.feeProductId,
            // The fee line is expanded into this and priced (works on every plan).
            componentVariantId: config.componentVariantId,
            pricingType: config.pricingType,
            percentage: config.percentage,
            fixedAmount: config.fixedAmount,
            appliesTo: config.appliesTo,
            productIds: productIdsOf(config),
          })),
        },
      },
    ]);
  } catch (error) {
    console.error("[shippingProtection] sync failed", { shop, error });
    return [`Shipping protection sync failed: ${error instanceof Error ? error.message : String(error)}`];
  }
}

/**
 * Why this campaign can't be active alongside the shop's others, or null.
 * Campaigns may overlap in time as long as they cover different products —
 * see protectionConflict for the rules.
 */
export async function findProtectionConflict(
  shop: string,
  incoming: Pick<ProtectionConfig, "appliesTo" | "products">,
  excludeId?: string
): Promise<string | null> {
  const others = await db.campaign.findMany({
    where: {
      shop,
      type: SHIPPING_PROTECTION,
      status: "active",
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { name: true, discountValue: true, protectionConfig: true },
  });

  return protectionConflict(
    others.map((other) => {
      const config = parseProtectionConfig(other.protectionConfig, other.discountValue);
      return {
        name: other.name,
        appliesTo: config?.appliesTo ?? "all",
        products: config?.products ?? [],
      };
    }),
    incoming
  );
}

/**
 * Checkout-step blocks (information/shipping/payment) only render on Shopify
 * Plus — including Plus-feature development stores, but not e.g. "Basic App
 * Development" ones, which report partnerDevelopment without shopifyPlus.
 * Pricing is unaffected: it uses Cart Transform expand operations, which run
 * on every plan. Drives the admin banner; assumes supported if the lookup
 * fails so a flaky call can't cry wolf.
 */
export async function getProtectionShopInfo(
  admin: AdminApiContext
): Promise<{ supported: boolean; currencyCode: string }> {
  try {
    const data = await gql(admin, `#graphql
      query ShippingProtectionShopPlan {
        shop { currencyCode plan { shopifyPlus publicDisplayName } }
      }`);
    const shop = data?.data?.shop;
    return {
      supported: !shop?.plan || !!shop.plan.shopifyPlus || /plus/i.test(shop.plan.publicDisplayName || ""),
      currencyCode: shop?.currencyCode || "USD",
    };
  } catch {
    return { supported: true, currencyCode: "USD" };
  }
}
