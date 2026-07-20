import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import {
  Page, Card, Text, BlockStack, InlineStack, Box, InlineGrid, Tabs, Badge, Icon,
} from "@shopify/polaris";
import { InfoIcon } from "@shopify/polaris-icons";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

function WidgetCard({ title, description, tags, previewContent, onClick }: {
  title: string; description: string; tags: string[]; previewContent: React.ReactNode; onClick: () => void;
}) {
  return (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      <Card>
        <BlockStack gap="400">
          <Box background="bg-surface-secondary" borderRadius="200" padding="400" minHeight="140px">
            {previewContent}
          </Box>
          <InlineStack align="space-between" blockAlign="start">
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">{title}</Text>
              <Text as="p" variant="bodySm" tone="subdued">{description}</Text>
            </BlockStack>
            <Icon source={InfoIcon} tone="subdued" />
          </InlineStack>
          <InlineStack gap="200">
            {tags.map((tag, i) => <Badge key={i} tone="info">{tag}</Badge>)}
          </InlineStack>
        </BlockStack>
      </Card>
    </div>
  );
}

function CountdownPreview({ label, color }: { label: string; color: string }) {
  return (
    <BlockStack gap="200">
      <InlineStack gap="200" blockAlign="center">
        <Text as="span" variant="bodySm" tone="subdued">Style:</Text>
        <div style={{ display: "flex", gap: "2px" }}>
          <div style={{ width: "16px", height: "16px", borderRadius: "3px", background: "#10b981", border: "1px solid #ccc" }} />
          <div style={{ width: "16px", height: "16px", borderRadius: "3px", background: "#1e293b", border: "1px solid #ccc" }} />
        </div>
      </InlineStack>
      <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e5e5e5", padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px" }}>🔥 {label} :</span>
        <div style={{ display: "flex", gap: "3px" }}>
          {["01", "12", "23", "57"].map((n, i) => (
            <div key={i} style={{ background: color, color: "white", padding: "3px 5px", borderRadius: "4px", fontSize: "11px", fontWeight: "bold", minWidth: "22px", textAlign: "center" as const }}>{n}</div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: "24px", paddingLeft: "110px" }}>
        {["Day", "Hrs", "Mins", "Secs"].map(u => <span key={u} style={{ fontSize: "8px", color: "#999" }}>{u}</span>)}
      </div>
      <InlineStack gap="100" blockAlign="center">
        <Text as="span" variant="bodySm" tone="subdued">Content:</Text>
        <div style={{ background: "#f5f5f5", borderRadius: "4px", padding: "2px 8px", fontSize: "10px", color: "#999" }}>Sale ends in</div>
      </InlineStack>
    </BlockStack>
  );
}

function QuantityTablePreview() {
  return (
    <BlockStack gap="100">
      <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e5e5e5", padding: "8px", fontSize: "10px" }}>
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Buy more, Save more!</div>
        <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
          <span style={{ background: "#10b981", color: "white", padding: "1px 6px", borderRadius: "3px", fontWeight: "bold", fontSize: "9px" }}>Buy</span>
          <span style={{ background: "#f97316", color: "white", padding: "1px 6px", borderRadius: "3px", fontWeight: "bold", fontSize: "9px" }}>Get</span>
        </div>
        {[{ q: "1+", d: "$10" }, { q: "3+", d: "$15" }, { q: "5+", d: "$20" }].map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px", background: i % 2 === 0 ? "#f9f9f9" : "transparent", borderRadius: "2px" }}>
            <span>{r.q}</span><span style={{ color: "#10b981", fontWeight: "bold" }}>{r.d} off each</span>
          </div>
        ))}
      </div>
      <InlineStack gap="200" blockAlign="center">
        <Text as="span" variant="bodySm" tone="subdued">Style:</Text>
        <div style={{ display: "flex", gap: "2px" }}>
          <div style={{ width: "16px", height: "16px", borderRadius: "3px", background: "#10b981", border: "1px solid #ccc" }} />
          <div style={{ width: "16px", height: "16px", borderRadius: "3px", background: "#1e293b", border: "1px solid #ccc" }} />
        </div>
      </InlineStack>
    </BlockStack>
  );
}

