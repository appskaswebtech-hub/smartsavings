import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { Page, Card, Text, BlockStack, InlineStack, Button, Box, TextField, Layout, RangeSlider, Banner } from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ColorPickerInput, StickyPreview, DeviceMockup } from "../components/CustomizationWidgets";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const c = await db.widgetCustomization.findUnique({ where: { shop_widgetType: { shop: session.shop, widgetType: "quantity_table" } } });
  return json({ config: c ? JSON.parse(c.config) : null });
};
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  await db.widgetCustomization.upsert({ where: { shop_widgetType: { shop: session.shop, widgetType: "quantity_table" } }, update: { config: fd.get("config") as string }, create: { shop: session.shop, widgetType: "quantity_table", config: fd.get("config") as string } });
  return json({ success: true });
};

export default function QuantityTable() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [headerTitle, setHeaderTitle] = useState(config?.headerTitle ?? "Buy more, Save more");
  const [buyText, setBuyText] = useState(config?.buyText ?? "Buy");
  const [getText, setGetText] = useState(config?.getText ?? "Get");
  const [offText, setOffText] = useState(config?.offText ?? "{Discount} Off");
  const [discountFormat, setDiscountFormat] = useState(config?.discountFormat ?? "Discount (X) off");
  const [perItemText, setPerItemText] = useState(config?.perItemText ?? "on each");
  const [newPriceText, setNewPriceText] = useState(config?.newPriceText ?? "each item (price-price)");
  const [textColor, setTextColor] = useState(config?.textColor ?? "#000000");
  const [titleBgColor, setTitleBgColor] = useState(config?.titleBgColor ?? "#FFFFFF");
  const [tableTextColor, setTableTextColor] = useState(config?.tableTextColor ?? "#000000");
  const [borderColor, setBorderColor] = useState(config?.borderColor ?? "#E0E0E0");
  const [borderRadiusVal, setBorderRadiusVal] = useState(config?.borderRadius ?? 8);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const fd = new FormData();
    fd.append("config", JSON.stringify({ enabled, headerTitle, buyText, getText, offText, discountFormat, perItemText, newPriceText, textColor, titleBgColor, tableTextColor, borderColor, borderRadius: borderRadiusVal }));
    submit(fd, { method: "post" }); setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const TablePreview = () => (
    <div style={{ display: "flex", padding: "12px", gap: "12px", flexDirection: previewDevice === "mobile" ? "column" as const : "row" as const }}>
      <div style={{ width: previewDevice === "mobile" ? "100%" : "120px", height: previewDevice === "mobile" ? "100px" : "160px", background: "#f0f0f0", borderRadius: "8px" }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: "6px", width: "80%", background: "#e5e5e5", borderRadius: "3px", marginBottom: "6px" }} />
        <div style={{ height: "6px", width: "50%", background: "#e5e5e5", borderRadius: "3px", marginBottom: "12px" }} />
        {enabled && <div style={{ border: `1px solid ${borderColor}`, borderRadius: `${borderRadiusVal}px`, overflow: "hidden", fontSize: previewDevice === "mobile" ? "9px" : "10px" }}>
          <div style={{ background: titleBgColor, padding: "6px 8px", fontWeight: "bold", color: textColor }}>{headerTitle}</div>
          <div style={{ display: "flex", padding: "4px 8px", borderBottom: "1px solid #eee", fontWeight: "bold", color: tableTextColor }}><span style={{ flex: 1 }}>{buyText}</span><span style={{ flex: 1 }}>{getText}</span></div>
          {[{ q: "1+", d: "$10 off each" }, { q: "3+", d: "$15 off each" }, { q: "5+", d: "$20 off each" }].map((r, i) => <div key={i} style={{ display: "flex", padding: "4px 8px", borderBottom: "1px solid #f5f5f5", color: tableTextColor }}><span style={{ flex: 1 }}>{r.q}</span><span style={{ flex: 1 }}>{r.d}</span></div>)}
        </div>}
        <div style={{ marginTop: "8px", background: "#10b981", color: "white", textAlign: "center" as const, padding: "6px", borderRadius: "6px", fontSize: "10px", fontWeight: "bold" }}>Add to cart</div>
      </div>
    </div>
  );

  return (
    <Page backAction={{ content: "Customization", url: "/app/customization" }} title="Quantity & volume discount" subtitle="Change content and style of the tier table." primaryAction={{ content: "Save", onAction: handleSave }}>
      {saved && <Box paddingBlockEnd="400"><Banner tone="success" title="Settings saved!" onDismiss={() => setSaved(false)} /></Box>}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card><InlineStack align="space-between" blockAlign="center"><InlineStack gap="200"><span>👁</span><Text as="h2" variant="headingSm">Display widget on store</Text></InlineStack><Button onClick={() => setEnabled(!enabled)} variant={enabled ? "primary" : undefined} size="slim">{enabled ? "ON" : "OFF"}</Button></InlineStack></Card>
            <Card><BlockStack gap="400"><InlineStack align="space-between"><InlineStack gap="200"><span>✏️</span><Text as="h2" variant="headingSm">Headers content</Text></InlineStack><Button variant="plain" size="slim">Reset to default</Button></InlineStack><TextField label="Title" value={headerTitle} onChange={setHeaderTitle} autoComplete="off" /><TextField label='"Buy" text' value={buyText} onChange={setBuyText} autoComplete="off" /><TextField label='"Get" text' value={getText} onChange={setGetText} autoComplete="off" /></BlockStack></Card>
            <Card><BlockStack gap="400"><InlineStack align="space-between"><InlineStack gap="200"><span>✏️</span><Text as="h2" variant="headingSm">Discount content</Text></InlineStack><Button variant="plain" size="slim">Reset to default</Button></InlineStack><TextField label='"Off" text' value={offText} onChange={setOffText} autoComplete="off" /><TextField label="Discount format" value={discountFormat} onChange={setDiscountFormat} autoComplete="off" /><TextField label="Per item text" value={perItemText} onChange={setPerItemText} autoComplete="off" /><TextField label="New price text" value={newPriceText} onChange={setNewPriceText} autoComplete="off" /></BlockStack></Card>
            <Card><BlockStack gap="400"><InlineStack align="space-between"><InlineStack gap="200"><span>🎨</span><Text as="h2" variant="headingSm">Styles</Text></InlineStack><Button variant="plain" size="slim">Reset to default</Button></InlineStack><ColorPickerInput label="Text color" value={textColor} onChange={setTextColor} /><ColorPickerInput label="Title background color" value={titleBgColor} onChange={setTitleBgColor} /><ColorPickerInput label="Table text color" value={tableTextColor} onChange={setTableTextColor} /><ColorPickerInput label="Border color" value={borderColor} onChange={setBorderColor} /><RangeSlider label="Border radius" value={borderRadiusVal} onChange={(v) => setBorderRadiusVal(v as number)} min={0} max={20} output suffix="px" /></BlockStack></Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <StickyPreview><Card><BlockStack gap="400">
            <InlineStack align="space-between"><Text as="h2" variant="headingSm">Preview</Text><InlineStack gap="100"><Button size="slim" variant={previewDevice === "desktop" ? "primary" : undefined} onClick={() => setPreviewDevice("desktop")}>🖥</Button><Button size="slim" variant={previewDevice === "mobile" ? "primary" : undefined} onClick={() => setPreviewDevice("mobile")}>📱</Button></InlineStack></InlineStack>
            <Box background="bg-surface-secondary" borderRadius="300" padding="200"><DeviceMockup device={previewDevice}><div style={{ padding: "8px", background: "white", borderBottom: "1px solid #eee", display: "flex", gap: "8px" }}><div style={{ padding: "4px 12px", background: "#e0e0e0", borderRadius: "4px", fontSize: "10px", fontWeight: "bold" }}>Save more</div></div><TablePreview /></DeviceMockup></Box>
          </BlockStack></Card></StickyPreview>
        </Layout.Section>
      </Layout>
    </Page>
  );
}