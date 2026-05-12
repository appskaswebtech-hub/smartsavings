import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  TextField,
  Select,
  Checkbox,
  Divider,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // TODO: Fetch settings from database
  return json({
    settings: {
      currency: "USD",
      roundPrices: true,
      roundingMethod: "nearest",
      showCompareAtPrice: true,
      stackDiscounts: false,
      displaySavings: true,
      savingsFormat: "percentage",
      excludeSaleProducts: false,
      customCss: "",
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();

  // TODO: Save settings to database
  return json({ success: true });
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const [roundPrices, setRoundPrices] = useState(settings.roundPrices);
  const [roundingMethod, setRoundingMethod] = useState(settings.roundingMethod);
  const [showCompareAtPrice, setShowCompareAtPrice] = useState(
    settings.showCompareAtPrice
  );
  const [stackDiscounts, setStackDiscounts] = useState(settings.stackDiscounts);
  const [displaySavings, setDisplaySavings] = useState(settings.displaySavings);
  const [savingsFormat, setSavingsFormat] = useState(settings.savingsFormat);
  const [excludeSaleProducts, setExcludeSaleProducts] = useState(
    settings.excludeSaleProducts
  );
  const [customCss, setCustomCss] = useState(settings.customCss);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const formData = new FormData();
    formData.append("roundPrices", String(roundPrices));
    formData.append("roundingMethod", roundingMethod);
    formData.append("showCompareAtPrice", String(showCompareAtPrice));
    formData.append("stackDiscounts", String(stackDiscounts));
    formData.append("displaySavings", String(displaySavings));
    formData.append("savingsFormat", savingsFormat);
    formData.append("excludeSaleProducts", String(excludeSaleProducts));
    formData.append("customCss", customCss);
    submit(formData, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Page
      backAction={{ content: "Home", url: "/app" }}
      title="Settings"
      primaryAction={{
        content: "Save",
        onAction: handleSave,
      }}
    >
      <BlockStack gap="400">
        {saved && (
          <Banner title="Settings saved successfully" tone="success" onDismiss={() => setSaved(false)} />
        )}

        {/* Pricing Settings */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Pricing
            </Text>

            <Checkbox
              label="Round discounted prices"
              helpText="Automatically round prices after applying discounts"
              checked={roundPrices}
              onChange={setRoundPrices}
            />

            {roundPrices && (
              <Select
                label="Rounding method"
                options={[
                  { label: "Nearest (e.g., $9.99)", value: "nearest" },
                  { label: "Up (e.g., $10.00)", value: "up" },
                  { label: "Down (e.g., $9.00)", value: "down" },
                ]}
                value={roundingMethod}
                onChange={setRoundingMethod}
              />
            )}

            <Checkbox
              label="Show compare-at price"
              helpText="Display original price alongside discounted price"
              checked={showCompareAtPrice}
              onChange={setShowCompareAtPrice}
            />
          </BlockStack>
        </Card>

        {/* Discount Behavior */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Discount behavior
            </Text>

            <Checkbox
              label="Allow stacking discounts"
              helpText="Allow multiple discounts to apply to the same product"
              checked={stackDiscounts}
              onChange={setStackDiscounts}
            />

            <Checkbox
              label="Exclude products already on sale"
              helpText="Don't apply campaign discounts to products with existing compare-at prices"
              checked={excludeSaleProducts}
              onChange={setExcludeSaleProducts}
            />
          </BlockStack>
        </Card>

        {/* Display Settings */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Display
            </Text>

            <Checkbox
              label="Display savings amount"
              helpText="Show how much the customer is saving"
              checked={displaySavings}
              onChange={setDisplaySavings}
            />

            {displaySavings && (
              <Select
                label="Savings format"
                options={[
                  { label: "Percentage (e.g., Save 20%)", value: "percentage" },
                  { label: "Amount (e.g., Save $10)", value: "amount" },
                  { label: "Both", value: "both" },
                ]}
                value={savingsFormat}
                onChange={setSavingsFormat}
              />
            )}
          </BlockStack>
        </Card>

        {/* Advanced */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Advanced
            </Text>

            <TextField
              label="Custom CSS"
              helpText="Add custom CSS to override default widget styles"
              value={customCss}
              onChange={setCustomCss}
              multiline={4}
              autoComplete="off"
              placeholder=".discounty-widget { /* your styles */ }"
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
