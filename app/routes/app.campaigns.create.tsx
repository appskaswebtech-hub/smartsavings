import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, Link } from "@remix-run/react";
import {
  Page,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,

  Tabs,
  Icon,

} from "@shopify/polaris";
import { LockIcon } from "@shopify/polaris-icons";
import { useState, useCallback } from "react";
import "../styles/campaign-picker.css";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({
    currentPlan: "starter",
  });
};

interface CampaignTypeCardProps {
  title: string;
  description: string;
  example: string;
  locked?: boolean;
  previewContent: React.ReactNode;
  onCreateClick: () => void;
  onLearnMoreClick?: () => void;
}

function CampaignTypeCard({
  title,
  description,
  example,
  locked = false,
  previewContent,
  onCreateClick,
  onLearnMoreClick,
}: CampaignTypeCardProps) {
  return (
    <div className="campaign-card"><div className="Polaris-Box campaign-card-inner">
      <BlockStack gap="400">
        {/* Preview Area */}
        <Box
          background="bg-surface-secondary"
          borderRadius="200"
          padding="600"
          minHeight="160px"
        >
          <InlineStack align="center" blockAlign="center">
            <div className="ss-campaigns-create__div-row"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                minHeight: "120px",
              }}
            >
              {previewContent}
            </div>
          </InlineStack>
        </Box>

        {/* Title */}
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingSm">
            {title}
          </Text>
          {locked && <Icon source={LockIcon} tone="subdued" />}
        </InlineStack>

        {/* Description */}
        <Text as="p" variant="bodySm" tone="subdued">
          {description}
        </Text>

        {/* Example */}
        <InlineStack gap="200" blockAlign="start">
          <span className="ss-campaigns-create__span" style={{ fontSize: "12px", color: "#8a8a8a" }}>💡</span>
          <Text as="p" variant="bodySm" tone="subdued">
            {example}
          </Text>
        </InlineStack>

        {/* Actions */}
        <InlineStack gap="200">
          <Button
            size="slim"
            onClick={onCreateClick}
            disabled={locked}
          >
            Create
          </Button>
          <Button size="slim" variant="plain" onClick={onLearnMoreClick}>
            Learn more
          </Button>
        </InlineStack>
      </BlockStack>
    </div></div>
  );
}

/* ── Preview Components ────────────────────────────────────── */

function BulkPricePreview() {
  return (
    <div className="ss-campaigns-create__div-20"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <div className="ss-campaigns-create__div-20-2"
        style={{
          width: "70px",
          height: "80px",
          background: "#e8e8e8",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div className="ss-campaigns-create__div-20-3"
          style={{
            position: "absolute",
            top: "-6px",
            left: "10px",
            background: "#e53e3e",
            color: "white",
            fontSize: "9px",
            padding: "2px 6px",
            borderRadius: "10px",
            fontWeight: "bold",
          }}
        >
          -20%
        </div>
        <img className="campaign-shirt" src="/images/campaigns/shirt.svg" alt="" />
      </div>
      <div className="ss-campaigns-create__div-100">
        <div className="ss-campaigns-create__div-100-2" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span className="ss-campaigns-create__span-100"
            style={{
              textDecoration: "line-through",
              color: "#999",
              fontSize: "12px",
            }}
          >
            $100
          </span>
          <span className="ss-campaigns-create__span-80" style={{ fontWeight: "bold", fontSize: "14px" }}>$80</span>
          <span className="ss-campaigns-create__span-sale"
            style={{
              background: "#10b981",
              color: "white",
              fontSize: "9px",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "bold",
            }}
          >
            Sale
          </span>
        </div>
      </div>
    </div>
  );
}

function QuantityDiscountPreview() {
  return (
    <div className="ss-campaigns-create__div-12"
      style={{
        background: "white",
        borderRadius: "8px",
        padding: "10px",
        fontSize: "11px",
        border: "1px solid #e5e5e5",
        width: "100%",
        maxWidth: "200px",
      }}
    >
      <div className="ss-campaigns-create__div-12-2"
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          marginBottom: "4px",
        }}
      >
        $12
      </div>
      <div className="ss-campaigns-create__div-buy-more-save"
        style={{
          fontSize: "10px",
          color: "#666",
          marginBottom: "8px",
        }}
      >
        Buy more, save more!
      </div>
      {[
        { qty: "Buy", label: "2+", save: "Save", pct: "" },
        { qty: "1+", label: "", save: "Get 0%", pct: "" },
        { qty: "2+", label: "", save: "Get 10%", pct: "" },
        { qty: "5+", label: "", save: "Get 20%", pct: "" },
      ].map((row, i) => (
        <div className="ss-campaigns-create__div-buy"
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "3px 4px",
            background: i === 0 ? "transparent" : i % 2 === 0 ? "#f9f9f9" : "transparent",
            borderRadius: "3px",
            fontSize: "10px",
            alignItems: "center",
          }}
        >
          <span className="ss-campaigns-create__span-buy">
            {i === 0 ? (
              <span className="ss-campaigns-create__span-buy-2" style={{ display: "flex", gap: "4px" }}>
                <span className="ss-campaigns-create__span-buy-3"
                  style={{
                    background: "#10b981",
                    color: "white",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    fontWeight: "bold",
                    fontSize: "9px",
                  }}
                >
                  Buy!
                </span>
                <span className="ss-campaigns-create__span-save"
                  style={{
                    background: "#f97316",
                    color: "white",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    fontWeight: "bold",
                    fontSize: "9px",
                  }}
                >
                  Save!
                </span>
              </span>
            ) : (
              row.qty
            )}
          </span>
          <span className="ss-campaigns-create__span-2" style={{ color: "#10b981", fontWeight: "bold" }}>
            {i === 0 ? "" : row.save}
          </span>
        </div>
      ))}
    </div>
  );
}

