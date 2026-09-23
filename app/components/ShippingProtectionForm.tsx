import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  DropZone,
  FormLayout,
  InlineStack,
  Spinner,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { ProtectedProduct, ProtectionConfigDraft } from "../lib/shippingProtection";

// Form + preview for Shipping protection campaigns, shared by
// app.campaigns.new.tsx and app.campaigns.edit.$id.tsx. Merchants choose what
// to protect, the pricing and the widget; the product the fee is charged on
// is created and kept in sync by the app (app/shippingProtectionProduct.server.ts).

// The preview prices a sample cart so merchants see what a shopper pays.
const SAMPLE_CART_VALUE = 1000;

function formatMoney(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

interface FormProps {
  config: ProtectionConfigDraft;
  onConfigChange: (next: ProtectionConfigDraft) => void;
  /** False on stores that aren't Shopify Plus or development stores. */
  supported: boolean;
  /** Shop currency, for the fixed-amount field. */
  currencyCode: string;
}

export function ShippingProtectionForm({ config, onConfigChange, supported, currencyCode }: FormProps) {
  const shopify = useAppBridge();

  const set = (patch: Partial<ProtectionConfigDraft>) => onConfigChange({ ...config, ...patch });
  const setText = (field: "heading" | "title" | "subtitle" | "description" | "feeProductTitle") =>
    (value: string) => set({ [field]: value });

  const addProtectedProducts = async () => {
    const picked: any = await shopify.resourcePicker({ type: "product", multiple: true, action: "select" });
    if (!picked?.length) return;
    const existing = new Set(config.products.map((p) => p.productId));
    const added: ProtectedProduct[] = picked
      .filter((p: any) => p?.id && !existing.has(p.id))
      .map((p: any) => ({ productId: p.id, productTitle: p.title, imageUrl: p.images?.[0]?.originalSrc || "" }));
    set({ products: [...config.products, ...added] });
  };

  return (
    <BlockStack gap="400">
      {!supported && (
        <Banner tone="info" title="Checkout block needs Shopify Plus">
          <p>
            Shopify only shows app blocks inside checkout on Plus stores. On your plan, shoppers
            opt in on product and cart pages instead — protection and exact percentage or fixed
            pricing work there on every plan.
          </p>
        </Banner>
      )}

      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">Protected products</Text>
          <ChoiceList
            title="Offer protection for"
            titleHidden
            choices={[
              { label: "All products", value: "all" },
              { label: "Specific products", value: "specific_products" },
            ]}
            selected={[config.appliesTo]}
            onChange={([value]) => set({ appliesTo: value === "all" ? "all" : "specific_products" })}
          />
          {config.appliesTo === "specific_products" && (
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodySm" tone="subdued">
                  Shoppers see the protection option when any of these is in their cart or on
                  its product page.
                </Text>
                <Button onClick={addProtectedProducts}>Add products</Button>
              </InlineStack>
              {config.products.length === 0 ? (
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    No products yet. Use "Add products" to choose as many as you like.
                  </Text>
                </Box>
              ) : (
                config.products.map((product) => (
                  <InlineStack key={product.productId} gap="300" blockAlign="center" wrap={false}>
                    <Thumbnail source={product.imageUrl || ImageIcon} alt={product.productTitle} size="small" />
                    <Box width="100%">
                      <Text as="p" variant="bodyMd">{product.productTitle}</Text>
                    </Box>
                    <Button
                      variant="plain"
                      tone="critical"
                      onClick={() =>
                        set({ products: config.products.filter((p) => p.productId !== product.productId) })
                      }
                    >
                      Remove
                    </Button>
                  </InlineStack>
                ))
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">Pricing</Text>
          <ChoiceList
            title="Protection fee"
            choices={[
              { label: "Percentage of cart value", value: "percentage" },
              { label: "Fixed amount", value: "fixed_amount" },
            ]}
            selected={[config.pricingType]}
            onChange={([value]) => set({ pricingType: value === "fixed_amount" ? "fixed_amount" : "percentage" })}
          />
          {config.pricingType === "fixed_amount" ? (
            <TextField
              label="Fee amount"
              type="number"
              min={0}
              step={0.01}
              suffix={currencyCode}
              value={config.fixedAmount}
              onChange={(v) => {
                if (v === "" || parseFloat(v) >= 0) set({ fixedAmount: v });
              }}
              autoComplete="off"
              helpText="Charged once per order, whatever the cart value. Shoppers paying in another currency are charged the converted amount."
            />
          ) : (
            <TextField
              label="Fee percentage"
              type="number"
              min={0}
              max={100}
              suffix={config.appliesTo === "all" ? "% of cart value" : "% of protected items"}
              value={config.percentage}
              onChange={(v) => {
                if (v === "" || (parseFloat(v) >= 0 && parseFloat(v) <= 100)) set({ percentage: v });
              }}
              autoComplete="off"
              helpText="Charged on the protected items' value before discounts, and updated whenever the cart changes."
            />
          )}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">Widget</Text>
          <IconField url={config.feeImageUrl} onChange={(feeImageUrl) => set({ feeImageUrl })} />
          <FormLayout>
            <TextField
              label="Name in cart"
              value={config.feeProductTitle}
              onChange={setText("feeProductTitle")}
              autoComplete="off"
              helpText="The app creates a hidden product with this name — it's the line shoppers see in their cart and order."
            />
            <TextField label="Heading" value={config.heading} onChange={setText("heading")} autoComplete="off" />
            <TextField label="Title" value={config.title} onChange={setText("title")} autoComplete="off" />
            <TextField
              label="Subtitle"
              value={config.subtitle}
              onChange={setText("subtitle")}
              autoComplete="off"
              helpText="{price} is replaced with the shopper's protection fee."
            />
            <TextField
              label="Description"
              value={config.description}
              onChange={setText("description")}
              autoComplete="off"
              multiline={3}
            />
          </FormLayout>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

// Icon upload — Shopify Files via /api/upload-image, same flow as the email
// builder's image blocks (ImageBlockField in EmailBlockEditor.tsx).
function IconField({ url, onChange }: { url: string; onChange: (url: string) => void }) {
  const fetcher = useFetcher<{ url?: string; error?: string }>();
  const uploading = fetcher.state !== "idle";
  useEffect(() => {
    if (fetcher.data?.url) onChange(fetcher.data.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data]);

  const upload = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fetcher.submit(fd, { method: "post", action: "/api/upload-image", encType: "multipart/form-data" });
  };

  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodyMd">Icon</Text>
      <InlineStack gap="300" blockAlign="center" wrap={false}>
        <Thumbnail source={url || ImageIcon} alt="Protection icon" size="medium" />
        <Box width="100%">
          <DropZone
            accept="image/*"
            type="image"
            allowMultiple={false}
            onDrop={(_files, accepted) => {
              if (accepted[0]) upload(accepted[0]);
            }}
          >
            {uploading ? (
              <Box padding="300">
                <InlineStack gap="200" align="center" blockAlign="center">
                  <Spinner size="small" />
                  <Text as="span" variant="bodySm">Uploading…</Text>
                </InlineStack>
              </Box>
            ) : (
              <DropZone.FileUpload actionTitle={url ? "Replace icon" : "Upload icon"} actionHint="PNG or JPG, max 5 MB" />
            )}
          </DropZone>
        </Box>
        {url && (
          <Button variant="plain" tone="critical" onClick={() => onChange("")}>
            Remove
          </Button>
        )}
      </InlineStack>
      {fetcher.data?.error ? (
        <Text as="span" variant="bodySm" tone="critical">{fetcher.data.error}</Text>
      ) : (
        <Text as="span" variant="bodySm" tone="subdued">
          Shown on the widget and as the product image in the cart.
        </Text>
      )}
    </BlockStack>
  );
}

interface PreviewProps {
  config: ProtectionConfigDraft;
  currencyCode: string;
}

export function ShippingProtectionPreview({ config, currencyCode }: PreviewProps) {
  const fixed = config.pricingType === "fixed_amount";
  const feeAmount = fixed
    ? parseFloat(config.fixedAmount) || 0
    : (SAMPLE_CART_VALUE * (parseFloat(config.percentage) || 0)) / 100;
  const subtitle = (config.subtitle || "").replace(/\{price\}/g, formatMoney(feeAmount, currencyCode));

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">Preview</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {fixed
            ? "A flat fee per order"
            : `For ${formatMoney(SAMPLE_CART_VALUE, currencyCode)} of protected items`}{" "}
          — on product pages, the cart page and checkout.
        </Text>
        <div style={{ fontFamily: "inherit" }}>
          {config.heading && (
            <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>{config.heading}</div>
          )}
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
              border: "1px solid #e3e3e3",
              borderRadius: "10px",
              padding: "14px",
              background: "#fff",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "4px",
                border: "1.5px solid #8a8a8a",
                flexShrink: 0,
                marginTop: "2px",
              }}
            />
            {config.feeImageUrl ? (
              <img
                src={config.feeImageUrl}
                alt=""
                style={{ width: "44px", height: "44px", objectFit: "contain", borderRadius: "8px", flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: "44px", height: "44px", borderRadius: "8px", background: "#f1f1f1", flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "13px" }}>{config.title || "Shipping insurance"}</div>
              {subtitle && <div style={{ fontSize: "12px", color: "#616161", marginTop: "2px" }}>{subtitle}</div>}
              {config.description && (
                <div style={{ fontSize: "12px", color: "#616161", marginTop: "2px" }}>{config.description}</div>
              )}
            </div>
          </div>
        </div>
      </BlockStack>
    </Card>
  );
}
