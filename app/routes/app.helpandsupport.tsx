import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import {
  Page, Card, Text, BlockStack, InlineStack, Box, Icon, InlineGrid,
  Collapsible, Banner, TextField, Divider, Badge,
} from "@shopify/polaris";
import {
  BookOpenIcon, ChatIcon, EmailIcon, ExternalIcon, ChevronRightIcon,
  ChevronDownIcon, NoteIcon, FlagIcon, SearchIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback, useMemo } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

interface FAQItem {
  id: string;
  question: string;
  answer: string[];
}

interface FAQSection {
  id: string;
  title: string;
  icon: string;
  badge?: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "🚀",
    badge: "Popular",
    items: [
      {
        id: "gs-1",
        question: "How do I create my first discount campaign?",
        answer: [
          "Creating your first campaign is simple:",
          "1. Click 'Campaigns' in the sidebar navigation.",
          "2. Click the 'Create campaign' button in the top right.",
          "3. Choose your campaign type (Bulk price, Quantity discount, Cart goal, etc.).",
          "4. Fill in the campaign name, discount value, and choose which products it applies to.",
          "5. Set a schedule or start immediately.",
          "6. Click 'Save campaign' — your discount goes live on your store right away!",
        ],
      },
      {
        id: "gs-2",
        question: "What discount campaign types are available?",
        answer: [
          "SmartDiscounts offers 6 campaign types:",
          "Bulk Price Editor — Apply percentage or fixed amount discounts to products in bulk. Great for store-wide sales like '20% off all shoes'.",
          "Quantity Discount — Offer tiered discounts based on how many items a customer buys. Example: Buy 2+ get 5% off, Buy 5+ get 15% off.",
          "Buy X Get Y — Give free or discounted items when customers purchase a qualifying quantity. Example: Buy 2 shirts, get 1 free.",
          "Cart Goal — Reward customers for reaching a minimum cart value. Example: Spend $100+, save 10%.",
          "Shipping Discount — Offer free or discounted shipping based on order value. Example: Free shipping on orders over $50.",
          "Advanced Discount Code — Create custom discount codes combining order discounts with free shipping.",
        ],
      },
      {
        id: "gs-3",
        question: "How do I activate widgets on my store?",
        answer: [
          "Widgets display your discounts beautifully on your storefront. To activate them:",
          "1. Go to your Shopify admin → Online Store → Themes → Customize.",
          "2. Navigate to the page where you want the widget (product page, cart, etc.).",
          "3. Click 'Add block' or 'Add section'.",
          "4. Look for 'SmartDiscounts Widgets' under the Apps section.",
          "5. Select the widget you want (Countdown Timer, Quantity Table, Shipping Bar, etc.).",
          "6. Configure its settings (colors, text, thresholds) in the right panel.",
          "7. Click Save.",
          "Your widgets will now appear on your live store!",
        ],
      },
      {
        id: "gs-4",
        question: "Do I need to install anything on my theme?",
        answer: [
          "No manual code editing is needed. SmartDiscounts uses Shopify's App Blocks system, which works with all Online Store 2.0 themes.",
          "Simply go to the Theme Editor (Online Store → Themes → Customize) and add SmartDiscounts blocks wherever you want them to appear.",
          "If you're using a vintage theme (pre-OS 2.0), you may need to add a small code snippet. Contact our support team for help with this.",
        ],
      },
    ],
  },
  {
    id: "campaigns",
    title: "Campaigns & Discounts",
    icon: "🏷️",
    items: [
      {
        id: "cd-1",
        question: "How do I edit an existing campaign?",
        answer: [
          "Go to Campaigns in the sidebar, find your campaign in the list, and click the 'Edit' button. Make your changes and click 'Save campaign'.",
          "Changes take effect immediately on your store.",
        ],
      },
      {
        id: "cd-2",
        question: "Can I schedule campaigns in advance?",
        answer: [
          "Yes! When creating or editing a campaign:",
          "1. Uncheck 'Start immediately'.",
          "2. Set your desired start date using the date picker.",
          "3. Optionally check 'Set end date' and choose when the campaign should expire.",
          "The campaign will automatically activate and deactivate at the scheduled times.",
        ],
      },
      {
        id: "cd-3",
        question: "Can I apply a discount to specific products or collections?",
        answer: [
          "Absolutely! When creating a campaign, under the 'Products' section:",
          "Select 'All products' to apply the discount store-wide.",
          "Select 'Specific products' and click 'Browse products' to pick individual products.",
          "Select 'Specific collections' and click 'Browse collections' to apply to entire collections.",
          "You can select multiple products or collections for a single campaign.",
        ],
      },
      {
        id: "cd-4",
        question: "Will discounts stack with other Shopify discounts?",
        answer: [
          "By default, SmartDiscounts campaigns don't stack with each other or with Shopify's native discounts.",
          "You can enable stacking in the Settings page by toggling 'Allow stacking discounts'. However, be careful with this setting as it can lead to unexpected total discounts.",
          "Shopify also has its own discount combination rules. Check your Shopify discount settings for more details.",
        ],
      },
      {
        id: "cd-5",
        question: "What happens when I delete a campaign?",
        answer: [
          "When you delete a campaign from SmartDiscounts:",
          "The discount is removed from both the app AND your Shopify store's Discounts page.",
          "The change takes effect immediately — customers can no longer use the discount.",
          "This action cannot be undone, but you can always create a new campaign.",
          "If you just want to temporarily stop a discount, use the 'Pause' button instead of deleting.",
        ],
      },
      {
        id: "cd-6",
        question: "How does the quantity discount work for customers?",
        answer: [
          "When a customer adds products to their cart, the quantity discount automatically applies based on your configured tiers.",
          "For example, if your tiers are: Buy 2+ get 5% off, Buy 5+ get 10% off, Buy 10+ get 15% off:",
          "Adding 1 item → no discount.",
          "Adding 3 items → 5% off each item.",
          "Adding 7 items → 10% off each item.",
          "Adding 12 items → 15% off each item.",
          "The discount is applied at checkout automatically — no code needed.",
        ],
      },
      {
        id: "cd-7",
        question: "Can I create a discount code instead of an automatic discount?",
        answer: [
          "Yes! Choose 'Advanced discount code' when creating a campaign.",
          "Enter your custom code (e.g., SAVE20) or click 'Generate code' for a random one.",
          "Choose the discount type: percentage off, fixed amount off, or free shipping.",
          "Customers will need to enter this code at checkout to get the discount.",
        ],
      },
    ],
  },
  {
    id: "customization",
    title: "Widgets & Customization",
    icon: "🎨",
    items: [
      {
        id: "cw-1",
        question: "How do I change the colors of my discount widgets?",
        answer: [
          "Go to the Customization page in the app sidebar. Click on any widget to open its settings.",
          "Each widget has color options in the 'Styles' or 'Colors' section. Click the color swatch to open a color picker, or type a hex code directly.",
          "Changes are saved and applied to your store when you click 'Save'.",
          "You can also customize colors directly in the Theme Editor when you add the widget blocks.",
        ],
      },
      {
        id: "cw-2",
        question: "Can I customize the countdown timer text and style?",
        answer: [
          "Yes! The countdown timer is fully customizable:",
          "Content: Change the title text, CTA button text, timer label visibility (show/hide days, hours, minutes, seconds).",
          "Position: Place it at the top or bottom of the page, make it sticky.",
          "Style: Set background color or gradient, border radius, close icon color.",
          "Colors: Customize title, countdown numbers, CTA button background and text colors.",
          "You can preview all changes in real-time using the desktop and mobile preview on the right side.",
        ],
      },
      {
        id: "cw-3",
        question: "What is the 'Saving on cart' widget?",
        answer: [
          "The 'Saving on cart' widget shows customers how much they're saving on the cart page.",
          "It displays three lines: Total (original price, crossed out), Saving (the discount amount, highlighted), and Subtotal (final price).",
          "You can customize the text labels, colors, and whether to show a border around the saving amount.",
          "This widget only appears when there's an actual discount being applied.",
        ],
      },
      {
        id: "cw-4",
        question: "How does the shipping progress bar work?",
        answer: [
          "The shipping progress bar shows customers how close they are to qualifying for free shipping.",
          "Set your free shipping threshold (e.g., $100) in the widget settings.",
          "As customers add items to their cart, the progress bar fills up and the message updates:",
          "Empty cart: 'Add $100 to unlock free shipping'",
          "Partially filled: 'You're $30 away from free shipping!'",
          "Threshold reached: 'You've unlocked free shipping! 🎉'",
          "You can place this widget on both product pages and the cart page.",
        ],
      },
      {
        id: "cw-5",
        question: "How do I set up the Buy X Get Y popup?",
        answer: [
          "1. Go to Customization → Buy X get Y pop-up.",
          "2. Configure the minimum cart quantity to trigger the popup.",
          "3. Set up a gift product collection in your Shopify admin (Products → Collections).",
          "4. In the theme editor, add the 'Buy X Get Y Popup' block and select your gift collection.",
          "5. Customize the popup text, colors, and dismiss behavior.",
          "When a customer's cart reaches the minimum quantity, the popup automatically appears showing the available gift products.",
        ],
      },
    ],
  },
  {
    id: "billing",
    title: "Plans & Billing",
    icon: "💳",
    items: [
      {
        id: "bi-1",
        question: "What's included in the free Starter plan?",
        answer: [
          "The Starter plan includes:",
          "Up to 10 discounted product variants.",
          "Up to 3 active campaigns.",
          "Quantity discount and Bulk price editor campaign types.",
          "All customizable widgets.",
          "Chat and email support.",
          "No credit card required — free forever!",
        ],
      },
      {
        id: "bi-2",
        question: "How do I upgrade my plan?",
        answer: [
          "Go to the Plans page in the app sidebar.",
          "Compare the available plans and choose the one that fits your needs.",
          "Click 'Upgrade' — you'll be redirected to Shopify's billing page to confirm.",
          "Billing is handled entirely through Shopify — charges appear on your regular Shopify invoice.",
          "You can downgrade or cancel anytime.",
        ],
      },
      {
        id: "bi-3",
        question: "What does 'Active discounted variants' mean?",
        answer: [
          "A variant is a specific version of a product (e.g., a T-shirt in size Small and color Red is one variant).",
          "'Active discounted variants' counts how many product variants currently have a discount applied through your campaigns.",
          "For example: If you discount a product with 3 sizes (S, M, L), that counts as 3 variants.",
          "The Starter plan allows up to 10 active discounted variants across all your campaigns.",
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: "🔧",
    items: [
      {
        id: "ts-1",
        question: "My discount isn't showing on my store. What should I do?",
        answer: [
          "Check these common causes:",
          "1. Campaign status — Make sure the campaign shows 'Active' (not Paused, Draft, or Expired) in the Campaigns page.",
          "2. Start date — If you scheduled the campaign, verify the start date has passed.",
          "3. Product selection — Confirm the discount applies to the product you're viewing (check 'Applies to' in the campaign).",
          "4. Theme widgets — Go to Online Store → Themes → Customize and make sure SmartDiscounts blocks are added to the relevant pages.",
          "5. Browser cache — Try viewing your store in an incognito/private browser window.",
          "If none of these solve it, contact our support team.",
        ],
      },
      {
        id: "ts-2",
        question: "My discount shows in the app but not in Shopify's Discounts page.",
        answer: [
          "This can happen if there was an error creating the discount on Shopify. Try these steps:",
          "1. Delete the campaign from the app.",
          "2. Recreate it — watch for any red error banners that appear when saving.",
          "3. Common errors include: duplicate discount names (use a unique name), invalid discount values, or missing API permissions.",
          "If the error persists, check that your app has 'write_discounts' and 'read_discounts' permissions in your app settings.",
        ],
      },
      {
        id: "ts-3",
        question: "The countdown timer isn't counting down.",
        answer: [
          "Make sure you've set a valid end date in the future.",
          "The date format should be YYYY-MM-DD HH:MM (e.g., 2026-12-31 23:59).",
          "Check that the countdown timer block is enabled (the 'Enable countdown timer' checkbox should be checked).",
          "Try refreshing the page — the timer uses JavaScript which needs to load fully.",
        ],
      },
      {
        id: "ts-4",
        question: "Discounts are being applied to products I didn't select.",
        answer: [
          "This usually means the campaign is set to 'All products'. To fix:",
          "1. Go to Campaigns and click Edit on the campaign.",
          "2. Under 'Products', change 'Applies to' from 'All products' to 'Specific products' or 'Specific collections'.",
          "3. Click 'Browse products' or 'Browse collections' to select exactly which items should be discounted.",
          "4. Save the campaign.",
        ],
      },
      {
        id: "ts-5",
        question: "I deleted a discount from Shopify but it still shows in the app.",
        answer: [
          "The app syncs with Shopify every time you open the Campaigns page.",
          "Simply navigate to the Campaigns page and refresh — the deleted discount will be automatically removed.",
          "If it still shows, click 'Delete' on the campaign in the app to clean it up manually.",
        ],
      },
      {
        id: "ts-6",
        question: "The app is loading slowly or showing errors.",
        answer: [
          "Try these steps:",
          "1. Refresh the page (Ctrl+R or Cmd+R).",
          "2. Clear your browser cache.",
          "3. Try a different browser.",
          "4. Check your internet connection.",
          "5. If the error persists, take a screenshot and contact our support team.",
          "Slow loading can also happen if you have many campaigns — the app syncs with Shopify on each page load.",
        ],
      },
    ],
  },
];

export default function HelpAndSupport() {
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["getting-started"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [showChatBanner, setShowChatBanner] = useState(false);
  const [showEmailBanner, setShowEmailBanner] = useState(false);

  const toggleItem = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Filter FAQ items based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_SECTIONS;
    const q = searchQuery.toLowerCase();
    return FAQ_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.some((line) => line.toLowerCase().includes(q))
      ),
    })).filter((section) => section.items.length > 0);
  }, [searchQuery]);

  const totalResults = filteredSections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <Page backAction={{ content: "Home", url: "/app" }} title="Help & Support">
      <BlockStack gap="400">
        {showChatBanner && (
          <Banner tone="success" onDismiss={() => setShowChatBanner(false)}>
            <p>Live chat opened! Our team typically responds within 2-3 minutes during business hours.</p>
          </Banner>
        )}
        {showEmailBanner && (
          <Banner tone="success" onDismiss={() => setShowEmailBanner(false)}>
            <p>Email compose opened! Send us your question and we'll get back to you within a few hours.</p>
          </Banner>
        )}

        {/* Search */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">How can we help you?</Text>
            <TextField
              label=""
              labelHidden
              placeholder="Search for answers... e.g. 'how to create discount' or 'countdown timer'"
              value={searchQuery}
              onChange={setSearchQuery}
              autoComplete="off"
              prefix={<Icon source={SearchIcon} />}
              clearButton
              onClearButtonClick={() => setSearchQuery("")}
            />
            {searchQuery && (
              <Text as="p" variant="bodySm" tone="subdued">
                {totalResults} result{totalResults !== 1 ? "s" : ""} found
              </Text>
            )}
          </BlockStack>
        </Card>

        {/* FAQ Sections */}
        {filteredSections.map((section) => (
          <Card key={section.id} padding="0">
            {/* Section Header */}
            <div
              onClick={() => toggleSection(section.id)}
              style={{
                padding: "16px 20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                <span style={{ fontSize: "20px" }}>{section.icon}</span>
                <div>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingSm">{section.title}</Text>
                    {section.badge && <Badge tone="info">{section.badge}</Badge>}
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {section.items.length} article{section.items.length !== 1 ? "s" : ""}
                  </Text>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <Icon
                  source={expandedSections.has(section.id) ? ChevronDownIcon : ChevronRightIcon}
                  tone="subdued"
                />
              </div>
            </div>

            {/* Section Items */}
            <Collapsible
              open={expandedSections.has(section.id) || !!searchQuery}
              id={`section-${section.id}`}
              transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
            >
              {section.items.map((item, itemIndex) => (
                <div key={item.id}>
                  {/* Question */}
                  <div
                    onClick={() => toggleItem(item.id)}
                    style={{
                      padding: "14px 20px 14px 56px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderTop: "1px solid #f0f0f0",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Text as="span" variant="bodyMd" fontWeight={expandedItems.has(item.id) ? "bold" : "regular"}>
                      {item.question}
                    </Text>
                    <div style={{ flexShrink: 0, marginLeft: "12px" }}>
                      <Icon
                        source={expandedItems.has(item.id) ? ChevronDownIcon : ChevronRightIcon}
                        tone="subdued"
                      />
                    </div>
                  </div>

                  {/* Answer */}
                  <Collapsible
                    open={expandedItems.has(item.id)}
                    id={`item-${item.id}`}
                    transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
                  >
                    <div style={{ padding: "0 20px 16px 56px" }}>
                      <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          {item.answer.map((line, i) => (
                            <Text key={i} as="p" variant="bodySm" tone={line.startsWith("1.") || line.startsWith("2.") || line.startsWith("3.") || line.startsWith("4.") || line.startsWith("5.") || line.startsWith("6.") || line.startsWith("7.") ? "subdued" : undefined}>
                              {line}
                            </Text>
                          ))}
                        </BlockStack>
                      </Box>
                    </div>
                  </Collapsible>
                </div>
              ))}
            </Collapsible>
          </Card>
        ))}

        {/* No results */}
        {searchQuery && totalResults === 0 && (
          <Card>
            <BlockStack gap="300" inlineAlign="center">
              <Text as="p" variant="bodyMd" alignment="center">
                No articles found for "{searchQuery}"
              </Text>
              <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                Try different keywords or contact our support team below
              </Text>
            </BlockStack>
          </Card>
        )}

        <Divider />

        {/* Quick Links */}
        <InlineGrid columns={2} gap="400">
          <Card padding="0">
            <div
              onClick={() => window.open("https://smartdiscounts.app/changelog", "_blank")}
              style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <InlineStack gap="300" blockAlign="center">
                <Icon source={NoteIcon} tone="base" />
                <BlockStack gap="0">
                  <Text as="h3" variant="headingSm">Release Notes</Text>
                  <Text as="p" variant="bodySm" tone="subdued">See what's new and improved</Text>
                </BlockStack>
              </InlineStack>
              <Icon source={ExternalIcon} tone="subdued" />
            </div>
          </Card>

          <Card padding="0">
            <div
              onClick={() => window.open("https://smartdiscounts.app/feature-request", "_blank")}
              style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <InlineStack gap="300" blockAlign="center">
                <Icon source={FlagIcon} tone="base" />
                <BlockStack gap="0">
                  <Text as="h3" variant="headingSm">Feature Request</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Suggest new features</Text>
                </BlockStack>
              </InlineStack>
              <Icon source={ExternalIcon} tone="subdued" />
            </div>
          </Card>
        </InlineGrid>

        {/* Contact Support */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Still need help?</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Can't find what you're looking for? Our support team is ready to assist you.
            </Text>
            <InlineGrid columns={2} gap="400">
              <div
                onClick={() => {
                  setShowChatBanner(true);
                  window.open("mailto:support@smartdiscounts.app?subject=Live%20Chat%20Request", "_blank");
                }}
                style={{
                  cursor: "pointer",
                  border: "1px solid #e0e0e0",
                  borderRadius: "12px",
                  padding: "20px",
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.background = "#f0fdf4"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e0e0e0"; e.currentTarget.style.background = "transparent"; }}
              >
                <BlockStack gap="200" inlineAlign="center">
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "50%",
                    background: "#f0fdf4", display: "flex", alignItems: "center",
                    justifyContent: "center", margin: "0 auto",
                  }}>
                    <Icon source={ChatIcon} tone="base" />
                  </div>
                  <Text as="h3" variant="headingSm" alignment="center">Chat with us</Text>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    Talk with our team now.
                  </Text>
                  <Badge tone="success">Typically replies in minutes</Badge>
                </BlockStack>
              </div>

              <div
                onClick={() => {
                  setShowEmailBanner(true);
                  window.open("mailto:support@smartdiscounts.app?subject=Support%20Request%20-%20SmartDiscounts", "_blank");
                }}
                style={{
                  cursor: "pointer",
                  border: "1px solid #e0e0e0",
                  borderRadius: "12px",
                  padding: "20px",
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.background = "#eff6ff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e0e0e0"; e.currentTarget.style.background = "transparent"; }}
              >
                <BlockStack gap="200" inlineAlign="center">
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "50%",
                    background: "#eff6ff", display: "flex", alignItems: "center",
                    justifyContent: "center", margin: "0 auto",
                  }}>
                    <Icon source={EmailIcon} tone="base" />
                  </div>
                  <Text as="h3" variant="headingSm" alignment="center">Email us</Text>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                    Send us a detailed message.
                  </Text>
                  <Badge tone="info">Replies within a few hours</Badge>
                </BlockStack>
              </div>
            </InlineGrid>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}