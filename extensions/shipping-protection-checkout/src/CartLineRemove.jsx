import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useState} from 'preact/hooks';

// "× Remove" under a Shipping protection line in the checkout order summary.
// This target renders once per cart line, so it stays empty for everything
// except a campaign's fee product ("Premium Shipping Protection"). Like every
// checkout-step extension, Shopify only renders it on Plus stores.
//
// The fee products come from the same shop metafield Checkout.jsx reads
// ($app:smartsavings/shipping_protection), which holds every active campaign;
// no metafield means no active campaign.

export default async () => {
  render(<Extension />, document.body);
};

function feeProductIds() {
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
  return raw.map((c) => c?.feeProductId).filter(Boolean);
}

function Extension() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const line = shopify.target.value;
  if (!feeProductIds().includes(line.merchandise.product?.id)) return null;
  if (!shopify.instructions.value.lines.canRemoveCartLine) return null;

  async function onRemove() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const result = await shopify.applyCartLinesChange({
      type: 'removeCartLine',
      id: line.id,
      quantity: line.quantity,
    });
    // On success this line (and so this extension) disappears.
    if (result.type === 'error') {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <s-stack gap="small-500">
      {busy ? (
        <s-text color="subdued">Removing…</s-text>
      ) : (
        <s-link onClick={onRemove} accessibilityLabel="Remove shipping protection">
          × Remove
        </s-link>
      )}
      {failed ? <s-text tone="critical">{shopify.i18n.translate('updateFailed')}</s-text> : null}
    </s-stack>
  );
}
