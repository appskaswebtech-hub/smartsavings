import { Text, InlineStack, BlockStack, TextField } from "@shopify/polaris";
import type { ReactNode, CSSProperties } from "react";

/* ── Color Picker Input ──────────────────────────────── */
export function ColorPickerInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div style={{ marginBottom: "8px" }}>
      {label && (
        <div style={{ marginBottom: "4px" }}>
          <Text as="span" variant="bodySm">
            {label}
          </Text>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            position: "relative",
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            overflow: "hidden",
            border: "1px solid #ccc",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              top: "-4px",
              left: "-4px",
              width: "44px",
              height: "44px",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "13px",
            fontFamily: "monospace",
            background: "white",
            flex: 1,
            maxWidth: "140px",
          }}
        >
          <span style={{ color: "#999", marginRight: "2px" }}>#</span>
          <input
            type="text"
            value={value.replace("#", "").toUpperCase()}
            onChange={(e) => {
              const hex = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
              if (hex.length <= 6) onChange(`#${hex}`);
            }}
            style={{
              border: "none",
              outline: "none",
              fontSize: "13px",
              fontFamily: "monospace",
              width: "100%",
              background: "transparent",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sticky Preview Wrapper ──────────────────────────── */
export function StickyPreview({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "sticky",
        top: "16px",
        maxHeight: "calc(100vh - 120px)",
        overflowY: "auto",
      }}
    >
      {children}
    </div>
  );
}

/* ── Browser / Phone Mockup ──────────────────────────── */
export function DeviceMockup({
  device,
  children,
}: {
  device: "desktop" | "mobile";
  children: ReactNode;
}) {
  if (device === "mobile") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "12px",
        }}
      >
        <div
          style={{
            width: "220px",
            minHeight: "400px",
            background: "#1a1a1a",
            borderRadius: "28px",
            padding: "10px 6px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          }}
        >
          {/* Phone notch */}
          <div
            style={{
              width: "80px",
              height: "6px",
              background: "#333",
              borderRadius: "3px",
              margin: "0 auto 6px auto",
            }}
          />
          {/* Screen */}
          <div
            style={{
              background: "#f5f5f5",
              borderRadius: "18px",
              overflow: "hidden",
              minHeight: "360px",
            }}
          >
            {children}
          </div>
          {/* Home bar */}
          <div
            style={{
              width: "60px",
              height: "4px",
              background: "#555",
              borderRadius: "2px",
              margin: "6px auto 0 auto",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#f5f5f5",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #e0e0e0",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          padding: "6px 10px",
          display: "flex",
          gap: "4px",
          borderBottom: "1px solid #e0e0e0",
          background: "#fafafa",
        }}
      >
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#e53e3e" }} />
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
      </div>
      {/* Nav bar */}
      <div style={{ padding: "8px 16px", background: "white", borderBottom: "1px solid #eee" }}>
        <div style={{ height: "6px", width: "60%", background: "#e5e5e5", borderRadius: "3px" }} />
      </div>
      {children}
    </div>
  );
}

/* ── Content Placeholder Lines ───────────────────────── */
export function PlaceholderLines({ count = 3 }: { count?: number }) {
  const widths = ["40%", "70%", "55%", "65%", "45%"];
  return (
    <div style={{ padding: "16px", minHeight: "120px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: "6px",
            width: widths[i % widths.length],
            background: "#e5e5e5",
            borderRadius: "3px",
            marginBottom: "8px",
          }}
        />
      ))}
    </div>
  );
}

/* ── Layout / Size & spacing controls ────────────────── */

export interface LayoutValue {
  width?: string;
  height?: string;
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  borderColor?: string;
  borderRadius?: string;
  fontColor?: string;
}

/** Build inline styles from a layout object — only applies fields the merchant set. */
export function layoutStyle(layout?: LayoutValue): CSSProperties {
  const l = layout || {};
  const s: CSSProperties = {};
  const px = (v?: string) => (v !== undefined && v !== "" && !isNaN(Number(v)) ? `${Number(v)}px` : undefined);
  if (px(l.width)) s.width = px(l.width);
  if (px(l.height)) s.height = px(l.height);
  if (px(l.paddingTop)) s.paddingTop = px(l.paddingTop);
  if (px(l.paddingBottom)) s.paddingBottom = px(l.paddingBottom);
  if (px(l.paddingLeft)) s.paddingLeft = px(l.paddingLeft);
  if (px(l.paddingRight)) s.paddingRight = px(l.paddingRight);
  if (px(l.borderRadius)) s.borderRadius = px(l.borderRadius);
  if (l.borderColor) {
    s.borderColor = l.borderColor;
    s.borderStyle = "solid";
    s.borderWidth = "1px";
  }
  if (l.fontColor) s.color = l.fontColor;
  return s;
}

function NumField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <TextField
      label={label}
      type="number"
      min={0}
      value={value ?? ""}
      onChange={(v) => {
        if (v === "" || (!isNaN(Number(v)) && Number(v) >= 0)) onChange(v);
      }}
      autoComplete="off"
      placeholder="auto"
    />
  );
}

/**
 * Reusable "Size & spacing" controls shared by every customization page.
 * Edits a single `layout` object; all fields optional (blank = leave widget as-is).
 */
export function LayoutControls({
  value,
  onChange,
}: {
  value: LayoutValue;
  onChange: (next: LayoutValue) => void;
}) {
  const set = (key: keyof LayoutValue) => (v: string) => onChange({ ...value, [key]: v });
  return (
    <BlockStack gap="300">
      <Text as="p" variant="bodySm" tone="subdued">
        All fields are optional — leave blank to keep the widget's default size and style.
      </Text>

      <Text as="p" variant="bodySm" fontWeight="bold">Size (px)</Text>
      <InlineStack gap="300" wrap>
        <div style={{ width: "140px" }}><NumField label="Width" value={value.width} onChange={set("width")} /></div>
        <div style={{ width: "140px" }}><NumField label="Height" value={value.height} onChange={set("height")} /></div>
      </InlineStack>

      <Text as="p" variant="bodySm" fontWeight="bold">Padding (px)</Text>
      <InlineStack gap="300" wrap>
        <div style={{ width: "140px" }}><NumField label="Top" value={value.paddingTop} onChange={set("paddingTop")} /></div>
        <div style={{ width: "140px" }}><NumField label="Bottom" value={value.paddingBottom} onChange={set("paddingBottom")} /></div>
        <div style={{ width: "140px" }}><NumField label="Left" value={value.paddingLeft} onChange={set("paddingLeft")} /></div>
        <div style={{ width: "140px" }}><NumField label="Right" value={value.paddingRight} onChange={set("paddingRight")} /></div>
      </InlineStack>

      <Text as="p" variant="bodySm" fontWeight="bold">Border & text</Text>
      <ColorPickerInput label="Border color" value={value.borderColor || "#E0E0E0"} onChange={set("borderColor")} />
      <div style={{ width: "160px" }}><NumField label="Border radius (px)" value={value.borderRadius} onChange={set("borderRadius")} /></div>
      <ColorPickerInput label="Font / text color" value={value.fontColor || "#333333"} onChange={set("fontColor")} />
    </BlockStack>
  );
}
