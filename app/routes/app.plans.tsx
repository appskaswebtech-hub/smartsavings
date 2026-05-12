import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Box,
  Badge,
  InlineGrid,
  Divider,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  syncSubscriptionFromShopify,
  buildManagedPricingUrl,
  type PlanId,
} from "../billing.server";

/**
 * The handle of your app as it appears in the Shopify admin URL.
 * Find it by visiting your app inside admin: the URL contains
 *   /apps/<app-handle>
 * For SmartSavings, the handle should be "smartsavings" but verify
 * by checking the admin URL once.
 */
const APP_HANDLE = "smartsavings";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;

  // Re-sync from Shopify so the page always reflects the latest state.
  // (Webhook is best-effort; this guarantees correctness on every render.)
  const { planId } = await syncSubscriptionFromShopify(admin, shop);

  const campaignCount = await db.campaign.count({ where: { shop } });

  // Build the URL where Shopify hosts the plan picker for this app.
  const managedPricingUrl = buildManagedPricingUrl(shop, APP_HANDLE);

  return json({
    currentPlanId: planId,
    campaignCount,
    managedPricingUrl,
  });
};

const PLAN_DISPLAY: Array<{
  id: PlanId;
  name: string;
  price: string;
  period: string;
  badge: string | null;
  color: string;
  features: { text: string; included: boolean }[];
}> = [
  {
    id: "base",
    name: "Base",
    price: "$9.99",
    period: "/month",
    badge: null,
    color: "#6B7280",
    features: [
      { text: "Up to 50 discounted variants", included: true },
      { text: "Up to 3 campaigns", included: true },
      { text: "Quantity discount", included: true },
      { text: "Bulk price editor", included: true },
      { text: "Customizable widgets", included: true },
      { text: "Email support", included: true },
      { text: "Cart goal", included: false },
      { text: "Buy X Get Y", included: false },
      { text: "Shipping discount", included: false },
      { text: "Campaign scheduling", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    price: "$19.99",
    period: "/month",
    badge: "MOST POPULAR",
    color: "#6366F1",
    features: [
      { text: "Up to 250 discounted variants", included: true },
      { text: "Up to 10 campaigns", included: true },
      { text: "All discount types", included: true },
      { text: "Cart goal", included: true },
      { text: "Buy X Get Y", included: true },
      { text: "Shipping discount", included: true },
      { text: "Campaign scheduling", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$29.99",
    period: "/month",
    badge: null,
    color: "#10B981",
    features: [
      { text: "Unlimited discounted variants", included: true },
      { text: "Unlimited campaigns", included: true },
      { text: "Everything in Advanced", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Dedicated support", included: true },
    ],
  },
];

export default function Plans() {
  const { currentPlanId, campaignCount, managedPricingUrl } =
    useLoaderData<typeof loader>();

  // Open Shopify's plan picker in the top-level window (escapes the iframe).
  const openManagedPricing = () => {
    if (typeof window !== "undefined") {
      window.top!.location.href = managedPricingUrl;
    }
  };

  const currentPlan =
    PLAN_DISPLAY.find((p) => p.id === currentPlanId) || null;

  return (
    <Page title="Plans & Pricing">
      <BlockStack gap="600">
        {!currentPlan && (
          <Banner tone="warning">
            <p>
              You don't have an active subscription. Choose a plan below to start
              using SmartSavings.
            </p>
          </Banner>
        )}

        {currentPlan && (
          <Card>
            <InlineStack align="space-between">
              <BlockStack>
                <Text as="h2" variant="bodySm" tone="subdued">
                  Current plan
                </Text>
                <InlineStack gap="200">
                  <Text as="h2" variant="headingLg" fontWeight="bold">
                    {currentPlan.name}
                  </Text>
                  <Badge tone="success">Active</Badge>
                </InlineStack>
              </BlockStack>

              <BlockStack inlineAlign="end">
                <Text as="h2" variant="bodySm" tone="subdued">
                  Campaigns used
                </Text>
                <Text as="h2" variant="headingSm" fontWeight="bold">
                  {campaignCount}
                </Text>
              </BlockStack>
            </InlineStack>
          </Card>
        )}

        <InlineGrid columns={3} gap="400">
          {PLAN_DISPLAY.map((plan) => {
            const isCurrent = plan.id === currentPlanId;

            return (
              <div key={plan.id} style={{ position: "relative" }}>
                {plan.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-10px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: plan.color,
                      color: "#fff",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      zIndex: 1,
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                <Card>
                  <BlockStack gap="400">
                    <BlockStack inlineAlign="center">
                      <Text as="h2" variant="headingMd">
                        {plan.name}
                      </Text>
                      <InlineStack gap="100" align="center">
                        <Text as="h2" variant="headingLg" fontWeight="bold">
                          {plan.price}
                        </Text>
                        <Text as="h2" tone="subdued">
                          {plan.period}
                        </Text>
                      </InlineStack>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="200">
                      {plan.features.map((f, i) => (
                        <InlineStack key={i} gap="200">
                          <span style={{ color: f.included ? "#10B981" : "#ccc" }}>
                            {f.included ? "✓" : "🔒"}
                          </span>
                          <Text as="h2" tone={f.included ? undefined : "subdued"}>
                            {f.included ? (
                              f.text
                            ) : (
                              <span style={{ textDecoration: "line-through" }}>
                                {f.text}
                              </span>
                            )}
                          </Text>
                        </InlineStack>
                      ))}
                    </BlockStack>

                    <Box paddingBlockStart="200">
                      {isCurrent ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "10px",
                            border: `2px solid ${plan.color}`,
                            borderRadius: "8px",
                            fontWeight: 700,
                            color: plan.color,
                          }}
                        >
                          Current Plan
                        </div>
                      ) : (
                        <button
                          onClick={openManagedPricing}
                          style={{
                            width: "100%",
                            padding: "10px",
                            background: plan.color,
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 700,
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Choose Plan
                        </button>
                      )}
                    </Box>
                  </BlockStack>
                </Card>
              </div>
            );
          })}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}