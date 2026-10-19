import { useState, useEffect } from "react";
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { PLANS, type PlanId } from "../plan-definitions";

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { authenticate } = await import("../shopify.server");
  const { syncSubscriptionFromShopify } = await import("../billing.server");

  const { admin, session } = await authenticate.admin(request);

  let planId: PlanId | null = null;
  try {
    const result = await syncSubscriptionFromShopify(admin, session.shop);
    planId = result.planId;
  } catch (err) {
    console.error("[plans loader] subscription sync failed:", err);
  }

  const appHandle = process.env.SHOPIFY_APP_HANDLE ?? "";
  const storeHandle = session.shop.replace(/\.myshopify\.com$/, "");
  const managedPricingUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

  return json({
    hasActivePlan: planId !== null,
    activePlanId: planId,
    managedPricingUrl,
  });
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { authenticate } = await import("../shopify.server");
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const planId = formData.get("planId") as string;

  if (!PLANS[planId as PlanId]) {
    return json({ error: "Invalid plan selected", redirectUrl: null }, { status: 400 });
  }

  const appHandle = process.env.SHOPIFY_APP_HANDLE ?? "";
  const storeHandle = session.shop.replace(/\.myshopify\.com$/, "");
  const redirectUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

  return json({ redirectUrl, error: null });
};

// ─── Plans Page ───────────────────────────────────────────────────────────────

const TRIAL_DAYS = 7;

type IconName = "bag" | "bolt" | "crown" | "card" | "refresh" | "shield" | "support";

function PlanIcon({ name }: { name: IconName }) {
  const shared = { width: 30, height: 30, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "bag") return <svg {...shared}><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>;
  if (name === "bolt") return <svg {...shared} fill="currentColor" stroke="none"><path d="m13.4 1-9 12h6.4L9.9 23l10-13h-6.6L13.4 1Z"/></svg>;
  if (name === "crown") return <svg {...shared}><path d="m2 7 5 5 5-7 5 7 5-5-2 12H4L2 7Z"/><path d="M5 22h14"/></svg>;
  if (name === "card") return <svg {...shared}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>;
  if (name === "refresh") return <svg {...shared}><path d="M20 11a8 8 0 0 0-14-5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14 5l2-2"/><path d="M15 16h5v5"/></svg>;
  if (name === "shield") return <svg {...shared}><path d="m12 2 9 4v6c0 6-4.5 9-9 10-4.5-1-9-4-9-10V6l9-4Z"/><path d="m8 12 3 3 5-6"/></svg>;
  return <svg {...shared}><path d="M3 13v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="12" width="4" height="7" rx="2"/><rect x="18" y="12" width="4" height="7" rx="2"/><path d="M20 19a5 5 0 0 1-5 3h-3"/></svg>;
}

const planDescriptions = [
  "Perfect for small stores getting started with discounts and promotions.",
  "Best for growing businesses with advanced discount and marketing tools.",
  "For high-volume stores that need unlimited discounts and full control.",
];

