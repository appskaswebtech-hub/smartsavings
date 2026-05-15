// import { useState, useEffect } from "react";
// import {
//   json,
//   type ActionFunctionArgs,
//   type LoaderFunctionArgs,
// } from "@remix-run/node";
// import { useFetcher, useLoaderData } from "@remix-run/react";

// // ✅ Import from plan-definitions (not plans.ts — avoids route name collision)
// import { PLANS, type PlanId } from "../plan-definitions";

// // ─── Loader ───────────────────────────────────────────────────────────────────

// export const loader = async ({ request }: LoaderFunctionArgs) => {
//   const { authenticate } = await import("../shopify.server");
//   const { syncSubscriptionFromShopify } = await import("../billing.server");

//   const { admin, session } = await authenticate.admin(request);

//   let planId: PlanId | null = null;
//   try {
//     const result = await syncSubscriptionFromShopify(admin, session.shop);
//     planId = result.planId;
//   } catch (err) {
//     console.error("[plans loader] subscription sync failed:", err);
//   }

//   const appHandle = process.env.SHOPIFY_APP_HANDLE ?? "";
//   const storeHandle = session.shop.replace(/\.myshopify\.com$/, "");
//   const managedPricingUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

//   return json({
//     hasActivePlan: planId !== null,
//     activePlanId: planId,
//     managedPricingUrl,
//   });
// };

// // ─── Action ───────────────────────────────────────────────────────────────────

// export const action = async ({ request }: ActionFunctionArgs) => {
//   const { authenticate } = await import("../shopify.server");
//   const { session } = await authenticate.admin(request);

//   const formData = await request.formData();
//   const planId = formData.get("planId") as string;

//   if (!PLANS[planId as PlanId]) {
//     return json({ error: "Invalid plan selected", redirectUrl: null }, { status: 400 });
//   }

//   const appHandle = process.env.SHOPIFY_APP_HANDLE ?? "";
//   const storeHandle = session.shop.replace(/\.myshopify\.com$/, "");
//   const redirectUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

//   // Return the URL as JSON — client uses App Bridge to navigate the top frame.
//   // A server-side redirect() lands in the iframe which Shopify blocks (X-Frame-Options: deny).
//   return json({ redirectUrl, error: null });
// };

// // ─── Plans Page ───────────────────────────────────────────────────────────────

// export default function PlansPage() {
//   const { hasActivePlan, activePlanId, managedPricingUrl } =
//     useLoaderData<typeof loader>();

//   const [selected, setSelected] = useState<string | null>(activePlanId ?? null);
//   const fetcher = useFetcher<{ redirectUrl: string | null; error: string | null }>();
//   const planList = Object.values(PLANS);
//   const selectedPlan = planList.find((p) => p.id === selected);
//   const isSubmitting = fetcher.state !== "idle";

//   // Navigate the top frame out of Shopify's iframe to the pricing page
//   useEffect(() => {
//     if (fetcher.data?.redirectUrl) {
//       window.open(fetcher.data.redirectUrl, "_top");
//     }
//   }, [fetcher.data]);

//   function handleActivate() {
//     if (!selected) return;
//     fetcher.submit(
//       { planId: selected },
//       { method: "POST", action: "/app/plans" }
//     );
//   }

//   return (
//     <>
//       <style>{`
//         .plans-grid {
//           display: grid;
//           grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
//           gap: 20px;
//           margin-bottom: 2rem;
//         }
//         .plan-card {
//           border-radius: 16px;
//           padding: 1.5rem;
//           cursor: pointer;
//           position: relative;
//           outline: none;
//           transition: transform 0.15s, box-shadow 0.15s;
//         }
//         .plan-card:hover {
//           transform: translateY(-3px);
//           box-shadow: 0 12px 32px rgba(0,0,0,0.1);
//         }
//         .plans-cta {
//           border: none;
//           border-radius: 99px;
//           padding: 13px 40px;
//           font-size: 15px;
//           font-weight: 700;
//           cursor: pointer;
//           transition: opacity 0.15s, transform 0.1s;
//           letter-spacing: 0.01em;
//         }
//         .plans-cta:active  { transform: scale(0.97); }
//         .plans-cta:disabled { opacity: 0.45; cursor: not-allowed; }
//       `}</style>

//       <div style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 1.5rem" }}>

//         {/* Header */}
//         <div style={{ marginBottom: "2.5rem" }}>
//           <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", letterSpacing: "-0.025em" }}>
//             Plans &amp; Billing
//           </h1>
//           <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>
//             {hasActivePlan
//               ? `You're on the ${activePlanId ? PLANS[activePlanId]?.name : ""} plan. Upgrade or change any time.`
//               : "Choose a plan to activate your app. Billed securely through Shopify."}
//           </p>
//         </div>