function SavingOnCartPreview() {
  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column" as const, gap: "4px", fontSize: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>Saving:</span>
          <div style={{ width: "14px", height: "14px", background: "#000", borderRadius: "2px" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span>Border:</span>
          <span style={{ fontSize: "9px", color: "#999" }}>0 3</span>
          <div style={{ width: "14px", height: "14px", background: "#10b981", borderRadius: "2px" }} />
        </div>
      </div>
      <div style={{ background: "white", borderRadius: "6px", border: "1px solid #e5e5e5", padding: "6px", fontSize: "10px", minWidth: "100px" }}>
        <div style={{ textAlign: "right" as const, marginBottom: "2px", fontWeight: "bold" }}>90$</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>$100</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", border: "1px solid #10b981", borderRadius: "3px", padding: "1px 4px", margin: "2px 0" }}>
          <span style={{ color: "#10b981", fontWeight: "bold" }}>Saving</span><span>$10</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total</span><span>$90</span></div>
      </div>
    </div>
  );
}

function BuyXGetYPopupPreview() {
  return (
    <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e5e5e5", padding: "8px", fontSize: "10px" }}>
      <div style={{ fontWeight: "bold", marginBottom: "4px", fontSize: "9px" }}>Your current cart qualifies for these rewards</div>
      <div style={{ display: "flex", gap: "6px" }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ width: "36px", height: "36px", background: "#f0f0f0", borderRadius: "4px", position: "relative" }}>
            {i === 1 && <div style={{ position: "absolute", top: "-4px", right: "-4px", background: "#e53e3e", color: "white", fontSize: "7px", borderRadius: "50%", width: "14px", height: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>%</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
        <span style={{ fontSize: "8px", color: "#999" }}>Discount badge</span>
        <span style={{ fontSize: "8px", color: "#999" }}>Percentage</span>
      </div>
    </div>
  );
}

function ShippingBarPreview() {
  return (
    <BlockStack gap="200">
      <InlineStack gap="200" blockAlign="center">
        <Text as="span" variant="bodySm" tone="subdued">Style:</Text>
        <div style={{ display: "flex", gap: "2px" }}>
          <div style={{ width: "16px", height: "16px", borderRadius: "3px", background: "#10b981", border: "1px solid #ccc" }} />
          <div style={{ width: "16px", height: "16px", borderRadius: "3px", background: "#1e293b", border: "1px solid #ccc" }} />
        </div>
      </InlineStack>
      <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e5e5e5", padding: "10px" }}>
        <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "6px" }}>You're $25 away from free shipping</div>
        <div style={{ background: "#e5e5e5", borderRadius: "10px", height: "8px", overflow: "hidden", marginBottom: "4px" }}>
          <div style={{ background: "linear-gradient(90deg, #10b981, #34d399)", width: "60%", height: "100%", borderRadius: "10px" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "9px", color: "#999" }}>Message:</span>
          <span style={{ fontSize: "9px", color: "#999" }}>You're $25 away!</span>
        </div>
      </div>
    </BlockStack>
  );
}

function FloatingButtonPreview() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>🎁</div>
      <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e5e5e5", padding: "6px", fontSize: "10px" }}>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span>Color palette:</span>
          <div style={{ width: "12px", height: "12px", background: "#10b981", borderRadius: "2px" }} />
          <div style={{ width: "12px", height: "12px", background: "#1e293b", borderRadius: "2px" }} />
        </div>
        <div style={{ marginTop: "2px" }}>Position: ...</div>
      </div>
    </div>
  );
}

function DiscountCodeInputPreview() {
  return (
    <div style={{ border: "1px solid #E0E0E0", borderRadius: "8px", overflow: "hidden", background: "white" }}>
      <div style={{ padding: "10px 12px", textAlign: "center" as const, fontSize: "10px", fontWeight: 600, color: "#333" }}>
        🏷️ Have a discount code? Click here to enter it.
      </div>
      <div style={{ borderTop: "1px solid #f0f0f0", padding: "8px 12px", display: "flex", gap: "6px", alignItems: "center" }}>
        <div style={{ flex: 1, border: "1px solid #E0E0E0", borderRadius: "4px", padding: "5px", fontSize: "8px", color: "#aaa" }}>Enter discount code</div>
        <div style={{ background: "#1a1a1a", color: "white", borderRadius: "4px", padding: "5px 10px", fontSize: "8px", fontWeight: "bold" }}>Apply</div>
      </div>
    </div>
  );
}

