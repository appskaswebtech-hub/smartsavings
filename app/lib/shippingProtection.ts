/**
 * Shipping protection campaign — shared between the admin forms (client) and
 * app/shippingProtection.server.ts. Unlike every other campaign type it creates
 * no Shopify discount.
 *
 * Model: shoppers buying any of the *protected products* (or any product, with
 * appliesTo "all") can opt in to protection. Opting in adds one *fee product*
 * (e.g. "Premium Shipping Protection") to the cart, priced by the
 * shipping-protection-transform Cart Transform at either `percentage`% of the
 * protected items' value or a flat `fixedAmount` per order.
 *
 * Stored on Campaign.protectionConfig (JSON); discountType/discountValue mirror
 * the pricing (see protectionDiscountColumns).
 */

export const SHIPPING_PROTECTION = "shipping_protection";

export const DEFAULT_PROTECTION_PERCENTAGE = 20;
export const DEFAULT_FEE_PRODUCT_TITLE = "Premium Shipping Protection";

export interface ProtectedProduct {
  productId: string;
  productTitle: string;
  imageUrl: string;
}

export interface ProtectionConfig {
  /** Line above the card, e.g. "Yes, add shipping insurance please!" */
  heading: string;
  title: string;
  /** `{price}` is replaced with the fee on the storefront. */
  subtitle: string;
  description: string;
  /** "percentage": `percentage`% of the protected items; "fixed_amount": a flat `fixedAmount` per order. */
  pricingType: "percentage" | "fixed_amount";
  percentage: number;
  /** In the shop currency; the Cart Transform converts it to the shopper's currency. */
  fixedAmount: number;
  /** Shop currency at save time — display only. */
  currencyCode: string;
  /**
   * The product added to the cart when a shopper opts in. Created and kept in
   * sync by the app (app/shippingProtectionProduct.server.ts) — the merchant
   * only sets its name ("Name in cart") and icon.
   */
  feeProductId: string;
  feeVariantId: string;
  feeProductTitle: string;
  /** Widget icon; also the fee product's image. */
  feeImageUrl: string;
  /**
   * Hidden "coverage" product the fee line is expanded into — the Cart
   * Transform prices it, which works on every plan (price overrides need Plus).
   * App-managed, like the fee product.
   */
  componentProductId: string;
  componentVariantId: string;
  appliesTo: "all" | "specific_products";
  /** Protected products — only used when appliesTo is "specific_products". */
  products: ProtectedProduct[];
}

/** Form state — amounts stay strings while being edited. */
export type ProtectionConfigDraft = Omit<ProtectionConfig, "percentage" | "fixedAmount"> & {
  percentage: string;
  fixedAmount: string;
};

export function defaultProtectionDraft(shopName: string): ProtectionConfigDraft {
  return {
    heading: "Yes, add shipping insurance please!",
    title: "Shipping insurance",
    subtitle: "from Damage, Loss & Theft for {price}",
    description: `Get peace of mind with ${shopName}'s Delivery Guarantee in the event your delivery is damaged, stolen, or lost during transit.`,
    pricingType: "percentage",
    percentage: String(DEFAULT_PROTECTION_PERCENTAGE),
    fixedAmount: "",
    currencyCode: "",
    feeProductId: "",
    feeVariantId: "",
    feeProductTitle: DEFAULT_FEE_PRODUCT_TITLE,
    feeImageUrl: "",
    componentProductId: "",
    componentVariantId: "",
    appliesTo: "specific_products",
    products: [],
  };
}

export function toProtectionDraft(config: ProtectionConfig): ProtectionConfigDraft {
  const text = (n: number) => (Number.isFinite(n) ? String(n) : "");
  return {
    ...config,
    percentage: text(config.percentage),
    fixedAmount: text(config.fixedAmount),
    feeProductTitle: config.feeProductTitle || DEFAULT_FEE_PRODUCT_TITLE,
  };
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) => (value === "" || value == null ? NaN : Number(value));

/**
 * Keeps only the known fields, and converts the two earlier shapes:
 *  - { items: [...] } — the items were the products the merchant wanted to
 *    protect. They become `products`; there is no fee product yet, so the
 *    campaign stays inactive until one is picked.
 *  - { productId, variantId, … } — that product was the fee product; percentage
 *    came from Campaign.discountValue (pass it as legacyPercentage).
 */
export function normalizeProtectionConfig(
  obj: unknown,
  legacyPercentage?: number | null
): ProtectionConfig | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as any;
  // Both earlier shapes predate fixed pricing and the coverage component, so
  // they fall back to percentage with no component (created on the next save).
  return {
    ...normalizeShape(o, legacyPercentage),
    pricingType: o.pricingType === "fixed_amount" ? "fixed_amount" : "percentage",
    fixedAmount: num(o.fixedAmount),
    currencyCode: str(o.currencyCode),
    componentProductId: str(o.componentProductId),
    componentVariantId: str(o.componentVariantId),
  };
}

type SharedFields =
  | "pricingType"
  | "fixedAmount"
  | "currencyCode"
  | "componentProductId"
  | "componentVariantId";