//         {/* Active plan banner */}
//         {hasActivePlan && activePlanId && (
//           <div style={{
//             background: "#E1F5EE", border: "1px solid #1D9E75", borderRadius: 12,
//             padding: "12px 20px", marginBottom: "1.5rem",
//             display: "flex", alignItems: "center", gap: 10,
//             fontSize: 14, color: "#085041", fontWeight: 500,
//           }}>
//             <span style={{ fontSize: 18 }}>✓</span>
//             Active plan: <strong>{PLANS[activePlanId]?.name}</strong>. Managed through Shopify billing.
//           </div>
//         )}

//         {/* Plan cards */}
//         <div className="plans-grid" role="radiogroup">
//           {planList.map((plan) => {
//             const isSelected = selected === plan.id;
//             const isActive = activePlanId === plan.id;
//             return (
//               <div
//                 key={plan.id}
//                 className="plan-card"
//                 role="radio"
//                 aria-checked={isSelected}
//                 tabIndex={0}
//                 onClick={() => setSelected(plan.id)}
//                 onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(plan.id)}
//                 style={{
//                   border: isSelected ? `2.5px solid ${plan.color}` : "1.5px solid #e5e7eb",
//                   background: isSelected ? plan.lightBg : "#fff",
//                 }}
//               >
//                 {plan.badge && (
//                   <span style={{
//                     position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
//                     background: plan.color, color: "#fff", fontSize: 11, fontWeight: 700,
//                     borderRadius: 99, padding: "3px 14px", whiteSpace: "nowrap",
//                   }}>
//                     {plan.badge}
//                   </span>
//                 )}
//                 {isActive && (
//                   <span style={{
//                     position: "absolute", top: 12, right: 12,
//                     background: plan.color, color: "#fff", fontSize: 10,
//                     fontWeight: 700, borderRadius: 99, padding: "2px 10px", textTransform: "uppercase",
//                   }}>
//                     Current
//                   </span>
//                 )}

//                 <div style={{ marginBottom: 14 }}>
//                   <p style={{ fontSize: 11, fontWeight: 700, color: plan.color, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
//                     {plan.name}
//                   </p>
//                   <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
//                     <span style={{ fontSize: 34, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
//                       ${plan.price.toFixed(2)}
//                     </span>
//                     <span style={{ fontSize: 13, color: "#9ca3af" }}>/month</span>
//                   </div>
//                 </div>

//                 <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
//                   {plan.features.map((f) => (
//                     <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 9 }}>
//                       <span style={{ color: plan.color, fontSize: 13, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
//                       <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
//                     </div>
//                   ))}
//                 </div>

//                 {isSelected && !isActive && (
//                   <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: plan.color }}>● Selected</div>
//                 )}
//               </div>
//             );
//           })}
//         </div>

//         {/* CTA footer */}
//         <div style={{
//           display: "flex", alignItems: "center", justifyContent: "space-between",
//           flexWrap: "wrap", gap: 12, paddingTop: "1rem", borderTop: "1px solid #f3f4f6",
//         }}>
//           <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
//             🔒 Billed securely through Shopify · Cancel any time
//           </p>
//           <button
//             className="plans-cta"
//             disabled={!selected || isSubmitting || (hasActivePlan && selected === activePlanId)}
//             onClick={handleActivate}
//             style={{
//               background: selectedPlan ? selectedPlan.color : "#e5e7eb",
//               color: selectedPlan ? "#fff" : "#9ca3af",
//             }}
//           >
//             {isSubmitting
//               ? "Redirecting to Shopify…"
//               : hasActivePlan && selected === activePlanId
//               ? "Current plan"
//               : selectedPlan
//               ? hasActivePlan
//                 ? `Switch to ${selectedPlan.name} — $${selectedPlan.price.toFixed(2)}/mo`
//                 : `Activate ${selectedPlan.name} — $${selectedPlan.price.toFixed(2)}/mo`
//               : "Select a plan"}
//           </button>
//         </div>
//       </div>
//     </>
//   );
// }


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

