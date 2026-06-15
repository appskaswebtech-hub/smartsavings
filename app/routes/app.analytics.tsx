import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,  
  Banner,
  EmptyState,
  Link,
  Box,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // TODO: Fetch analytics data
  return json({
    campaigns: [],
    hasAnalytics: false,
  });
};

export default function Analytics() {
  const { campaigns, hasAnalytics } = useLoaderData<typeof loader>();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  return (
    <Page backAction={{ content: "Home", url: "/app" }} title="Analytics">
      <BlockStack gap="400">
        {/* Coming Soon Banner */}
        {!bannerDismissed && (
          <Banner
            title="More campaign analytics coming soon"
            tone="info"
            onDismiss={() => setBannerDismissed(true)}
          >
            <p>
              Analytics for Quantity discount, Cart goal, Shipping discount, Buy
              X Get Y, and Advanced discount codes will be available soon.{" "}
              <Link url="https://discounty.app" external>
                Learn more
              </Link>
            </p>
          </Banner>
        )}

        {/* Analytics Content */}
        <Card>
          {!hasAnalytics || campaigns.length === 0 ? (
            <EmptyState
              heading="No campaigns found"
              image=""
            >
              <p>Try changing the filters or search term</p>
            </EmptyState>
          ) : (
            <BlockStack gap="400">
              {/* Analytics dashboard content will go here */}
              <Text as="p" variant="bodyMd">
                Campaign analytics will appear here once you create and run
                campaigns.
              </Text>
            </BlockStack>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
