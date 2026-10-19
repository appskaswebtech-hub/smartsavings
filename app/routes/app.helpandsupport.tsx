import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
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

type HelpIconName = "rocket" | "discount" | "puzzle" | "card" | "tool" | "file" | "bulb" | "chat" | "email" | "search" | "arrow" | "external" | "back" | "close";

function HelpIcon({ name, size = 23 }: { name: HelpIconName; size?: number }) {
  const base = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<HelpIconName, ReactNode> = {
    rocket: <><path d="M4.5 16.5 3 21l4.5-1.5 3-3"/><path d="M9 15 5 11l5-5c3-3 7-3.6 11-3-0.5 4-1 8-4 11l-5 5-4-4Z"/><circle cx="15" cy="9" r="2"/><path d="M5 11H2l3-4h4M13 19v3l4-3v-4"/></>,
    discount: <><path d="M4 4h16v16H4z" rx="4"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><path d="m8 16 8-8"/></>,
    puzzle: <path d="M10 3H7a2 2 0 0 0-2 2v3a2.5 2.5 0 1 1 0 5v5a2 2 0 0 0 2 2h4v-2a2.5 2.5 0 0 1 5 0v2h3a2 2 0 0 0 2-2v-4h-2a2.5 2.5 0 0 1 0-5h2V5a2 2 0 0 0-2-2h-4v2a2.5 2.5 0 1 1-5 0V3Z"/>,
    card: <><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20M6 15h5"/></>,
    tool: <><path d="M14 6a5 5 0 0 0-6 6l-5.5 5.5a2.1 2.1 0 0 0 3 3L11 15a5 5 0 0 0 6-6l-3.5 3.5-3-3L14 6Z"/></>,
    file: <><path d="M6 2h8l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/><path d="M14 2v6h5M8 12h8M8 16h8"/></>,
    bulb: <><path d="M9 18h6M10 21h4M9 15c-1.8-1.3-3-3-3-5a6 6 0 0 1 12 0c0 2-1.2 3.7-3 5l-.5 3h-5L9 15Z"/></>,
    chat: <><path d="M20 11.5a8 8 0 0 1-8 8c-1.3 0-2.5-.3-3.6-.8L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M8 11.5h.1M12 11.5h.1M16 11.5h.1" strokeWidth="3"/></>,
    email: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>,
    search: <><circle cx="10.7" cy="10.7" r="6.5"/><path d="m16 16 5 5"/></>,
    arrow: <path d="m9 5 7 7-7 7"/>,
    external: <><path d="M13 5h6v6M19 5l-9 9"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/></>,
    back: <><path d="m12 19-7-7 7-7M5 12h15"/></>,
    close: <path d="M6 6 18 18M18 6 6 18"/>,
  };
  return <svg {...base}>{paths[name]}</svg>;
}

const CATEGORY_ICONS: Record<string, HelpIconName> = {
  "getting-started": "rocket", campaigns: "discount", customization: "puzzle", billing: "card", troubleshooting: "tool",
};