export default function PlansPage() {
  const { hasActivePlan, activePlanId, managedPricingUrl } =
    useLoaderData<typeof loader>();

  const [selected, setSelected] = useState<string | null>(activePlanId ?? null);
  const fetcher = useFetcher<{ redirectUrl: string | null; error: string | null }>();
  const planList = Object.values(PLANS);
  const selectedPlan = planList.find((p) => p.id === selected);
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.redirectUrl) {
      window.open(fetcher.data.redirectUrl, "_top");
    }
  }, [fetcher.data]);

  function handleActivate() {
    if (!selected) return;
    fetcher.submit(
      { planId: selected },
      { method: "POST", action: "/app/plans" }
    );
  }

  return (
    <>
      <style>{`
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
          margin-bottom: 2rem;
        }
        .plan-card {
          border-radius: 16px;
          padding: 1.5rem;
          cursor: pointer;
          position: relative;
          outline: none;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .plan-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.1);
        }
        .plans-cta {
          border: none;
          border-radius: 99px;
          padding: 13px 40px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          letter-spacing: 0.01em;
        }
        .plans-cta:active  { transform: scale(0.97); }
        .plans-cta:disabled { opacity: 0.45; cursor: not-allowed; }
        .trial-badge {
          display: inline-block;
          background: #FEF3C7;
          color: #92400E;
          font-size: 11px;
          font-weight: 700;
          border-radius: 99px;
          padding: 3px 10px;
          margin-top: 6px;
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 1.5rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px", letterSpacing: "-0.025em" }}>
            Plans &amp; Billing
          </h1>
          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 10px" }}>
            {hasActivePlan
              ? `You're on the ${activePlanId ? PLANS[activePlanId]?.name : ""} plan. Upgrade or change any time.`
              : "Choose a plan to start your free trial. Billed securely through Shopify."}
          </p>
          {/* Trial announcement */}
          {!hasActivePlan && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#FEF3C7", border: "1px solid #F59E0B",
              borderRadius: 10, padding: "8px 16px",
              fontSize: 13, color: "#92400E", fontWeight: 600,
            }}>
              🎁 All plans include a <strong>{TRIAL_DAYS}-day free trial</strong> — no charges until your trial ends.
            </div>
          )}
        </div>

        {/* Active plan banner */}
        {hasActivePlan && activePlanId && (
          <div style={{
            background: "#E1F5EE", border: "1px solid #1D9E75", borderRadius: 12,
            padding: "12px 20px", marginBottom: "1.5rem",
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 14, color: "#085041", fontWeight: 500,
          }}>
            <span style={{ fontSize: 18 }}>✓</span>
            Active plan: <strong>{PLANS[activePlanId]?.name}</strong>. Managed through Shopify billing.
          </div>
        )}

        {/* Plan cards */}
        <div className="plans-grid" role="radiogroup">
          {planList.map((plan) => {
            const isSelected = selected === plan.id;
            const isActive = activePlanId === plan.id;
            return (
              <div
                key={plan.id}
                className="plan-card"
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => setSelected(plan.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(plan.id)}
                style={{
                  border: isSelected ? `2.5px solid ${plan.color}` : "1.5px solid #e5e7eb",
                  background: isSelected ? plan.lightBg : "#fff",
                }}
              >
                {plan.badge && (
                  <span style={{
                    position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                    background: plan.color, color: "#fff", fontSize: 11, fontWeight: 700,
                    borderRadius: 99, padding: "3px 14px", whiteSpace: "nowrap",
                  }}>
                    {plan.badge}
                  </span>
                )}
                {isActive && (
                  <span style={{
                    position: "absolute", top: 12, right: 12,
                    background: plan.color, color: "#fff", fontSize: 10,
                    fontWeight: 700, borderRadius: 99, padding: "2px 10px", textTransform: "uppercase",
                  }}>
                    Current
                  </span>
                )}

                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: plan.color, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {plan.name}
                  </p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 34, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
                      ${plan.price.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 13, color: "#9ca3af" }}>/month</span>
                  </div>
                  {/* Trial badge per card */}
                  {!isActive && (
                    <div className="trial-badge">
                      🎁 {TRIAL_DAYS}-day free trial
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 9 }}>
                      <span style={{ color: plan.color, fontSize: 13, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
                      <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
                    </div>
                  ))}
                </div>

                {isSelected && !isActive && (
                  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: plan.color }}>● Selected</div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12, paddingTop: "1rem", borderTop: "1px solid #f3f4f6",
        }}>
          <div>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 2px" }}>
              🔒 Billed securely through Shopify · Cancel any time
            </p>
            {selectedPlan && !hasActivePlan && (
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                Then ${selectedPlan.price.toFixed(2)}/month after {TRIAL_DAYS}-day trial
              </p>
            )}
          </div>
          <button
            className="plans-cta"
            disabled={!selected || isSubmitting || (hasActivePlan && selected === activePlanId)}
            onClick={handleActivate}
            style={{
              background: selectedPlan ? selectedPlan.color : "#e5e7eb",
              color: selectedPlan ? "#fff" : "#9ca3af",
            }}
          >
            {isSubmitting
              ? "Redirecting to Shopify…"
              : hasActivePlan && selected === activePlanId
              ? "Current plan"
              : selectedPlan
              ? hasActivePlan
                ? `Switch to ${selectedPlan.name} — $${selectedPlan.price.toFixed(2)}/mo`
                : `Start ${TRIAL_DAYS}-Day Free Trial`
              : "Select a plan"}
          </button>
        </div>

      </div>
    </>
  );
}