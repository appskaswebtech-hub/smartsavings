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
import db from "../db.server";
import { countDiscountedVariants } from "../variants.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;

  // Fetch real campaign count from database
  const campaignCount = await db.campaign.count({ where: { shop } });

  // Fetch real discounted variant count from Shopify
  const activeVariants = await countDiscountedVariants(admin);

  return json({
    shop,
    plan: {
      name: "Starter",
      activeVariants,
      maxVariants: 10,
      createdCampaigns: campaignCount,
      maxCampaigns: 3,
    },
    campaigns: [],
  });
};

export default function Index() {
  const { plan, shop } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [aiPrompt, setAiPrompt] = useState("");
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);

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

  const storeName = shop ? shop.replace(".myshopify.com", "") : "My Store";
  const variantsProgress = Math.min(
    100,
    plan.maxVariants ? (plan.activeVariants / plan.maxVariants) * 100 : 0
  );
  const campaignsProgress = Math.min(
    100,
    plan.maxCampaigns ? (plan.createdCampaigns / plan.maxCampaigns) * 100 : 0
  );

  return (
    <Page fullWidth>
      <style>{homeStyles}</style>
      <BlockStack gap="600">
        <div className="ss-home">
          {/* Welcome Section */}
          <div className="ss-home__hero">
            <div className="ss-home__hero-art" aria-hidden="true">
              <HeroIllustration />
            </div>

            <div className="ss-home__store">
              <button
                type="button"
                className="ss-home__store-btn"
                onClick={() => setStoreMenuOpen((open) => !open)}
                aria-expanded={storeMenuOpen}
              >
                <StoreIcon />
                <span className="ss-home__store-name">{storeName || "My Store"}</span>
                <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 7.5l5 5 5-5" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {storeMenuOpen && (
                <div className="ss-home__store-menu">
                  <a
                    className="ss-home__store-menu-item"
                    href={`https://${shop}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setStoreMenuOpen(false)}
                  >
                    View online store
                  </a>
                  <button
                    type="button"
                    className="ss-home__store-menu-item"
                    onClick={() => navigate("/app/settings")}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    className="ss-home__store-menu-item"
                    onClick={() => navigate("/app/plans")}
                  >
                    Plans
                  </button>
                </div>
              )}
            </div>

            <div className="ss-home__hero-text">
              <span className="ss-home__breadcrumb">Home</span>
              <h1 className="ss-home__title">
                Hey there, <span className="ss-home__title-accent">let&rsquo;s get started.</span>
              </h1>
              <p className="ss-home__subtitle">
                Set up SmartSavings and start running discount campaigns on your store.
              </p>
            </div>
          </div>

          {/* Plan Overview Bar */}
          <div className="ss-home__plan">
            <div className="ss-home__plan-col ss-home__plan-col--plan">
              <div>
                <span className="ss-home__plan-label">Current plan:</span>
                <span className="ss-home__plan-name">{plan.name}</span>
              </div>
              <button
                type="button"
                className="ss-home__upgrade"
                onClick={() => navigate("/app/plans")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z" fill="#3B2BDB" />
                </svg>
                Upgrade
              </button>
            </div>

            <div className="ss-home__plan-col">
              <span className="ss-home__plan-label">Active discounted variants</span>
              <div className="ss-home__plan-progress">
                <span className="ss-home__plan-count">
                  {plan.activeVariants}/{plan.maxVariants}
                </span>
                <div
                  className="ss-home__bar"
                  role="progressbar"
                  aria-valuenow={Math.round(variantsProgress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="ss-home__bar-fill"
                    style={{ width: `${Math.max(variantsProgress, 4)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="ss-home__plan-col">
              <span className="ss-home__plan-label">Created campaigns</span>
              <div className="ss-home__plan-progress">
                <span className="ss-home__plan-count">
                  {plan.createdCampaigns}/{plan.maxCampaigns}
                </span>
                <div
                  className="ss-home__bar"
                  role="progressbar"
                  aria-valuenow={Math.round(campaignsProgress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="ss-home__bar-fill"
                    style={{ width: `${Math.max(campaignsProgress, 4)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Feature Cards */}
          <div className="ss-home__features">
            {/* Create First Campaign Card */}
            <div className="ss-home__card">
              <div className="ss-home__panel ss-home__panel--blue">
                <div className="ss-home__panel-art ss-home__panel-art--browser" aria-hidden="true">
                  <BrowserIllustration />
                </div>
                <div className="ss-index__div-row ss-home__percent-wrap" aria-hidden="true">
                  <div className="ss-index__div-pill ss-home__percent">%</div>
                  <Sparks color="#2F62F5" className="ss-home__sparks--blue" />
                </div>
                <h3 className="ss-home__card-title">Create your first campaign</h3>
                <p className="ss-home__card-text">
                  Set up a discount campaign to start attracting customers and
                  boosting sales.
                </p>
                <div className="ss-home__actions">
                  <button
                    type="button"
                    className="ss-home__btn ss-home__btn--primary"
                    onClick={() => navigate("/app/campaigns/create")}
                  >
                    Start from scratch <ArrowIcon color="#fff" />
                  </button>
                  <button
                    type="button"
                    className="ss-home__link"
                    onClick={() => navigate("/app/campaigns/create")}
                  >
                    Use a template
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Price Editor Card */}
            <div className="ss-home__card">
              <div className="ss-home__panel ss-home__panel--peach">
                <div className="ss-home__panel-art ss-home__panel-art--tag" aria-hidden="true">
                  <PriceTagIllustration />
                </div>
                <div className="ss-index__div-80 ss-home__price-wrap" aria-hidden="true">
                  <div className="ss-index__div-80-2 ss-home__price-card">
                    <div className="ss-index__div-80-3 ss-home__price-row">
                      <span className="ss-index__span-80 ss-home__price-old">$80</span>
                      <span className="ss-index__span-sale ss-home__price-sale">SALE</span>
                    </div>
                    <span className="ss-index__span-65 ss-home__price-new">$65</span>
                  </div>
                  <Sparks color="#F43F5E" className="ss-home__sparks--red" />
                </div>
                <h3 className="ss-home__card-title">Bulk price editor</h3>
                <p className="ss-home__card-text">
                  Update products prices and compare-at prices in bulk for
                  promotions and sales.
                </p>
                <div className="ss-home__actions">
                  <button
                    type="button"
                    className="ss-home__btn ss-home__btn--outline"
                    onClick={() => navigate("/app/campaigns/create")}
                  >
                    Try it now
                  </button>
                  <button
                    type="button"
                    className="ss-home__link"
                    onClick={() => navigate("/app/campaigns/create")}
                  >
                    View all types
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Feature Cards */}
          <div className="ss-home__secondary">
            {/* Customize Widgets */}
            <div className="ss-home__card">
              <div className="ss-home__mini ss-home__mini--purple">
                <div className="ss-home__mini-art" aria-hidden="true">
                  <WidgetIllustration />
                </div>
                <div className="ss-home__mini-icon ss-home__mini-icon--purple" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24">
                    <g stroke="#5B3FD9" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </g>
                    <circle cx="9" cy="6" r="2.4" fill="#EDE9FE" stroke="#5B3FD9" strokeWidth="2" />
                    <circle cx="15" cy="12" r="2.4" fill="#EDE9FE" stroke="#5B3FD9" strokeWidth="2" />
                    <circle cx="8" cy="18" r="2.4" fill="#EDE9FE" stroke="#5B3FD9" strokeWidth="2" />
                  </svg>
                </div>
                <div className="ss-home__mini-body">
                  <h3 className="ss-home__mini-title">Customize widgets</h3>
                  <p className="ss-home__mini-text">
                    Choose how discounts appear on your storefront.
                  </p>
                  <div className="ss-index__div-customize">
                    <button
                      type="button"
                      className="ss-home__btn ss-home__btn--outline ss-home__btn--sm"
                      onClick={() => navigate("/app/customization")}
                    >
                      Customize <ArrowIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Explore Campaign Types */}
            <div className="ss-home__card">
              <div className="ss-home__mini ss-home__mini--blue">
                <div className="ss-home__mini-art" aria-hidden="true">
                  <ListIllustration />
                </div>
                <div className="ss-home__mini-icon ss-home__mini-icon--blue" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24">
                    <rect x="4" y="12" width="4" height="8" rx="1.2" fill="#1F5EFF" />
                    <rect x="10" y="8" width="4" height="12" rx="1.2" fill="#1F5EFF" />
                    <rect x="16" y="4" width="4" height="16" rx="1.2" fill="#1F5EFF" />
                  </svg>
                </div>
                <div className="ss-home__mini-body">
                  <h3 className="ss-home__mini-title">Explore campaign types</h3>
                  <p className="ss-home__mini-text">
                    Discover 6 discount types for different strategies.
                  </p>
                  <div className="ss-index__div-create-campaign">
                    <button
                      type="button"
                      className="ss-home__btn ss-home__btn--outline ss-home__btn--sm"
                      onClick={() => navigate("/app/campaigns/create")}
                    >
                      Create campaign <ArrowIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Learn More */}
            <div className="ss-home__card">
              <div className="ss-home__mini ss-home__mini--orange">
                <div className="ss-home__mini-art" aria-hidden="true">
                  <BookIllustration />
                </div>
                <div className="ss-home__mini-icon ss-home__mini-icon--orange" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24">
                    <path d="M12 4L1.5 9 12 14l10.5-5L12 4z" fill="#F59E0B" />
                    <path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5L12 14.5 6 11.5z" fill="#D97706" />
                    <path d="M21 9.5V15" stroke="#D97706" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="ss-home__mini-body">
                  <h3 className="ss-home__mini-title">Learn more about SmartSavings</h3>
                  <p className="ss-home__mini-text">
                    Learn how to create effective discount campaigns.
                  </p>
                  <div className="ss-index__div-watch-tutorials">
                    <button
                      type="button"
                      className="ss-home__btn ss-home__btn--outline ss-home__btn--sm"
                      onClick={() => navigate("/app/helpandsupport")}
                    >
                      Watch tutorials <ArrowIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Campaign Assistant */}
        {/* <Card>
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
        </Card> */}

        {/* In the Spotlight */}
        {/* <Card>
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
        </Card> */}
      </BlockStack>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Home page illustrations (inline SVG, no external image files)       */
/* ------------------------------------------------------------------ */

function badgePoints(cx: number, cy: number, outer: number, inner: number, count: number) {
  const pts: string[] = [];
  for (let i = 0; i < count * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / count - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function ArrowIcon({ color = "#111827" }: { color?: string }) {
  return (
    <svg className="ss-home__arrow" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5.5L15.5 10 11 14.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sparks({ color, className = "" }: { color: string; className?: string }) {
  return (
    <svg className={`ss-home__sparks ${className}`} width="44" height="56" viewBox="0 0 44 56" aria-hidden="true">
      <g stroke={color} strokeWidth="4" strokeLinecap="round">
        <path d="M6 18L14 4" />
        <path d="M14 28L32 20" />
        <path d="M16 40L32 44" />
      </g>
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg className="ss-home__store-icon" width="40" height="36" viewBox="0 0 40 36" aria-hidden="true">
      <defs>
        <linearGradient id="ssStoreIcon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4C7DFF" />
          <stop offset="1" stopColor="#1F4FE0" />
        </linearGradient>
      </defs>
      <path d="M4 3h32l3 10H1L4 3z" fill="url(#ssStoreIcon)" />
      <path d="M1 13h38v2.5a4.75 4.75 0 01-9.5 0 4.75 4.75 0 01-9.5 0 4.75 4.75 0 01-9.5 0A4.75 4.75 0 011 15.5V13z" fill="#7FA2FF" />
      <path d="M11 3l-2 10M20 3v10M29 3l2 10" stroke="#fff" strokeWidth="1.6" />
      <rect x="4" y="19" width="32" height="15" rx="2" fill="url(#ssStoreIcon)" />
      <rect x="9" y="23" width="9" height="11" rx="1" fill="#fff" />
      <rect x="22" y="23" width="9" height="6" rx="1" fill="#C9D8FF" />
    </svg>
  );
}

function HeroIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 640 240" preserveAspectRatio="xMaxYMin meet">
      <defs>
        <linearGradient id="ssHeroBlob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#DCE6FF" />
          <stop offset="1" stopColor="#B9CCFF" />
        </linearGradient>
        <linearGradient id="ssHeroBlob2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#EEF3FF" />
          <stop offset="1" stopColor="#D5E1FF" />
        </linearGradient>
        <linearGradient id="ssBag" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E3EBFF" />
        </linearGradient>
        <linearGradient id="ssBagSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C4D4FF" />
          <stop offset="1" stopColor="#A9C0FF" />
        </linearGradient>
        <linearGradient id="ssBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6E98FF" />
          <stop offset="1" stopColor="#2A5BF0" />
        </linearGradient>
        <linearGradient id="ssBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5D88FF" />
          <stop offset="1" stopColor="#9DB6FF" />
        </linearGradient>
      </defs>

      {/* soft background waves */}
      <path d="M40 240C70 160 150 120 240 130c90 10 120-70 210-100 70-23 140-10 190 10v200H40z" fill="url(#ssHeroBlob2)" />
      <path d="M150 240c30-60 90-90 160-80 80 11 100-60 170-95 50-25 110-20 160 5v170H150z" fill="url(#ssHeroBlob)" opacity="0.75" />
      <path d="M330 30c30-25 70-30 100-15" stroke="#C9D8FF" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* shopping bag */}
      <ellipse cx="300" cy="226" rx="90" ry="10" fill="#9DB4F5" opacity="0.35" />
      <path d="M352 82l36 14 6 128h-38z" fill="url(#ssBagSide)" />
      <path d="M232 86l120-4 4 142H226z" fill="url(#ssBag)" />
      <path d="M262 92c-2-44 14-66 38-66s40 22 40 62" fill="none" stroke="#2A5BF0" strokeWidth="8" strokeLinecap="round" />
      <path d="M296 30l16-14" stroke="#2A5BF0" strokeWidth="6" strokeLinecap="round" />
      <circle cx="262" cy="96" r="5" fill="#2A5BF0" />
      <circle cx="340" cy="94" r="5" fill="#2A5BF0" />
      {/* store mark on bag */}
      <g transform="translate(258 124)">
        <path d="M2 0h52l4 14H-2L2 0z" fill="url(#ssBlue)" />
        <path d="M14 0l-3 14M28 0v14M42 0l3 14" stroke="#fff" strokeWidth="2" />
        <path d="M-2 14h60v4a6 6 0 01-12 0 6 6 0 01-12 0 6 6 0 01-12 0 6 6 0 01-12 0 6 6 0 01-12 0v-4z" fill="#7FA2FF" />
        <rect x="2" y="22" width="52" height="30" rx="3" fill="url(#ssBlue)" />
        <rect x="10" y="28" width="14" height="24" rx="2" fill="#fff" />
        <rect x="30" y="28" width="16" height="12" rx="2" fill="#DCE6FF" />
      </g>

      {/* discount badge */}
      <polygon points={badgePoints(418, 100, 40, 34, 14)} fill="url(#ssBlue)" />
      <circle cx="418" cy="100" r="28" fill="#4D7BFA" opacity="0.6" />
      <text x="418" y="112" textAnchor="middle" fontSize="34" fontWeight="800" fill="#fff" fontFamily="inherit">%</text>

      {/* bar chart */}
      <rect x="520" y="182" width="22" height="44" rx="4" fill="url(#ssBar)" opacity="0.8" />
      <rect x="548" y="160" width="22" height="66" rx="4" fill="url(#ssBar)" opacity="0.85" />
      <rect x="576" y="122" width="22" height="104" rx="4" fill="url(#ssBar)" />
      <rect x="604" y="176" width="22" height="50" rx="4" fill="url(#ssBar)" opacity="0.7" />
    </svg>
  );
}

function BrowserIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 240 200" preserveAspectRatio="xMaxYMin meet">
      <defs>
        <linearGradient id="ssBrowserTop" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B7C9FF" />
          <stop offset="1" stopColor="#D3DFFF" />
        </linearGradient>
        <linearGradient id="ssBrowserBadge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A9C0FF" />
          <stop offset="1" stopColor="#6E98FF" />
        </linearGradient>
      </defs>
      <g transform="rotate(6 140 100)">
        <rect x="40" y="10" width="220" height="170" rx="14" fill="#EEF3FF" />
        <path d="M40 24a14 14 0 0114-14h192a14 14 0 0114 14v18H40z" fill="url(#ssBrowserTop)" />
        <circle cx="62" cy="27" r="5" fill="#fff" />
        <circle cx="78" cy="27" r="5" fill="#fff" />
        <circle cx="94" cy="27" r="5" fill="#fff" />
        <rect x="56" y="56" width="190" height="110" rx="10" fill="#fff" opacity="0.85" />
        <rect x="74" y="74" width="54" height="12" rx="6" fill="#DCE5FB" />
        <rect x="74" y="98" width="100" height="12" rx="6" fill="#DCE5FB" />
        <rect x="74" y="122" width="76" height="12" rx="6" fill="#DCE5FB" />
      </g>
      <polygon points={badgePoints(196, 138, 30, 26, 12)} fill="url(#ssBrowserBadge)" />
      <text x="196" y="148" textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff" fontFamily="inherit">%</text>
    </svg>
  );
}

function PriceTagIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 220 220" preserveAspectRatio="xMaxYMin meet">
      <defs>
        <linearGradient id="ssTag" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE3CC" />
          <stop offset="1" stopColor="#FFC9A3" />
        </linearGradient>
      </defs>
      <g transform="rotate(-28 110 120)">
        <path d="M70 40h70l20 30v120a10 10 0 01-10 10H70a10 10 0 01-10-10V50a10 10 0 0110-10z" fill="url(#ssTag)" />
        <circle cx="122" cy="62" r="9" fill="#FFF4EA" />
        <text x="110" y="150" textAnchor="middle" fontSize="58" fontWeight="800" fill="#F97316" opacity="0.85" fontFamily="inherit">%</text>
      </g>
      <g stroke="#F43F5E" strokeWidth="4" strokeLinecap="round">
        <path d="M184 40l12-16" />
        <path d="M184 64l20 2" />
      </g>
    </svg>
  );
}

function WidgetIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 170 150" preserveAspectRatio="xMaxYMax meet">
      <circle cx="70" cy="150" r="70" fill="#E9E3FF" opacity="0.8" />
      <rect x="66" y="22" width="130" height="110" rx="10" fill="#fff" />
      <path d="M66 32a10 10 0 0110-10h120v20H66z" fill="#D9CFFF" />
      <circle cx="80" cy="32" r="3.5" fill="#fff" />
      <circle cx="92" cy="32" r="3.5" fill="#fff" />
      <circle cx="104" cy="32" r="3.5" fill="#fff" />
      <rect x="118" y="58" width="70" height="12" rx="6" fill="#A78BFA" />
      <rect x="118" y="82" width="70" height="12" rx="6" fill="#C4B5FD" />
      <rect x="118" y="106" width="44" height="12" rx="6" fill="#A78BFA" />
      {/* shopping bag */}
      <path d="M40 64h56l4 70H36z" fill="#F3F4F6" />
      <path d="M96 64l10 6 2 64h-8z" fill="#E5E7EB" />
      <path d="M54 68c0-16 6-24 14-24s14 8 14 24" fill="none" stroke="#D1D5DB" strokeWidth="4" />
      <path d="M74 86c-4-3-12-2-12 4 0 7 14 5 14 12 0 6-9 7-14 3" fill="none" stroke="#9CA3AF" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function ListIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 150 150" preserveAspectRatio="xMaxYMax meet">
      <g transform="rotate(8 100 60)">
        <rect x="54" y="6" width="90" height="80" rx="10" fill="#E3EBFF" />
        <circle cx="68" cy="18" r="3.5" fill="#B7C9FF" />
        <circle cx="80" cy="18" r="3.5" fill="#B7C9FF" />
        <circle cx="92" cy="18" r="3.5" fill="#B7C9FF" />
      </g>
      <g transform="rotate(-8 70 100)">
        <rect x="24" y="40" width="100" height="112" rx="10" fill="#fff" stroke="#E5ECFF" strokeWidth="2" />
        <circle cx="46" cy="70" r="7" fill="#2F62F5" />
        <rect x="60" y="66" width="48" height="8" rx="4" fill="#DCE5FB" />
        <circle cx="46" cy="98" r="7" fill="#2F62F5" />
        <rect x="60" y="94" width="48" height="8" rx="4" fill="#DCE5FB" />
        <circle cx="46" cy="126" r="7" fill="#2F62F5" />
        <rect x="60" y="122" width="40" height="8" rx="4" fill="#DCE5FB" />
      </g>
    </svg>
  );
}

function BookIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 170 150" preserveAspectRatio="xMaxYMax meet">
      <defs>
        <linearGradient id="ssBook" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF3D6" />
          <stop offset="1" stopColor="#FFE2A8" />
        </linearGradient>
      </defs>
      <path d="M20 54c20-10 44-10 64 2v90c-20-12-44-12-64-2z" fill="url(#ssBook)" />
      <path d="M84 56c20-12 44-12 64-2v90c-20-10-44-10-64 2z" fill="url(#ssBook)" />
      <path d="M14 60v92c24-10 48-8 70 4 22-12 46-14 70-4V60" fill="none" stroke="#F8C76B" strokeWidth="5" />
      <g stroke="#F6C26A" strokeWidth="3" strokeLinecap="round" opacity="0.8">
        <path d="M32 74c12-4 26-4 40 0M32 90c12-4 26-4 40 0M32 106c12-4 26-4 40 0" />
      </g>
      <circle cx="118" cy="96" r="20" fill="#F59E0B" />
      <path d="M112 85l17 11-17 11z" fill="#fff" />
    </svg>
  );
}

const homeStyles = `
.ss-home {
  --ss-blue: #1F5EFF;
  --ss-blue-dark: #0B4BF0;
  --ss-ink: #0B1220;
  --ss-muted: #4B5563;
  --ss-border: #E6EAF2;
  color: var(--ss-ink);
  background: linear-gradient(180deg, #F4F7FF 0%, #F6F8FC 45%, #F7F8FB 100%);
  border-radius: 20px;
  padding: 20px 0px 24px;
  position: relative;
  overflow: hidden;
}
.ss-home * { box-sizing: border-box; }
.ss-home button { font-family: inherit; }
.Polaris-Page {
    max-width: 1300px !important;
}
/* hero */
.ss-home__hero { position: relative; min-height: 188px; padding: 8px 16px 0; }
.ss-home__hero-art {
  position: absolute; top: -20px; right: -16px; width: min(62%, 760px); height: 250px;
  pointer-events: none;
}
  .Polaris-Page.Polaris-Page--fullWidth {
    max-width: 1300px !important;
}
body {
    background: linear-gradient(180deg, #F4F7FF 0%, #F6F8FC 45%, #F7F8FB 100%) !important;
}
.ss-home__hero-text { position: relative; z-index: 1; max-width: 760px; }
.ss-home__breadcrumb { display: block; font-size: 18px; color: #1F2937; margin-bottom: 14px; }
.ss-home__title {
  margin: 0; font-size: clamp(30px, 3.2vw, 36px); line-height: 1.08; font-weight: 800;
  letter-spacing: -0.03em; color: var(--ss-ink);
}
.ss-home__title-accent { color: var(--ss-blue); }
.ss-home__subtitle { margin: 12px 0 0; font-size: 16px; color: #374151; }

.ss-home__store { position: absolute; top: 0; right: 0; z-index: 3; }
.ss-home__store-btn {
  display: inline-flex; align-items: center; gap: 14px; padding: 12px 20px; min-height: 60px;
  background: #fff; border: 0; border-radius: 16px; cursor: pointer;
  box-shadow: 0 6px 20px rgba(31, 94, 255, 0.10);
  font-size: 18px; font-weight: 700; color: var(--ss-ink);
}
.ss-home__store-btn:hover { box-shadow: 0 8px 24px rgba(31, 94, 255, 0.16); }
.ss-home__store-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-home__store-menu {
  position: absolute; right: 0; top: calc(100% + 8px); min-width: 200px; padding: 6px;
  background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
}
.ss-home__store-menu-item {
  display: block; width: 100%; text-align: left; padding: 10px 12px; border: 0; background: none;
  border-radius: 8px; font-size: 14px; color: var(--ss-ink); text-decoration: none; cursor: pointer;
}
.ss-home__store-menu-item:hover { background: #F1F5FF; }

/* plan bar */
.ss-home__plan {
  position: relative; z-index: 2; display: grid; grid-template-columns: 1.2fr 1.4fr 1.4fr;
  align-items: center; background: #fff; border-radius: 20px; padding: 26px 30px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.06); margin-top: 80px;
}
.ss-home__plan-col { display: flex; flex-direction: column; gap: 10px; padding: 0 40px; min-width: 0; }
.ss-home__plan-col + .ss-home__plan-col { border-left: 2px solid #E5E7EB; }
.ss-home__plan-col--plan { flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; padding-left: 0; }
.ss-home__plan-label { display: block; font-size: 17px; color: #374151; }
.ss-home__plan-name { display: block; font-size: 24px; font-weight: 800; margin-top: 10px; }
.ss-home__upgrade {
  display: inline-flex; align-items: center; gap: 10px; padding: 12px 22px; border: 0; cursor: pointer;
  border-radius: 14px; background: #EEEBFF; color: #3B2BDB; font-size: 18px; font-weight: 700;
}
.ss-home__upgrade:hover { background: #E3DEFF; }
.ss-home__plan-progress { display: flex; align-items: center; gap: 30px; }
.ss-home__plan-count { font-size: 21px; font-weight: 800; min-width: 44px; }
.ss-home__bar { flex: 1; max-width: 330px; height: 12px; background: #E5E7EB; border-radius: 999px; overflow: hidden; }
.ss-home__bar-fill { height: 100%; background: linear-gradient(90deg, var(--ss-blue-dark), var(--ss-blue)); border-radius: 999px; transition: width .4s ease; }

/* main feature cards */
.ss-home__features { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; margin-top: 30px; }
.ss-home__card { background: #fff; border-radius: 22px; padding: 14px 20px 14px 20px; box-shadow: 0 8px 28px rgba(15, 23, 42, 0.05); min-width: 0; }
.ss-home__panel {
  position: relative; overflow: hidden; border-radius: 16px; padding: 30px 20px 16px;
  min-height: 338px; display: flex; flex-direction: column;
}
.ss-home__panel--blue { background: linear-gradient(135deg, #EEF3FF 0%, #E6EDFC 100%); }
.ss-home__panel--peach { background: linear-gradient(135deg, #FFF8EC 0%, #FFF1E2 100%); }
.ss-home__panel-art { position: absolute; pointer-events: none; }
.ss-home__panel-art--browser { top: 22px; right: -4px; width: 46%; max-width: 250px; height: 210px; }
.ss-home__panel-art--tag { top: 26px; right: 10px; width: 36%; max-width: 210px; height: 220px; }

.ss-home__percent-wrap { position: relative; display: flex; align-items: flex-start; height: 128px; margin-bottom: 18px; }
.ss-home__percent {
  width: 112px; height: 112px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #3E7BFF, #1452E8);
  display: flex; align-items: center; justify-content: center; color: #fff; font-size: 52px; font-weight: 800;
  box-shadow: 0 0 0 12px rgba(31, 94, 255, 0.08), 0 14px 30px rgba(20, 82, 232, 0.25);
  margin: 12px 0 0 10px;
}
.ss-home__sparks { margin-left: 8px; }
.ss-home__sparks--red { align-self: flex-start; margin-left: 20px; }

.ss-home__price-wrap { position: relative; display: flex; align-items: flex-start; height: 128px; margin-bottom: 18px; }
.ss-home__price-card {
  background: #fff; border-radius: 14px; padding: 18px 34px 18px 34px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07); display: flex; flex-direction: column; gap: 6px;
}
.ss-home__price-row { display: flex; align-items: center; gap: 22px; }
.ss-home__price-old { text-decoration: line-through; color: #9CA3AF; font-size: 21px; font-weight: 700; }
.ss-home__price-sale { background: #F43F5E; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 17px; font-weight: 800; letter-spacing: .04em; }
.ss-home__price-new { font-size: 32px; font-weight: 800; color: #1F2937; }

.ss-home__card-title { position: relative; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: var(--ss-ink); }
.ss-home__card-text { position: relative; margin: 12px 0 0; font-size: 16px; line-height: 1.5; color: #4B5563; max-width: 520px; }
.ss-home__actions { position: relative; display: flex; align-items: center; gap: 30px; margin-top: 16px; flex-wrap: wrap; }

.ss-home__btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 12px;
  min-height: 54px; padding: 0 28px; border-radius: 10px; font-size: 18px; font-weight: 600; cursor: pointer;
  transition: background .15s ease, box-shadow .15s ease, transform .15s ease;
}
.ss-home__btn:active { transform: translateY(1px); }
.ss-home__btn--primary { background: var(--ss-blue-dark); color: #fff; border: 0; box-shadow: 0 6px 16px rgba(11, 75, 240, 0.25); }
.ss-home__btn--primary:hover { background: #0940D1; }
.ss-home__btn--outline { background: #fff; color: var(--ss-ink); border: 1.5px solid #6B7280; }
.ss-home__btn--outline:hover { background: #F9FAFB; }
.ss-home__btn--sm { min-height: 52px; padding: 0 22px; font-size: 17px; }
.ss-home__btn:focus-visible, .ss-home__link:focus-visible, .ss-home__upgrade:focus-visible, .ss-home__store-btn:focus-visible {
  outline: 2px solid var(--ss-blue); outline-offset: 2px;
}
.ss-home__link { background: none; border: 0; padding: 0; color: var(--ss-blue-dark); font-size: 18px; font-weight: 600; cursor: pointer; }
.ss-home__link:hover { text-decoration: underline; }
.ss-home__arrow { flex-shrink: 0; }

/* secondary cards */
.ss-home__secondary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; margin-top: 22px; }
.ss-home__secondary .ss-home__card { padding: 8px; }
.ss-home__mini {
  position: relative; overflow: hidden; border-radius: 16px; padding: 22px 24px 18px;
  min-height: 178px; display: flex; gap: 22px;
}
.ss-home__mini--purple { background: linear-gradient(135deg, #F6F3FF 0%, #F1EEFD 100%); }
.ss-home__mini--blue { background: linear-gradient(135deg, #F2F6FF 0%, #EAF0FD 100%); }
.ss-home__mini--orange { background: linear-gradient(135deg, #FFF9EF 0%, #FFF3E2 100%); }
.ss-home__mini-art { position: absolute; right: 4px; bottom: 4px; width: 40%; max-width: 150px; height: 124px; pointer-events: none; }
.ss-home__mini-icon {
  position: relative; flex-shrink: 0; width: 62px; height: 62px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
}
.ss-home__mini-icon svg { width: 32px; height: 32px; }
.ss-home__upgrade svg { width: 22px; height: 22px; }
.ss-home__mini-icon--purple { background: #E7E1FF; }
.ss-home__mini-icon--blue { background: #DCE7FF; }
.ss-home__mini-icon--orange { background: #FFE8C2; }
.ss-home__mini-body { position: relative; min-width: 0; }
.ss-home__mini-title { margin: 6px 0 0; font-size: 19px; font-weight: 700; color: var(--ss-ink); }
.ss-home__mini-text { margin: 10px 0 0; font-size: 16px; line-height: 1.5; color: #4B5563; max-width: 250px; }
.ss-home__mini-body > div { margin-top: 16px; }

/* responsive */
@media (max-width: 1200px) {
  .ss-home__plan { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 22px; }
  .ss-home__plan-col { padding: 0 22px; }
  .ss-home__plan-progress { gap: 16px; }
  .ss-home__secondary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .ss-home__hero-art { right: 0; opacity: .55; width: 70%; }
  .ss-home__store { position: relative; display: flex; justify-content: flex-end; margin-bottom: 12px; }
  .ss-home__plan { grid-template-columns: minmax(0, 1fr); row-gap: 18px; }
  .ss-home__plan-col { padding: 0; }
  .ss-home__plan-col + .ss-home__plan-col { border-left: 0; border-top: 2px solid #E5E7EB; padding-top: 18px; }
  .ss-home__bar { max-width: none; }
  .ss-home__features, .ss-home__secondary { grid-template-columns: minmax(0, 1fr); }
  .ss-home__panel { padding: 24px 24px 16px; }
}
@media (max-width: 520px) {
  .ss-home { padding: 16px 10px 20px; }
  .ss-home__hero { padding: 4px 6px 0; }
  .ss-home__card { padding: 10px; }
  .ss-home__panel { padding: 20px 18px 14px; min-height: 0; }
  .ss-home__plan { padding: 18px; }
  .ss-home__plan-col--plan { flex-wrap: wrap; }
  .ss-home__mini { padding: 18px 16px; gap: 14px; }
  .ss-home__mini-icon { width: 48px; height: 48px; }
  .ss-home__btn { padding: 0 18px; font-size: 16px; min-height: 48px; }
  .ss-home__card-title { font-size: 22px; }
  .ss-home__card-text, .ss-home__subtitle { font-size: 16px; }
  .ss-home__panel-art--browser, .ss-home__panel-art--tag { opacity: .45; }
  .ss-home__mini-art { opacity: .4; }
}
`;
