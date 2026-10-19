import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import {
  Page, Card, Text, BlockStack, InlineStack, Box, InlineGrid, Tabs, Badge, Icon,
} from "@shopify/polaris";
import { InfoIcon } from "@shopify/polaris-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

function WidgetCard({ title, description, tags, previewContent, onClick }: {
  title: string; description: string; tags: string[]; previewContent: React.ReactNode; onClick: () => void;
}) {
  return (
    <div
      className="ss-customization-index__div ss-cust__card"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Customize ${title}`}
      style={{ cursor: "pointer" }}
    >
      <div className="ss-cust__preview">{previewContent}</div>
      <div className="ss-cust__card-head">
        <div className="ss-cust__card-text">
          <h3 className="ss-cust__card-title">{title}</h3>
          <p className="ss-cust__card-desc">{description}</p>
        </div>
        <span className="ss-cust__info" title={description} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 9v4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="10" cy="6.4" r="1" fill="currentColor" />
          </svg>
        </span>
      </div>
      <div className="ss-cust__tags">
        {tags.map((tag, i) => <span key={i} className="ss-cust__tag">{tag}</span>)}
      </div>
    </div>
  );
}

function Swatches({ colors, label = "Style:" }: { colors: string[]; label?: string }) {
  return (
    <div className="ss-cust__swatches">
      <span className="ss-cust__muted-label">{label}</span>
      {colors.map((c, i) => (
        <span key={i} className="ss-cust__swatch" style={{ background: c }} />
      ))}
    </div>
  );
}

function CountdownPreview({ label, color }: { label: string; color: string }) {
  const tint = color === "#e53e3e" ? "linear-gradient(90deg, #FFF1F2, #FFE4E6)" : "#FFFFFF";
  return (
    <div className="ss-cust__stack">
      <Swatches colors={["#1F6FFF", "#0F172A"]} />
      <div className="ss-customization-index__div-row-2 ss-cust__countdown" style={{ background: tint }}>
        <div className="ss-cust__countdown-row">
          <span className="ss-customization-index__span ss-cust__countdown-label">🔥 {label} :</span>
          <div className="ss-customization-index__div-row-3 ss-cust__digits">
            {["01", "12", "23", "57"].map((n, i) => (
              <span className="ss-customization-index__div-2 ss-cust__digit" key={i} style={{ background: color === "#e53e3e" ? "#EF2B2B" : "#10B26C" }}>{n}</span>
            ))}
          </div>
        </div>
        <div className="ss-customization-index__div-row-4 ss-cust__units">
          {["Day", "Hrs", "Mins", "Secs"].map(u => <span className="ss-customization-index__span-2" key={u}>{u}</span>)}
        </div>
      </div>
      <div className="ss-cust__content-row">
        <span className="ss-cust__muted-label">Content:</span>
        <span className="ss-customization-index__div-sale-ends-in ss-cust__fake-input">Sale ends in</span>
      </div>
    </div>
  );
}

function QuantityTablePreview() {
  return (
    <div className="ss-cust__stack">
      <div className="ss-customization-index__div-buy-more-save ss-cust__panel">
        <div className="ss-customization-index__div-buy-more-save-2 ss-cust__panel-title">Buy more, Save more!</div>
        <div className="ss-customization-index__div-buy ss-cust__buyget">
          <span className="ss-customization-index__span-buy ss-cust__chip-green">Buy</span>
          <span className="ss-customization-index__span-get ss-cust__chip-orange">Get</span>
        </div>
        {[{ q: "1+", d: "$10" }, { q: "2+", d: "$15" }, { q: "5+", d: "$20" }].map((r, i) => (
          <div className="ss-customization-index__div-off-each ss-cust__tier" key={i}>
            <span className="ss-customization-index__span-3">{r.q}</span>
            <span className="ss-customization-index__span-off-each ss-cust__tier-off">{r.d} off each</span>
          </div>
        ))}
      </div>
      <Swatches colors={["#1F6FFF", "#0F172A"]} />
    </div>
  );
}

function SavingOnCartPreview() {
  return (
    <div className="ss-customization-index__div-saving ss-cust__saving">
      <div className="ss-customization-index__div-saving-2 ss-cust__saving-controls">
        <div className="ss-customization-index__div-saving-3 ss-cust__saving-control">
          <span className="ss-customization-index__span-saving">Subtotal</span>
          <span className="ss-cust__swatch" style={{ background: "#111827" }} />
        </div>
        <div className="ss-customization-index__div-border ss-cust__saving-control">
          <span className="ss-customization-index__span-border">Border :</span>
          <span className="ss-customization-index__span-0-3 ss-cust__tiny-muted">⟋</span>
          <span className="ss-cust__swatch" style={{ background: "#10B981" }} />
        </div>
      </div>
      <div className="ss-customization-index__div-90 ss-cust__panel ss-cust__saving-card">
        <div className="ss-customization-index__div-90-2 ss-cust__saving-top">$95</div>
        <div className="ss-customization-index__div-subtotal ss-cust__saving-line"><span className="ss-customization-index__span-subtotal">Subtotal</span><span className="ss-customization-index__span-100">$100</span></div>
        <div className="ss-customization-index__div-saving-4 ss-cust__saving-line ss-cust__saving-hl">
          <span className="ss-customization-index__span-saving-2">Saving</span><span className="ss-customization-index__span-10">$10</span>
        </div>
        <div className="ss-customization-index__div-total ss-cust__saving-line"><span className="ss-customization-index__span-total">Total</span><span className="ss-customization-index__span-90">$90</span></div>
      </div>
    </div>
  );
}

function BuyXGetYPopupPreview() {
  return (
    <div className="ss-customization-index__div-your-current-cart ss-cust__panel ss-cust__bxgy">
      <div className="ss-customization-index__div-your-current-cart-2 ss-cust__bxgy-title">Your current cart qualifies for these rewards</div>
      <div className="ss-customization-index__div-row-6 ss-cust__bxgy-items">
        {[1, 2, 3].map(i => (
          <div className="ss-customization-index__div-5 ss-cust__bxgy-item" key={i} style={i === 1 ? { background: "#FFF1F2" } : undefined}>
            {i === 1 && (
              <span className="ss-customization-index__div-pill ss-cust__bxgy-check">
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.2 2.2 4.8-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="ss-customization-index__div-discount-badge ss-cust__bxgy-labels">
        <span className="ss-customization-index__span-discount-badge">Discount badge</span>
        <span className="ss-customization-index__span-percentage">Percentage</span>
      </div>
    </div>
  );
}

function ShippingBarPreview() {
  return (
    <div className="ss-cust__stack">
      <Swatches colors={["#1F6FFF", "#0F172A"]} />
      <div className="ss-customization-index__div-you-re-25 ss-cust__panel">
        <div className="ss-customization-index__div-you-re-25-2 ss-cust__ship-title">You&rsquo;re $25 away from free shipping</div>
        <div className="ss-customization-index__div-6 ss-cust__ship-track">
          <div className="ss-customization-index__div-7 ss-cust__ship-fill" />
        </div>
        <div className="ss-customization-index__div-message ss-cust__ship-msg">
          <span className="ss-customization-index__span-message">Message:</span>
          <span className="ss-customization-index__span-you-re-25">You&rsquo;re $25 away!</span>
        </div>
      </div>
    </div>
  );
}

function FloatingButtonPreview() {
  return (
    <div className="ss-customization-index__div-row-8 ss-cust__fab-wrap">
      <div className="ss-customization-index__div-row-9 ss-cust__fab">
        <GiftIcon />
        <span className="ss-cust__fab-badge">3</span>
      </div>
      <div className="ss-customization-index__div-color-palette ss-cust__panel ss-cust__fab-panel">
        <div className="ss-customization-index__div-color-palette-2 ss-cust__fab-line">
          <span className="ss-customization-index__span-color-palette">Color palette:</span>
          <span className="ss-cust__swatch" style={{ background: "#10B981" }} />
          <span className="ss-cust__swatch" style={{ background: "#0F172A" }} />
        </div>
        <div className="ss-customization-index__div-position ss-cust__fab-line ss-cust__fab-line--sep">
          <span>Position:</span>
          <span className="ss-cust__fake-select">Bottom Right
            <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5l5 5 5-5" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function ShippingProtectionPreview() {
  return (
    <div className="ss-cust__stack">
      <div className="ss-customization-index__div-yes-add-shipping ss-cust__panel-title">Yes, add shipping insurance please!</div>
      <div className="ss-customization-index__div-shipping-insurance ss-cust__panel ss-cust__protect">
        <span className="ss-customization-index__div-box-7 ss-cust__protect-check" />
        <span className="ss-customization-index__div-10 ss-cust__protect-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6L12 3z" fill="none" stroke="#E11D48" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="ss-customization-index__div-shipping-insurance-2">
          <div className="ss-customization-index__div-shipping-insurance-3 ss-cust__protect-title">Shipping insurance</div>
          <div className="ss-customization-index__div-from-damage-loss ss-cust__protect-sub">from Damage, Loss &amp; Theft for $10.00</div>
        </div>
      </div>
      <Swatches colors={["#E11D74", "#C4C7CE"]} />
    </div>
  );
}

function DiscountCodeInputPreview() {
  return (
    <div className="ss-customization-index__div-have-a-discount ss-cust__panel ss-cust__code">
      <div className="ss-customization-index__div-have-a-discount-2 ss-cust__code-prompt">
        <TagIcon /> Have a discount code? Click here to enter it.
      </div>
      <div className="ss-customization-index__div-enter-discount-code ss-cust__code-row">
        <div className="ss-customization-index__div-enter-discount-code-2 ss-cust__code-input">Enter discount code</div>
        <div className="ss-customization-index__div-apply ss-cust__code-apply">Apply</div>
      </div>
    </div>
  );
}

function EmailPopupPreview() {
  return (
    <div className="ss-customization-index__div-get-your-discount ss-cust__email">
      <div className="ss-customization-index__div-get-your-discount-2 ss-cust__email-modal">
        <div className="ss-customization-index__div-get-your-discount-3 ss-cust__email-title">Get your discount code</div>
        <div className="ss-customization-index__div-enter-your-email ss-cust__email-sub">Enter your email to get the code.</div>
        <div className="ss-customization-index__div-you-email-com ss-cust__email-input">you@email.com</div>
        <div className="ss-customization-index__div-email-me-the ss-cust__email-btn">Send me the code</div>
      </div>
    </div>
  );
}

// Tabs shown in the "More views" dropdown instead of the main tab row.
const MORE_VIEW_TAB_IDS = ["advanced-discount-code"];

export default function Customization() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const tabs = [
    { id: "all", content: "All" },
    { id: "bulk-price", content: "Bulk price editor" },
    { id: "quantity-discount", content: "Quantity discount" },
    { id: "cart-goal", content: "Cart goal" },
    { id: "buy-x-get-y", content: "Buy X get Y" },
    { id: "shipping-discount", content: "Shipping discount" },
    { id: "advanced-discount-code", content: "Advanced discount code" },
    { id: "shipping-protection", content: "Shipping protection" },
  ];
  const handleTabChange = useCallback((i: number) => setSelectedTab(i), []);

  useEffect(() => {
    if (!moreOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [moreOpen]);

  const widgets = [
    { id: "countdown-start", title: "Starts in countdown timer", desc: "Set time style for starts in countdown timer.", tags: ["All types"], category: ["all", "bulk-price", "quantity-discount", "cart-goal"], preview: <CountdownPreview label="Sale starts in" color="#e53e3e" />, route: "/app/customization/countdown-start" },
    { id: "countdown-end", title: "Ends in countdown timer", desc: "Set time style for ends in countdown timer.", tags: ["All types"], category: ["all", "bulk-price", "quantity-discount", "cart-goal"], preview: <CountdownPreview label="Sale ends in" color="#059669" />, route: "/app/customization/countdown-end" },
    { id: "quantity-table", title: "Quantity/Value table", desc: "Change content and style of the tier table.", tags: ["Quantity discount", "Cart goal"], category: ["all", "quantity-discount", "cart-goal"], preview: <QuantityTablePreview />, route: "/app/customization/quantity-table" },
    { id: "bxgy-popup", title: "Buy X get Y pop-up", desc: "Change pop-up text, color and behaviour.", tags: ["Buy X get Y"], category: ["all", "buy-x-get-y"], preview: <BuyXGetYPopupPreview />, route: "/app/customization/bxgy-popup" },
    { id: "saving-cart", title: "Saving on cart", desc: 'Customize "Saving & Total" widget on cart.', tags: ["All types"], category: ["all", "bulk-price", "quantity-discount", "cart-goal", "buy-x-get-y"], preview: <SavingOnCartPreview />, route: "/app/customization/saving-cart" },
    { id: "bxgy-fab", title: "Buy X get Y Floating button", desc: "Customize FAB style shown after closing pop-up.", tags: ["Buy X get Y"], category: ["all", "buy-x-get-y"], preview: <FloatingButtonPreview />, route: "/app/customization/bxgy-fab" },
    { id: "shipping-bar", title: "Shipping progress bar", desc: "Change content and style of the progress bar.", tags: ["Shipping discount"], category: ["all", "shipping-discount"], preview: <ShippingBarPreview />, route: "/app/customization/shipping-bar" },
    { id: "discount-code-input", title: "Discount code input", desc: "Change the on-store discount code box text and style.", tags: ["Advanced discount code"], category: ["all", "advanced-discount-code"], preview: <DiscountCodeInputPreview />, route: "/app/customization/discount-code" },
    { id: "shipping-protection", title: "Shipping protection", desc: "Change the look of the protection opt-in card.", tags: ["Shipping protection"], category: ["all", "shipping-protection"], preview: <ShippingProtectionPreview />, route: "/app/customization/shipping-protection" },
    { id: "discount-popup", title: "Discount pop-up", desc: "Change the email pop-up colors and style.", tags: ["Advanced discount code"], category: ["all", "advanced-discount-code"], preview: <EmailPopupPreview />, route: "/app/customization/discount-popup" },
  ];

  const tabId = tabs[selectedTab].id;
  const filtered = widgets.filter(w => w.category.includes(tabId));

  const mainTabs = tabs.map((t, i) => ({ ...t, index: i })).filter(t => !MORE_VIEW_TAB_IDS.includes(t.id));
  const moreTabs = tabs.map((t, i) => ({ ...t, index: i })).filter(t => MORE_VIEW_TAB_IDS.includes(t.id));
  const moreSelected = moreTabs.some(t => t.index === selectedTab);

  return (
    <Page fullWidth>
      <style>{customizationStyles}</style>
      <div className="ss-cust">
        <div className="ss-cust__hero">
          <div className="ss-cust__hero-art" aria-hidden="true">
            <CartIllustration />
          </div>
          <div className="ss-cust__title-row">
            <button type="button" className="ss-cust__back" aria-label="Back to Home" onClick={() => navigate("/app")}>
              <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M12.5 4.5L7 10l5.5 5.5" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="ss-cust__title">Customization</h1>
          </div>
          <p className="ss-cust__subtitle">Choose a widget to customize its appearance or content.</p>
        </div>

        <div className="ss-cust__tabs" role="tablist">
          {mainTabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selectedTab === t.index}
              className={`ss-cust__tab${selectedTab === t.index ? " ss-cust__tab--active" : ""}`}
              onClick={() => handleTabChange(t.index)}
            >
              {t.content}
            </button>
          ))}
          {moreTabs.length > 0 && (
            <div className="ss-cust__more" ref={moreRef}>
              <button
                type="button"
                className={`ss-cust__tab ss-cust__tab--more${moreSelected ? " ss-cust__tab--active" : ""}`}
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen(o => !o)}
              >
                {moreSelected ? tabs[selectedTab].content : "More views"}
                <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {moreOpen && (
                <div className="ss-cust__more-menu" role="menu">
                  {moreTabs.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      role="menuitem"
                      className={`ss-cust__more-item${selectedTab === t.index ? " ss-cust__more-item--active" : ""}`}
                      onClick={() => { handleTabChange(t.index); setMoreOpen(false); }}
                    >
                      {t.content}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ss-cust__grid">
          {filtered.map(w => (
            <WidgetCard key={w.id} title={w.title} description={w.desc} tags={w.tags} previewContent={w.preview} onClick={() => navigate(w.route)} />
          ))}
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Customization page illustrations + styles                           */
/* ------------------------------------------------------------------ */

function GiftIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="12" width="22" height="16" rx="2" fill="#F59E0B" />
      <rect x="3.5" y="9" width="25" height="6" rx="1.5" fill="#FBBF24" />
      <rect x="14" y="9" width="4" height="19" fill="#DC2626" />
      <path d="M16 9c-2-5-8-6-8-2 0 2 4 2 8 2zM16 9c2-5 8-6 8-2 0 2-4 2-8 2z" fill="none" stroke="#DC2626" strokeWidth="2" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="ss-cust__tag-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 12.2V4.5a1 1 0 011-1h7.7l8.3 8.3a1.4 1.4 0 010 2l-6.2 6.2a1.4 1.4 0 01-2 0L3.5 12.2z" fill="#FDBA74" stroke="#C2410C" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.6" fill="#C2410C" />
    </svg>
  );
}

function CartIllustration() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 420 170" preserveAspectRatio="xMaxYMin meet">
      <defs>
        <linearGradient id="ssCustBlob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EAF0FF" />
          <stop offset="1" stopColor="#D3E0FF" />
        </linearGradient>
        <linearGradient id="ssCustCard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F86FF" />
          <stop offset="1" stopColor="#1F55EC" />
        </linearGradient>
        <linearGradient id="ssCustCart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7EA4FF" />
          <stop offset="1" stopColor="#3D6EF5" />
        </linearGradient>
      </defs>
      <path d="M40 170C70 110 140 80 210 86c80 7 110-50 170-70 20-7 32-6 40-4v158H40z" fill="url(#ssCustBlob)" />
      {/* cart */}
      <path d="M210 30h22l22 86h96l18-60" fill="none" stroke="url(#ssCustCart)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M240 56h132" stroke="#9DB7FF" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
      {/* card with % in cart */}
      <g transform="rotate(10 300 70)">
        <rect x="256" y="34" width="92" height="66" rx="10" fill="url(#ssCustCard)" />
        <text x="302" y="80" textAnchor="middle" fontSize="34" fontWeight="800" fill="#fff" fontFamily="inherit">%</text>
      </g>
      <circle cx="268" cy="140" r="11" fill="#2F62F5" />
      <circle cx="268" cy="140" r="4.5" fill="#fff" />
      <circle cx="338" cy="140" r="11" fill="#2F62F5" />
      <circle cx="338" cy="140" r="4.5" fill="#fff" />
      {/* % bubble */}
      <circle cx="220" cy="98" r="36" fill="#fff" />
      <circle cx="220" cy="98" r="36" fill="none" stroke="#E3EAFF" strokeWidth="2" />
      <text x="220" y="112" textAnchor="middle" fontSize="38" fontWeight="800" fill="#1F55EC" fontFamily="inherit">%</text>
      {/* accents */}
      <circle cx="200" cy="8" r="7" fill="#1F55EC" />
      <circle cx="356" cy="14" r="9" fill="none" stroke="#3D6EF5" strokeWidth="4" />
      <circle cx="166" cy="120" r="7" fill="#3D6EF5" />
      <circle cx="402" cy="126" r="10" fill="#C7D6FF" opacity="0.8" />
    </svg>
  );
}

const customizationStyles = `
.ss-cust {
  --cu-blue: #1F5EFF;
  --cu-ink: #0B1220;
  --cu-muted: #4B5563;
  --cu-line: #E8ECF3;
  color: var(--cu-ink);
  background:
    radial-gradient(900px 400px at 100% 0%, rgba(214, 226, 255, 0.55), transparent 60%),
    radial-gradient(700px 500px at 0% 70%, rgba(222, 232, 255, 0.5), transparent 60%),
    linear-gradient(180deg, #F4F7FE, #F6F8FC);
  border-radius: 20px;
  padding: 20px 0px 30px;
  position: relative;
  overflow: hidden;
}
  .Polaris-Page.Polaris-Page--fullWidth {
    background: linear-gradient(180deg, #F3F6FE 0%, #F6F8FC 30%, #F7F8FB 100%) !important;
    max-width: 1300px !important;
}
body {
    background: linear-gradient(180deg, #F3F6FE 0%, #F6F8FC 30%, #F7F8FB 100%) !important;
}
.ss-cust * { box-sizing: border-box; }
.ss-cust button { font-family: inherit; }

/* header */
.ss-cust__hero { position: relative; min-height: 120px; padding: 18px 0 8px; }
.ss-cust__hero-art { position: absolute; top: -20px; right: -22px; width: min(46%, 440px); height: 150px; pointer-events: none; }
.ss-cust__title-row { position: relative; display: flex; align-items: center; gap: 14px; }
.ss-cust__back { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; background: none; border-radius: 10px; cursor: pointer; }
.ss-cust__back:hover { background: rgba(15, 23, 42, 0.06); }
.ss-cust__title { margin: 0; font-size: clamp(24px, 3vw, 30px); font-weight: 800; letter-spacing: -0.02em; }
.ss-cust__subtitle { position: relative; margin: 10px 0 0 50px; font-size: 15px; color: #374151; }

/* tabs */
.ss-cust__tabs {
  position: relative; z-index: 2; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  background: #fff; border-radius: 12px; padding: 8px 10px; margin-top: 12px;
  box-shadow: 0 6px 22px rgba(15, 23, 42, 0.06);
}
.ss-cust__tab {
  display: inline-flex; align-items: center; gap: 6px; padding: 0 18px; min-height: 36px;
  border: 0; border-radius: 8px; background: none; cursor: pointer; font-size: 14px; color: #1F2937; white-space: nowrap;
}
.ss-cust__tab:hover { background: #F3F6FB; }
.ss-cust__tab--active, .ss-cust__tab--active:hover { background: #E3ECFF; color: var(--cu-blue); font-weight: 600; }
.ss-cust__more { position: relative; }
.ss-cust__more-menu {
  position: absolute; left: 0; top: calc(100% + 6px); z-index: 30; min-width: 220px; padding: 6px;
  background: #fff; border-radius: 10px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
}
.ss-cust__more-item { display: block; width: 100%; text-align: left; padding: 9px 12px; border: 0; background: none; border-radius: 7px; font-size: 14px; cursor: pointer; color: var(--cu-ink); }
.ss-cust__more-item:hover { background: #F3F6FF; }
.ss-cust__more-item--active { color: var(--cu-blue); font-weight: 600; }

/* grid + cards */
.ss-cust__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 20px; align-items: stretch; }
.ss-cust__card {
  background: #fff; border-radius: 14px; padding: 14px 14px 16px; min-width: 0;
  box-shadow: 0 6px 22px rgba(15, 23, 42, 0.06); border: 1px solid transparent;
  transition: box-shadow .15s ease, transform .15s ease, border-color .15s ease;
}
.ss-cust__card:hover { box-shadow: 0 12px 30px rgba(31, 94, 255, 0.12); transform: translateY(-2px); border-color: #DCE6FF; }
.ss-cust__card:focus-visible { outline: 2px solid var(--cu-blue); outline-offset: 2px; }
.ss-cust__preview { background: #F5F7FB; border-radius: 10px; padding: 12px 14px; min-height: 130px; font-size: 12px; color: #1F2937; }
.ss-cust__card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-top: 14px; padding: 0 4px; }
.ss-cust__card-text { min-width: 0; }
.ss-cust__card-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--cu-ink); }
.ss-cust__card-desc { margin: 6px 0 0; font-size: 13px; line-height: 1.5; color: var(--cu-muted); }
.ss-cust__info { flex-shrink: 0; color: #6B7280; margin-top: 2px; }
.ss-cust__tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; padding: 0 4px; }
.ss-cust__tag { display: inline-block; padding: 5px 12px; border-radius: 8px; background: #E5EDFF; color: #1D4ED8; font-size: 13px; font-weight: 500; }

/* preview building blocks */
.ss-cust__stack { display: flex; flex-direction: column; gap: 10px; }
.ss-cust__panel { background: #fff; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 12px; }
.ss-cust__panel-title { font-weight: 700; font-size: 12px; }
.ss-cust__muted-label { font-size: 13px; color: #374151; }
.ss-cust__swatches { display: flex; align-items: center; gap: 6px; }
.ss-cust__swatches .ss-cust__muted-label { margin-right: 8px; }
.ss-cust__swatch { display: inline-block; width: 15px; height: 15px; border-radius: 3px; }
.ss-cust__tiny-muted { font-size: 10px; color: #9CA3AF; }

.ss-cust__countdown { border-radius: 8px; padding: 10px 12px 6px; border: 1px solid #EEF0F4; }
.ss-cust__countdown-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ss-cust__countdown-label { font-size: 12px; font-weight: 600; white-space: nowrap; }
.ss-cust__digits { display: flex; gap: 6px; }
.ss-cust__digit { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; border-radius: 5px; color: #fff; font-weight: 700; font-size: 13px; }
.ss-cust__units { display: flex; justify-content: flex-end; gap: 0; margin-top: 6px; }
.ss-cust__units span { width: 34px; text-align: center; font-size: 10px; color: #6B7280; }
.ss-cust__content-row { display: flex; align-items: center; gap: 12px; }
.ss-cust__fake-input { display: inline-block; padding: 5px 10px; border-radius: 4px; background: #EEF0F4; color: #6B7280; font-size: 11px; min-width: 100px; }

.ss-cust__buyget { display: flex; gap: 4px; margin: 8px 0 6px; }
.ss-cust__chip-green, .ss-cust__chip-orange { color: #fff; padding: 3px 9px; border-radius: 4px; font-weight: 700; font-size: 11px; }
.ss-cust__chip-green { background: #10B26C; }
.ss-cust__chip-orange { background: #F97316; }
.ss-cust__tier { display: flex; justify-content: space-between; padding: 5px 6px; font-size: 11px; border-radius: 3px; }
.ss-cust__tier:nth-child(odd) { background: #F6F7F9; }
.ss-cust__tier-off { color: #10B26C; font-weight: 700; }

.ss-cust__saving { display: flex; gap: 14px; align-items: flex-start; }
.ss-cust__saving-controls { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; font-size: 12px; }
.ss-cust__saving-control { display: flex; align-items: center; gap: 8px; }
.ss-cust__saving-card { flex: 1; max-width: 150px; margin-left: auto; font-size: 11px; display: flex; flex-direction: column; gap: 6px; }
.ss-cust__saving-top { text-align: right; }
.ss-cust__saving-line { display: flex; justify-content: space-between; }
.ss-cust__saving-hl { border: 1px solid #10B981; background: #ECFDF5; border-radius: 4px; padding: 3px 6px; color: #059669; font-weight: 700; }

.ss-cust__bxgy-title { font-size: 11px; font-weight: 600; margin-bottom: 10px; }
.ss-cust__bxgy-items { display: flex; gap: 8px; }
.ss-cust__bxgy-item { position: relative; width: 40px; height: 40px; border-radius: 4px; background: #F3F4F6; }
.ss-cust__bxgy-check { position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%; background: #EF4444; display: flex; align-items: center; justify-content: center; }
.ss-cust__bxgy-labels { display: flex; gap: 12px; margin-top: 8px; font-size: 10px; color: #6B7280; }

.ss-cust__ship-title { font-weight: 700; font-size: 12px; margin-bottom: 8px; }
.ss-cust__ship-track { background: #E5E7EB; border-radius: 999px; height: 9px; overflow: hidden; margin-bottom: 8px; }
.ss-cust__ship-fill { width: 70%; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #1F5EFF, #3B82F6); }
.ss-cust__ship-msg { display: flex; gap: 8px; font-size: 10px; color: #6B7280; }

.ss-cust__fab-wrap { display: flex; align-items: center; gap: 18px; padding: 8px 0; }
.ss-cust__fab { position: relative; flex-shrink: 0; width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, #22C55E, #059669); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(5, 150, 105, 0.3); }
.ss-cust__fab-badge { position: absolute; top: -7px; right: -7px; width: 20px; height: 20px; border-radius: 50%; background: #EF4444; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
.ss-cust__fab-panel { flex: 1; padding: 0; font-size: 11px; }
.ss-cust__fab-line { display: flex; align-items: center; gap: 8px; padding: 9px 10px; }
.ss-cust__fab-line--sep { border-top: 1px solid #EEF0F4; justify-content: space-between; }
.ss-cust__fake-select { display: inline-flex; align-items: center; gap: 6px; }

.ss-cust__protect { display: flex; align-items: center; gap: 10px; }
.ss-cust__protect-check { flex-shrink: 0; width: 14px; height: 14px; border-radius: 3px; border: 2px solid #E11D48; }
.ss-cust__protect-icon { flex-shrink: 0; display: inline-flex; }
.ss-cust__protect-title { font-size: 12px; font-weight: 700; }
.ss-cust__protect-sub { font-size: 10px; color: #6B7280; margin-top: 3px; }

.ss-cust__code { padding: 0; overflow: hidden; }
.ss-cust__code-prompt { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; font-size: 11px; text-align: center; }
.ss-cust__tag-icon { flex-shrink: 0; }
.ss-cust__code-row { display: flex; gap: 8px; align-items: center; padding: 10px; border-top: 1px solid #EEF0F4; }
.ss-cust__code-input { flex: 1; border: 1px solid #D1D5DB; border-radius: 4px; padding: 8px; font-size: 10px; color: #9CA3AF; }
.ss-cust__code-apply { background: #111; color: #fff; border-radius: 4px; padding: 8px 14px; font-size: 11px; font-weight: 700; }

.ss-cust__email { background: #8C8F96; border-radius: 6px; padding: 10px; display: flex; justify-content: center; margin: -2px; }
.ss-cust__email-modal { background: #fff; border-radius: 6px; padding: 10px 12px; width: 150px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2); }
.ss-cust__email-title { font-size: 10px; font-weight: 700; margin-bottom: 4px; text-align: center; }
.ss-cust__email-sub { font-size: 8px; color: #6B7280; margin-bottom: 8px; text-align: center; }
.ss-cust__email-input { border: 1px solid #D1D5DB; border-radius: 3px; padding: 5px; font-size: 8px; color: #9CA3AF; margin-bottom: 6px; }
.ss-cust__email-btn { background: #111; color: #fff; border-radius: 3px; padding: 5px; font-size: 8px; font-weight: 700; text-align: center; }

/* responsive */
@media (max-width: 1100px) {
  .ss-cust__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ss-cust__hero-art { opacity: .6; }
}
@media (max-width: 700px) {
  .ss-cust { padding: 14px 10px 22px; }
  .ss-cust__hero-art { width: 60%; right: 0; opacity: .35; }
  .ss-cust__subtitle { margin-left: 0; }
  .ss-cust__tabs { flex-wrap: nowrap; overflow-x: auto; }
  .ss-cust__more-menu { position: fixed; left: 16px; right: 16px; top: auto; }
  .ss-cust__grid { grid-template-columns: minmax(0, 1fr); }
}
`;
