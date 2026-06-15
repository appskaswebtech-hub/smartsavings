import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  Icon,
  TextField,
  Badge,
  InlineGrid,
  Divider,
  ProgressBar,
  Tooltip,
  Banner,
} from "@shopify/polaris";
import {
  ChartVerticalFilledIcon,
  SettingsIcon,
  CollectionIcon,
  BookOpenIcon,
  SendIcon,
  StarFilledIcon,
  DiscountIcon,
  CartIcon,
  DeliveryIcon,
  TextIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  // Replace with actual data fetching
  return json({
    shop,
    plan: {
      name: "Starter",
      activeVariants: 0,
      maxVariants: 10,
      createdCampaigns: 0,
      maxCampaigns: 3,
    },
    campaigns: [],
  });
};

export default function Index() {
  const { plan } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [aiPrompt, setAiPrompt] = useState("");

  const handleAiPromptChange = useCallback(
    (value: string) => setAiPrompt(value),
    []
  );

  const quickPrompts = [
    "Create a 10% off everything campaign",
    "Set up a Buy 2 Get 1 Free deal",
    "Launch a free shipping campaign for orders over $50",
  ];

  const spotlightApps = [
    {
      name: "Subi: Subscriptions & Loyalty",
      description:
        "Boost sales with subscriptions, memberships, bundles & loyalty.",
      icon: "📊",
      color: "#4285F4",
      action: "Install now",
    },
    {
      name: "Trustoo Loyalty",
      description:
        "Get more customers, enhance brand fans, create multiple points with loyalty solutions! Up to 40% AOI.",
      icon: "🎯",
      color: "#FF6B35",
      action: "Try now",
    },
    {
      name: "SEOAnt - AI SEO Optimizer",
      description:
        "SEO booster tools to improve Google rankings, boost speed.",
      icon: "🚀",
      color: "#34A853",
      action: "Install now",
    },
  ];

  return (
    <Page title="Home">
      <BlockStack gap="600">
        {/* Welcome Section */}
        <Text as="h2" variant="headingLg">
          Hey there, let's get started.
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Set up Discounty and start running discount campaigns on your store.
        </Text>

        {/* Plan Overview Bar */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">
                Current plan:
              </Text>
              <Text as="span" variant="headingSm" fontWeight="bold">
                {plan.name}
              </Text>
            </BlockStack>

            <InlineStack gap="200" blockAlign="center">
              <Box width="200px">
                <ProgressBar
                  progress={
                    (plan.activeVariants / plan.maxVariants) * 100
                  }
                  size="small"
                  tone="primary"
                />
              </Box>
              <BlockStack gap="0">
                <Text as="span" variant="bodySm" tone="subdued">
                  Active discounted variants
                </Text>
                <Text as="span" variant="headingSm" fontWeight="bold">
                  {plan.activeVariants}/{plan.maxVariants}
                </Text>
              </BlockStack>
            </InlineStack>

            <InlineStack gap="200" blockAlign="center">
              <Box width="200px">
                <ProgressBar
                  progress={
                    (plan.createdCampaigns / plan.maxCampaigns) * 100
                  }
                  size="small"
                  tone="primary"
                />
              </Box>
              <BlockStack gap="0">
                <Text as="span" variant="bodySm" tone="subdued">
                  Created campaigns
                </Text>
                <Text as="span" variant="headingSm" fontWeight="bold">
                  {plan.createdCampaigns}/{plan.maxCampaigns}
                </Text>
              </BlockStack>
            </InlineStack>
          </InlineStack>
        </Card>

        {/* Main Feature Cards */}
        <InlineGrid columns={2} gap="400">
          {/* Create First Campaign Card */}
          <Card>
            <BlockStack gap="400">
              <Box
                background="bg-surface-secondary"
                borderRadius="300"
                padding="800"
                minHeight="180px"
              >
                <InlineStack align="center" blockAlign="center">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      height: "140px",
                      position: "relative",
                    }}
                  >
                    {/* Decorative discount illustration */}
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, #5C6AC4, #006FBB)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "36px",
                        color: "white",
                        fontWeight: "bold",
                        boxShadow: "0 4px 14px rgba(92,106,196,0.3)",
                      }}
                    >
                      %
                    </div>
                  </div>
                </InlineStack>
              </Box>

              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Create your first campaign
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Set up a discount campaign to start attracting customers and
                  boosting sales.
                </Text>
              </BlockStack>

              <InlineStack gap="300">
                <Button
                  variant="primary"
                  onClick={() => navigate("/app/campaigns")}
                >
                  Start from scratch
                </Button>
                <Button
                  variant="plain"
                  onClick={() => navigate("/app/campaigns")}
                >
                  Use a template
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Bulk Price Editor Card */}
          <Card>
            <BlockStack gap="400">
              <Box
                background="bg-surface-secondary"
                borderRadius="300"
                padding="800"
                minHeight="180px"
              >
                <InlineStack align="center" blockAlign="center">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "100%",
                      height: "140px",
                      position: "relative",
                    }}
                  >
                    {/* Decorative price editor illustration */}
                    <div
                      style={{
                        background: "white",
                        borderRadius: "12px",
                        padding: "16px 24px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            textDecoration: "line-through",
                            color: "#999",
                          }}
                        >
                          $80
                        </span>
                        <span
                          style={{
                            background: "#22C55E",
                            color: "white",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          SALE
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "20px",
                          fontWeight: "bold",
                          color: "#333",
                        }}
                      >
                        $65
                      </span>
                    </div>
                  </div>
                </InlineStack>
              </Box>

              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Bulk price editor
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Update products prices and compare-at prices in bulk for
                  promotions and sales.
                </Text>
              </BlockStack>

              <InlineStack gap="300">
                <Button onClick={() => navigate("/app/campaigns")}>
                  Try it now
                </Button>
                <Button variant="plain">View all types</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Secondary Feature Cards */}
        <InlineGrid columns={3} gap="400">
          {/* Customize Widgets */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Customize widgets
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Choose how discounts appear on your storefront.
              </Text>
              <div>
                <Button
                  onClick={() => navigate("/app/customization")}
                  size="slim"
                >
                  Customize
                </Button>
              </div>
            </BlockStack>
          </Card>

          {/* Explore Campaign Types */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Explore campaign types
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Discover 6 discount types for different strategies.
              </Text>
              <div>
                <Button
                  onClick={() => navigate("/app/campaigns")}
                  size="slim"
                >
                  Create campaign
                </Button>
              </div>
            </BlockStack>
          </Card>

          {/* Learn More */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Learn more about Discounty
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Learn how to create effective discount campaigns.
              </Text>
              <div>
                <Button
                  onClick={() => navigate("/app/helpandsupport")}
                  size="slim"
                >
                  Watch tutorials
                </Button>
              </div>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* AI Campaign Assistant */}
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" variant="bodyMd">
                ✨
              </Text>
              <Text as="h3" variant="headingSm">
                AI campaign assistant
              </Text>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              Describe the campaign you need and it'll create it for you.
            </Text>

            <TextField
              label=""
              labelHidden
              placeholder='Ask anything... e.g. "Create a 10% off sale for all t-shirts"'
              value={aiPrompt}
              onChange={handleAiPromptChange}
              autoComplete="off"
              connectedRight={
                <Button variant="primary" icon={SendIcon}>
                  Send
                </Button>
              }
            />

            <InlineStack gap="200" wrap>
              {quickPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  size="slim"
                  onClick={() => setAiPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </InlineStack>
          </BlockStack>
        </Card>

        {/* In the Spotlight */}
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" variant="bodyMd">
                💡
              </Text>
              <BlockStack gap="0">
                <Text as="h3" variant="headingSm">
                  In the spotlight
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Empower your store with our partners! Handpicked for their
                  quality and popularity.
                </Text>
              </BlockStack>
            </InlineStack>

            <InlineGrid columns={3} gap="400">
              {spotlightApps.map((app, index) => (
                <Card key={index}>
                  <BlockStack gap="300">
                    <InlineStack gap="300" blockAlign="start">
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "10px",
                          background: app.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "22px",
                          flexShrink: 0,
                        }}
                      >
                        {app.icon}
                      </div>
                      <BlockStack gap="100">
                        <Text as="h4" variant="headingSm">
                          {app.name}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {app.description}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    <InlineStack align="end">
                      <Button size="slim">{app.action}</Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
