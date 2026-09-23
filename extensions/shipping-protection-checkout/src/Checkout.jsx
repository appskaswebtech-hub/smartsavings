import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';

// Shipping protection cards — a checkout block the merchant places in the
// checkout editor. One card per active campaign that protects something in the
// cart; ticking it adds that campaign's fee product (e.g. "Premium Shipping
// Protection").
//
// Config comes from the shop metafield $app:smartsavings/shipping_protection,
// which the admin writes (syncShippingProtection in
// app/shippingProtection.server.ts) whenever a Shipping protection campaign
// changes. It holds every active campaign, each covering different products.
// No metafield means no active campaign, so nothing renders.
//
// The fee line's real price is set by the shipping-protection-transform Cart
// Transform; a card only estimates it the same way before the line is
// added, then shows the line's actual cost once it is in the cart.

export default async () => {
  render(<Extension />, document.body);
};

function readCampaigns() {
  const entry = shopify.appMetafields.value.find(
    (e) => e.target.type === 'shop' && e.metafield.key === 'shipping_protection',
  );
  if (!entry) return [];
  let parsed;
  try {
    parsed = JSON.parse(entry.metafield.value);
  } catch {
    return [];
  }
  // Older stores published a single campaign object.
  const raw = Array.isArray(parsed?.campaigns) ? parsed.campaigns : parsed ? [parsed] : [];
  return raw.filter((c) => c?.feeProductId && c?.feeVariantId && isLive(c));
}

function isLive(config) {
  const now = Date.now();
  if (config.startsAt && Date.parse(config.startsAt) > now) return false;
  if (config.endsAt && Date.parse(config.endsAt) <= now) return false;
  return true;
}

// Cart transforms price from pre-discount amounts, so add line discounts back.
function preDiscountAmount(line) {
  return (
    line.cost.totalAmount.amount +
    line.discountAllocations.reduce((sum, d) => sum + d.discountedAmount.amount, 0)
  );
}

function Extension() {
  // At most one card is toggling at a time, so the campaign's fee product id is
  // enough to track which one is busy or failed.
  const [busyId, setBusyId] = useState(null);
  const [failedId, setFailedId] = useState(null);

  const campaigns = readCampaigns();
  const lines = shopify.lines.value;
  const {canAddCartLine, canRemoveCartLine} = shopify.instructions.value.lines;

  const productOf = (line) => line.merchandise.product?.id;
  // Any campaign's fee line is a charge, not merchandise to protect.
  const feeProductIds = new Set(campaigns.map((c) => c.feeProductId));
  const feeLinesOf = (c) => lines.filter((line) => productOf(line) === c.feeProductId);
  const protectedLinesOf = (c) => {
    const protectedIds = new Set(c.productIds ?? []);
    return lines.filter((line) => {
      const productId = productOf(line);
      return !feeProductIds.has(productId) && (c.appliesTo === 'all' || protectedIds.has(productId));
    });
  };

  const cards = campaigns.map((campaign) => ({
    campaign,
    feeLines: feeLinesOf(campaign),
    protectedLines: protectedLinesOf(campaign),
  }));

  // Nothing left for a campaign to protect — drop its orphaned fee line. Only
  // ever a fee product; the shopper's own items are never touched.
  const orphaned = cards
    .filter((card) => card.protectedLines.length === 0)
    .flatMap((card) => card.feeLines);
  const orphanKey = orphaned.map((line) => line.id).join(',');
  useEffect(() => {
    if (!orphanKey || !canRemoveCartLine) return;
    for (const line of orphaned) {
      shopify.applyCartLinesChange({type: 'removeCartLine', id: line.id, quantity: line.quantity});
    }
  }, [orphanKey]);

  const shown = cards.filter((card) => card.protectedLines.length > 0);
  if (shown.length === 0) return null;

  return (
    <s-stack gap="base">
      {shown.map((card) => (
        <Card
          key={card.campaign.feeProductId}
          {...card}
          busy={busyId === card.campaign.feeProductId}
          failed={failedId === card.campaign.feeProductId}
          setBusyId={setBusyId}
          setFailedId={setFailedId}
          canAddCartLine={canAddCartLine}
          canRemoveCartLine={canRemoveCartLine}
        />
      ))}
    </s-stack>
  );
}

function Card({
  campaign,
  feeLines,
  protectedLines,
  busy,
  failed,
  setBusyId,
  setFailedId,
  canAddCartLine,
  canRemoveCartLine,
}) {
  const added = feeLines.length > 0;
  const canToggle = added ? canRemoveCartLine : canAddCartLine;
  if (!added && !canToggle) return null;

  // Once added, the line's actual (already converted) cost. Before that, an
  // estimate: a fixed fee is shown in the shop currency — checkout exposes no
  // exchange rate — and a percentage in the cart's currency.
  const cartCurrency = protectedLines[0].cost.totalAmount.currencyCode;
  const fixed = campaign.pricingType === 'fixed_amount';
  const fee = added
    ? feeLines.reduce((sum, line) => sum + line.cost.totalAmount.amount, 0)
    : fixed
      ? Number(campaign.fixedAmount)
      : Math.round(protectedLines.reduce((sum, line) => sum + preDiscountAmount(line), 0) * campaign.percentage) / 100;
  const price = shopify.i18n.formatCurrency(fee, {
    currency: !added && fixed ? campaign.currencyCode || cartCurrency : cartCurrency,
  });
  const subtitle = (campaign.subtitle || '').replace(/\{price\}/g, price);

  async function onToggle() {
    if (busy) return;
    setBusyId(campaign.feeProductId);
    setFailedId(null);
    const results = added
      ? await Promise.all(
          feeLines.map((line) =>
            shopify.applyCartLinesChange({type: 'removeCartLine', id: line.id, quantity: line.quantity}),
          ),
        )
      : [await shopify.applyCartLinesChange({type: 'addCartLine', merchandiseId: campaign.feeVariantId, quantity: 1})];
    if (results.some((r) => r.type === 'error')) setFailedId(campaign.feeProductId);
    setBusyId(null);
  }

  return (
    <s-stack gap="small-200">
      {campaign.heading ? <s-heading>{campaign.heading}</s-heading> : null}
      <s-box border="base" borderRadius="base" padding="base">
        <s-grid
          gridTemplateColumns={campaign.imageUrl ? 'auto auto 1fr' : 'auto 1fr'}
          gap="base"
          alignItems="center"
        >
          <s-checkbox
            accessibilityLabel={campaign.title || 'Shipping protection'}
            checked={added}
            disabled={busy || !canToggle}
            onChange={onToggle}
          />
          {campaign.imageUrl ? (
            <s-product-thumbnail src={campaign.imageUrl} alt={campaign.title || ''} />
          ) : null}
          <s-stack gap="small-500">
            <s-text type="strong">{campaign.title}</s-text>
            {subtitle ? <s-text color="subdued">{subtitle}</s-text> : null}
            {campaign.description ? <s-text color="subdued">{campaign.description}</s-text> : null}
          </s-stack>
        </s-grid>
      </s-box>
      {failed ? <s-banner tone="critical">{shopify.i18n.translate('updateFailed')}</s-banner> : null}
    </s-stack>
  );
}