function EmailPopupPreview() {
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", borderRadius: "8px", padding: "12px", display: "flex", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: "8px", padding: "10px", width: "130px", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: "9px", fontWeight: "bold", marginBottom: "3px" }}>Get your discount code</div>
        <div style={{ fontSize: "7px", color: "#888", marginBottom: "6px" }}>Enter your email to get the code.</div>
        <div style={{ border: "1px solid #ddd", borderRadius: "4px", padding: "4px", fontSize: "7px", color: "#aaa", marginBottom: "4px" }}>you@email.com</div>
        <div style={{ background: "#1a1a1a", color: "white", borderRadius: "4px", padding: "4px", fontSize: "7px", fontWeight: "bold", textAlign: "center" as const }}>Email me the code</div>
      </div>
    </div>
  );
}

export default function Customization() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);
  const tabs = [
    { id: "all", content: "All" },
    { id: "bulk-price", content: "Bulk price editor" },
    { id: "quantity-discount", content: "Quantity discount" },
    { id: "cart-goal", content: "Cart goal" },
    { id: "buy-x-get-y", content: "Buy X get Y" },
    { id: "shipping-discount", content: "Shipping discount" },
    { id: "advanced-discount-code", content: "Advanced discount code" },
  ];
  const handleTabChange = useCallback((i: number) => setSelectedTab(i), []);

  const widgets = [
    { id: "countdown-start", title: "Starts in countdown timer", desc: "Set new style for starts in countdown timer.", tags: ["All types"], category: ["all", "bulk-price", "quantity-discount", "cart-goal"], preview: <CountdownPreview label="Sale starts in" color="#e53e3e" />, route: "/app/customization/countdown-start" },
    { id: "countdown-end", title: "Ends in countdown timer", desc: "Set new style for ends in countdown timer.", tags: ["All types"], category: ["all", "bulk-price", "quantity-discount", "cart-goal"], preview: <CountdownPreview label="Sale ends in" color="#059669" />, route: "/app/customization/countdown-end" },
    { id: "quantity-table", title: "Quantity/Value table", desc: "Change content and style of the tier table.", tags: ["Quantity discount", "Cart goal"], category: ["all", "quantity-discount", "cart-goal"], preview: <QuantityTablePreview />, route: "/app/customization/quantity-table" },
    { id: "bxgy-popup", title: "Buy X get Y pop-up", desc: "Change pop-up text, color and behaviour.", tags: ["Buy X get Y"], category: ["all", "buy-x-get-y"], preview: <BuyXGetYPopupPreview />, route: "/app/customization/bxgy-popup" },
    { id: "saving-cart", title: "Saving on cart", desc: 'Customize "Saving & Total" widget on cart.', tags: ["All types"], category: ["all", "bulk-price", "quantity-discount", "cart-goal", "buy-x-get-y"], preview: <SavingOnCartPreview />, route: "/app/customization/saving-cart" },
    { id: "bxgy-fab", title: "Buy X get Y Floating button", desc: "Customize FAB style shown after closing pop-up.", tags: ["Buy X get Y"], category: ["all", "buy-x-get-y"], preview: <FloatingButtonPreview />, route: "/app/customization/bxgy-fab" },
    { id: "shipping-bar", title: "Shipping progress bar", desc: "Change content and style of the progress bar.", tags: ["Shipping discount"], category: ["all", "shipping-discount"], preview: <ShippingBarPreview />, route: "/app/customization/shipping-bar" },
    { id: "discount-code-input", title: "Discount code input", desc: "Change the on-store discount code box text and style.", tags: ["Advanced discount code"], category: ["all", "advanced-discount-code"], preview: <DiscountCodeInputPreview />, route: "/app/customization/discount-code" },
    { id: "discount-popup", title: "Discount pop-up", desc: "Change the email pop-up colors and style.", tags: ["Advanced discount code"], category: ["all", "advanced-discount-code"], preview: <EmailPopupPreview />, route: "/app/customization/discount-popup" },
  ];

  const tabId = tabs[selectedTab].id;
  const filtered = widgets.filter(w => w.category.includes(tabId));

  return (
    <Page backAction={{ content: "Home", url: "/app" }} title="Customization">
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">Choose a widget to customize its appearance or content.</Text>
        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
          <Box paddingBlockStart="400">
            <InlineGrid columns={3} gap="400">
              {filtered.map(w => (
                <WidgetCard key={w.id} title={w.title} description={w.desc} tags={w.tags} previewContent={w.preview} onClick={() => navigate(w.route)} />
              ))}
            </InlineGrid>
          </Box>
        </Tabs>
      </BlockStack>
    </Page>
  );
}