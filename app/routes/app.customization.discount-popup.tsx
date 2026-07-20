import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page, Card, Text, BlockStack, InlineStack, Button, Box, TextField, Layout, Banner,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ColorPickerInput, StickyPreview, DeviceMockup, LayoutControls, layoutStyle, type LayoutValue } from "../components/CustomizationWidgets";

const WIDGET_TYPE = "discount_popup";

// Appearance defaults — must match the hard defaults in email-discount-popup.liquid
const DEFAULTS = {
  enabled: true,
  overlayColor: "#000000",
  overlayOpacity: 55,
  modalBg: "#FFFFFF",
  headingColor: "#1A1A1A",
  textColor: "#555555",
  buttonBg: "#1A1A1A",
  buttonTextColor: "#FFFFFF",
  inputBorderColor: "#DDDDDD",
  borderRadius: 14,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const c = await db.widgetCustomization.findUnique({
    where: { shop_widgetType: { shop: session.shop, widgetType: WIDGET_TYPE } },
  });
  return json({ config: c ? JSON.parse(c.config) : null });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  const config = fd.get("config") as string;
  await db.widgetCustomization.upsert({
    where: { shop_widgetType: { shop: session.shop, widgetType: WIDGET_TYPE } },
    update: { config },
    create: { shop: session.shop, widgetType: WIDGET_TYPE, config },
  });
  return json({ success: true });
};

// #RRGGBB + 0-100 opacity → rgba()
function toRgba(hex: string, opacity: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
}

