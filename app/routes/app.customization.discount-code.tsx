import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { useIsSaving } from "../lib/useIsSaving";
import {
  Page, Card, Text, BlockStack, InlineStack, Button, Box, TextField, Layout, Banner,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ColorPickerInput, StickyPreview, DeviceMockup, LayoutControls, layoutStyle, type LayoutValue } from "../components/CustomizationWidgets";

const WIDGET_TYPE = "discount_code_input";

// Defaults — must match the block schema defaults in discount-code-input.liquid
const DEFAULTS = {
  enabled: true,
  promptText: "🏷️ Have a discount code? Click here to enter it.",
  placeholder: "Enter discount code",
  buttonLabel: "Apply",
  textColor: "#333333",
  buttonBg: "#1A1A1A",
  buttonText: "#FFFFFF",
  borderColor: "#E0E0E0",
  borderRadius: 8,
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

export default function DiscountCodeCustomization() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const [enabled, setEnabled] = useState<boolean>(config?.enabled ?? DEFAULTS.enabled);
  const [promptText, setPromptText] = useState<string>(config?.promptText ?? DEFAULTS.promptText);
  const [placeholder, setPlaceholder] = useState<string>(config?.placeholder ?? DEFAULTS.placeholder);
  const [buttonLabel, setButtonLabel] = useState<string>(config?.buttonLabel ?? DEFAULTS.buttonLabel);
  const [textColor, setTextColor] = useState<string>(config?.textColor ?? DEFAULTS.textColor);
  const [buttonBg, setButtonBg] = useState<string>(config?.buttonBg ?? DEFAULTS.buttonBg);
  const [buttonText, setButtonText] = useState<string>(config?.buttonText ?? DEFAULTS.buttonText);
  const [borderColor, setBorderColor] = useState<string>(config?.borderColor ?? DEFAULTS.borderColor);
  const [borderRadius, setBorderRadius] = useState<string>(
    String(config?.borderRadius ?? DEFAULTS.borderRadius)
  );

  const [layout, setLayout] = useState<LayoutValue>(config?.layout ?? {});
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);

  const resetDefaults = () => {
    setEnabled(DEFAULTS.enabled);
    setPromptText(DEFAULTS.promptText);
    setPlaceholder(DEFAULTS.placeholder);
    setButtonLabel(DEFAULTS.buttonLabel);
    setTextColor(DEFAULTS.textColor);
    setButtonBg(DEFAULTS.buttonBg);
    setButtonText(DEFAULTS.buttonText);
    setBorderColor(DEFAULTS.borderColor);
    setBorderRadius(String(DEFAULTS.borderRadius));
  };

  const isSaving = useIsSaving();

  const handleSave = () => {
    if (isSaving) return;
    const fd = new FormData();
    fd.append(
      "config",
      JSON.stringify({
        enabled,
        promptText,
        placeholder,
        buttonLabel,
        textColor,
        buttonBg,
        buttonText,
        borderColor,
        borderRadius: parseInt(borderRadius, 10) || 0,
        layout,
      })
    );
    submit(fd, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const radiusPx = parseInt(borderRadius, 10) || 0;

  const CodeBoxPreview = () => (
    <div style={{ margin: "16px 8px" }}>
      <div style={{ border: `1px solid ${borderColor}`, borderRadius: `${radiusPx}px`, overflow: "hidden", ...layoutStyle(layout) }}>
        <div
          onClick={() => setExpanded((v) => !v)}
          style={{ padding: "12px 14px", textAlign: "center", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: textColor }}
        >
          {promptText}
        </div>
        {expanded && (
          <div style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <div style={{ flex: 1, padding: "8px 10px", border: `1px solid ${borderColor}`, borderRadius: "6px", fontSize: "11px", color: "#aaa" }}>
                {placeholder}
              </div>
              <div style={{ padding: "8px 14px", background: buttonBg, color: buttonText, borderRadius: "6px", fontWeight: 700, fontSize: "11px" }}>
                {buttonLabel}
              </div>
            </div>
          </div>
        )}
      </div>
      <Text as="p" variant="bodySm" tone="subdued">
        <span style={{ fontSize: "10px" }}>Tap the prompt to preview the expanded state.</span>
      </Text>
    </div>
  );

  return (
    <Page
      backAction={{ content: "Customization", url: "/app/customization" }}
      title="Discount code input"
      subtitle="Change the on-store discount code box text and style."
      primaryAction={{ content: "Save", onAction: handleSave, loading: isSaving, disabled: isSaving }}
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
                  <Text as="h2" variant="headingSm">Display widget on store</Text>
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
                    <span>✏️</span>
                    <Text as="h2" variant="headingSm">Text customization</Text>
                  </InlineStack>
                  <Button variant="plain" size="slim" onClick={resetDefaults}>Reset to default</Button>
                </InlineStack>
                <TextField label="Prompt text" value={promptText} onChange={setPromptText} autoComplete="off" />
                <TextField label="Input placeholder" value={placeholder} onChange={setPlaceholder} autoComplete="off" />
                <TextField label="Apply button label" value={buttonLabel} onChange={setButtonLabel} autoComplete="off" />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200">
                  <span>🎨</span>
                  <Text as="h2" variant="headingSm">Color palette</Text>
                </InlineStack>
                <ColorPickerInput label="Prompt text color" value={textColor} onChange={setTextColor} />
                <ColorPickerInput label="Border color" value={borderColor} onChange={setBorderColor} />
                <ColorPickerInput label="Button background" value={buttonBg} onChange={setButtonBg} />
                <ColorPickerInput label="Button text color" value={buttonText} onChange={setButtonText} />
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
                  <DeviceMockup device={previewDevice}>{enabled && <CodeBoxPreview />}</DeviceMockup>
                </Box>
              </BlockStack>
            </Card>
          </StickyPreview>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