export default function HelpAndSupport() {
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["getting-started"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [showChatBanner, setShowChatBanner] = useState(false);
  const [showEmailBanner, setShowEmailBanner] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_SECTIONS;
    const q = searchQuery.toLowerCase();
    return FAQ_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.question.toLowerCase().includes(q) || item.answer.some((line) => line.toLowerCase().includes(q))),
    })).filter((section) => section.items.length > 0);
  }, [searchQuery]);
  const totalResults = filteredSections.reduce((sum, s) => sum + s.items.length, 0);

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    <main className="sd-help">
      <style>{HELP_STYLES}</style>
      <div className="sd-help__shell">
        <header className="sd-help__header">
          <button type="button" className="sd-help__back" aria-label="Back to home" onClick={() => navigate("/app")}><HelpIcon name="back" /></button>
          <div className="sd-help__intro">
            <h1>Help &amp; Support</h1>
            <p>Find answers, learn how to use Discountly, or get in touch with our support team.</p>
          </div>
          <div className="sd-help__header-art" aria-hidden="true"><span className="sd-help__bubble">?</span><span className="sd-help__decor-line"/><span className="sd-help__decor-line"/><span className="sd-help__decor-line"/></div>
        </header>

        {showChatBanner && <div className="sd-help__notice" role="status">Email compose opened for your chat request. <button type="button" onClick={() => setShowChatBanner(false)} aria-label="Dismiss notification"><HelpIcon name="close" size={16}/></button></div>}
        {showEmailBanner && <div className="sd-help__notice" role="status">Email compose opened! Send your support question. <button type="button" onClick={() => setShowEmailBanner(false)} aria-label="Dismiss notification"><HelpIcon name="close" size={16}/></button></div>}

        <div className="sd-help__search-wrap">
          <div className="sd-help__search-box">
            <HelpIcon name="search" size={22}/>
            <input ref={searchRef} aria-label="Search help articles" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={'Search for answers... e.g. “How to create discount” or “countdown timer”'}/>
            {searchQuery ? <button type="button" className="sd-help__clear" onClick={() => setSearchQuery("")} aria-label="Clear search"><HelpIcon name="close" size={17}/></button> : <kbd>⌘ K</kbd>}
          </div>
          {searchQuery && <span className="sd-help__results">{totalResults} result{totalResults === 1 ? "" : "s"} found</span>}
        </div>

        <div className="sd-help__categories">
          {filteredSections.map((section) => {
            const expanded = expandedSections.has(section.id) || !!searchQuery;
            return (
              <section className={`sd-help__category sd-help__category--${section.id}`} key={section.id}>
                <button type="button" className="sd-help__category-head" aria-expanded={expanded} aria-controls={`section-${section.id}`} onClick={() => toggleSection(section.id)}>
                  <span className="sd-help__category-icon"><HelpIcon name={CATEGORY_ICONS[section.id]}/></span>
                  <span className="sd-help__category-name"><span className="sd-help__category-title">{section.title} {section.badge && <span className="sd-help__popular">{section.badge}</span>}</span><span className="sd-help__category-count">{section.items.length} article{section.items.length === 1 ? "" : "s"}</span></span>
                  <span className={`sd-help__chevron ${expanded ? "is-open" : ""}`}><HelpIcon name="arrow" size={19}/></span>
                </button>
                <div id={`section-${section.id}`} className="sd-help__section-body" hidden={!expanded}>
                  <div className="sd-help__articles">
                    {section.items.map((item) => {
                      const isOpen = expandedItems.has(item.id);
                      return <div className="sd-help__article" key={item.id}>
                        <button type="button" className="sd-help__question" aria-expanded={isOpen} aria-controls={`item-${item.id}`} onClick={() => toggleItem(item.id)}>
                          <span className="sd-help__doc-icon"><HelpIcon name="file" size={19}/></span><span>{item.question}</span><span className={`sd-help__chevron ${isOpen ? "is-open" : ""}`}><HelpIcon name="arrow" size={18}/></span>
                        </button>
                        <div id={`item-${item.id}`} hidden={!isOpen} className="sd-help__answer">{item.answer.map((line, i) => <p key={i}>{line}</p>)}</div>
                      </div>;
                    })}
                  </div>
                </div>
              </section>
            );
          })}
          {searchQuery && totalResults === 0 && <div className="sd-help__empty"><strong>No articles found for “{searchQuery}”</strong><p>Try different keywords or contact our support team below.</p></div>}
        </div>

        <div className="sd-help__quick-links">
          <a className="sd-help__quick" href="https://smartdiscounts.app/changelog" target="_blank" rel="noopener noreferrer"><span className="sd-help__quick-icon sd-help__quick-icon--note"><HelpIcon name="file"/></span><span><strong>Release Notes</strong><small>See what's new and improved</small></span><HelpIcon name="external" size={19}/></a>
          <a className="sd-help__quick" href="https://smartdiscounts.app/feature-request" target="_blank" rel="noopener noreferrer"><span className="sd-help__quick-icon sd-help__quick-icon--bulb"><HelpIcon name="bulb"/></span><span><strong>Feature Request</strong><small>Suggest new features</small></span><HelpIcon name="external" size={19}/></a>
        </div>

        <section className="sd-help__contact">
          <h2>Still need help?</h2><p>Can't find what you're looking for? Our support team is ready to assist you.</p>
          <div className="sd-help__contact-grid">
            <a className="sd-help__contact-card sd-help__contact-card--chat" href="mailto:support@smartdiscounts.app?subject=Live%20Chat%20Request" onClick={() => setShowChatBanner(true)}>
              <span className="sd-help__contact-icon"><HelpIcon name="chat"/></span><strong>Chat with us</strong><span>Talk with our team now.</span><em>Typically replies in minutes <span>→</span></em>
            </a>
            <a className="sd-help__contact-card sd-help__contact-card--email" href="mailto:support@smartdiscounts.app?subject=Support%20Request%20-%20SmartDiscounts" onClick={() => setShowEmailBanner(true)}>
              <span className="sd-help__contact-icon"><HelpIcon name="email"/></span><strong>Email us</strong><span>Send us a detailed message.</span><em>Replies within a few hours <span>→</span></em>
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

