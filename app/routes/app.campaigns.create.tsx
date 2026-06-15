import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, Link } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  InlineGrid,
  Tabs,
  Icon,
  Badge,
} from "@shopify/polaris";
import { LockIcon } from "@shopify/polaris-icons";
import { useState, useCallback } from "react";
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
    <Card>
      <BlockStack gap="400">
        {/* Preview Area */}
        <Box
          background="bg-surface-secondary"
          borderRadius="200"
          padding="600"
          minHeight="160px"
        >
          <InlineStack align="center" blockAlign="center">
            <div
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
          <span style={{ fontSize: "12px", color: "#8a8a8a" }}>💡</span>
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
    </Card>
  );
}

/* ── Preview Components ────────────────────────────────────── */

function BulkPricePreview() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <div
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
        <div
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
        <div
          style={{
            width: "30px",
            height: "50px",
            background: "#ccc",
            borderRadius: "4px",
          }}
        />
      </div>
      <div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span
            style={{
              textDecoration: "line-through",
              color: "#999",
              fontSize: "12px",
            }}
          >
            $100
          </span>
          <span style={{ fontWeight: "bold", fontSize: "14px" }}>$80</span>
          <span
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
    <div
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
      <div
        style={{
          fontSize: "14px",
          fontWeight: "bold",
          marginBottom: "4px",
        }}
      >
        $12
      </div>
      <div
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
        { qty: "3+", label: "", save: "SAVE 5%", pct: "" },
        { qty: "5+", label: "", save: "SAVE 10%", pct: "" },
        { qty: "8+", label: "", save: "SAVE 20%", pct: "" },
      ].map((row, i) => (
        <div
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
          <span>
            {i === 0 ? (
              <span style={{ display: "flex", gap: "4px" }}>
                <span
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
                <span
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
          <span style={{ color: "#10b981", fontWeight: "bold" }}>
            {i === 0 ? "" : row.save}
          </span>
        </div>
      ))}
    </div>
  );
}

function BuyXGetYPreview() {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "8px",
        padding: "10px",
        border: "1px solid #e5e5e5",
        width: "100%",
        maxWidth: "220px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            background: "#10b981",
            color: "white",
            fontSize: "9px",
            padding: "2px 8px",
            borderRadius: "4px",
            fontWeight: "bold",
          }}
        >
          Customers Buy (1)
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: "8px",
          justifyContent: "center",
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
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
            <div
              style={{
                width: "24px",
                height: "24px",
                background: "#ddd",
                borderRadius: "3px",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvancedDiscountCodePreview() {
  return (
    <div
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
      <div style={{ color: "#999", fontSize: "9px", marginBottom: "2px" }}>
        Your cart
      </div>
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "8px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "30px",
            height: "30px",
            background: "#f0f0f0",
            borderRadius: "4px",
          }}
        />
        <div>
          <div style={{ fontSize: "9px" }}>$100 $80</div>
          <div style={{ fontSize: "9px", color: "#999" }}>x1/pc</div>
        </div>
        <div
          style={{
            width: "30px",
            height: "30px",
            background: "#f0f0f0",
            borderRadius: "4px",
            marginLeft: "auto",
          }}
        />
        <div>
          <div style={{ fontSize: "9px" }}>$100</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: "4px",
          marginBottom: "8px",
        }}
      >
        <div
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
        <div
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
      <div style={{ fontSize: "9px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "2px",
          }}
        >
          <span>Subtotal</span>
          <span>
            <span
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "2px",
          }}
        >
          <span>Shipping</span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <span
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            marginTop: "4px",
            borderTop: "1px solid #eee",
            paddingTop: "4px",
          }}
        >
          <span>Total</span>
          <span>$90</span>
        </div>
      </div>
    </div>
  );
}

function CartGoalPreview() {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "8px",
        padding: "12px",
        border: "1px solid #e5e5e5",
        width: "100%",
        maxWidth: "200px",
      }}
    >
      <div
        style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "4px" }}
      >
        $30
      </div>
      <div
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
        { range: "$50+", save: "SAVE 5%" },
        { range: "$100+", save: "SAVE 10%" },
        { range: "$150+", save: "SAVE 15%" },
      ].map((row, i) => (
        <div
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
          <span>{row.range}</span>
          <span
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
    <div
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
      <div style={{ color: "#999", fontSize: "9px", marginBottom: "8px" }}>
        Your cart
      </div>
      <div style={{ fontSize: "9px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <span>Subtotal</span>
          <span>-</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: "bold" }}>Shipping</span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span
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
            <span
              style={{
                textDecoration: "line-through",
                color: "#999",
              }}
            >
              $10
            </span>
            <span style={{ fontWeight: "bold" }}>$0</span>
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #eee",
            paddingTop: "4px",
            marginTop: "4px",
          }}
        >
          <span style={{ fontWeight: "bold" }}>Total</span>
          <span>-</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────── */

export default function CreateCampaign() {
  const { currentPlan } = useLoaderData<typeof loader>();
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
    <Page
      backAction={{ content: "Campaigns", url: "/app/campaigns" }}
      title="Choose campaign type"
    >
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">
          Select the type of campaign you wish to create.
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
              <InlineGrid columns={3} gap="400">
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
              </InlineGrid>
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
    </Page>
  );
}