function normalizeShape(o: any, legacyPercentage?: number | null): Omit<ProtectionConfig, SharedFields> {
  if (Array.isArray(o.items)) {
    const first = o.items[0] ?? {};
    const pct = num(first.percentage);
    return {
      heading: str(o.heading),
      title: str(first.title),
      subtitle: str(first.subtitle),
      description: str(first.description),
      percentage: Number.isFinite(pct) ? pct : legacyPercentage ?? NaN,
      feeProductId: "",
      feeVariantId: "",
      feeProductTitle: "",
      feeImageUrl: "",
      appliesTo: "specific_products",
      products: o.items
        .filter((item: any) => item && str(item.productId))
        .map((item: any) => ({
          productId: str(item.productId),
          productTitle: str(item.productTitle),
          imageUrl: str(item.imageUrl),
        })),
    };
  }

  if (!("feeProductId" in o) && str(o.productId)) {
    return {
      heading: str(o.heading),
      title: str(o.title),
      subtitle: str(o.subtitle),
      description: str(o.description),
      percentage: legacyPercentage ?? NaN,
      feeProductId: str(o.productId),
      feeVariantId: str(o.variantId),
      feeProductTitle: str(o.productTitle),
      feeImageUrl: str(o.imageUrl),
      appliesTo: "all",
      products: [],
    };
  }

  const pct = num(o.percentage);
  return {
    heading: str(o.heading),
    title: str(o.title),
    subtitle: str(o.subtitle),
    description: str(o.description),
    percentage: Number.isFinite(pct) ? pct : legacyPercentage ?? NaN,
    feeProductId: str(o.feeProductId),
    feeVariantId: str(o.feeVariantId),
    feeProductTitle: str(o.feeProductTitle),
    feeImageUrl: str(o.feeImageUrl),
    appliesTo: o.appliesTo === "all" ? "all" : "specific_products",
    products: (Array.isArray(o.products) ? o.products : [])
      .filter((p: any) => p && str(p.productId))
      .map((p: any) => ({
        productId: str(p.productId),
        productTitle: str(p.productTitle),
        imageUrl: str(p.imageUrl),
      })),
  };
}

export function parseProtectionConfig(
  raw: string | null | undefined,
  legacyPercentage?: number | null
): ProtectionConfig | null {
  if (!raw) return null;
  try {
    return normalizeProtectionConfig(JSON.parse(raw), legacyPercentage);
  } catch {
    return null;
  }
}

/**
 * Checks what the merchant controls. Returns an error message, or null when
 * the config can be saved. The fee product is the app's job, so it isn't checked.
 */
export function validateProtection(config: ProtectionConfig | null): string | null {
  if (!config) return "Set up the shipping protection.";
  if (config.appliesTo === "specific_products" && config.products.length === 0) {
    return "Add at least one product to protect, or choose All products.";
  }
  if (config.pricingType === "fixed_amount") {
    if (!(config.fixedAmount > 0)) return "The fixed protection fee must be more than 0.";
  } else if (!(config.percentage > 0 && config.percentage <= 100)) {
    return "The protection fee must be a percentage between 0 and 100.";
  }
  if (!config.title) return "Enter a title for the protection widget.";
  if (!config.feeProductTitle) return "Enter the name shoppers see in their cart.";
  return null;
}

/**
 * A config that can be published to the storefront: valid, and its fee and
 * coverage products have been created (older campaigns get them on their next save).
 */
export function isProtectionPublishable(config: ProtectionConfig | null): config is ProtectionConfig {
  return validateProtection(config) === null && protectionProductsReady(config);
}

function protectionProductsReady(config: ProtectionConfig | null) {
  return !!config?.feeProductId && !!config?.feeVariantId && !!config?.componentVariantId;
}

/** An active campaign as the conflict rules see it. */
export interface ProtectionCoverage {
  name: string;
  appliesTo: ProtectionConfig["appliesTo"];
  products: ProtectedProduct[];
}

/**
 * Several protection campaigns can be active at once, as long as each covers
 * different products — two campaigns over one product would mean two fees and
 * two cards for it. "All products" is exclusive, since it covers everything.
 *
 * `others` are the shop's other active protection campaigns. Returns why the
 * incoming one can't be active, or null.
 */
export function protectionConflict(
  others: ProtectionCoverage[],
  incoming: Pick<ProtectionConfig, "appliesTo" | "products">
): string | null {
  if (others.length === 0) return null;

  if (incoming.appliesTo === "all") {
    const other = others[0];
    return `"${other.name}" is already active. Pause or delete it first, or protect specific products instead of all products.`;
  }

  const coversAll = others.find((other) => other.appliesTo === "all");
  if (coversAll) {
    return `"${coversAll.name}" already protects all products. Pause or delete it first.`;
  }

  for (const other of others) {
    const clash = other.products.find((p) =>
      incoming.products.some((mine) => mine.productId === p.productId)
    );
    if (clash) {
      return `"${other.name}" already protects "${clash.productTitle || "this product"}". Choose different products.`;
    }
  }
  return null;
}

/** Why a saved config isn't live, for the detail page. */
export function protectionNotLiveReason(config: ProtectionConfig | null): string | null {
  const invalid = validateProtection(config);
  if (invalid) return invalid;
  if (!protectionProductsReady(config)) {
    return "Its protection products haven't been created yet — open the campaign and save it once.";
  }
  return null;
}

export function formatProtectionMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode || "USD" }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

/** "20% of protected items", "$5.00 flat fee" */
export function describeProtectionFees(config: ProtectionConfig | null): string {
  if (!config) return "—";
  if (config.pricingType === "fixed_amount") {
    return Number.isFinite(config.fixedAmount)
      ? `${formatProtectionMoney(config.fixedAmount, config.currencyCode)} flat fee`
      : "—";
  }
  if (!Number.isFinite(config.percentage)) return "—";
  return config.appliesTo === "all"
    ? `${config.percentage}% of cart value`
    : `${config.percentage}% of protected items`;
}

/** What goes in Campaign.discountType / discountValue. */
export function protectionDiscountColumns(config: ProtectionConfig) {
  return config.pricingType === "fixed_amount"
    ? { discountType: "fixed_amount", discountValue: config.fixedAmount }
    : { discountType: "percentage", discountValue: config.percentage };
}
