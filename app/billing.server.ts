import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import db from "./db.server";
import { PLANS, type PlanId, isValidPlanId } from "./plan-definitions";

export { PLANS, type PlanId, isValidPlanId };

function planIdFromName(name: string | null | undefined): PlanId | null {
  if (!name) return null;
  for (const plan of Object.values(PLANS)) {
    if (plan.name === name) return plan.id;
  }
  const lower = name.toLowerCase().trim();
  if (lower === "base") return "base";
  if (lower === "advanced") return "advanced";
  if (lower === "professional") return "professional";
  return null;
}

export async function fetchActiveSubscription(admin: AdminApiContext): Promise<{
  id: string;
  status: string;
  name: string;
  currentPeriodEnd: string | null;
} | null> {
  const response = await admin.graphql(`#graphql
    query {
      currentAppInstallation {
        activeSubscriptions {
          id
          status
          name
          currentPeriodEnd
        }
      }
    }
  `);
  const data = await response.json();
  const subs = data?.data?.currentAppInstallation?.activeSubscriptions ?? [];
  if (subs.length === 0) return null;
  return subs[0];
}

export async function syncSubscriptionFromShopify(
  admin: AdminApiContext,
  shop: string
): Promise<{ planId: PlanId | null; status: string }> {
  const active = await fetchActiveSubscription(admin);

  if (!active || active.status !== "ACTIVE") {
    await db.subscription.upsert({
      where: { shop },
      update: { status: "cancelled" },
      create: { shop, planId: "none", status: "cancelled" },
    });
    return { planId: null, status: "cancelled" };
  }

  const planId = planIdFromName(active.name);
  if (!planId) {
    console.warn(`[billing] "${active.name}" did not map to a known plan`);
    return { planId: null, status: "active" };
  }

  await db.subscription.upsert({
    where: { shop },
    update: {
      planId,
      status: "active",
      shopifyChargeId: active.id,
      currentPeriodEnd: active.currentPeriodEnd
        ? new Date(active.currentPeriodEnd)
        : null,
    },
    create: {
      shop,
      planId,
      status: "active",
      shopifyChargeId: active.id,
      currentPeriodEnd: active.currentPeriodEnd
        ? new Date(active.currentPeriodEnd)
        : null,
    },
  });

  return { planId, status: "active" };
}

export async function getCurrentPlanId(shop: string): Promise<PlanId | null> {
  const sub = await db.subscription.findUnique({ where: { shop } });
  if (!sub || sub.status !== "active") return null;
  if (!isValidPlanId(sub.planId)) return null;
  return sub.planId;
}