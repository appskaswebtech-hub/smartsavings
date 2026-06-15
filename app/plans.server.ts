/**
 * SmartDiscounts Plan System
 * Defines plan limits and checks feature access
 */

export interface PlanLimits {
  name: string;
  price: number;
  maxVariants: number;
  maxCampaigns: number;
  allowedTypes: string[];
  features: {
    bulkPriceEditor: boolean;
    quantityDiscount: boolean;
    cartGoal: boolean;
    buyXGetY: boolean;
    shippingDiscount: boolean;
    advancedDiscountCode: boolean;
    customizableWidgets: boolean;
    campaignScheduling: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
    dedicatedSupport: boolean;
  };
}

export const PLANS: Record<string, PlanLimits> = {
  free: {
    name: "Free",
    price: 0,
    maxVariants: 10,
    maxCampaigns: 3,
    allowedTypes: ["bulk_price", "quantity_discount"],
    features: {
      bulkPriceEditor: true,
      quantityDiscount: true,
      cartGoal: false,
      buyXGetY: false,
      shippingDiscount: false,
      advancedDiscountCode: false,
      customizableWidgets: true,
      campaignScheduling: false,
      advancedAnalytics: false,
      prioritySupport: false,
      dedicatedSupport: false,
    },
  },
  advanced: {
    name: "Advanced",
    price: 9.99,
    maxVariants: 100,
    maxCampaigns: 10,
    allowedTypes: ["bulk_price", "quantity_discount", "cart_goal", "buy_x_get_y", "shipping_discount", "advanced_discount_code"],
    features: {
      bulkPriceEditor: true,
      quantityDiscount: true,
      cartGoal: true,
      buyXGetY: true,
      shippingDiscount: true,
      advancedDiscountCode: true,
      customizableWidgets: true,
      campaignScheduling: true,
      advancedAnalytics: false,
      prioritySupport: true,
      dedicatedSupport: false,
    },
  },
  professional: {
    name: "Professional",
    price: 24.99,
    maxVariants: 1000,
    maxCampaigns: -1, // unlimited
    allowedTypes: ["bulk_price", "quantity_discount", "cart_goal", "buy_x_get_y", "shipping_discount", "advanced_discount_code"],
    features: {
      bulkPriceEditor: true,
      quantityDiscount: true,
      cartGoal: true,
      buyXGetY: true,
      shippingDiscount: true,
      advancedDiscountCode: true,
      customizableWidgets: true,
      campaignScheduling: true,
      advancedAnalytics: true,
      prioritySupport: true,
      dedicatedSupport: true,
    },
  },
};

export function getPlan(planId: string): PlanLimits {
  return PLANS[planId] || PLANS.free;
}

export function canCreateCampaign(plan: PlanLimits, currentCount: number): { allowed: boolean; message?: string } {
  if (plan.maxCampaigns !== -1 && currentCount >= plan.maxCampaigns) {
    return { allowed: false, message: `You've reached the maximum of ${plan.maxCampaigns} campaigns on the ${plan.name} plan. Upgrade to create more.` };
  }
  return { allowed: true };
}

export function canUseCampaignType(plan: PlanLimits, type: string): { allowed: boolean; message?: string } {
  if (!plan.allowedTypes.includes(type)) {
    return { allowed: false, message: `${type.replace(/_/g, ' ')} campaigns are not available on the ${plan.name} plan. Upgrade to unlock this feature.` };
  }
  return { allowed: true };
}

export function canScheduleCampaign(plan: PlanLimits): boolean {
  return plan.features.campaignScheduling;  
}