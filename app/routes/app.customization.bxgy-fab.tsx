import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { useIsSaving } from "../lib/useIsSaving";
import { Page, Text, BlockStack, InlineStack, Button, Box, Checkbox, Layout, RangeSlider, Banner } from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ColorPickerInput, StickyPreview, DeviceMockup, PlaceholderLines, LayoutControls, type LayoutValue } from "../components/CustomizationWidgets";
import { PageHeader, SectionCard } from "../components/Theme";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const c = await db.widgetCustomization.findUnique({ where: { shop_widgetType: { shop: session.shop, widgetType: "bxgy_fab" } } });
  return json({ config: c ? JSON.parse(c.config) : null });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  await db.widgetCustomization.upsert({ where: { shop_widgetType: { shop: session.shop, widgetType: "bxgy_fab" } }, update: { config: fd.get("config") as string }, create: { shop: session.shop, widgetType: "bxgy_fab", config: fd.get("config") as string } });
  return json({ success: true });
};

export default function BxgyFab() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [removeCloseButton, setRemoveCloseButton] = useState(config?.removeCloseButton ?? false);
  const [position, setPosition] = useState(config?.position ?? "right");
  const [fabRadius, setFabRadius] = useState(config?.fabRadius ?? 25);
  const [fabBg, setFabBg] = useState(config?.fabBg ?? "#03A87C");
  const [fabIcon, setFabIcon] = useState(config?.fabIcon ?? "#FFFFFF");
  const [closeBtnColor, setCloseBtnColor] = useState(config?.closeBtnColor ?? "#FFFFFF");
  const [closeIconColor, setCloseIconColor] = useState(config?.closeIconColor ?? "#C0C0C0");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [saved, setSaved] = useState(false);

  const [layout, setLayout] = useState<LayoutValue>(config?.layout ?? {});

  const isSaving = useIsSaving();

  const handleSave = () => {
    if (isSaving) return;
    const fd = new FormData();
    fd.append("config", JSON.stringify({ enabled, removeCloseButton, position, fabRadius, fabBg, fabIcon, closeBtnColor, closeIconColor, layout }));
    submit(fd, { method: "post" }); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Page fullWidth>
      <div className="ss-page">
      <PageHeader
        backTo="/app/customization"
        backLabel="Customization"
        title="Buy X get Y Floating button"
        subtitle="Customize FAB style shown after closing pop-up."
        primaryAction={{ content: "Save", icon: "save", onAction: handleSave, loading: isSaving, disabled: isSaving }}
      />
      {saved && <Box paddingBlockEnd="400"><Banner tone="success" title="Settings saved!" onDismiss={() => setSaved(false)} /></Box>}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <SectionCard title="Display widget on store" icon="eye" tone="blue" actions={<Button onClick={() => setEnabled(!enabled)} variant={enabled ? "primary" : undefined} size="slim">{enabled ? "ON" : "OFF"}</Button>} />
            <SectionCard title="General" icon="sliders" tone="violet" actions={<Button variant="plain" size="slim">Reset to default</Button>}><BlockStack gap="400"><Checkbox label="Remove close button" checked={removeCloseButton} onChange={setRemoveCloseButton} /><Text as="p" variant="bodySm" fontWeight="bold">Floating button position</Text><InlineStack gap="200"><Button size="slim" variant={position === "left" ? "primary" : undefined} onClick={() => setPosition("left")}>Left</Button><Button size="slim" variant={position === "right" ? "primary" : undefined} onClick={() => setPosition("right")}>Right</Button></InlineStack><RangeSlider label="Floating button radius" value={fabRadius} onChange={(v) => setFabRadius(v as number)} min={0} max={50} output /></BlockStack></SectionCard>
            <SectionCard title="Colors" icon="palette" tone="amber" actions={<Button variant="plain" size="slim">Reset to default</Button>}><BlockStack gap="400"><ColorPickerInput label="Floating button background" value={fabBg} onChange={setFabBg} /><ColorPickerInput label="Floating button icon" value={fabIcon} onChange={setFabIcon} /><ColorPickerInput label="Close button color" value={closeBtnColor} onChange={setCloseBtnColor} /><ColorPickerInput label="Close button icon" value={closeIconColor} onChange={setCloseIconColor} /></BlockStack></SectionCard>
            <SectionCard title="Size & spacing" icon="ruler" tone="mint"><BlockStack gap="400"><LayoutControls value={layout} onChange={setLayout} /></BlockStack></SectionCard>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <StickyPreview><SectionCard title="Preview" icon="monitor" tone="sky" actions={<InlineStack gap="100"><Button size="slim" variant={previewDevice === "desktop" ? "primary" : undefined} onClick={() => setPreviewDevice("desktop")}>🖥</Button><Button size="slim" variant={previewDevice === "mobile" ? "primary" : undefined} onClick={() => setPreviewDevice("mobile")}>📱</Button></InlineStack>}><BlockStack gap="400">
            <Box background="bg-surface-secondary" borderRadius="300" padding="200">
              <DeviceMockup device={previewDevice}>
                <div style={{ position: "relative", minHeight: previewDevice === "mobile" ? "300px" : "320px" }}>
                  <PlaceholderLines count={3} />
                  {enabled && (
                    <div style={{ position: "absolute", bottom: "20px", [position === "left" ? "left" : "right"]: "20px" }}>
                      {!removeCloseButton && <div style={{ position: "absolute", top: "-6px", right: "-6px", background: closeBtnColor, color: closeIconColor, width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", border: "1px solid #ddd", cursor: "pointer", zIndex: 1 }}>✕</div>}
                      <div style={{ width: previewDevice === "mobile" ? "44px" : "50px", height: previewDevice === "mobile" ? "44px" : "50px", borderRadius: `${fabRadius}px`, background: fabBg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", cursor: "pointer" }}>
                        <span style={{ fontSize: previewDevice === "mobile" ? "18px" : "22px" }}>🎁</span>
                      </div>
                    </div>
                  )}
                </div>
              </DeviceMockup>
            </Box>
          </BlockStack></SectionCard></StickyPreview>
        </Layout.Section>
      </Layout>
      </div>
    </Page>
  );
}