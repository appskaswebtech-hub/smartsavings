import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
  OrderDiscountCandidate,
  ProductDiscountCandidate,
} from '../generated/api';

/**
 * Tiered discounts: quantity tiers (PRODUCT class) and cart goals (ORDER class).
 *
 * These used to be native automatic discounts, one per tier. A tier set can only
 * award its single best tier, and native discounts can't express that, so every
 * tier had to be created with combinesWith.productDiscounts: false to stop a
 * campaign's own tiers stacking. That also stopped two *different* campaigns from
 * ever discounting the same cart — Shopify applies one automatic product discount
 * unless all of them opt into combining, so the second campaign was silently
 * dropped. Evaluating the whole tier set here fixes both halves: only one tier can
 * ever win, so combining is safe to turn on.
 *
 * Config comes from a metafield on the discount:
 *   namespace: "$app:smartsavings"
 *   key: "config"
 * See createQuantityTierDiscount / createCartGoalDiscount in app/discount.server.ts
 * for the writer, which owns the shape below.
 *
 * NOTE: `collectionIds` is ALSO consumed as an input-query variable
 * ($collectionIds -> Product.inAnyCollection) via [extensions.input.variables] in
 * shopify.extension.toml. Renaming that key breaks collection targeting silently —
 * inAnyCollection just returns false for every line.
 */

type TierType = 'percentage' | 'fixed_amount';
type RequirementType = 'amount' | 'quantity' | 'both' | 'either';

interface QuantityTier {
  quantity: number;
  value: number;
  type: TierType;
}

interface CartGoalTier {
  requirementType: RequirementType;
  amount: number;
  quantity: number;
  value: number;
  type: TierType;
}

interface QuantityTiersConfig {
  kind: 'quantity_tiers';
  campaignName?: string;
  appliesTo: 'all' | 'specific_products' | 'specific_collections';
  productIds?: string[];
  variantIds?: string[];
  collectionIds?: string[];
  /** Fixed amounts come off each unit rather than once across the entitled items. */
  fixedPerItem?: boolean;
  tiers: QuantityTier[];
}

interface CartGoalConfig {
  kind: 'cart_goal';
  campaignName?: string;
  tiers: CartGoalTier[];
}

type Config = QuantityTiersConfig | CartGoalConfig;

function isStringArray(x: any): boolean {
  return (
    x === undefined ||
    x === null ||
    (Array.isArray(x) && x.every((i: any) => typeof i === 'string'))
  );
}

function isTierType(x: any): x is TierType {
  return x === 'percentage' || x === 'fixed_amount';
}

function isValidQuantityConfig(x: any): x is QuantityTiersConfig {
  if (
    x.appliesTo !== 'all' &&
    x.appliesTo !== 'specific_products' &&
    x.appliesTo !== 'specific_collections'
  ) {
    return false;
  }
  if (!isStringArray(x.productIds)) return false;
  if (!isStringArray(x.variantIds)) return false;
  if (!isStringArray(x.collectionIds)) return false;

  if (!Array.isArray(x.tiers) || x.tiers.length === 0) return false;
  for (const t of x.tiers) {
    if (!t || typeof t !== 'object') return false;
    if (typeof t.quantity !== 'number' || typeof t.value !== 'number') return false;
    if (!isTierType(t.type)) return false;
  }

  // A "specific" campaign whose target list is empty must discount nothing. The
  // native path used to fall back to { all: true } here, which under a function
  // would mean discounting the entire catalogue.
  const targetCount = (x.productIds?.length ?? 0) + (x.variantIds?.length ?? 0);
  if (x.appliesTo === 'specific_products' && targetCount === 0) return false;
  if (x.appliesTo === 'specific_collections' && (x.collectionIds?.length ?? 0) === 0) {
    return false;
  }

  return true;
}

