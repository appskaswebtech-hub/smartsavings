import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { useIsSaving } from "../lib/useIsSaving";
import { Page, Card, Text, BlockStack, InlineStack, Button, Box, TextField, Checkbox, Layout, Banner } from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ColorPickerInput, StickyPreview, DeviceMockup, LayoutControls, type LayoutValue } from "../components/CustomizationWidgets";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const c = await db.widgetCustomization.findUnique({ where: { shop_widgetType: { shop: session.shop, widgetType: "bxgy_popup" } } });
  return json({ config: c ? JSON.parse(c.config) : null });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  await db.widgetCustomization.upsert({ where: { shop_widgetType: { shop: session.shop, widgetType: "bxgy_popup" } }, update: { config: fd.get("config") as string }, create: { shop: session.shop, widgetType: "bxgy_popup", config: fd.get("config") as string } });
  return json({ success: true });
};

export default function BxgyPopup() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [headerTitle, setHeaderTitle] = useState(config?.headerTitle ?? "Your current cart qualifies for these rewards");
  const [subtitle, setSubtitle] = useState(config?.subtitle ?? "Now you are able to choose between them.\nAdd before checking out!");
  const [selectText, setSelectText] = useState(config?.selectText ?? "Select");
  const [addToCartText, setAddToCartText] = useState(config?.addToCartText ?? "Add to Cart");
  const [continueText, setContinueText] = useState(config?.continueText ?? "Continue Shopping");
  const [removeButton, setRemoveButton] = useState(false);
  const [discountBadgeType, setDiscountBadgeType] = useState(config?.discountBadgeType ?? "percentage");
  const [showFreeGiftBadge, setShowFreeGiftBadge] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(config?.primaryColor ?? "#000000");
  const [secondaryColor, setSecondaryColor] = useState(config?.secondaryColor ?? "#FFFFFF");
  const [borderColor, setBorderColor] = useState(config?.borderColor ?? "#C8C8C8");
  const [popupBg, setPopupBg] = useState(config?.popupBg ?? "#F0F4F4");
  const [headerBg, setHeaderBg] = useState(config?.headerBg ?? "#1E2832");
  const [addToCartColor, setAddToCartColor] = useState(config?.addToCartColor ?? "#FFFFFF");
  const [saleBadgeColor, setSaleBadgeColor] = useState(config?.saleBadgeColor ?? "#2F1BE2");
  const [dismissBehavior, setDismissBehavior] = useState(config?.dismissBehavior ?? "until_triggered");
  const [layout, setLayout] = useState<LayoutValue>(config?.layout ?? {});
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [saved, setSaved] = useState(false);

  const isSaving = useIsSaving();

  const handleSave = () => {
    if (isSaving) return;
    const fd = new FormData();
    fd.append("config", JSON.stringify({ enabled, headerTitle, subtitle, selectText, addToCartText, continueText, removeButton, discountBadgeType, showFreeGiftBadge, primaryColor, secondaryColor, borderColor, popupBg, headerBg, addToCartColor, saleBadgeColor, dismissBehavior, layout }));
    submit(fd, { method: "post" }); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const products = [
    { name: "Classic Cotton T-Shirt", price: 12.5 },
    { name: "Premium Leather Wallet", price: 0 },
    { name: "Organic Face Moisturizer", price: 15 },
  ];
  const isMobile = previewDevice === "mobile";

  const PopupPreview = () => (
    <div style={{ margin: "8px" }}>
      <div style={{ background: headerBg, borderRadius: "8px 8px 0 0", padding: isMobile ? "8px" : "10px 12px", color: "white", position: "relative" }}>
        <div style={{ fontSize: isMobile ? "8px" : "10px", fontWeight: "bold", marginBottom: "4px", paddingRight: "16px" }}>{headerTitle}</div>
        <div style={{ fontSize: isMobile ? "7px" : "8px", opacity: 0.8, whiteSpace: "pre-line" }}>{subtitle}</div>
        <span style={{ position: "absolute", top: "8px", right: "10px", color: "white", fontSize: "12px", cursor: "pointer" }}>✕</span>
      </div>
      <div style={{ background: popupBg, padding: "6px", fontSize: "9px", color: "#666" }}>● You can add 2 product(s)</div>
      <div style={{ display: "flex", gap: isMobile ? "4px" : "8px", padding: isMobile ? "4px" : "8px", background: popupBg, flexWrap: isMobile ? "nowrap" as const : "nowrap" as const }}>
        {products.map((p, i) => (
          <div key={i} style={{ flex: 1, background: "white", borderRadius: "8px", border: `1px solid ${borderColor}`, padding: isMobile ? "4px" : "6px", textAlign: "center" as const, position: "relative", minWidth: 0 }}>
            <div style={{ position: "absolute", top: "4px", right: "4px", background: saleBadgeColor, color: "white", fontSize: "7px", padding: "1px 4px", borderRadius: "3px" }}>
              {discountBadgeType === "percentage" ? "-50%" : "-$5"}
            </div>
            <div style={{ width: "100%", height: isMobile ? "35px" : "50px", background: "#f0f0f0", borderRadius: "4px", marginBottom: "4px" }} />
            <div style={{ fontSize: isMobile ? "7px" : "8px", fontWeight: "bold", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.name}</div>
            <div style={{ fontSize: isMobile ? "7px" : "8px", marginBottom: "4px" }}>
              <span style={{ color: primaryColor, fontWeight: "bold" }}>${p.price.toFixed(2)}</span>
              <span style={{ textDecoration: "line-through", color: "#999", marginLeft: "2px" }}>${(p.price * 2).toFixed(2)}</span>
            </div>
            <div style={{ background: primaryColor, color: secondaryColor, padding: "3px 4px", borderRadius: "4px", fontSize: isMobile ? "7px" : "8px", fontWeight: "bold" }}>{selectText}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", padding: "8px", background: popupBg, borderRadius: "0 0 8px 8px" }}>
        {!removeButton && <div style={{ flex: 1, border: `1px solid ${primaryColor}`, color: primaryColor, textAlign: "center" as const, padding: "6px", borderRadius: "6px", fontSize: isMobile ? "8px" : "9px", fontWeight: "bold" }}>{continueText}</div>}
        <div style={{ flex: 1, background: primaryColor, color: secondaryColor, textAlign: "center" as const, padding: "6px", borderRadius: "6px", fontSize: isMobile ? "8px" : "9px", fontWeight: "bold" }}>{addToCartText} (0)</div>
      </div>
    </div>
  );

  return (
    <Page backAction={{ content: "Customization", url: "/app/customization" }} title="Buy X get Y pop-up" subtitle="Change pop-up text, color and behaviour." primaryAction={{ content: "Save", onAction: handleSave, loading: isSaving, disabled: isSaving }}>
      {saved && <Box paddingBlockEnd="400"><Banner tone="success" title="Settings saved!" onDismiss={() => setSaved(false)} /></Box>}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card><InlineStack align="space-between" blockAlign="center"><InlineStack gap="200"><span>👁</span><Text as="h2" variant="headingSm">Display widget on store</Text></InlineStack><Button onClick={() => setEnabled(!enabled)} variant={enabled ? "primary" : undefined} size="slim">{enabled ? "ON" : "OFF"}</Button></InlineStack></Card>
            <Card><BlockStack gap="400"><InlineStack align="space-between"><InlineStack gap="200"><span>✏️</span><Text as="h2" variant="headingSm">Text customization</Text></InlineStack><Button variant="plain" size="slim">Reset to default</Button></InlineStack><Text as="p" variant="bodySm" fontWeight="bold">Header texts</Text><TextField label="Title" value={headerTitle} onChange={setHeaderTitle} autoComplete="off" /><TextField label="Subtitle" value={subtitle} onChange={setSubtitle} autoComplete="off" multiline={2} /><Text as="p" variant="bodySm" fontWeight="bold">Button labels</Text><TextField label='"Select"' value={selectText} onChange={setSelectText} autoComplete="off" /><TextField label='"Add to Cart"' value={addToCartText} onChange={setAddToCartText} autoComplete="off" /><TextField label='"Continue Shopping"' value={continueText} onChange={setContinueText} autoComplete="off" /><Checkbox label="Remove this button" checked={removeButton} onChange={setRemoveButton} /></BlockStack></Card>
            <Card><BlockStack gap="400"><Text as="h2" variant="headingSm">Discount badge</Text><Text as="p" variant="bodySm">How the discount appears on badge</Text><InlineStack gap="200"><Button size="slim" variant={discountBadgeType === "percentage" ? "primary" : undefined} onClick={() => setDiscountBadgeType("percentage")}>Percentage</Button><Button size="slim" variant={discountBadgeType === "amount" ? "primary" : undefined} onClick={() => setDiscountBadgeType("amount")}>Amount</Button></InlineStack><Checkbox label='Show "Free Gift" badge' checked={showFreeGiftBadge} onChange={setShowFreeGiftBadge} /></BlockStack></Card>
            <Card><BlockStack gap="400"><InlineStack align="space-between"><InlineStack gap="200"><span>🎨</span><Text as="h2" variant="headingSm">Color palette</Text></InlineStack><Button variant="plain" size="slim">Reset to default</Button></InlineStack><Text as="p" variant="bodySm" fontWeight="bold">Theme colors</Text><ColorPickerInput label="Primary color" value={primaryColor} onChange={setPrimaryColor} /><ColorPickerInput label="Secondary color" value={secondaryColor} onChange={setSecondaryColor} /><ColorPickerInput label="Border color" value={borderColor} onChange={setBorderColor} /><Text as="p" variant="bodySm" fontWeight="bold">Element colors</Text><ColorPickerInput label="Pop-up background" value={popupBg} onChange={setPopupBg} /><ColorPickerInput label="Header background" value={headerBg} onChange={setHeaderBg} /><ColorPickerInput label="Add to cart color" value={addToCartColor} onChange={setAddToCartColor} /><ColorPickerInput label="Sale badge color" value={saleBadgeColor} onChange={setSaleBadgeColor} /></BlockStack></Card>
            <Card><BlockStack gap="400"><InlineStack align="space-between"><InlineStack gap="200"><span>⚙️</span><Text as="h2" variant="headingSm">Advanced</Text></InlineStack><Button variant="plain" size="slim">Reset to default</Button></InlineStack><Text as="p" variant="bodySm">When should the pop-up be dismissed?</Text><Checkbox label="Dismiss until triggered again" checked={dismissBehavior === "until_triggered"} onChange={() => setDismissBehavior("until_triggered")} /><Checkbox label="Dismiss for 2 minutes after closing" checked={dismissBehavior === "2_minutes"} onChange={() => setDismissBehavior("2_minutes")} /><Checkbox label="Keep displaying until moved to action" checked={dismissBehavior === "keep_displaying"} onChange={() => setDismissBehavior("keep_displaying")} /></BlockStack></Card>
            <Card><BlockStack gap="400"><InlineStack gap="200"><span>📐</span><Text as="h2" variant="headingSm">Size &amp; spacing</Text></InlineStack><LayoutControls value={layout} onChange={setLayout} /></BlockStack></Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <StickyPreview><Card><BlockStack gap="400">
            <InlineStack align="space-between"><Text as="h2" variant="headingSm">Preview</Text><InlineStack gap="100"><Button size="slim" variant={previewDevice === "desktop" ? "primary" : undefined} onClick={() => setPreviewDevice("desktop")}>🖥</Button><Button size="slim" variant={previewDevice === "mobile" ? "primary" : undefined} onClick={() => setPreviewDevice("mobile")}>📱</Button></InlineStack></InlineStack>
            <Box background="bg-surface-secondary" borderRadius="300" padding="200"><DeviceMockup device={previewDevice}>{enabled && <PopupPreview />}</DeviceMockup></Box>
          </BlockStack></Card></StickyPreview>
        </Layout.Section>
      </Layout>
    </Page>
  );
}