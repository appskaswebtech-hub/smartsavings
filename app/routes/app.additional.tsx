import { json, type LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  InlineGrid,
  Badge,
  Icon,
} from "@shopify/polaris";
import { ExternalIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export default function Additional() {
  const resources = [
    {
      title: "Shopify Discount APIs",
      description:
        "Learn about Shopify's built-in discount functionality and how Discounty extends it.",
      url: "https://shopify.dev/docs/api/admin-graphql/latest/objects/DiscountNode",
      badge: "API",
    },
    {
      title: "Theme Integration Guide",
      description:
        "How to manually integrate Discounty widgets into custom themes.",
      url: "#",
      badge: "Guide",
    },
    {
      title: "Migration from other apps",
      description:
        "Step-by-step guide to migrate your discount campaigns from other apps to Discounty.",
      url: "#",
      badge: "Guide",
    },
    {
      title: "Webhooks & Automation",
      description:
        "Set up webhooks to automate discount workflows with external tools.",
      url: "#",
      badge: "Advanced",
    },
    {
      title: "Changelog",
      description: "See the latest updates and improvements to Discounty.",
      url: "#",
      badge: "Updates",
    },
    {
      title: "Roadmap",
      description: "See what features we're working on next.",
      url: "#",
      badge: "Coming soon",
    },
  ];

  return (
    <Page backAction={{ content: "Home", url: "/app" }} title="Additional Resources">
      <BlockStack gap="400">
        <Text as="p" variant="bodyMd" tone="subdued">
          Explore additional resources, guides, and tools to get the most out of
          Discounty.
        </Text>

        <InlineGrid columns={2} gap="400">
          {resources.map((resource, index) => (
            <Card key={index}>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="start">
                  <Text as="h3" variant="headingSm">
                    {resource.title}
                  </Text>
                  <Badge>{resource.badge}</Badge>
                </InlineStack>

                <Text as="p" variant="bodySm" tone="subdued">
                  {resource.description}
                </Text>

                <InlineStack align="end">
                  <Button
                    icon={ExternalIcon}
                    url={resource.url}
                    external
                    size="slim"
                  >
                    View
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
