import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, Text, BlockStack, InlineStack, Button, Box, TextField, Checkbox, Layout, RangeSlider, Banner } from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ColorPickerInput, StickyPreview, DeviceMockup } from "../components/CustomizationWidgets";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const c = await db.widgetCustomization.findUnique({ where: { shop_widgetType: { shop: session.shop, widgetType: "shipping_bar" } } });
  return json({ config: c ? JSON.parse(c.config) : null });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  await db.widgetCustomization.upsert({ where: { shop_widgetType: { shop: session.shop, widgetType: "shipping_bar" } }, update: { config: fd.get("config") as string }, create: { shop: session.shop, widgetType: "shipping_bar", config: fd.get("config") as string } });
  return json({ success: true });
};

export default function ShippingBar() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [showOnProduct, setShowOnProduct] = useState(config?.showOnProduct ?? true);
  const [showOnCart, setShowOnCart] = useState(config?.showOnCart ?? true);
  const [initialMessage, setInitialMessage] = useState(config?.initialMessage ?? "Add {amount} more to unlock {discount} off shipping");
  const [inProgressMessage, setInProgressMessage] = useState(config?.inProgressMessage ?? "You're {amount} away from {discount} off shipping");
  const [thresholdMessage, setThresholdMessage] = useState(config?.thresholdMessage ?? "You've unlocked {discount} off shipping!");
  const [textSize, setTextSize] = useState(config?.textSize ?? 12);
  const [textColor, setTextColor] = useState(config?.textColor ?? "#000000");
  const [bgColor, setBgColor] = useState(config?.bgColor ?? "#FFFFFF");
  const [borderColor, setBorderColor] = useState(config?.borderColor ?? "#000000");
  const [borderRadiusVal, setBorderRadiusVal] = useState(config?.borderRadius ?? 1);
  const [progressBg, setProgressBg] = useState(config?.progressBg ?? "#D5D5D0");
  const [progressFg, setProgressFg] = useState(config?.progressFg ?? "#10F100");
  const [progressRadius, setProgressRadius] = useState(config?.progressRadius ?? 1);
  const [previewMode, setPreviewMode] = useState<"product" | "cart">("product");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const fd = new FormData();
    fd.append("config", JSON.stringify({ showOnProduct, showOnCart, initialMessage, inProgressMessage, thresholdMessage, textSize, textColor, bgColor, borderColor, borderRadius: borderRadiusVal, progressBg, progressFg, progressRadius }));
    submit(fd, { method: "post" }); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const isMobile = previewDevice === "mobile";

  const ShippingWidget = ({ message, progress }: { message: string; progress: number }) => (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: `${borderRadiusVal}px`, padding: isMobile ? "6px" : "8px", fontSize: `${textSize}px`, color: textColor }}>
      <div style={{ marginBottom: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ fontSize: isMobile ? "10px" : "inherit" }}>{message}</span>
        <span>🚚</span>
      </div>
      <div style={{ background: progressBg, borderRadius: `${progressRadius}px`, height: "6px", overflow: "hidden" }}>
        <div style={{ background: progressFg, width: `${progress}%`, height: "100%", borderRadius: `${progressRadius}px`, transition: "width 0.3s" }} />
      </div>
    </div>
  );

  return (
    <Page backAction={{ content: "Customization", url: "/app/customization" }} title="Shipping progress bar" subtitle="Change content and style of the progress bar." primaryAction={{ content: "Save", onAction: handleSave }}>
      {saved && <Box paddingBlockEnd="400"><Banner tone="success" title="Settings saved!" onDismiss={() => setSaved(false)} /></Box>}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card><BlockStack gap="300"><InlineStack gap="200"><span>👁</span><Text as="h2" variant="headingSm">Display progress bar in</Text></InlineStack><Checkbox label="Product page" checked={showOnProduct} onChange={setShowOnProduct} /><Checkbox label="Cart page" checked={showOnCart} onChange={setShowOnCart} /></BlockStack></Card>
            <Card><BlockStack gap="400"><InlineStack align="space-between"><InlineStack gap="200"><span>✏️</span><Text as="h2" variant="headingSm">Content</Text></InlineStack><Button variant="plain" size="slim">Reset to default</Button></InlineStack><TextField label="Initial message" value={initialMessage} onChange={setInitialMessage} autoComplete="off" helpText="Use {amount} and {discount} as placeholders" /><TextField label="In progress message" value={inProgressMessage} onChange={setInProgressMessage} autoComplete="off" /><TextField label="Threshold reached message" value={thresholdMessage} onChange={setThresholdMessage} autoComplete="off" /></BlockStack></Card>
            <Card><BlockStack gap="400"><InlineStack align="space-between"><InlineStack gap="200"><span>🎨</span><Text as="h2" variant="headingSm">Card styles</Text></InlineStack><Button variant="plain" size="slim">Reset to default</Button></InlineStack><TextField label="Text size" type="number" value={String(textSize)} onChange={(v) => setTextSize(parseInt(v) || 12)} autoComplete="off" suffix="px" /><ColorPickerInput label="Text color" value={textColor} onChange={setTextColor} /><ColorPickerInput label="Background color" value={bgColor} onChange={setBgColor} /><ColorPickerInput label="Border color" value={borderColor} onChange={setBorderColor} /><RangeSlider label="Border radius" value={borderRadiusVal} onChange={(v) => setBorderRadiusVal(v as number)} min={0} max={20} output suffix="px" /></BlockStack></Card>
            <Card><BlockStack gap="400"><InlineStack align="space-between"><InlineStack gap="200"><span>🎨</span><Text as="h2" variant="headingSm">Progress bar styles</Text></InlineStack><Button variant="plain" size="slim">Reset to default</Button></InlineStack><ColorPickerInput label="Background color" value={progressBg} onChange={setProgressBg} /><ColorPickerInput label="Foreground color" value={progressFg} onChange={setProgressFg} /><RangeSlider label="Border radius" value={progressRadius} onChange={(v) => setProgressRadius(v as number)} min={0} max={20} output suffix="px" /></BlockStack></Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <StickyPreview><Card><BlockStack gap="400">
            <InlineStack align="space-between" wrap={false}><Text as="h2" variant="headingSm">Preview</Text><InlineStack gap="200"><Button size="slim" variant={previewMode === "product" ? "primary" : undefined} onClick={() => setPreviewMode("product")}>Product page</Button><Button size="slim" variant={previewMode === "cart" ? "primary" : undefined} onClick={() => setPreviewMode("cart")}>Cart page</Button></InlineStack></InlineStack>
            <InlineStack align="end" gap="100"><Button size="slim" variant={previewDevice === "desktop" ? "primary" : undefined} onClick={() => setPreviewDevice("desktop")}>🖥</Button><Button size="slim" variant={previewDevice === "mobile" ? "primary" : undefined} onClick={() => setPreviewDevice("mobile")}>📱</Button></InlineStack>
            <Box background="bg-surface-secondary" borderRadius="300" padding="200">
              <DeviceMockup device={previewDevice}>
                {previewMode === "product" ? (
                  <div style={{ padding: "12px" }}>
                    <div style={{ display: "flex", gap: "12px", flexDirection: isMobile ? "column" as const : "row" as const }}>
                      <div style={{ width: isMobile ? "100%" : "120px", height: isMobile ? "80px" : "150px", background: "#e8e0d4", borderRadius: "8px" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "2px" }}>Nolla bed</div>
                        <div style={{ fontSize: "9px", color: "#f59e0b", marginBottom: "4px" }}>★★★★★ 4.8 reviews</div>
                        <div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>$89.99</div>
                        <div style={{ background: "#10b981", color: "white", textAlign: "center" as const, padding: "6px", borderRadius: "6px", fontSize: "10px", fontWeight: "bold", marginBottom: "8px" }}>Add to cart</div>
                        <ShippingWidget message="Add $100.00 more to unlock $8.00 off shipping" progress={30} />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "8px" }}>
                      <span style={{ fontSize: "10px", color: "#999" }}>‹</span>
                      <span style={{ fontSize: "9px", color: "#999" }}>Initial message</span>
                      <span style={{ fontSize: "10px", color: "#999" }}>›</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "12px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px" }}>Your Cart</div>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
                      <div style={{ width: "50px", height: "50px", background: "#f0f0f0", borderRadius: "4px" }} />
                      <div style={{ flex: 1 }}><div style={{ fontSize: "10px", fontWeight: "bold" }}>Product A</div><div style={{ fontSize: "9px", color: "#999" }}>$89.99</div></div>
                    </div>
                    <ShippingWidget message="You're $10.01 away from free shipping!" progress={90} />
                  </div>
                )}
              </DeviceMockup>
            </Box>
          </BlockStack></Card></StickyPreview>
        </Layout.Section>
      </Layout>
    </Page>
  );
}