function BuyXGetYPreview() {
  return (
    <div className="ss-campaigns-create__div-customers-buy-1"
      style={{
        background: "white",
        borderRadius: "8px",
        padding: "10px",
        border: "1px solid #e5e5e5",
        width: "100%",
        maxWidth: "220px",
      }}
    >
      <div className="ss-campaigns-create__div-customers-buy-1-2"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <span className="ss-campaigns-create__span-customers-buy-1"
          style={{
            background: "#10b981",
            color: "white",
            fontSize: "9px",
            padding: "2px 8px",
            borderRadius: "4px",
            fontWeight: "bold",
          }}
        >
          Frequently Bought
        </span>
      </div>
      <div className="ss-campaigns-create__div-row-2"
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
        }}
      >
        {[1, 2, 3].map((i) => (
          <div className="ss-campaigns-create__div-row-3"
            key={i}
            style={{
              width: "40px",
              height: "40px",
              background: "#f0f0f0",
              borderRadius: "6px",
              border: i === 2 ? "2px solid #e53e3e" : "1px solid #e5e5e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img className="campaign-product-image" src={`/images/campaigns/${["shirt", "shoe", "cap"][i - 1]}.svg`} alt="" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvancedDiscountCodePreview() {
  return (
    <div className="ss-campaigns-create__div-your-cart"
      style={{
        background: "white",
        borderRadius: "8px",
        padding: "12px",
        border: "1px solid #e5e5e5",
        width: "100%",
        maxWidth: "220px",
        fontSize: "11px",
      }}
    >
      <div className="ss-campaigns-create__div-your-cart-2" style={{ color: "#999", fontSize: "9px", marginBottom: "2px" }}>
        Your cart
      </div>
      <div className="ss-campaigns-create__div-100-80"
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "8px",
          alignItems: "center",
        }}
      >
        <img className="campaign-cart-shirt" src="/images/campaigns/shirt.svg" alt="" />
        <div className="ss-campaigns-create__div-100-80-2">
          <div className="ss-campaigns-create__div-100-80-3" style={{ fontSize: "9px" }}>$100 $80</div>
          <div className="ss-campaigns-create__div-x1-pc" style={{ fontSize: "9px", color: "#999" }}>x1/pc</div>
        </div>
        <div className="ss-campaigns-create__div-4"
          style={{
            width: "30px",
            height: "30px",
            background: "#f0f0f0",
            borderRadius: "4px",
            marginLeft: "auto",
          }}
        />
        <div className="ss-campaigns-create__div-100-3">
          <div className="ss-campaigns-create__div-100-4" style={{ fontSize: "9px" }}>$100</div>
        </div>
      </div>
      <div className="ss-campaigns-create__div-save15shipfree"
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "8px",
        }}
      >
        <div className="ss-campaigns-create__div-save15shipfree-2"
          style={{
            flex: 1,
            background: "#f5f5f5",
            borderRadius: "4px",
            padding: "4px 6px",
            fontSize: "8px",
            color: "#666",
          }}
        >
          SAVE15SHIPFREE
        </div>
        <div className="ss-campaigns-create__div-apply"
          style={{
            background: "#10b981",
            color: "white",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "8px",
            fontWeight: "bold",
          }}
        >
          Apply
        </div>
      </div>
      <div className="ss-campaigns-create__div-subtotal" style={{ fontSize: "9px" }}>
        <div className="ss-campaigns-create__div-subtotal-2"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "2px",
          }}
        >
          <span className="ss-campaigns-create__span-subtotal">Subtotal</span>
          <span className="ss-campaigns-create__span-180">
            <span className="ss-campaigns-create__span-180-2"
              style={{
                background: "#fee2e2",
                color: "#e53e3e",
                padding: "0 4px",
                borderRadius: "2px",
                textDecoration: "line-through",
                fontSize: "8px",
              }}
            >
              $180
            </span>{" "}
            $162
          </span>
        </div>
        <div className="ss-campaigns-create__div-shipping"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "2px",
          }}
        >
          <span className="ss-campaigns-create__span-shipping">Shipping</span>
          <span className="ss-campaigns-create__span-free-shipping"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <span className="ss-campaigns-create__span-free-shipping-2"
              style={{
                background: "#10b981",
                color: "white",
                fontSize: "7px",
                padding: "1px 4px",
                borderRadius: "2px",
              }}
            >
              FREE SHIPPING
            </span>
          </span>
        </div>
        <div className="ss-campaigns-create__div-total"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            marginTop: "4px",
            borderTop: "1px solid #eee",
            paddingTop: "4px",
          }}
        >
          <span className="ss-campaigns-create__span-total">Total</span>
          <span className="ss-campaigns-create__span-90">$90</span>
        </div>
      </div>
    </div>
  );
}

