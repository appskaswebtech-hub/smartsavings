import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { useIsSaving } from "../lib/useIsSaving";
import { Page, BlockStack, InlineStack, Button, Box, TextField, Checkbox, Layout, RangeSlider, Banner } from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ColorPickerInput, StickyPreview, DeviceMockup, LayoutControls, type LayoutValue } from "../components/CustomizationWidgets";
import { PageHeader, SectionCard } from "../components/Theme";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const c = await db.widgetCustomization.findUnique({ where: { shop_widgetType: { shop: session.shop, widgetType: "saving_cart" } } });
  return json({ config: c ? JSON.parse(c.config) : null });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  await db.widgetCustomization.upsert({ where: { shop_widgetType: { shop: session.shop, widgetType: "saving_cart" } }, update: { config: fd.get("config") as string }, create: { shop: session.shop, widgetType: "saving_cart", config: fd.get("config") as string } });
  return json({ success: true });
};

export default function SavingOnCart() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [totalText, setTotalText] = useState(config?.totalText ?? "Total");
  const [savingText, setSavingText] = useState(config?.savingText ?? "Saving");
  const [showBorder, setShowBorder] = useState(config?.showBorder ?? true);
  const [borderRadiusVal, setBorderRadiusVal] = useState(config?.borderRadius ?? 8);
  const [totalTextColor, setTotalTextColor] = useState(config?.totalTextColor ?? "#000000");
  const [savingTextColor, setSavingTextColor] = useState(config?.savingTextColor ?? "#29845A");
  const [borderColor, setBorderColor] = useState(config?.borderColor ?? "#29845A");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [saved, setSaved] = useState(false);

  const [layout, setLayout] = useState<LayoutValue>(config?.layout ?? {});

  const isSaving = useIsSaving();

  const handleSave = () => {
    if (isSaving) return;
    const fd = new FormData();
    fd.append("config", JSON.stringify({ enabled, totalText, savingText, showBorder, borderRadius: borderRadiusVal, totalTextColor, savingTextColor, borderColor, layout }));
    submit(fd, { method: "post" }); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const CartPreview = () => (
    <div style={{ padding: "16px", background: "white" }}>
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
        <div style={{ width: previewDevice === "mobile" ? "40px" : "60px", height: previewDevice === "mobile" ? "50px" : "70px", background: "#f0f0f0", borderRadius: "6px" }} />
        <div style={{ flex: 1 }}><div style={{ height: "5px", width: "80%", background: "#e5e5e5", borderRadius: "3px", marginBottom: "4px" }} /><div style={{ height: "5px", width: "50%", background: "#e5e5e5", borderRadius: "3px" }} /></div>
        <span style={{ fontSize: "12px", fontWeight: "bold" }}>$90.00</span>
      </div>
      {enabled && <div style={{ borderTop: "1px solid #eee", paddingTop: "12px", fontSize: previewDevice === "mobile" ? "11px" : "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}><span style={{ color: totalTextColor, fontWeight: "bold" }}>{totalText}</span><span style={{ textDecoration: "line-through", color: "#999" }}>$100.00 USD</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", border: showBorder ? `1px solid ${borderColor}` : "none", borderRadius: `${borderRadiusVal}px`, padding: showBorder ? "4px 8px" : "0" }}><span style={{ color: savingTextColor, fontWeight: "bold" }}>{savingText}</span><span style={{ color: savingTextColor, fontWeight: "bold" }}>$10.00 USD</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}><span>Subtotal</span><span style={{ fontWeight: "bold" }}>$90.00 USD</span></div>
        <div style={{ background: "#e5e5e5", textAlign: "center" as const, padding: "8px", borderRadius: "6px", fontSize: "11px", color: "#666" }}>Checkout</div>
      </div>}
    </div>
  );

  return (
    <Page fullWidth>
      <div className="ss-page">
      <PageHeader
        backTo="/app/customization"
        backLabel="Customization"
        title="Saving on cart"
        subtitle='Customize "Saving & Total" widget on cart.'
        primaryAction={{ content: "Save", icon: "save", onAction: handleSave, loading: isSaving, disabled: isSaving }}
      />
      {saved && <Box paddingBlockEnd="400"><Banner tone="success" title="Settings saved!" onDismiss={() => setSaved(false)} /></Box>}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <SectionCard title="Display widget on store" icon="eye" tone="blue" actions={<Button onClick={() => setEnabled(!enabled)} variant={enabled ? "primary" : undefined} size="slim">{enabled ? "ON" : "OFF"}</Button>} />
            <SectionCard title="Content" icon="text" tone="sky" actions={<Button variant="plain" size="slim">Reset to default</Button>}><BlockStack gap="400"><TextField label='"Total" text' value={totalText} onChange={setTotalText} autoComplete="off" /><TextField label='"Saving" text' value={savingText} onChange={setSavingText} autoComplete="off" /></BlockStack></SectionCard>
            <SectionCard title="Styles" icon="palette" tone="amber" actions={<Button variant="plain" size="slim">Reset to default</Button>}><BlockStack gap="400"><Checkbox label="Show a border for Saving section" checked={showBorder} onChange={setShowBorder} /><RangeSlider label="Border radius" value={borderRadiusVal} onChange={(v) => setBorderRadiusVal(v as number)} min={0} max={20} output suffix="px" /><ColorPickerInput label='"Total" text color' value={totalTextColor} onChange={setTotalTextColor} /><ColorPickerInput label='"Saving" text color' value={savingTextColor} onChange={setSavingTextColor} /><ColorPickerInput label="Border color" value={borderColor} onChange={setBorderColor} /></BlockStack></SectionCard>
            <SectionCard title="Size & spacing" icon="ruler" tone="mint"><BlockStack gap="400"><LayoutControls value={layout} onChange={setLayout} /></BlockStack></SectionCard>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <StickyPreview><SectionCard title="Preview" icon="monitor" tone="sky" actions={<InlineStack gap="100"><Button size="slim" variant={previewDevice === "desktop" ? "primary" : undefined} onClick={() => setPreviewDevice("desktop")}>🖥</Button><Button size="slim" variant={previewDevice === "mobile" ? "primary" : undefined} onClick={() => setPreviewDevice("mobile")}>📱</Button></InlineStack>}><BlockStack gap="400">
            <Box background="bg-surface-secondary" borderRadius="300" padding="200"><DeviceMockup device={previewDevice}><CartPreview /></DeviceMockup></Box>
          </BlockStack></SectionCard></StickyPreview>
        </Layout.Section>
      </Layout>
      </div>
    </Page>
  );
}