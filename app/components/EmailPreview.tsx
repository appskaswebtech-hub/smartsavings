/**
 * Live preview of the discount-code email, shared by the create and edit
 * campaign forms so the two can't drift.
 *
 * Links inside the preview stay clickable so a merchant can check they point
 * where they meant — but clicking one navigates the iframe away from the email,
 * and `srcDoc` is only re-applied when the HTML string itself changes, so
 * editing a block won't necessarily bring it back. "Back to preview" bumps a
 * key to remount the iframe, which restores the email unconditionally.
 */
import { useState } from "react";
import { BlockStack, Button, InlineStack, Text } from "@shopify/polaris";

export function EmailPreview({
  html,
  labelVariant = "bodyMd",
  labelWeight = "medium",
}: {
  html: string;
  labelVariant?: "bodySm" | "bodyMd";
  labelWeight?: "medium" | "bold";
}) {
  const [previewKey, setPreviewKey] = useState(0);

  return (
    <BlockStack gap="100">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="p" variant={labelVariant} fontWeight={labelWeight}>Preview</Text>
        <Button size="slim" onClick={() => setPreviewKey((k) => k + 1)}>
          Back to preview
        </Button>
      </InlineStack>
      <iframe
        key={previewKey}
        title="Email preview"
        srcDoc={html}
        style={{
          width: "100%",
          height: "540px",
          border: "1px solid #e1e3e5",
          borderRadius: "8px",
        }}
      />
    </BlockStack>
  );
}