function CartGoalPreview() {
  return (
    <div className="ss-campaigns-create__div-30"
      style={{
        background: "white",
        borderRadius: "8px",
        padding: "12px",
        border: "1px solid #e5e5e5",
        width: "100%",
        maxWidth: "200px",
      }}
    >
      <div className="ss-campaigns-create__div-30-2"
        style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "4px" }}
      >
        $30
      </div>
      <div className="ss-campaigns-create__div-buy-more-save-2"
        style={{
          fontSize: "10px",
          color: "#666",
          marginBottom: "8px",
          fontWeight: "bold",
        }}
      >
        Buy more, save more!
      </div>
      {[
        { range: "$50+", save: "Get 10%" },
        { range: "$100+", save: "Get 15%" },
        { range: "$200+", save: "Get 20%" },
      ].map((row, i) => (
        <div className="ss-campaigns-create__div-row-4"
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "4px 6px",
            background: i % 2 === 0 ? "#f9f9f9" : "transparent",
            borderRadius: "3px",
            fontSize: "10px",
            marginBottom: "2px",
            alignItems: "center",
          }}
        >
          <span className="ss-campaigns-create__span-3">{row.range}</span>
          <span className="ss-campaigns-create__span-4"
            style={{
              background: "#10b981",
              color: "white",
              padding: "1px 6px",
              borderRadius: "3px",
              fontWeight: "bold",
              fontSize: "9px",
            }}
          >
            {row.save}
          </span>
        </div>
      ))}
    </div>
  );
}

