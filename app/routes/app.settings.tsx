import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { useState, useCallback, type ReactNode } from "react";
import { authenticate } from "../shopify.server";
import { useIsSaving } from "../lib/useIsSaving";

// Existing backend contracts preserved. Replace TODO implementations with your DB logic when ready.
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
  // TODO: Save settings to database (original action currently does not persist changes)
  return json({ success: true });
};

type IconName = "cart" | "layers" | "eye" | "code" | "save" | "back" | "check" | "chevron";
function SettingsIcon({ name, size = 26 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (name) {
    case "cart": return <svg {...common}><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M2 3h2l2.5 12h13l2-9H5"/></svg>;
    case "layers": return <svg {...common}><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>;
    case "eye": return <svg {...common}><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case "code": return <svg {...common}><path d="m8 5-7 7 7 7M16 5l7 7-7 7M14 3l-4 18"/></svg>;
    case "save": return <svg {...common}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v6h8V3"/></svg>;
    case "back": return <svg {...common}><path d="m12 19-7-7 7-7M5 12h16"/></svg>;
    case "check": return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
    case "chevron": return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
  }
}

function SettingCheckbox({ checked, onChange, title, description }: { checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
  return (
    <label className="ss-settings__check-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="ss-settings__native-check" />
      <span className="ss-settings__custom-check"><SettingsIcon name="check" size={17}/></span>
      <span className="ss-settings__check-copy"><span className="ss-settings__check-title">{title}</span><span className="ss-settings__check-help">{description}</span></span>
    </label>
  );
}

function SettingsSection({ name, subtitle, icon, tone, children }: { name: string; subtitle: string; icon: IconName; tone: "blue" | "mint" | "amber" | "violet"; children: ReactNode }) {
  return (
    <section className={`ss-settings__section ss-settings__section--${tone}`}>
      <div className="ss-settings__section-head">
        <span className="ss-settings__section-icon"><SettingsIcon name={icon} size={29} /></span>
        <div><h2>{name}</h2><p>{subtitle}</p></div>
      </div>
      <div className="ss-settings__section-body">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const [roundPrices, setRoundPrices] = useState(settings.roundPrices);
  const [roundingMethod, setRoundingMethod] = useState(settings.roundingMethod);
  const [showCompareAtPrice, setShowCompareAtPrice] = useState(settings.showCompareAtPrice);
  const [stackDiscounts, setStackDiscounts] = useState(settings.stackDiscounts);
  const [displaySavings, setDisplaySavings] = useState(settings.displaySavings);
  const [savingsFormat, setSavingsFormat] = useState(settings.savingsFormat);
  const [excludeSaleProducts, setExcludeSaleProducts] = useState(settings.excludeSaleProducts);
  const [customCss, setCustomCss] = useState(settings.customCss);
  const [saved, setSaved] = useState(false);
  const isSaving = useIsSaving();

  const handleSave = useCallback(() => {
    if (isSaving) return;
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
  }, [isSaving, roundPrices, roundingMethod, showCompareAtPrice, stackDiscounts, displaySavings, savingsFormat, excludeSaleProducts, customCss, submit]);

  return <div className="ss-settings">
    <style>{`
      .ss-settings, .ss-settings * { box-sizing: border-box; }
      .ss-settings { min-height: 100vh; padding: 20px 24px 46px; background: radial-gradient(ellipse 55% 35% at 87% 0%,#dfecff 0%,transparent 100%),linear-gradient(145deg,#f9fcff 0%,#eef5ff 100%); color:#091633; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .ss-settings__wrap { max-width: 1080px; margin: 0 auto; }
      .ss-settings__top { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:20px; }
      .ss-settings__heading-group { display:flex; align-items:center; gap:22px; }
      .ss-settings__back { display:grid; place-items:center; width:35px;height:35px; padding:0; border:0; background:none; cursor:pointer; color:#6b85b4; text-decoration:none; border-radius:9px; transition:background .2s; }
      .ss-settings__back:hover { background:#e3edff; }
      .ss-settings__title { font-size:29px; letter-spacing:-1.1px; margin:0 0 2px; font-weight:800; line-height:1.2; }
      .ss-settings__intro { margin:0; font-size:14px; color:#58729b; }
      .ss-settings__save { display:inline-flex; align-items:center; justify-content:center; gap:10px; background:#0b4bf0; color:white; padding:14px 23px; border:0; border-radius:11px; box-shadow:0 9px 21px #5c66ff22; font-family:inherit; font-size:15px; font-weight:700; cursor:pointer; white-space:nowrap; transition:background .2s,transform .2s,box-shadow .2s; }
      .ss-settings__save:hover:not(:disabled) { background:#3e3ae8; transform:translateY(-2px); box-shadow:0 12px 24px #5c66ff36; }
      .ss-settings__save:disabled { cursor:wait; opacity:.6; }
      .ss-settings__alert { background:#e8f9ef; border:1px solid #9fe0b5; color:#126e3e; padding:12px 16px; border-radius:10px; margin-bottom:14px; display:flex; justify-content:space-between; gap:12px; align-items:center; font-size:14px; }
      .ss-settings__alert button { background:none; border:0; color:inherit; font-size:20px; cursor:pointer; }
      .ss-settings__sections { display:grid; gap:16px; }
      .ss-settings__section { position:relative; overflow:hidden; isolation:isolate; border-radius:18px; padding:13px 14px 12px; background:#ffffffef; box-shadow:0 8px 36px #759aca0c; border:1px solid #fff; }
      .ss-settings__section::before { content:""; position:absolute; z-index:-1; top:-75px; right:-38px; width:305px; height:140px; border-radius:0 0 50% 50%; transform:rotate(16deg); background:var(--ss-wave); }
      .ss-settings__section::after { content:""; position:absolute; z-index:-1; top:-55px; right:-130px; width:240px; height:145px; border-radius:50%; background:var(--ss-wave-2); }
      .ss-settings__section--blue { --ss-accent:#494cff;--ss-tile:#e9eaff;--ss-wave:#eff5ff;--ss-wave-2:#e5efff; }
      .ss-settings__section--mint { --ss-accent:#08b99c;--ss-tile:#d9f8ef;--ss-wave:#edfcf7;--ss-wave-2:#dcfbf1; }
      .ss-settings__section--amber { --ss-accent:#f4aa17;--ss-tile:#fff2d4;--ss-wave:#fff8e9;--ss-wave-2:#fff2d8; }
      .ss-settings__section--violet { --ss-accent:#5855ff;--ss-tile:#e9e9ff;--ss-wave:#f1f1ff;--ss-wave-2:#e9e9ff; }
      .ss-settings__section-head { display:flex;align-items:center;gap:23px;padding:0 0 11px; min-height:60px; }
      .ss-settings__section-icon { width:52px;height:52px; flex:0 0 52px; display:grid;place-items:center;border-radius:13px;background:var(--ss-tile);color:var(--ss-accent); }
      .ss-settings__section-head h2 { font-size:18px;font-weight:800;letter-spacing:-.5px;margin:0 0 4px; }
      .ss-settings__section-head p { font-size:14px;color:#59749e;margin:0; }
      .ss-settings__section-body { border:1px solid #e2eafa; box-shadow:0 2px 8px #44598005 inset; border-radius:16px; padding:12px 23px; background:#ffffff9e; }
      .ss-settings__check-row { display:flex;align-items:flex-start;gap:12px;cursor:pointer;padding:3px 0; width:100%; }
      .ss-settings__check-row + .ss-settings__check-row { margin-top:9px; }
      .ss-settings__native-check { position:absolute; opacity:0; width:22px;height:22px; }
      .ss-settings__custom-check { display:grid;place-items:center; margin-top:0; flex:0 0 24px;width:24px;height:24px;border:1.6px solid #8ea3c6;border-radius:5px;background:#fff;color:transparent;transition:background .2s,border-color .2s; }
      .ss-settings__native-check:checked + .ss-settings__custom-check { background:#0b4bf0; border-color:#514bff;color:white;box-shadow:0 3px 9px #514bff29; }
      .ss-settings__native-check:focus-visible + .ss-settings__custom-check { outline:3px solid #a6b7ff;outline-offset:2px; }
      .ss-settings__check-copy { display:flex;flex-direction:column;gap:2px; }
      .ss-settings__check-title { font-size:14px;font-weight:500;color:#081633; }
      .ss-settings__check-help { font-size:13.5px;color:#5b76a0;line-height:1.45; }
      .ss-settings__nested-field { margin:11px 0 12px 36px; }
      .ss-settings__field-label { display:block;font-size:13.5px;color:#0b1934;margin-bottom:4px; }
      .ss-settings__select-wrap { position:relative; }
      .ss-settings__select { appearance:none;-webkit-appearance:none;width:100%;min-height:39px;border-radius:8px;border:1px solid #9dafff;background:#fff;color:#0b1934;padding:8px 38px 8px 13px;font:inherit;font-size:14px;outline:none;cursor:pointer; }
      .ss-settings__select:focus,.ss-settings__textarea:focus { border-color:#4c4bff;box-shadow:0 0 0 3px #5855ff19; }
      .ss-settings__chevron { position:absolute;right:12px;top:50%;transform:translateY(-50%);color:#4e4cff;pointer-events:none; }
      .ss-settings__textarea { display:block;width:100%;min-height:72px;resize:vertical; border:1px solid #93a9d1;border-radius:8px;background:white;padding:11px 13px;font:inherit;font-size:14px;color:#0b1934;outline:none; }
      .ss-settings__textarea::placeholder { color:#6280ad;opacity:1; }
      .ss-settings__textarea-help {font-size:13px;color:#59749e;margin:5px 0 0;}
      .ss-settings__css-field {padding:0 4px 0 36px;}
      @media(max-width:640px) { .ss-settings {padding:18px 12px 30px;} .ss-settings__top {align-items:flex-start;gap:15px;} .ss-settings__heading-group{gap:8px;} .ss-settings__title{font-size:23px;} .ss-settings__intro{font-size:12px;} .ss-settings__save{padding:11px 12px;font-size:12px;gap:6px;} .ss-settings__save svg{width:16px;height:16px;} .ss-settings__section{padding:12px 10px;} .ss-settings__section-head{gap:12px;} .ss-settings__section-head h2{font-size:16px;} .ss-settings__section-head p{font-size:12px;} .ss-settings__section-body{padding:12px;} .ss-settings__nested-field{margin-left:36px;} .ss-settings__css-field{padding:0;} }
    `}</style>
    <div className="ss-settings__wrap">
      <header className="ss-settings__top">
        <div className="ss-settings__heading-group"><button type="button" className="ss-settings__back" onClick={() => navigate("/app")} aria-label="Back to Home"><SettingsIcon name="back" size={22}/></button><div><h1 className="ss-settings__title">Settings</h1><p className="ss-settings__intro">Configure how discounts work for your store</p></div></div>
        <button className="ss-settings__save" type="button" onClick={handleSave} disabled={isSaving}><SettingsIcon name="save" size={18}/>{isSaving ? "Saving…" : "Save Changes"}</button>
      </header>
      {saved && <div className="ss-settings__alert" role="status"><span>Settings save request submitted.</span><button type="button" onClick={() => setSaved(false)} aria-label="Dismiss">×</button></div>}
      <main className="ss-settings__sections">
        <SettingsSection name="Pricing" subtitle="Configure how prices are displayed and calculated" icon="cart" tone="blue">
          <SettingCheckbox title="Round discounted prices" description="Automatically round prices after applying discounts" checked={roundPrices} onChange={setRoundPrices}/>
          {roundPrices && <div className="ss-settings__nested-field"><label className="ss-settings__field-label" htmlFor="ss-rounding">Rounding method</label><div className="ss-settings__select-wrap"><select className="ss-settings__select" id="ss-rounding" value={roundingMethod} onChange={(e) => setRoundingMethod(e.target.value)}><option value="nearest">Nearest (e.g., $9.99)</option><option value="up">Up (e.g., $10.00)</option><option value="down">Down (e.g., $9.00)</option></select><span className="ss-settings__chevron"><SettingsIcon name="chevron" size={19}/></span></div></div>}
          <SettingCheckbox title="Show compare-at price" description="Display original price alongside discounted price" checked={showCompareAtPrice} onChange={setShowCompareAtPrice}/>
        </SettingsSection>
        <SettingsSection name="Discount behavior" subtitle="Control how discounts are applied to products" icon="layers" tone="mint">
          <SettingCheckbox title="Allow stacking discounts" description="Allow multiple discounts to apply to the same product" checked={stackDiscounts} onChange={setStackDiscounts}/>
          <SettingCheckbox title="Exclude products already on sale" description="Don't apply campaign discounts to products with existing compare-at prices" checked={excludeSaleProducts} onChange={setExcludeSaleProducts}/>
        </SettingsSection>
        <SettingsSection name="Display" subtitle="Choose what information to show to customers" icon="eye" tone="amber">
          <SettingCheckbox title="Display savings amount" description="Show how much the customer is saving" checked={displaySavings} onChange={setDisplaySavings}/>
          {displaySavings && <div className="ss-settings__nested-field" style={{marginBottom:0}}><label className="ss-settings__field-label" htmlFor="ss-savings">Savings format</label><div className="ss-settings__select-wrap"><select className="ss-settings__select" id="ss-savings" value={savingsFormat} onChange={(e) => setSavingsFormat(e.target.value)}><option value="percentage">Percentage (e.g., Save 20%)</option><option value="amount">Amount (e.g., Save $10)</option><option value="both">Both</option></select><span className="ss-settings__chevron"><SettingsIcon name="chevron" size={19}/></span></div></div>}
        </SettingsSection>
        <SettingsSection name="Advanced" subtitle="Add custom styles to match your theme" icon="code" tone="violet">
          <div className="ss-settings__css-field"><label htmlFor="ss-custom-css" className="ss-settings__field-label">Custom CSS</label><textarea id="ss-custom-css" className="ss-settings__textarea" value={customCss} onChange={(e) => setCustomCss(e.target.value)} placeholder=".discounty-widget { /* your styles */ }" rows={3}/><p className="ss-settings__textarea-help">Add custom CSS to override default widget styles</p></div>
        </SettingsSection>
      </main>
    </div>
  </div>;
}
