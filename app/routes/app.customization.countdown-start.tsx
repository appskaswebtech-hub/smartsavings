import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { useIsSaving } from "../lib/useIsSaving";
import { Page, Text, BlockStack, InlineStack, Button, Box, TextField, Checkbox, Layout, RangeSlider, Banner } from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ColorPickerInput, StickyPreview, DeviceMockup, PlaceholderLines, LayoutControls, type LayoutValue } from "../components/CustomizationWidgets";
import { PageHeader, SectionCard } from "../components/Theme";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const config = await db.widgetCustomization.findUnique({ where: { shop_widgetType: { shop: session.shop, widgetType: "countdown_start" } } });
  return json({ config: config ? JSON.parse(config.config) : null });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  await db.widgetCustomization.upsert({
    where: { shop_widgetType: { shop: session.shop, widgetType: "countdown_start" } },
    update: { config: formData.get("config") as string },
    create: { shop: session.shop, widgetType: "countdown_start", config: formData.get("config") as string },
  });
  return json({ success: true });
};

export default function CountdownStart() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [enabled, setEnabled] = useState(config?.enabled ?? true);
  const [position, setPosition] = useState(config?.position ?? "top");
  const [stickyBanner, setStickyBanner] = useState(config?.stickyBanner ?? false);
  const [alwaysVisible, setAlwaysVisible] = useState(config?.alwaysVisible ?? true);
  const [removeCloseIcon, setRemoveCloseIcon] = useState(config?.removeCloseIcon ?? false);
  const [removeCtaButton, setRemoveCtaButton] = useState(config?.removeCtaButton ?? false);
  const [title, setTitle] = useState(config?.title ?? "Sale starts in");
  const [titleSize, setTitleSize] = useState(config?.titleSize ?? "14/15");
  const [timerLabels, setTimerLabels] = useState<Record<string, boolean>>(config?.timerLabels ?? { day: true, hr: true, min: true, sec: true });
  const [ctaText, setCtaText] = useState(config?.ctaText ?? "Click here");
  const [ctaSize, setCtaSize] = useState(config?.ctaSize ?? "16/26");
  const [ctaUrl, setCtaUrl] = useState(config?.ctaUrl ?? "");
  const [makeClickable, setMakeClickable] = useState(config?.makeClickable ?? false);
  const [bgType, setBgType] = useState(config?.bgType ?? "gradient");
  const [bgColor1, setBgColor1] = useState(config?.bgColor1 ?? "#252727");
  const [bgColor2, setBgColor2] = useState(config?.bgColor2 ?? "#4C4E63");
  const [gradientAngle, setGradientAngle] = useState(config?.gradientAngle ?? 160);
  const [borderRadius, setBorderRadius] = useState(config?.borderRadius ?? 8);
  const [closeIconColor, setCloseIconColor] = useState(config?.closeIconColor ?? "#D5D5E5");
  const [titleColor, setTitleColor] = useState(config?.titleColor ?? "#FFFFFF");
  const [countdownBoxText, setCountdownBoxText] = useState(config?.countdownBoxText ?? "#FFFFFF");
  const [countdownNumber, setCountdownNumber] = useState(config?.countdownNumber ?? "#F14262");
  const [ctaBg, setCtaBg] = useState(config?.ctaBg ?? "#F14262");
  const [ctaTextColor, setCtaTextColor] = useState(config?.ctaTextColor ?? "#FFFFFF");
  const [previewMode, setPreviewMode] = useState<"homepage" | "product">("homepage");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [layout, setLayout] = useState<LayoutValue>(config?.layout ?? {});
  const [saved, setSaved] = useState(false);

  const isSaving = useIsSaving();

  const handleSave = () => {
    if (isSaving) return;
    const formData = new FormData();
    formData.append("config", JSON.stringify({ enabled, position, stickyBanner, alwaysVisible, removeCloseIcon, removeCtaButton, title, titleSize, timerLabels, ctaText, ctaSize, ctaUrl, makeClickable, bgType, bgColor1, bgColor2, gradientAngle, borderRadius, closeIconColor, titleColor, countdownBoxText, countdownNumber, ctaBg, ctaTextColor, layout }));
    submit(formData, { method: "post" });
    setSaved(true); setTimeout(() => setSaved(false), 3000);
  };

  const bannerBg = bgType === "gradient" ? `linear-gradient(${gradientAngle}deg, ${bgColor1}, ${bgColor2})` : bgColor1;
  const timerNums = ["03", "12", "45", "22"];
  const timerUnits = ["Day", "Hr", "Min", "Sec"];

  const BannerPreview = () => (
    <div style={{ background: bannerBg, padding: previewDevice === "mobile" ? "6px 8px" : "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: previewDevice === "mobile" ? "6px" : "12px", borderRadius: `${borderRadius}px`, margin: "4px", flexWrap: "wrap" as const }}>
      <span style={{ color: titleColor, fontSize: previewDevice === "mobile" ? "8px" : "11px", fontWeight: "bold" }}>🔥 {title}</span>
      <div style={{ display: "flex", gap: "3px" }}>
        {timerNums.map((n, i) => (
          <div key={i} style={{ display: timerLabels[["day", "hr", "min", "sec"][i]] ? "flex" : "none", flexDirection: "column" as const, alignItems: "center", gap: "1px" }}>
            <div style={{ background: countdownNumber, color: countdownBoxText, padding: previewDevice === "mobile" ? "2px 3px" : "3px 5px", borderRadius: "4px", fontSize: previewDevice === "mobile" ? "9px" : "11px", fontWeight: "bold", minWidth: previewDevice === "mobile" ? "16px" : "20px", textAlign: "center" as const }}>{n}</div>
            <span style={{ color: countdownBoxText, fontSize: "6px", opacity: 0.7 }}>{timerUnits[i]}</span>
          </div>
        ))}
      </div>
      {!removeCtaButton && <div style={{ background: ctaBg, color: ctaTextColor, fontSize: previewDevice === "mobile" ? "7px" : "9px", padding: previewDevice === "mobile" ? "2px 6px" : "3px 10px", borderRadius: "4px", fontWeight: "bold" }}>{ctaText}</div>}
      {!removeCloseIcon && <span style={{ color: closeIconColor, fontSize: previewDevice === "mobile" ? "10px" : "12px", cursor: "pointer" }}>✕</span>}
    </div>
  );

  return (
    <Page fullWidth>
      <div className="ss-page">
      <PageHeader
        backTo="/app/customization"
        backLabel="Customization"
        title="Starts in countdown timer"
        subtitle="Set new style for starts in countdown timer."
        primaryAction={{ content: "Save", icon: "save", onAction: handleSave, loading: isSaving, disabled: isSaving }}
      />
      {saved && <Box paddingBlockEnd="400"><Banner tone="success" title="Settings saved!" onDismiss={() => setSaved(false)} /></Box>}
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Display Toggle */}
            <SectionCard title="Display widget on store" icon="eye" tone="blue" actions={<Button onClick={() => setEnabled(!enabled)} variant={enabled ? "primary" : undefined} size="slim">{enabled ? "ON" : "OFF"}</Button>} />

            {/* General */}
            <SectionCard title="General" icon="sliders" tone="violet" actions={<Button variant="plain" size="slim">Reset to default</Button>}><BlockStack gap="400">
              <Text as="p" variant="bodySm" fontWeight="bold">Countdown position on homepage</Text>
              <InlineStack gap="200">
                <Button size="slim" variant={position === "top" ? "primary" : undefined} onClick={() => setPosition("top")}>Top</Button>
                <Button size="slim" variant={position === "bottom" ? "primary" : undefined} onClick={() => setPosition("bottom")}>Bottom</Button>
              </InlineStack>
              <Checkbox label="Sticky banner" checked={stickyBanner} onChange={setStickyBanner} />
              <Checkbox label="Always visible while scrolling" checked={alwaysVisible} onChange={setAlwaysVisible} />
              <Checkbox label="Remove close icon" checked={removeCloseIcon} onChange={setRemoveCloseIcon} />
              <Checkbox label="Remove CTA button" checked={removeCtaButton} onChange={setRemoveCtaButton} />
            </BlockStack></SectionCard>

            {/* Content */}
            <SectionCard title="Content" icon="text" tone="sky" actions={<Button variant="plain" size="slim">Reset to default</Button>}><BlockStack gap="400">
              <TextField label="Title" value={title} onChange={setTitle} autoComplete="off" suffix={titleSize} />
              <Text as="p" variant="bodySm" fontWeight="bold">Timer label</Text>
              <InlineStack gap="200">
                {(["day", "hr", "min", "sec"] as const).map(key => (
                  <Button key={key} size="slim" variant={timerLabels[key] ? "primary" : undefined} onClick={() => setTimerLabels({ ...timerLabels, [key]: !timerLabels[key] })}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Button>
                ))}
              </InlineStack>
              <TextField label="CTA text" value={ctaText} onChange={setCtaText} autoComplete="off" suffix={ctaSize} />
              <TextField label="URL" value={ctaUrl} onChange={setCtaUrl} autoComplete="off" placeholder="https://brand-new-checkout-surrey.myshopify..." />
              <Checkbox label="Make entire banner clickable" checked={makeClickable} onChange={setMakeClickable} />
            </BlockStack></SectionCard>

            {/* Banner Style */}
            <SectionCard title="Banner style" icon="palette" tone="amber" actions={<Button variant="plain" size="slim">Reset to default</Button>}><BlockStack gap="400">
              <Text as="p" variant="bodySm" fontWeight="bold">Background</Text>
              <InlineStack gap="200">
                <Button size="slim" variant={bgType === "single" ? "primary" : undefined} onClick={() => setBgType("single")}>Single color</Button>
                <Button size="slim" variant={bgType === "gradient" ? "primary" : undefined} onClick={() => setBgType("gradient")}>Gradient</Button>
              </InlineStack>
              <InlineStack gap="300">
                <ColorPickerInput label="" value={bgColor1} onChange={setBgColor1} />
                {bgType === "gradient" && <ColorPickerInput label="" value={bgColor2} onChange={setBgColor2} />}
              </InlineStack>
              {bgType === "gradient" && <RangeSlider label="Gradient angle" value={gradientAngle} onChange={(v) => setGradientAngle(v as number)} min={0} max={360} output />}
              <RangeSlider label="Radius" value={borderRadius} onChange={(v) => setBorderRadius(v as number)} min={0} max={35} output />
              <ColorPickerInput label="Close icon color" value={closeIconColor} onChange={setCloseIconColor} />
            </BlockStack></SectionCard>

            {/* Content Color */}
            <SectionCard title="Content color" icon="palette" tone="amber" actions={<Button variant="plain" size="slim">Reset to default</Button>}><BlockStack gap="400">
              <ColorPickerInput label="Title" value={titleColor} onChange={setTitleColor} />
              <ColorPickerInput label="Countdown box and text" value={countdownBoxText} onChange={setCountdownBoxText} />
              <ColorPickerInput label="Countdown number" value={countdownNumber} onChange={setCountdownNumber} />
              <ColorPickerInput label="CTA background" value={ctaBg} onChange={setCtaBg} />
              <ColorPickerInput label="CTA text" value={ctaTextColor} onChange={setCtaTextColor} />
            </BlockStack></SectionCard>

            {/* Size & spacing */}
            <SectionCard title="Size & spacing" icon="ruler" tone="mint"><BlockStack gap="400"><LayoutControls value={layout} onChange={setLayout} /></BlockStack></SectionCard>
          </BlockStack>
        </Layout.Section>

        {/* Preview - Sticky */}
        <Layout.Section variant="oneThird">
          <StickyPreview>
            <SectionCard title="Preview" icon="monitor" tone="sky" actions={<InlineStack gap="200">
                    <Button size="slim" variant={previewMode === "homepage" ? "primary" : undefined} onClick={() => setPreviewMode("homepage")}>Homepage</Button>
                    <Button size="slim" variant={previewMode === "product" ? "primary" : undefined} onClick={() => setPreviewMode("product")}>Product page</Button>
                  </InlineStack>}>
              <BlockStack gap="400">
                <InlineStack align="end" gap="100">
                  <Button size="slim" variant={previewDevice === "desktop" ? "primary" : undefined} onClick={() => setPreviewDevice("desktop")}>🖥</Button>
                  <Button size="slim" variant={previewDevice === "mobile" ? "primary" : undefined} onClick={() => setPreviewDevice("mobile")}>📱</Button>
                </InlineStack>

                <Box background="bg-surface-secondary" borderRadius="300" padding="200">
                  <DeviceMockup device={previewDevice}>
                    {enabled && <BannerPreview />}
                    <PlaceholderLines count={previewDevice === "mobile" ? 2 : 3} />
                  </DeviceMockup>
                </Box>
              </BlockStack>
            </SectionCard>
          </StickyPreview>
        </Layout.Section>
      </Layout>
      </div>
    </Page>
  );
}