// /**
//  * Client-safe plan definitions — no server imports.
//  * Safe to import in both loaders/actions AND React components.
//  *
//  * Plan `name` values must EXACTLY match what you configured in
//  * Partners → Apps → SmartSavings → Distribution → Managed pricing
//  */

// export const PLANS = {
//   base: {
//     id: "base",
//     name: "Base",
//     price: 9.99,
//     currencyCode: "USD",
//     badge: null as string | null,
//     color: "#1D9E75",
//     lightBg: "#E1F5EE",
//     features: [
//       "Up to 50 discounted variants",
//       "Up to 3 campaigns",
//       "Quantity discount",
//       "Bulk price editor",
//       "Customizable widgets",
//       "Email support",
//     ],
//   },
//   advanced: {
//     id: "advanced",
//     name: "Advanced",
//     price: 19.99,
//     currencyCode: "USD",
//     badge: "Most popular" as string | null,
//     color: "#534AB7",
//     lightBg: "#EEEDFE",
//     features: [
//       "Up to 250 discounted variants",
//       "Up to 10 campaigns",
//       "All discount types",
//       "Cart goal",
//       "Buy X Get Y",
//       "Shipping discount",
//       "Priority support",
//     ],
//   },
//   professional: {
//     id: "professional",
//     name: "Professional",
//     price: 29.99,
//     currencyCode: "USD",
//     badge: null as string | null,
//     color: "#185FA5",
//     lightBg: "#E6F1FB",
//     features: [
//       "Unlimited discounted variants",
//       "Unlimited campaigns",
//       "Everything in Advanced",
//       "Advanced analytics",
//       "Dedicated support",
//     ],
//   },
// } as const;

// export type PlanId = keyof typeof PLANS;

// export function isValidPlanId(id: string): id is PlanId {
//   return id === "base" || id === "advanced" || id === "professional";
// }


/**
 * SmartSavings Plan Definitions
 * Single source of truth for plan limits, features, and trial info.
 */

export type PlanId = "base" | "advanced" | "professional";

export function isValidPlanId(id: string): id is PlanId {
  return id === "base" || id === "advanced" || id === "professional";
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  currencyCode: string;
  trialDays: number;
  badge: string | null;
  color: string;
  lightBg: string;
  maxVariants: number;
  maxCampaigns: number;
  allowedTypes: string[];
  features: string[];
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  base: {
    id: "base",
    name: "Base",
    price: 9.99,
    currencyCode: "USD",
    trialDays: 7,
    badge: null,
    color: "#6B7280",
    lightBg: "#F9FAFB",
    maxVariants: 50,
    maxCampaigns: 3,
    allowedTypes: ["bulk_price", "quantity_discount"],
    features: [
      "Up to 50 discounted variants",
      "Up to 3 campaigns",
      "Quantity discount",
      "Bulk price editor",
      "Customizable widgets",
      "Email support",
    ],
  },
  advanced: {
    id: "advanced",
    name: "Advanced",
    price: 19.99,
    currencyCode: "USD",
    trialDays: 7,
    badge: "MOST POPULAR",
    color: "#6366F1",
    lightBg: "#EEF2FF",
    maxVariants: 250,
    maxCampaigns: 10,
    allowedTypes: [
      "bulk_price",
      "quantity_discount",
      "cart_goal",
      "buy_x_get_y",
      "shipping_discount",
    ],
    features: [
      "Up to 250 discounted variants",
      "Up to 10 campaigns",
      "All discount types",
      "Cart goal",
      "Buy X Get Y",
      "Shipping discount",
      "Campaign scheduling",
      "Priority support",
    ],
  },
  professional: {
    id: "professional",
    name: "Professional",
    price: 29.99,
    currencyCode: "USD",
    trialDays: 7,
    badge: null,
    color: "#10B981",
    lightBg: "#ECFDF5",
    maxVariants: -1, // unlimited
    maxCampaigns: -1, // unlimited
    allowedTypes: [
      "bulk_price",
      "quantity_discount",
      "cart_goal",
      "buy_x_get_y",
      "shipping_discount",
      "advanced_discount_code",
    ],
    features: [
      "Unlimited discounted variants",
      "Unlimited campaigns",
      "Everything in Advanced",
      "Advanced analytics",
      "Dedicated support",
    ],
  },
};

export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId as PlanId] ?? PLANS.base;
}

export function canCreateCampaign(
  plan: PlanDefinition,
  currentCount: number
): { allowed: boolean; message?: string } {
  if (plan.maxCampaigns !== -1 && currentCount >= plan.maxCampaigns) {
    return {
      allowed: false,
      message: `You've reached the maximum of ${plan.maxCampaigns} campaigns on the ${plan.name} plan. Upgrade to create more.`,
    };
  }
  return { allowed: true };
}

export function canUseCampaignType(
  plan: PlanDefinition,
  type: string
): { allowed: boolean; message?: string } {
  if (!plan.allowedTypes.includes(type)) {
    return {
      allowed: false,
      message: `${type.replace(/_/g, " ")} campaigns are not available on the ${plan.name} plan. Upgrade to unlock this feature.`,
    };
  }
  return { allowed: true };
}

export function canScheduleCampaign(plan: PlanDefinition): boolean {
  return plan.allowedTypes.includes("campaign_scheduling");
}