const HELP_STYLES = `
.sd-help{min-height:100vh;background:radial-gradient(ellipse at 88% -6%,#dcecff 0%,transparent 38%),linear-gradient(135deg,#f9fcff 0%,#eff7ff 63%,#e7f2ff 100%);color:#080f31;padding:24px 24px 34px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.sd-help *{box-sizing:border-box}.sd-help__shell{max-width:1100px;margin:auto}.sd-help button,.sd-help input{font:inherit}.sd-help button{cursor:pointer}.sd-help__header{display:flex;align-items:flex-start;position:relative;gap:20px;min-height:74px;margin-bottom:20px;overflow:hidden}.sd-help__back{flex-shrink:0;display:grid;place-items:center;background:none;border:0;color:#3558b2;width:30px;height:42px}.sd-help__intro{position:relative;z-index:1}.sd-help__intro h1{font-size:29px;line-height:1.18;letter-spacing:-1px;margin:0 0 7px;font-weight:800}.sd-help__intro p{margin:0;color:#57709f;font-size:14px}.sd-help__header-art{position:absolute;right:24px;top:-14px;width:220px;height:110px;border-radius:0px;background:linear-gradient(135deg,#e3f1ff,#f8fbff);opacity:.9}.sd-help__bubble{position:absolute;top:13px;left:30px;display:grid;place-items:center;background:linear-gradient(135deg,#a7c6ff,#315eff);color:white;font-size:43px;font-weight:800;width:76px;height:64px;border-radius:26px;box-shadow:0 12px 30px #527ffb36}.sd-help__bubble:after{content:"";position:absolute;bottom:-8px;left:19px;border-top:13px solid #537eff;border-right:12px solid transparent}.sd-help__decor-line{position:absolute;left:112px;top:30px;width:60px;height:12px;background:#a8caff;border-radius:20px}.sd-help__decor-line:nth-of-type(3){top:58px;width:92px}.sd-help__decor-line:nth-of-type(4){top:85px;width:72px}
.sd-help__search-wrap,.sd-help__category,.sd-help__quick,.sd-help__contact{border:1px solid #deebff;background:linear-gradient(132deg,#fff 65%,#f5faff);box-shadow:0 6px 20px rgba(54,110,187,.055);border-radius:16px}.sd-help__search-wrap{padding:12px;margin-bottom:15px}.sd-help__search-box{border:1px solid #dce8fa;box-shadow:inset 0 0 0 1px #f1f5ff;border-radius:12px;padding:0 14px;display:flex;align-items:center;gap:13px;min-height:50px;color:#34519b}.sd-help__search-box:focus-within{border-color:#5e76ff;box-shadow:0 0 0 3px #657bff20}.sd-help__search-box input{flex:1;min-width:0;background:transparent;border:0;outline:0;font-size:14px;color:#101b3e}.sd-help__search-box input::placeholder{color:#546a94;opacity:1}.sd-help__search-box kbd{font-family:inherit;border-radius:8px;background:#f1f5ff;color:#4a5f8c;padding:6px 10px;font-size:12px;white-space:nowrap}.sd-help__clear{border:0;background:transparent;color:#61729f;display:grid;place-items:center}.sd-help__results{display:block;margin:9px 8px 1px;color:#61729f;font-size:12px}
.sd-help__categories{display:grid;gap:12px}.sd-help__category{overflow:hidden;position:relative}.sd-help__category:before,.sd-help__contact:before{content:"";position:absolute;right:-22px;top:-75px;width:230px;height:135px;background:linear-gradient(135deg,transparent,#ddeeff88);border-radius:0 0 55% 55%;pointer-events:none}.sd-help__category--campaigns:before{background:linear-gradient(135deg,transparent,#efe7ffb5)}.sd-help__category--customization:before{background:linear-gradient(135deg,transparent,#d9fbf0c0)}.sd-help__category--billing:before{background:linear-gradient(135deg,transparent,#ffefdaba)}.sd-help__category--troubleshooting:before{background:linear-gradient(135deg,transparent,#e0eeff)}.sd-help__category-head{width:100%;display:flex;align-items:center;gap:20px;text-align:left;border:0;padding:12px 21px;background:transparent;position:relative;color:inherit;min-height:71px}.sd-help__category-head:hover{background:#f8fbff80}.sd-help__category-icon,.sd-help__quick-icon{width:54px;height:54px;flex-shrink:0;border-radius:14px;display:grid;place-items:center;color:#315aff;background:linear-gradient(135deg,#e0e9ff,#cfe2ff)}.sd-help__category--campaigns .sd-help__category-icon{background:#f1e4ff;color:#8242e7}.sd-help__category--customization .sd-help__category-icon{background:#dcfaed;color:#00b878}.sd-help__category--billing .sd-help__category-icon{background:#fff0db;color:#f99400}.sd-help__category--troubleshooting .sd-help__category-icon{background:#e3f0ff;color:#1977ed}.sd-help__category-name{display:flex;flex-direction:column;gap:4px;flex:1}.sd-help__category-title{font-weight:750;font-size:16px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}.sd-help__category-count{font-size:13px;color:#5e74a0}.sd-help__popular{font-size:12px;color:#006aff;background:#deefff;border-radius:20px;padding:5px 10px;font-weight:600}.sd-help__chevron{margin-left:auto;display:grid;place-items:center;color:#4468ba;transition:transform .2s}.sd-help__chevron.is-open{transform:rotate(90deg)}.sd-help__articles{margin:0 19px 12px;border:1px solid #e1eafa;border-radius:14px;padding:0 20px;background:#ffffffc7}.sd-help__article+.sd-help__article{border-top:1px solid #e8eef8}.sd-help__question{display:flex;align-items:center;gap:20px;text-align:left;width:100%;min-height:48px;background:transparent;border:0;color:#0d1a42;padding:10px 1px;font-size:14px}.sd-help__question:hover{color:#315aff}.sd-help__doc-icon{color:#4b98fc;display:grid;place-items:center;flex-shrink:0;width:35px}.sd-help__answer{padding:4px 38px 17px 55px;color:#50648b;font-size:13px;line-height:1.55}.sd-help__answer p{margin:0 0 8px}.sd-help__answer p:last-child{margin-bottom:0}.sd-help__empty{border-radius:15px;background:white;padding:25px;text-align:center;color:#152449}.sd-help__empty p{color:#6680aa}
.sd-help__quick-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.sd-help__quick{display:flex;align-items:center;gap:17px;padding:13px 20px;text-decoration:none;color:#111c40;transition:transform .2s,box-shadow .2s}.sd-help__quick:hover,.sd-help__contact-card:hover{transform:translateY(-2px);box-shadow:0 10px 30px #4269ac1c}.sd-help__quick>span:nth-child(2){display:flex;flex-direction:column;gap:4px;flex:1}.sd-help__quick strong{font-size:15px}.sd-help__quick small{font-size:13px;color:#5d73a3}.sd-help__quick>svg{color:#7b92c2}.sd-help__quick-icon--note{background:#e9eaff;color:#4155ff}.sd-help__quick-icon--bulb{background:#fff4e3;color:#f49600}
.sd-help__contact{margin-top:14px;padding:20px;position:relative;overflow:hidden}.sd-help__contact h2{font-size:18px;font-weight:800;letter-spacing:-.3px;position:relative;margin:0 0 5px}.sd-help__contact>p{margin:0 0 15px;color:#5c75a5;font-size:13px;position:relative}.sd-help__contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;position:relative}.sd-help__contact-card{border:1px solid #dae7fa;border-radius:14px;min-height:154px;background:#ffffffae;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:5px;text-decoration:none;color:#101b40;padding:12px;transition:transform .2s,box-shadow .2s,border-color .2s}.sd-help__contact-card:hover{border-color:#9cbeff}.sd-help__contact-icon{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:#dcfaed;color:#00ae72;margin-bottom:2px}.sd-help__contact-card--email .sd-help__contact-icon{background:#e4f0ff;color:#147cff}.sd-help__contact-card strong{font-size:14px}.sd-help__contact-card>span:not(.sd-help__contact-icon){font-size:13px;color:#657bad}.sd-help__contact-card em{font-size:12px;border-radius:30px;padding:7px 14px;background:#d3fae7;color:#00995c;font-style:normal;font-weight:650}.sd-help__contact-card--email em{background:#e0eeff;color:#0076f5}.sd-help__contact-card em span{margin-left:8px}.sd-help__notice{padding:12px 16px;border-radius:12px;background:#e2f8e9;color:#125932;margin:12px 0;display:flex;justify-content:space-between;align-items:center;font-size:13px}.sd-help__notice button{background:transparent;border:0;color:inherit}
@media(max-width:750px){.sd-help{padding:18px 12px 30px}.sd-help__header{gap:8px}.sd-help__intro h1{font-size:23px}.sd-help__intro p{font-size:12px;line-height:1.5}.sd-help__header-art{opacity:.18;right:-75px}.sd-help__category-head{padding:11px 13px;gap:12px}.sd-help__category-title{font-size:14px}.sd-help__category-icon,.sd-help__quick-icon{width:44px;height:44px;border-radius:12px}.sd-help__articles{margin:0 9px 10px;padding:0 10px}.sd-help__question{gap:8px;font-size:12px}.sd-help__doc-icon{width:24px}.sd-help__answer{padding:5px 8px 15px 31px}.sd-help__quick-links,.sd-help__contact-grid{grid-template-columns:1fr}.sd-help__contact{padding:15px}.sd-help__contact-card{min-height:145px}.sd-help__quick{padding:12px}.sd-help__search-box input{font-size:12px}.sd-help__search-box kbd{display:none}}
`;
