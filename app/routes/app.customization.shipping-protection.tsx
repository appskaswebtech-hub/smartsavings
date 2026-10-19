import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import {
  Page, Text, BlockStack, InlineStack, Box, TextField, Checkbox, Layout,
  RangeSlider, Banner, Button,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useIsSaving } from "../lib/useIsSaving";
import { ColorPickerInput, StickyPreview, DeviceMockup } from "../components/CustomizationWidgets";
import { PageHeader, SectionCard } from "../components/Theme";
import { ProtectionCard } from "../components/ShippingProtectionForm";
import {
  DEFAULT_PROTECTION_STYLE,
  SHIPPING_PROTECTION,
  defaultProtectionDraft,
  normalizeProtectionStyle,
  parseProtectionStyle,
  type ProtectionStyle,
} from "../lib/shippingProtection";
import { getProtectionShopInfo, syncShippingProtection } from "../shippingProtection.server";
import { getShopDisplayName } from "../lib/shopName.server";

/**
 * Customization > Shipping protection — how the opt-in card looks, once for the
 * whole shop. The wording stays on each campaign, so campaigns can differ in
 * words while sharing one look.
 *
 * Saved as a WidgetCustomization row like every other widget, then republished
 * to the shop metafield the widget reads (syncShippingProtection), so saving
 * here reaches the storefront without touching a campaign.
 */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const row = await db.widgetCustomization.findUnique({
    where: { shop_widgetType: { shop: session.shop, widgetType: SHIPPING_PROTECTION } },
  });
  return json({
    style: parseProtectionStyle(row?.config),
    currencyCode: (await getProtectionShopInfo(admin)).currencyCode,
    shopName: await getShopDisplayName(admin, session.shop),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;
  const formData = await request.formData();

  let style: ProtectionStyle;
  try {
    style = normalizeProtectionStyle(JSON.parse((formData.get("config") as string) || "{}"));
  } catch {
    return json({ success: false, error: "Couldn't read those settings. Please try again." });
  }
  const config = JSON.stringify(style);

  await db.widgetCustomization.upsert({
    where: { shop_widgetType: { shop, widgetType: SHIPPING_PROTECTION } },
    update: { config },
    create: { shop, widgetType: SHIPPING_PROTECTION, config },
  });

  // Republish so the storefront picks the new look up right away. With no live
  // campaign there's no metafield to write and nothing renders — not an error.
  const syncErrors = await syncShippingProtection(admin, shop);
  return json({
    success: true,
    error: syncErrors.length ? `Saved, but the storefront wasn't updated: ${syncErrors.join(", ")}` : null,
  });
};

export default function ShippingProtectionCustomization() {
  const { style, currencyCode, shopName } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const isSaving = useIsSaving();
  const [saved, setSaved] = useState(false);

  const [value, setValue] = useState<ProtectionStyle>(style);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const set =
    <K extends keyof ProtectionStyle>(key: K) =>
    (v: ProtectionStyle[K]) =>
      setValue((prev) => ({ ...prev, [key]: v }));

  // Blank clears the field, so the theme block's own setting applies again.
  const setNumber = (key: keyof ProtectionStyle) => (v: string) =>
    setValue((prev) => {
      const next: ProtectionStyle = { ...prev };
      if (v === "") delete next[key];
      else if (!isNaN(Number(v)) && Number(v) >= 0) (next as Record<string, unknown>)[key] = Number(v);
      return next;
    });

  const handleSave = () => {
    if (isSaving) return;
    const fd = new FormData();
    fd.append("config", JSON.stringify(value));
    submit(fd, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // The card needs wording to draw; each campaign supplies its own on the
  // storefront, so the preview borrows what a new campaign starts from.
  const sampleConfig = defaultProtectionDraft(shopName || "our store");

  return (
    <Page fullWidth>
      <div className="ss-page">
      <PageHeader
        backTo="/app/customization"
        backLabel="Customization"
        title="Shipping protection"
        subtitle="Change the look of the protection opt-in card."
        primaryAction={{ content: "Save", icon: "save", onAction: handleSave, loading: isSaving, disabled: isSaving }}
        secondaryActions={[
          { content: "Reset to default", onAction: () => setValue({ ...DEFAULT_PROTECTION_STYLE }) },
        ]}
      />
      {saved && actionData?.success && !actionData.error && (
        <Box paddingBlockEnd="400">
          <Banner tone="success" title="Settings saved!" onDismiss={() => setSaved(false)} />
        </Box>
      )}
      {actionData?.error && (
        <Box paddingBlockEnd="400">
          <Banner tone="warning"><p>{actionData.error}</p></Banner>
        </Box>
      )}

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <SectionCard title="Display protection card in" icon="eye" tone="blue">
              <BlockStack gap="300">
                <Checkbox
                  label="Product page"
                  checked={value.showOnProduct !== false}
                  onChange={(v) => set("showOnProduct")(v)}
                />
                <Checkbox
                  label="Cart page"
                  checked={value.showOnCart !== false}
                  onChange={(v) => set("showOnCart")(v)}
                />
                <Text as="p" variant="bodySm" tone="subdued">
                  The Shipping Protection block still has to be added to those pages in your theme
                  (Online Store → Themes → Customize).
                </Text>
              </BlockStack>
            </SectionCard>

            <SectionCard title="Card styles" icon="palette" tone="amber">
              <BlockStack gap="400">
                <ColorPickerInput label="Card background" value={value.cardBg ?? ""} onChange={set("cardBg")} />
                <ColorPickerInput label="Border color" value={value.borderColor ?? ""} onChange={set("borderColor")} />
                <RangeSlider
                  label="Border radius"
                  value={value.borderRadius ?? 0}
                  onChange={(v) => set("borderRadius")(v as number)}
                  min={0}
                  max={24}
                  output
                  suffix="px"
                />
                <ColorPickerInput label="Checkbox color" value={value.accentColor ?? ""} onChange={set("accentColor")} />
                <TextField
                  label="Icon size"
                  type="number"
                  min={16}
                  value={value.iconSize === undefined ? "" : String(value.iconSize)}
                  onChange={setNumber("iconSize")}
                  autoComplete="off"
                  suffix="px"
                  helpText="The campaign's icon, also used as the cart image."
                />
              </BlockStack>
            </SectionCard>

            <SectionCard title="Text styles" icon="text" tone="sky">
              <BlockStack gap="400">
                <Text as="p" variant="bodySm" tone="subdued">
                  The wording itself lives on each Shipping protection campaign, so campaigns can
                  say different things while sharing this look.
                </Text>
                <InlineStack gap="400" wrap>
                  <div style={{ minWidth: "220px", flex: 1 }}>
                    <ColorPickerInput label="Heading color" value={value.headingColor ?? ""} onChange={set("headingColor")} />
                  </div>
                  <div style={{ width: "140px" }}>
                    <TextField
                      label="Heading size"
                      type="number"
                      min={8}
                      value={value.headingSize === undefined ? "" : String(value.headingSize)}
                      onChange={setNumber("headingSize")}
                      autoComplete="off"
                      suffix="px"
                    />
                  </div>
                </InlineStack>
                <InlineStack gap="400" wrap>
                  <div style={{ minWidth: "220px", flex: 1 }}>
                    <ColorPickerInput label="Title color" value={value.titleColor ?? ""} onChange={set("titleColor")} />
                  </div>
                  <div style={{ width: "140px" }}>
                    <TextField
                      label="Title size"
                      type="number"
                      min={8}
                      value={value.titleSize === undefined ? "" : String(value.titleSize)}
                      onChange={setNumber("titleSize")}
                      autoComplete="off"
                      suffix="px"
                    />
                  </div>
                </InlineStack>
                <InlineStack gap="400" wrap>
                  <div style={{ minWidth: "220px", flex: 1 }}>
                    <ColorPickerInput label="Description color" value={value.bodyColor ?? ""} onChange={set("bodyColor")} />
                  </div>
                  <div style={{ width: "140px" }}>
                    <TextField
                      label="Description size"
                      type="number"
                      min={8}
                      value={value.bodySize === undefined ? "" : String(value.bodySize)}
                      onChange={setNumber("bodySize")}
                      autoComplete="off"
                      suffix="px"
                    />
                  </div>
                </InlineStack>
              </BlockStack>
            </SectionCard>

            <SectionCard title="Size & spacing" icon="ruler" tone="mint">
              <BlockStack gap="400">
                <Text as="p" variant="bodySm" tone="subdued">
                  Optional — leave blank to follow the theme's own width and spacing.
                </Text>
                <InlineStack gap="300" wrap>
                  {(
                    [
                      ["width", "Width"],
                      ["paddingTop", "Padding top"],
                      ["paddingBottom", "Padding bottom"],
                      ["paddingLeft", "Padding left"],
                      ["paddingRight", "Padding right"],
                    ] as [keyof ProtectionStyle, string][]
                  ).map(([key, label]) => (
                    <div key={key} style={{ width: "140px" }}>
                      <TextField
                        label={label}
                        type="number"
                        min={0}
                        value={value[key] === undefined ? "" : String(value[key])}
                        onChange={setNumber(key)}
                        autoComplete="off"
                        placeholder="auto"
                        suffix="px"
                      />
                    </div>
                  ))}
                </InlineStack>
              </BlockStack>
            </SectionCard>

            <Banner tone="info">
              <p>
                This styles the card on your product and cart pages. In checkout, Shopify draws it
                with your checkout branding instead, so colours and sizes there follow
                Settings → Checkout.
              </p>
            </Banner>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <StickyPreview>
            <SectionCard title="Preview" icon="monitor" tone="sky" actions={<InlineStack gap="100">
                    <Button size="slim" variant={previewDevice === "desktop" ? "primary" : undefined} onClick={() => setPreviewDevice("desktop")}>🖥</Button>
                    <Button size="slim" variant={previewDevice === "mobile" ? "primary" : undefined} onClick={() => setPreviewDevice("mobile")}>📱</Button>
                  </InlineStack>}>
              <BlockStack gap="400">
                <Box background="bg-surface-secondary" borderRadius="300" padding="200">
                  <DeviceMockup device={previewDevice}>
                    <div style={{ padding: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>Your cart</div>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
                        <div style={{ width: "44px", height: "44px", background: "#f0f0f0", borderRadius: "4px" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "10px", fontWeight: "bold" }}>Product A</div>
                          <div style={{ fontSize: "9px", color: "#999" }}>$150.00</div>
                        </div>
                      </div>
                      <ProtectionCard config={sampleConfig} currencyCode={currencyCode} style={value} />
                    </div>
                  </DeviceMockup>
                </Box>
                <Text as="p" variant="bodySm" tone="subdued">
                  Sample wording — each campaign supplies its own on the storefront.
                </Text>
              </BlockStack>
            </SectionCard>
          </StickyPreview>
        </Layout.Section>
      </Layout>
      </div>
    </Page>
  );
}