export default function DiscountPopupCustomization() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const [enabled, setEnabled] = useState<boolean>(config?.enabled ?? DEFAULTS.enabled);
  const [overlayColor, setOverlayColor] = useState<string>(config?.overlayColor ?? DEFAULTS.overlayColor);
  const [overlayOpacity, setOverlayOpacity] = useState<string>(
    String(config?.overlayOpacity ?? DEFAULTS.overlayOpacity)
  );
  const [modalBg, setModalBg] = useState<string>(config?.modalBg ?? DEFAULTS.modalBg);
  const [headingColor, setHeadingColor] = useState<string>(config?.headingColor ?? DEFAULTS.headingColor);
  const [textColor, setTextColor] = useState<string>(config?.textColor ?? DEFAULTS.textColor);
  const [buttonBg, setButtonBg] = useState<string>(config?.buttonBg ?? DEFAULTS.buttonBg);
  const [buttonTextColor, setButtonTextColor] = useState<string>(
    config?.buttonTextColor ?? DEFAULTS.buttonTextColor
  );
  const [inputBorderColor, setInputBorderColor] = useState<string>(
    config?.inputBorderColor ?? DEFAULTS.inputBorderColor
  );
  const [borderRadius, setBorderRadius] = useState<string>(
    String(config?.borderRadius ?? DEFAULTS.borderRadius)
  );

  const [layout, setLayout] = useState<LayoutValue>(config?.layout ?? {});
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [saved, setSaved] = useState(false);

  const resetDefaults = () => {
    setEnabled(DEFAULTS.enabled);
    setOverlayColor(DEFAULTS.overlayColor);
    setOverlayOpacity(String(DEFAULTS.overlayOpacity));
    setModalBg(DEFAULTS.modalBg);
    setHeadingColor(DEFAULTS.headingColor);
    setTextColor(DEFAULTS.textColor);
    setButtonBg(DEFAULTS.buttonBg);
    setButtonTextColor(DEFAULTS.buttonTextColor);
    setInputBorderColor(DEFAULTS.inputBorderColor);
    setBorderRadius(String(DEFAULTS.borderRadius));
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.append(
      "config",
      JSON.stringify({
        enabled,
        overlayColor,
        overlayOpacity: parseInt(overlayOpacity, 10) || 0,
        modalBg,
        headingColor,
        textColor,
        buttonBg,
        buttonTextColor,
        inputBorderColor,
        borderRadius: parseInt(borderRadius, 10) || 0,
        layout,
      })
    );
    submit(fd, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const radiusPx = parseInt(borderRadius, 10) || 0;

  const PopupPreview = () => (
    <div
      style={{
        background: toRgba(overlayColor, parseInt(overlayOpacity, 10) || 0),
        padding: "24px 12px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: modalBg,
          borderRadius: `${radiusPx}px`,
          padding: "20px 18px",
          width: "100%",
          maxWidth: "260px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          ...layoutStyle(layout),
        }}
      >
        <div style={{ fontSize: "15px", fontWeight: 700, color: headingColor, marginBottom: "6px" }}>
          Get your discount code
        </div>
        <div style={{ fontSize: "11px", color: textColor, marginBottom: "12px", lineHeight: 1.5 }}>
          Enter your email and we'll send your code to your inbox.
        </div>
        <div
          style={{
            border: `1px solid ${inputBorderColor}`,
            borderRadius: `${Math.max(4, radiusPx - 6)}px`,
            padding: "8px 10px",
            fontSize: "11px",
            color: "#999",
            marginBottom: "8px",
          }}
        >
          you@email.com
        </div>
        <div
          style={{
            background: buttonBg,
            color: buttonTextColor,
            borderRadius: `${Math.max(4, radiusPx - 6)}px`,
            padding: "9px",
            fontSize: "12px",
            fontWeight: 700,
            textAlign: "center" as const,
          }}
        >
          Email me the code
        </div>
      </div>
    </div>
  );

  return (
    <Page
      backAction={{ content: "Customization", url: "/app/customization" }}
      title="Discount pop-up"
      subtitle="Change the email pop-up colors and style."
      primaryAction={{ content: "Save", onAction: handleSave }}
    >
      {saved && (
        <Box paddingBlockEnd="400">
          <Banner tone="success" title="Settings saved!" onDismiss={() => setSaved(false)} />
        </Box>
      )}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200">
                  <span>👁</span>
                  <Text as="h2" variant="headingSm">Display pop-up on store</Text>
                </InlineStack>
                <Button onClick={() => setEnabled(!enabled)} variant={enabled ? "primary" : undefined} size="slim">
                  {enabled ? "ON" : "OFF"}
                </Button>
              </InlineStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <InlineStack gap="200">
                    <span>🎨</span>
                    <Text as="h2" variant="headingSm">Color palette</Text>
                  </InlineStack>
                  <Button variant="plain" size="slim" onClick={resetDefaults}>Reset to default</Button>
                </InlineStack>

                <Text as="p" variant="bodySm" fontWeight="bold">Overlay</Text>
                <ColorPickerInput label="Overlay color" value={overlayColor} onChange={setOverlayColor} />
                <TextField
                  label="Overlay opacity (%)"
                  type="number"
                  min={0}
                  max={100}
                  value={overlayOpacity}
                  onChange={(v) => {
                    const n = parseInt(v, 10);
                    if (v === "" || (!isNaN(n) && n >= 0 && n <= 100)) setOverlayOpacity(v);
                  }}
                  autoComplete="off"
                />

                <Text as="p" variant="bodySm" fontWeight="bold">Modal</Text>
                <ColorPickerInput label="Background" value={modalBg} onChange={setModalBg} />
                <ColorPickerInput label="Heading color" value={headingColor} onChange={setHeadingColor} />
                <ColorPickerInput label="Text color" value={textColor} onChange={setTextColor} />
                <ColorPickerInput label="Input border color" value={inputBorderColor} onChange={setInputBorderColor} />

                <Text as="p" variant="bodySm" fontWeight="bold">Button</Text>
                <ColorPickerInput label="Button background" value={buttonBg} onChange={setButtonBg} />
                <ColorPickerInput label="Button text color" value={buttonTextColor} onChange={setButtonTextColor} />

                <Text as="p" variant="bodySm" fontWeight="bold">Shape</Text>
                <TextField
                  label="Corner radius (px)"
                  type="number"
                  min={0}
                  max={40}
                  value={borderRadius}
                  onChange={(v) => {
                    const n = parseInt(v, 10);
                    if (v === "" || (!isNaN(n) && n >= 0)) setBorderRadius(v);
                  }}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200">
                  <span>📐</span>
                  <Text as="h2" variant="headingSm">Size &amp; spacing</Text>
                </InlineStack>
                <LayoutControls value={layout} onChange={setLayout} />
              </BlockStack>
            </Card>

            <Banner tone="info">
              <p>
                Pop-up text (heading, description, button label) and how often it re-appears are set on
                each campaign under <strong>Campaigns → Advanced discount code</strong>. This page controls
                the colors and shape for all popups.
              </p>
            </Banner>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <StickyPreview>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingSm">Preview</Text>
                  <InlineStack gap="100">
                    <Button size="slim" variant={previewDevice === "desktop" ? "primary" : undefined} onClick={() => setPreviewDevice("desktop")}>🖥</Button>
                    <Button size="slim" variant={previewDevice === "mobile" ? "primary" : undefined} onClick={() => setPreviewDevice("mobile")}>📱</Button>
                  </InlineStack>
                </InlineStack>
                <Box background="bg-surface-secondary" borderRadius="300" padding="200">
                  <DeviceMockup device={previewDevice}>{enabled && <PopupPreview />}</DeviceMockup>
                </Box>
              </BlockStack>
            </Card>
          </StickyPreview>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
