/**
 * Client-safe plan definitions — no server imports.
 * Safe to import in both loaders/actions AND React components.
 *
 * Plan `name` values must EXACTLY match what you configured in
 * Partners → Apps → SmartSavings → Distribution → Managed pricing
 */

export const PLANS = {
  base: {
    id: "base",
    name: "Base",
    price: 9.99,
    currencyCode: "USD",
    badge: null as string | null,
    color: "#1D9E75",
    lightBg: "#E1F5EE",
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
    badge: "Most popular" as string | null,
    color: "#534AB7",
    lightBg: "#EEEDFE",
    features: [
      "Up to 250 discounted variants",
      "Up to 10 campaigns",
      "All discount types",
      "Cart goal",
      "Buy X Get Y",
      "Shipping discount",
      "Priority support",
    ],
  },
  professional: {
    id: "professional",
    name: "Professional",
    price: 29.99,
    currencyCode: "USD",
    badge: null as string | null,
    color: "#185FA5",
    lightBg: "#E6F1FB",
    features: [
      "Unlimited discounted variants",
      "Unlimited campaigns",
      "Everything in Advanced",
      "Advanced analytics",
      "Dedicated support",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function isValidPlanId(id: string): id is PlanId {
  return id === "base" || id === "advanced" || id === "professional";
}