function ShippingDiscountPreview() {
  return (
    <div className="ss-campaigns-create__div-your-cart-3"
      style={{
        background: "white",
        borderRadius: "8px",
        padding: "12px",
        border: "1px solid #e5e5e5",
        width: "100%",
        maxWidth: "220px",
        fontSize: "11px",
      }}
    >
      <div className="ss-campaigns-create__div-your-cart-4" style={{ color: "#999", fontSize: "9px", marginBottom: "8px" }}>
        Your cart
      </div>
      <div className="ss-campaigns-create__div-subtotal-3" style={{ fontSize: "9px" }}>
        <div className="ss-campaigns-create__div-subtotal-4"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <span className="ss-campaigns-create__span-subtotal-2">Subtotal</span>
          <span className="ss-campaigns-create__span-5">-</span>
        </div>
        <div className="ss-campaigns-create__div-shipping-2"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
            alignItems: "center",
          }}
        >
          <span className="ss-campaigns-create__span-shipping-2" style={{ fontWeight: "bold" }}>Shipping</span>
          <span className="ss-campaigns-create__span-shipping-discount"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span className="ss-campaigns-create__span-shipping-discount-2"
              style={{
                background: "#10b981",
                color: "white",
                fontSize: "7px",
                padding: "2px 6px",
                borderRadius: "3px",
                fontWeight: "bold",
              }}
            >
              shipping discount
            </span>
            <span className="ss-campaigns-create__span-10"
              style={{
                textDecoration: "line-through",
                color: "#999",
              }}
            >
              $10
            </span>
            <span className="ss-campaigns-create__span-0" style={{ fontWeight: "bold" }}>$0</span>
          </span>
        </div>
        <div className="ss-campaigns-create__div-total-2"
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #eee",
            paddingTop: "4px",
            marginTop: "4px",
          }}
        >
          <span className="ss-campaigns-create__span-total-2" style={{ fontWeight: "bold" }}>Total</span>
          <span className="ss-campaigns-create__span-6">-</span>
        </div>
      </div>
    </div>
  );
}