export default function PlansPage() {
  const { hasActivePlan, activePlanId, managedPricingUrl } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState<string | null>(activePlanId ?? null);
  const fetcher = useFetcher<{ redirectUrl: string | null; error: string | null }>();
  const planList = Object.values(PLANS);
  const selectedPlan = planList.find((p) => p.id === selected);
  const isSubmitting = fetcher.state !== "idle";

  // Existing billing flow deliberately preserved. Never compute a fake yearly rate.
  useEffect(() => {
    if (fetcher.data?.redirectUrl) {
      window.open(fetcher.data.redirectUrl, "_top");
    }
  }, [fetcher.data]);

  function handleActivate() {
    if (!selected) return;
    fetcher.submit({ planId: selected }, { method: "POST", action: "/app/plans" });
  }

  return (
    <div className="ss-pricing-page">
      <style>{`
        .ss-pricing-page{    background: radial-gradient(ellipse at 76% 3%, rgba(151, 190, 255, .28) 0, rgba(151, 190, 255, 0) 30%), radial-gradient(ellipse at 87% 100%, rgba(173, 201, 255, .24) 0, rgba(173, 201, 255, 0) 28%), linear-gradient(135deg, #f4f8ff 0%, #edf5ff 52%, #f8fbff 100%);min-height:100vh;padding:28px 24px 36px;color:#090e27;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .ss-pricing-page *{box-sizing:border-box}
        .ss-pricing-wrap{max-width:1210px;margin:0 auto}
        .ss-pricing-top{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:36px}
        .ss-pricing-eyebrow{font-size:14px;letter-spacing:.01em;font-weight:800;color:#0b4bf0;margin-bottom:8px}
        .ss-pricing-title{margin:0 0 4px;font-size:clamp(27px,3vw,38px);font-weight:850;line-height:1.13;letter-spacing:-.045em;color:#070c23}
        .ss-pricing-subtitle{font-size:19px;line-height:1.5;color:#666b7e;margin:0 0 12px}
        .ss-pricing-notice{display:inline-flex;align-items:center;gap:10px;background:#fff5ce;border:1px solid #ffa900;padding:12px 22px;border-radius:13px;color:#a84c00;font-size:15px;line-height:1.4}
        .ss-pricing-gift{font-size:23px;line-height:1}
        .ss-pricing-billing{display:flex;gap:18px;align-items:center;white-space:nowrap;margin-bottom:17px;font-size:15px;font-weight:700;color:#707487}
        .ss-pricing-monthly{color:#0b4bf0}
        .ss-pricing-switch{width:57px;height:32px;border:0;border-radius:99px;background:#0b4bf0;padding:4px;display:flex;align-items:center;justify-content:flex-end;cursor:not-allowed;opacity:1}
        .ss-pricing-switch span{width:25px;height:25px;border-radius:50%;background:white;box-shadow:0 2px 5px #1112}
        .ss-pricing-save{font-size:12px;color:#009762;background:#dff7ed;border-radius:99px;padding:10px 15px}
        .ss-pricing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
        .ss-pricing-card{--accent:#5550ff;--tint:#efedff;position:relative;display:flex;flex-direction:column;min-height:640px;overflow:visible;background:#fff;border:1.5px solid #edf0f4;border-radius:22px;padding:22px 28px 24px;transition:box-shadow .25s,transform .25s,border-color .25s;outline:none}
        .ss-pricing-card:hover{transform:translateY(-5px);box-shadow:0 18px 48px #1a245217}
        .ss-pricing-card:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
        .ss-pricing-card[data-tier="0"]{--accent:#554cff;--tint:#fff0d8}
        .ss-pricing-card[data-tier="1"]{--accent:#554cff;--tint:#eceaff;border-color:#c9c6ff}
        .ss-pricing-card[data-tier="2"]{--accent:#009f63;--tint:#dff7ed}
        .ss-pricing-card.is-selected{border-color:var(--accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 15%,transparent)}
        .ss-pricing-card:before{content:"";pointer-events:none;position:absolute;top:0;right:0;width:56%;height:82px;background:var(--tint);border-radius:0 20px 0 100%;opacity:.5}
        .ss-pricing-card-main{position:relative;z-index:1;flex:1;display:flex;flex-direction:column}
        .ss-pricing-icon{width:64px;height:64px;border-radius:20px;background:var(--tint);color:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 0 14px}
        .ss-pricing-card[data-tier="0"] .ss-pricing-icon{color:#e78b00}
        .ss-pricing-planname{margin:0;font-size:15px;font-weight:800;letter-spacing:.025em;color:#686c7c;text-transform:uppercase}
        .ss-pricing-price{display:flex;align-items:baseline;gap:6px;margin-top:2px;margin-bottom:5px}
        .ss-pricing-price strong{font-size:clamp(34px,3vw,46px);font-weight:850;letter-spacing:-.065em;line-height:1.1;color:#070c23}
        .ss-pricing-price span{color:#9297a9;font-size:16px}
        .ss-pricing-trial{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:99px;background:#fff2bf;color:#b24e00;font-size:14px;font-weight:700;margin-bottom:9px}
        .ss-pricing-description{min-height:49px;margin:0 0 15px;font-size:16px;line-height:1.45;color:#404761}
        .ss-pricing-rule{height:1px;background:#e7e9f0;margin-bottom:18px}
        .ss-pricing-features{display:flex;flex-direction:column;gap:14px;padding:0;margin:0 0 22px;list-style:none}
        .ss-pricing-features li{display:flex;gap:18px;align-items:flex-start;font-size:15px;line-height:1.4;color:#303958}
        .ss-pricing-check{flex:none;color:#0b4bf0;font-size:22px;line-height:19px;font-weight:700}
        .ss-pricing-popular{position:absolute;z-index:3;left:50%;top:-16px;transform:translateX(-50%);border-radius:99px;background:#0b4bf0;color:white;padding:8px 21px;font-size:13px;font-weight:800;white-space:nowrap;box-shadow:0 4px 12px #554cff33}
        .ss-pricing-current{position:absolute;right:22px;top:28px;z-index:3;background:#e4f6ed;color:#008555;border-radius:99px;padding:5px 10px;font-size:11px;font-weight:800}
        .ss-pricing-card-button{position:relative;z-index:1;width:100%;border:1.5px solid #0b4bf0;background:color-mix(in srgb,var(--tint) 47%,white);color:var(--accent);border-radius:15px;padding:15px 10px;font-size:17px;font-weight:800;cursor:pointer;transition:transform .2s,box-shadow .2s,background .2s}
        .ss-pricing-card-button:hover{transform:translateY(-2px);box-shadow:0 8px 20px #2b2c4020}
        .ss-pricing-card[data-tier="1"] .ss-pricing-card-button{background:#0b4bf0;color:white}
        .ss-pricing-card-button[aria-pressed="true"]{box-shadow:inset 0 0 0 1px var(--accent)}
        .ss-pricing-card-button:disabled{cursor:default;opacity:.7}
        .ss-pricing-trust{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#fff;border-radius:20px;padding:20px 22px;margin-top:27px;gap:0}
        .ss-pricing-trust-item{display:flex;align-items:center;gap:16px;padding:0 20px;border-right:1px solid #e6e8ef}
        .ss-pricing-trust-item:first-child{padding-left:0}.ss-pricing-trust-item:last-child{border-right:0;padding-right:0}
        .ss-pricing-trust-icon{flex:none;width:54px;height:54px;display:flex;align-items:center;justify-content:center;border-radius:18px;color:#0b4bf0;background:#f0efff}
        .ss-pricing-trust-item strong{display:block;font-size:14px;color:#111629;margin-bottom:4px}
        .ss-pricing-trust-item small{display:block;color:#6d7284;font-size:12px;line-height:1.4}
        .ss-pricing-footer{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-top:22px;padding:18px 6px;border-top:1px solid #e5e7ed}
        .ss-pricing-footer-note{color:#767d90;font-size:13px;line-height:1.7}
        .ss-pricing-footer-note p{margin:0}
        .plans-cta{border:0;border-radius:99px;min-width:230px;padding:15px 26px;color:white;background:#0b4bf0;font-size:15px;font-weight:800;cursor:pointer;transition:transform .2s,box-shadow .2s}
        .plans-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 25px #0b4bf040}
        .plans-cta:disabled{opacity:.45;cursor:not-allowed}
        .ss-pricing-error{margin-top:10px;color:#b42318;font-size:13px}
        @media(max-width:1050px){.ss-pricing-card{padding:22px 20px;min-height:610px}.ss-pricing-grid{gap:14px}.ss-pricing-trust-item{padding:0 12px;gap:9px}.ss-pricing-trust-icon{width:44px;height:44px}}
        /* iPads in portrait: one centred column instead of three ~230px cards. */
        @media(max-width:900px){.ss-pricing-grid{grid-template-columns:1fr;gap:27px;max-width:560px;margin-inline:auto}.ss-pricing-card{min-height:0}.ss-pricing-description{min-height:0}}
        @media(max-width:780px){.ss-pricing-top{align-items:flex-start;flex-direction:column;gap:10px}.ss-pricing-billing{margin:0}.ss-pricing-grid{grid-template-columns:1fr;gap:27px}.ss-pricing-card{min-height:0}.ss-pricing-description{min-height:0}.ss-pricing-card-main{min-height:375px}.ss-pricing-trust{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.ss-pricing-trust-item{border-right:0;padding:0}.ss-pricing-footer{align-items:stretch;flex-direction:column}.plans-cta{width:100%}}
        @media(max-width:480px){.ss-pricing-page{padding:24px 14px}.ss-pricing-title{font-size:29px}.ss-pricing-subtitle{font-size:16px}.ss-pricing-notice{font-size:12px;padding:10px}.ss-pricing-billing{gap:10px;flex-wrap:wrap}.ss-pricing-save{padding:7px 10px}.ss-pricing-trust{grid-template-columns:1fr}.ss-pricing-card-main{min-height:0}.ss-pricing-features{margin-bottom:35px}}
      `}</style>
      <div className="ss-pricing-wrap">
        <div className="ss-pricing-top">
          <div>
            <div className="ss-pricing-eyebrow">PLANS &amp; BILLING</div>
            <h1 className="ss-pricing-title">Choose the right plan for your business</h1>
            <p className="ss-pricing-subtitle">Start your 7-day free trial. Upgrade, downgrade or cancel anytime.</p>
            {!hasActivePlan && <div className="ss-pricing-notice"><span className="ss-pricing-gift">🎁</span><span>All plans include a <strong>{TRIAL_DAYS}-day free trial</strong> — no charges until your trial ends.</span></div>}
          </div>
          {/* Yearly is intentionally disabled until a real yearly Shopify billing plan exists. */}
          <div className="ss-pricing-billing" aria-label="Monthly billing only; yearly billing not available">
            <span className="ss-pricing-monthly">Monthly</span>
            <button className="ss-pricing-switch" type="button" disabled title="Yearly billing is not configured yet" aria-label="Monthly billing enabled, yearly unavailable"><span /></button>
            <span title="Yearly billing is not configured yet">Yearly</span>
            <span className="ss-pricing-save" title="Available only when yearly billing is configured">Save up to 20%</span>
          </div>
        </div>

        {hasActivePlan && activePlanId && <div className="ss-pricing-notice" style={{marginBottom:25,background:"#e9f8ef",borderColor:"#78ce9f",color:"#086b43"}}>✓ Active plan: <strong>{PLANS[activePlanId]?.name}</strong>. Managed through Shopify billing.</div>}

        <div className="ss-pricing-grid" role="radiogroup" aria-label="Subscription plans">
          {planList.map((plan, index) => {
            const isSelected = selected === plan.id;
            const isActive = activePlanId === plan.id;
            return (
              <article className={`ss-pricing-card${isSelected ? " is-selected" : ""}`} data-tier={Math.min(index,2)} key={plan.id}>
                {plan.badge && <div className="ss-pricing-popular">{plan.badge}</div>}
                {isActive && <div className="ss-pricing-current">CURRENT</div>}
                <div className="ss-pricing-card-main">
                  <div className="ss-pricing-icon"><PlanIcon name={index === 0 ? "bag" : index === 1 ? "bolt" : "crown"}/></div>
                  <h2 className="ss-pricing-planname">{plan.name}</h2>
                  <div className="ss-pricing-price"><strong>${plan.price.toFixed(2)}</strong><span>/month</span></div>
                  {!isActive && <div className="ss-pricing-trial"><span>🎁</span>{TRIAL_DAYS}-day free trial</div>}
                  <p className="ss-pricing-description">{planDescriptions[index] ?? "Find the right fit for your business."}</p>
                  <div className="ss-pricing-rule"/>
                  <ul className="ss-pricing-features">{plan.features.map((feature) => <li key={feature}><span className="ss-pricing-check" aria-hidden="true">✓</span><span>{feature}</span></li>)}</ul>
                </div>
                <button type="button" className="ss-pricing-card-button" role="radio" aria-checked={isSelected} aria-pressed={isSelected} onClick={() => setSelected(plan.id)}>{isActive ? "Current Plan" : `Select ${plan.name}`}</button>
              </article>
            );
          })}
        </div>

        <div className="ss-pricing-trust">
          <div className="ss-pricing-trust-item"><div className="ss-pricing-trust-icon"><PlanIcon name="card"/></div><div><strong>Secure billing</strong><small>Billed securely through Shopify</small></div></div>
          <div className="ss-pricing-trust-item"><div className="ss-pricing-trust-icon"><PlanIcon name="refresh"/></div><div><strong>Cancel anytime</strong><small>No long-term contracts</small></div></div>
          <div className="ss-pricing-trust-item"><div className="ss-pricing-trust-icon"><PlanIcon name="shield"/></div><div><strong>7-day free trial</strong><small>No charges until your trial ends</small></div></div>
          <div className="ss-pricing-trust-item"><div className="ss-pricing-trust-icon"><PlanIcon name="support"/></div><div><strong>Dedicated support</strong><small>We're here to help you grow</small></div></div>
        </div>

        {/* KEEP EXISTING SELECT-THEN-ACTIVATE BILLING FUNCTIONALITY */}
        <div className="ss-pricing-footer">
          <div className="ss-pricing-footer-note">
            <p>🔒 Billed securely through Shopify · Cancel any time</p>
            {selectedPlan && !hasActivePlan && <p>Then ${selectedPlan.price.toFixed(2)}/month after {TRIAL_DAYS}-day trial</p>}
            {fetcher.data?.error && <p className="ss-pricing-error" role="alert">{fetcher.data.error}</p>}
          </div>
          <button className="plans-cta" disabled={!selected || isSubmitting || (hasActivePlan && selected === activePlanId)} onClick={handleActivate}>
            {isSubmitting ? "Redirecting to Shopify…" : hasActivePlan && selected === activePlanId ? "Current plan" : selectedPlan ? hasActivePlan ? `Switch to ${selectedPlan.name} — $${selectedPlan.price.toFixed(2)}/mo` : `Start ${TRIAL_DAYS}-Day Free Trial` : "Select a plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