function isValidCartGoalConfig(x: any): x is CartGoalConfig {
  if (!Array.isArray(x.tiers) || x.tiers.length === 0) return false;
  for (const t of x.tiers) {
    if (!t || typeof t !== 'object') return false;
    if (
      t.requirementType !== 'amount' &&
      t.requirementType !== 'quantity' &&
      t.requirementType !== 'both' &&
      t.requirementType !== 'either'
    ) {
      return false;
    }
    if (typeof t.value !== 'number') return false;
    if (!isTierType(t.type)) return false;
    // amount/quantity are only read for the requirement types that gate on them,
    // but a malformed number would silently disable a tier — reject instead.
    if (typeof t.amount !== 'number' || typeof t.quantity !== 'number') return false;
  }
  return true;
}

function isValidConfig(x: any): x is Config {
  if (!x || typeof x !== 'object') return false;
  if (x.kind === 'quantity_tiers') return isValidQuantityConfig(x);
  if (x.kind === 'cart_goal') return isValidCartGoalConfig(x);
  return false;
}

// Convert gid://shopify/Product/12345 -> 12345
function numericId(gid: string): string {
  const m = gid.match(/\/(\d+)$/);
  return m ? m[1] : gid;
}

function savingLabel(value: number, type: TierType): string {
  return type === 'fixed_amount' ? `Save $${value}` : `Save ${value}%`;
}

function withCampaignName(campaignName: string | undefined, label: string): string {
  return campaignName ? `${campaignName} — ${label}` : label;
}

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  if (!input.cart.lines.length) {
    return { operations: [] };
  }

  const rawConfig = input.discount.metafield?.jsonValue;
  if (!isValidConfig(rawConfig)) {
    return { operations: [] };
  }

  // This wasm also backs the free-shipping delivery target, so a discount of the
  // wrong class can reach us. Each branch checks the class it needs.
  const classes = input.discount.discountClasses;

  if (rawConfig.kind === 'quantity_tiers') {
    if (!classes.includes(DiscountClass.Product)) return { operations: [] };
    return runQuantityTiers(input, rawConfig);
  }

  if (!classes.includes(DiscountClass.Order)) return { operations: [] };
  return runCartGoal(input, rawConfig);
}

// ─── Quantity tiers ─────────────────────────────────────────────────────────

/** Highest tier whose threshold is met. `tiers` must be sorted ascending. */
function pickQuantityTier(tiers: QuantityTier[], quantity: number): QuantityTier | null {
  let best: QuantityTier | null = null;
  for (const tier of tiers) {
    if (quantity < tier.quantity) break;
    best = tier;
  }
  return best;
}

const CART_WIDE_GROUP = '__cart__';

function runQuantityTiers(
  input: CartInput,
  config: QuantityTiersConfig,
): CartLinesDiscountsGenerateRunResult {
  // Zero rows are kept in the DB as placeholders but are not valid tiers.
  const tiers = config.tiers
    .filter((t) => t.quantity > 0 && t.value > 0)
    .sort((a, b) => a.quantity - b.quantity);
  if (tiers.length === 0) {
    return { operations: [] };
  }

  const appliesToAll = config.appliesTo === 'all';
  const productIds = new Set(config.productIds ?? []);
  const variantIds = new Set(config.variantIds ?? []);

  // "all" -> one cart-wide group: the threshold is total cart quantity and every
  // line is discounted, mirroring the native minimumRequirement.quantity paired
  // with items: { all: true }.
  // Specific targeting -> one group per product, so several variants of the same
  // product accumulate toward "Buy 6+".
  const groups = new Map<string, { quantity: number; lineIds: string[] }>();

  for (const line of input.cart.lines) {
    const merch = line.merchandise;
    // Gift cards and custom products carry no product id — never discountable here.
    if (merch.__typename !== 'ProductVariant') continue;

    const matched =
      appliesToAll ||
      variantIds.has(numericId(merch.id)) ||
      productIds.has(numericId(merch.product.id)) ||
      merch.product.inCampaignCollection;
    if (!matched) continue;

    const key = appliesToAll ? CART_WIDE_GROUP : numericId(merch.product.id);
    const group = groups.get(key) ?? { quantity: 0, lineIds: [] };
    group.quantity += line.quantity;
    group.lineIds.push(line.id);
    groups.set(key, group);
  }

  if (groups.size === 0) {
    return { operations: [] };
  }

  const candidates: ProductDiscountCandidate[] = [];

  for (const group of groups.values()) {
    const tier = pickQuantityTier(tiers, group.quantity);
    if (!tier) continue;

    const value =
      tier.type === 'fixed_amount'
        ? {
            fixedAmount: {
              amount: tier.value,
              // Preserves the native rule `appliesOnEachItem: !targetsAllItems`.
              appliesToEachItem: config.fixedPerItem ?? !appliesToAll,
            },
          }
        : { percentage: { value: tier.value } };

    candidates.push({
      message: withCampaignName(
        config.campaignName,
        `Buy ${tier.quantity}+ ${savingLabel(tier.value, tier.type)}`,
      ),
      // One candidate per GROUP targeting all of its lines, not one per line.
      // appliesToEachItem: false means "once across the entitled items", so
      // per-line candidates would multiply a cart-wide fixed amount by the
      // number of lines.
      targets: group.lineIds.map((id) => ({ cartLine: { id } })),
      value,
    });
  }

  if (candidates.length === 0) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          // Every group's chosen tier applies. Only one tier per group is ever a
          // candidate, so a campaign's tiers cannot stack with each other.
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}

