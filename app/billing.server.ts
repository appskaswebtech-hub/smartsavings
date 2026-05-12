import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import db from "./db.server";

/**
 * Plan catalog used for displaying plan info and gating features.
 * In Managed Pricing, Shopify owns the actual subscription creation.
 * This catalog must MATCH what you configured in
 *   Partners → Apps → SmartSavings → Distribution → Managed pricing
 *
 * The `name` field must EXACTLY match the plan name in Shopify Partners,
 * because that's what we use to identify which plan a merchant is on.
 */
export const PLANS = {
  base: {
    id: "base",
    name: "Base",            // ← must match Partner Dashboard
    price: 9.99,
    currencyCode: "USD",
  },
  advanced: {
    id: "advanced",
    name: "Advanced",        // ← must match Partner Dashboard
    price: 19.99,
    currencyCode: "USD",
  },
  professional: {
    id: "professional",
    name: "Professional",    // ← must match Partner Dashboard
    price: 29.99,
    currencyCode: "USD",
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function isValidPlanId(id: string): id is PlanId {
  return id === "base" || id === "advanced" || id === "professional";
}

/**
 * Resolve a Shopify subscription name (e.g. "Base") to our internal plan ID.
 * Falls back to lowercased name if no exact match.
 */
function planIdFromName(name: string | null | undefined): PlanId | null {
  if (!name) return null;
  for (const plan of Object.values(PLANS)) {
    if (plan.name === name) return plan.id;
  }
  // Fuzzy fallback in case of casing differences
  const lower = name.toLowerCase().trim();
  if (lower === "base") return "base";
  if (lower === "advanced") return "advanced";
  if (lower === "professional") return "professional";
  return null;
}

/**
 * Look up the active app subscription for the shop directly from Shopify.
 * Returns the raw subscription, or null if none active.
 */
export async function fetchActiveSubscription(admin: AdminApiContext): Promise<{
  id: string;
  status: string;
  name: string;
  currentPeriodEnd: string | null;
} | null> {
  const response = await admin.graphql(
    `#graphql
    query {
      currentAppInstallation {
        activeSubscriptions {
          id
          status
          name
          currentPeriodEnd
        }
      }
    }`
  );
  const data = await response.json();
  const subs = data?.data?.currentAppInstallation?.activeSubscriptions || [];
  if (subs.length === 0) return null;
  return subs[0];
}

/**
 * Sync the live Shopify subscription state into our local DB.
 * Called from the gate in app.tsx and from the subscriptions_update webhook
 * so reads stay fast and offline-friendly.
 */
export async function syncSubscriptionFromShopify(
  admin: AdminApiContext,
  shop: string
): Promise<{ planId: PlanId | null; status: string }> {
  const active = await fetchActiveSubscription(admin);

  if (!active || active.status !== "ACTIVE") {
    // Mark any local row as cancelled
    await db.subscription.upsert({
      where: { shop },
      update: { status: "cancelled" },
      create: { shop, planId: "none", status: "cancelled" },
    });
    return { planId: null, status: "cancelled" };
  }

  const planId = planIdFromName(active.name);
  if (!planId) {
    console.warn(
      `[billing] subscription name "${active.name}" did not map to a known plan id`
    );
    return { planId: null, status: "active" };
  }

  await db.subscription.upsert({
    where: { shop },
    update: {
      planId,
      status: "active",
      shopifyChargeId: active.id,
      currentPeriodEnd: active.currentPeriodEnd ? new Date(active.currentPeriodEnd) : null,
    },
    create: {
      shop,
      planId,
      status: "active",
      shopifyChargeId: active.id,
      currentPeriodEnd: active.currentPeriodEnd ? new Date(active.currentPeriodEnd) : null,
    },
  });

  return { planId, status: "active" };
}

/**
 * Quick local-DB lookup of the active plan id for a shop.
 * Returns null if no active subscription exists.
 */
export async function getCurrentPlanId(shop: string): Promise<PlanId | null> {
  const sub = await db.subscription.findUnique({ where: { shop } });
  if (!sub) return null;
  if (sub.status !== "active") return null;
  if (!isValidPlanId(sub.planId)) return null;
  return sub.planId;
}

/**
 * Build the URL where Shopify hosts the managed-pricing plan picker for
 * this app + shop. Sending the merchant here lets them pick/change plans
 * inside Shopify's UI; once they approve, Shopify's webhook will tell us.
 *
 * The shop comes in as "myshop.myshopify.com" — we extract the storehandle.
 */
export function buildManagedPricingUrl(shop: string, appHandle: string): string {
  const storeHandle = shop.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}