function ShippingProtectionPreview() {
  return (
    <div className="ss-campaigns-create__div-yes-add-shipping"
      style={{
        background: "white",
        borderRadius: "8px",
        padding: "12px",
        border: "1px solid #e5e5e5",
        width: "100%",
        maxWidth: "220px",
        fontSize: "11px",
      }}
    >
      <div className="ss-campaigns-create__div-yes-add-shipping-2" style={{ fontWeight: "bold", fontSize: "9px", marginBottom: "6px" }}>
        Yes, add shipping insurance please!
      </div>
      <div className="ss-campaigns-create__div-row-5"
        style={{
          display: "flex",
          gap: "6px",
          alignItems: "flex-start",
          border: "1px solid #eee",
          borderRadius: "6px",
          padding: "6px",
        }}
      >
        <div className="ss-campaigns-create__div-row-6"
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "4px",
            background: "#f3e8ea",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            flexShrink: 0,
          }}
        >
          📦
        </div>
        <div className="ss-campaigns-create__div-shipping-insurance" style={{ flex: 1, fontSize: "8px", color: "#666" }}>
          <div className="ss-campaigns-create__div-shipping-insurance-2" style={{ fontWeight: "bold", fontSize: "9px", color: "#111" }}>Shipping insurance</div>
          <div className="ss-campaigns-create__div-from-damage-loss">from Damage, Loss & Theft for $20</div>
        </div>
        <span className="ss-campaigns-create__span-7"
          style={{
            width: "11px",
            height: "11px",
            borderRadius: "3px",
            background: "#10b981",
            color: "white",
            fontSize: "8px",
            lineHeight: "11px",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          ✓
        </span>
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export default function CreateCampaign() {
  useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: "all", content: "All" },
    { id: "code", content: "Code discount" },
    { id: "automatic", content: "Automatic discount" },
    { id: "templates", content: "Templates & Use Cases" },
  ];

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    []
  );

  const campaignTypes = [
    {
      id: "bulk_price",
      title: "Bulk price editor",
      description:
        "Update products prices and compare at prices in bulk for promotions and sales.",
      example: "20% off on shoes",
      category: "automatic",
      locked: false,
      preview: <BulkPricePreview />,
    },
    {
      id: "quantity_discount",
      title: "Quantity discount",
      description:
        "Offer tiered discounts based on the quantity of items purchased.",
      example: "Buy 3+, Save 10%",
      category: "automatic",
      locked: false,
      preview: <QuantityDiscountPreview />,
    },
    {
      id: "buy_x_get_y",
      title: "Buy X Get Y",
      description:
        "Offer free or discounted items when customers buy selected products.",
      example: "Buy 2 shirts, get 1 cap free",
      category: "automatic",
      // locked: currentPlan === "starter",
      locked: false,
      preview: <BuyXGetYPreview />,
    },
    {
      id: "advanced_discount_code",
      title: "Advanced discount code",
      description:
        "Offer order and shipping discounts with a single code.",
      example: "Get 20% off shirts, 10% off your order, and free shipping!",
      category: "code",
      // locked: currentPlan === "starter",
      locked: false,
      preview: <AdvancedDiscountCodePreview />,
    },
    {
      id: "cart_goal",
      title: "Cart goal",
      description:
        "Offer discounts when customers reach a minimum cart value.",
      example: "Spend $100, Save 5%",
      category: "automatic",
      locked: false,
      preview: <CartGoalPreview />,
    },
    {
      id: "shipping_discount",
      title: "Shipping discount",
      description:
        "Offer different shipping discounts or free shipping promotions.",
      example: "Free shipping for orders above $100",
      category: "both",
      locked: false,
      preview: <ShippingDiscountPreview />,
    },
    {
      id: "shipping_protection",
      title: "Shipping protection",
      description:
        "Let customers protect their order against damage, loss & theft for a % of the cart value.",
      example: "Protect your order for 20% of cart value",
      category: "automatic",
      locked: false,
      preview: <ShippingProtectionPreview />,
    },
  ];

  // Filter campaign types based on selected tab
  const filteredCampaigns = campaignTypes.filter((campaign) => {
    switch (selectedTab) {
      case 1: // Code discount
        return campaign.category === "code" || campaign.category === "both";
      case 2: // Automatic discount
        return (
          campaign.category === "automatic" || campaign.category === "both"
        );
      case 3: // Templates
        return false; // TODO: Add templates
      default:
        return true;
    }
  });

  const handleCreate = (campaignId: string) => {
    // Navigate to the campaign creation form with the type pre-selected
    navigate(`/app/campaigns/new?type=${campaignId}`);
  };

  return (
    <div className="campaign-picker"><Page
      fullWidth
      backAction={{ content: "Campaigns", url: "/app/campaigns" }}
      title="Choose campaign type"
    >
      <img className="campaign-hero" src="/images/campaigns/discount.svg" alt="" />
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">
          Select the type of campaign you want to create.
        </Text>

        <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
          <Box paddingBlockStart="400">
            {selectedTab === 3 ? (
              /* Templates Tab */
              <Box padding="800">
                <BlockStack gap="400" inlineAlign="center">
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    Campaign templates and use cases coming soon.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    Pre-built campaign configurations for common scenarios like
                    flash sales, seasonal promotions, clearance events, and more.
                  </Text>
                </BlockStack>
              </Box>
            ) : filteredCampaigns.length === 0 ? (
              <Box padding="800">
                <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                  No campaign types found for this category.
                </Text>
              </Box>
            ) : (
              <div className="campaign-grid">
                {filteredCampaigns.map((campaign) => (
                  <CampaignTypeCard
                    key={campaign.id}
                    title={campaign.title}
                    description={campaign.description}
                    example={campaign.example}
                    locked={campaign.locked}
                    previewContent={campaign.preview}
                    onCreateClick={() => handleCreate(campaign.id)}
                    onLearnMoreClick={() => {
                      // TODO: Open learn more modal or navigate to help
                    }}
                  />
                ))}
              </div>
            )}

            {/* Footer link */}
            <Box paddingBlockStart="600" paddingBlockEnd="400">
              <InlineStack align="center">
                <Text as="p" variant="bodySm" tone="subdued">
                  Learn more about{" "}
                  <Link to="/app/helpandsupport">
                    Discount types
                  </Link>
                  .
                </Text>
              </InlineStack>
            </Box>
          </Box>
        </Tabs>
      </BlockStack>
    </Page></div>
  );
}