// ─── Cart goal ──────────────────────────────────────────────────────────────

function cartGoalTierQualifies(
  tier: CartGoalTier,
  subtotal: number,
  totalQuantity: number,
): boolean {
  const hasAmount = tier.amount > 0;
  const hasQuantity = tier.quantity > 0;
  const meetsAmount = hasAmount && subtotal >= tier.amount;
  const meetsQuantity = hasQuantity && totalQuantity >= tier.quantity;

  switch (tier.requirementType) {
    case 'quantity':
      return meetsQuantity;
    case 'both':
      // Native could only gate on the subtotal here, so the quantity half was
      // silently display-only. A function can AND the two properly.
      return hasAmount && hasQuantity && meetsAmount && meetsQuantity;
    case 'either':
      return meetsAmount || meetsQuantity;
    default:
      return meetsAmount;
  }
}

function cartGoalLabel(tier: CartGoalTier): string {
  const saving = savingLabel(tier.value, tier.type);
  switch (tier.requirementType) {
    case 'quantity':
      return `Buy ${tier.quantity}+ ${saving}`;
    case 'both':
      return `Spend $${tier.amount}+ and buy ${tier.quantity}+ ${saving}`;
    case 'either':
      return `Spend $${tier.amount}+ or buy ${tier.quantity}+ ${saving}`;
    default:
      return `Spend $${tier.amount}+ ${saving}`;
  }
}

function runCartGoal(
  input: CartInput,
  config: CartGoalConfig,
): CartLinesDiscountsGenerateRunResult {
  const subtotal = parseFloat(input.cart.cost.subtotalAmount.amount);
  if (isNaN(subtotal)) {
    return { operations: [] };
  }

  let totalQuantity = 0;
  for (const line of input.cart.lines) {
    totalQuantity += line.quantity;
  }

  const candidates: OrderDiscountCandidate[] = [];

  for (const tier of config.tiers) {
    if (tier.value <= 0) continue;
    if (!cartGoalTierQualifies(tier, subtotal, totalQuantity)) continue;

    const value =
      tier.type === 'fixed_amount'
        ? { fixedAmount: { amount: tier.value } }
        : { percentage: { value: tier.value } };

    candidates.push({
      message: withCampaignName(config.campaignName, cartGoalLabel(tier)),
      targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
      value,
    });
  }

  if (candidates.length === 0) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates,
          // Every qualifying tier is offered and Shopify applies exactly one —
          // the largest actual reduction. That handles tier sets that mix
          // percentages and fixed amounts without us ranking them ourselves.
          selectionStrategy: OrderDiscountSelectionStrategy.Maximum,
        },
      },
    ],
  };
}
