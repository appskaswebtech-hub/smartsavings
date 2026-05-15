// import { useEffect, useState } from "react";
// import { json, type LoaderFunctionArgs } from "@remix-run/node";
// import {
//   Link,
//   Outlet,
//   useFetcher,
//   useLoaderData,
//   useLocation,
//   useRouteError,
// } from "@remix-run/react";
// import { boundary } from "@shopify/shopify-app-remix/server";
// import { AppProvider } from "@shopify/shopify-app-remix/react";
// import { NavMenu } from "@shopify/app-bridge-react";
// import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

// import { authenticate } from "../shopify.server";

// // ─── Styles ───────────────────────────────────────────────────────────────────

// export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// // ─── Plan display data (UI only — no billing logic here) ─────────────────────

// const PLAN_UI = [
//   {
//     id: "base",
//     name: "Base",
//     price: 9.99,
//     badge: null,
//     color: "#1D9E75",
//     lightBg: "#E1F5EE",
//     features: [
//       "Up to 3 team members",
//       "500 orders / month",
//       "Basic analytics dashboard",
//       "Email support",
//       "API access",
//       "Shopify POS support",
//     ],
//   },
//   {
//     id: "advanced",
//     name: "Advanced",
//     price: 19.99,
//     badge: "Most popular",
//     color: "#534AB7",
//     lightBg: "#EEEDFE",
//     features: [
//       "Up to 10 team members",
//       "5,000 orders / month",
//       "Advanced analytics & reports",
//       "Priority email + chat support",
//       "Custom integrations",
//       "Webhooks & automations",
//       "Multi-store support",
//     ],
//   },
//   {
//     id: "professional",
//     name: "Professional",
//     price: 29.99,
//     badge: null,
//     color: "#185FA5",
//     lightBg: "#E6F1FB",
//     features: [
//       "Unlimited team members",
//       "Unlimited orders",
//       "Full analytics suite",
//       "Dedicated account manager",
//       "SSO & custom security",
//       "SLA guarantee",
//       "Custom onboarding",
//       "White-label options",
//     ],
//   },
// ];

// // ─── Loader ───────────────────────────────────────────────────────────────────

// export const loader = async ({ request }: LoaderFunctionArgs) => {
//   const { admin, session } = await authenticate.admin(request);

//   // Extract host param — App Bridge needs this to know the parent frame origin
//   const url = new URL(request.url);
//   const host = url.searchParams.get("host") ?? "";

//   let hasActivePlan = false;

//   try {
//     const response = await admin.graphql(`#graphql
//       query {
//         currentAppInstallation {
//           activeSubscriptions {
//             id
//             status
//             name
//           }
//         }
//       }
//     `);
//     const data = await response.json();
//     const subs =
//       data?.data?.currentAppInstallation?.activeSubscriptions ?? [];
//     hasActivePlan = subs.some(
//       (s: { status: string }) => s.status === "ACTIVE"
//     );
//   } catch (err) {
//     console.error("[app loader] subscription check failed:", err);
//     hasActivePlan = false;
//   }

//   const appHandle = process.env.SHOPIFY_APP_HANDLE ?? "";
//   const storeHandle = session.shop.replace(/\.myshopify\.com$/, "");
//   const managedPricingUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

//   return json({
//     apiKey: process.env.SHOPIFY_API_KEY ?? "",
//     host,
//     hasActivePlan,
//     managedPricingUrl,
//   });
// };

// // ─── Plan Modal ───────────────────────────────────────────────────────────────

// function PlanModal({ managedPricingUrl }: { managedPricingUrl: string }) {
//   const [selected, setSelected] = useState<string | null>(null);
//   const fetcher = useFetcher<{ redirectUrl: string | null; error: string | null }>();
//   const isSubmitting = fetcher.state !== "idle";
//   const selectedPlan = PLAN_UI.find((p) => p.id === selected);

//   // When action returns URL, navigate the top frame out of the iframe
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
//         @keyframes planModalIn {
//           from { opacity: 0; transform: translateY(24px) scale(0.97); }
//           to   { opacity: 1; transform: translateY(0) scale(1); }
//         }
//         .pm-overlay {
//           position: fixed; inset: 0;
//           background: rgba(0,0,0,0.6);
//           backdrop-filter: blur(4px);
//           display: flex; align-items: center; justify-content: center;
//           z-index: 99999; padding: 1rem;
//         }
//         .pm-sheet {
//           background: #fff; border-radius: 20px;
//           padding: 2rem 2rem 1.5rem;
//           max-width: 860px; width: 100%;
//           max-height: 90vh; overflow-y: auto;
//           box-shadow: 0 32px 80px rgba(0,0,0,0.18);
//           animation: planModalIn 0.35s cubic-bezier(0.16,1,0.3,1);
//         }
//         .pm-grid {
//           display: grid;
//           grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
//           gap: 16px; margin-bottom: 1.5rem;
//         }
//         .pm-card {
//           border-radius: 14px; padding: 1.25rem;
//           position: relative; cursor: pointer; outline: none;
//           transition: transform 0.15s ease, box-shadow 0.15s ease;
//         }
//         .pm-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.09); }
//         .pm-btn {
//           border: none; border-radius: 99px;
//           padding: 12px 36px; font-size: 14px; font-weight: 700;
//           letter-spacing: 0.01em; cursor: pointer;
//           transition: opacity 0.15s, transform 0.1s;
//         }
//         .pm-btn:active { transform: scale(0.97); }
//         .pm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
//       `}</style>

//       <div className="pm-overlay">
//         <div className="pm-sheet">

//           {/* Header */}
//           <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
//             <span style={{
//               display: "inline-block", background: "#EEEDFE", color: "#534AB7",
//               borderRadius: 99, padding: "4px 16px", fontSize: 12, fontWeight: 700,
//               letterSpacing: "0.04em", marginBottom: 14, textTransform: "uppercase",
//             }}>
//               ✦ Activation required
//             </span>
//             <h2 style={{
//               fontSize: 26, fontWeight: 800, color: "#111827",
//               margin: "0 0 8px", letterSpacing: "-0.025em",
//             }}>
//               Choose a plan to unlock your app
//             </h2>
//             <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
//               Select a plan below. You'll be taken to Shopify's secure billing page to confirm.
//             </p>
//           </div>

//           {/* Cards */}
//           <div className="pm-grid" role="radiogroup">
//             {PLAN_UI.map((plan) => {
//               const isSelected = selected === plan.id;
//               return (
//                 <div
//                   key={plan.id}
//                   className="pm-card"
//                   role="radio"
//                   aria-checked={isSelected}
//                   tabIndex={0}
//                   onClick={() => setSelected(plan.id)}
//                   onKeyDown={(e) =>
//                     (e.key === "Enter" || e.key === " ") && setSelected(plan.id)
//                   }
//                   style={{
//                     border: isSelected ? `2.5px solid ${plan.color}` : "1.5px solid #e5e7eb",
//                     background: isSelected ? plan.lightBg : "#fff",
//                   }}
//                 >
//                   {plan.badge && (
//                     <span style={{
//                       position: "absolute", top: -13, left: "50%",
//                       transform: "translateX(-50%)",
//                       background: plan.color, color: "#fff",
//                       fontSize: 11, fontWeight: 700, borderRadius: 99,
//                       padding: "3px 14px", whiteSpace: "nowrap",
//                     }}>
//                       {plan.badge}
//                     </span>
//                   )}

//                   <div style={{ marginBottom: 12 }}>
//                     <p style={{
//                       fontSize: 11, fontWeight: 700, color: plan.color,
//                       margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.08em",
//                     }}>
//                       {plan.name}
//                     </p>
//                     <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
//                       <span style={{ fontSize: 32, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
//                         ${plan.price.toFixed(2)}
//                       </span>
//                       <span style={{ fontSize: 13, color: "#9ca3af" }}>/month</span>
//                     </div>
//                   </div>

//                   <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
//                     {plan.features.map((f) => (
//                       <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
//                         <span style={{ color: plan.color, fontSize: 13, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
//                         <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
//                       </div>
//                     ))}
//                   </div>

//                   {isSelected && (
//                     <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: plan.color }}>
//                       ● Selected
//                     </div>
//                   )}
//                 </div>
//               );
//             })}
//           </div>

//           {/* Footer */}
//           <div style={{
//             display: "flex", alignItems: "center", justifyContent: "space-between",
//             flexWrap: "wrap", gap: 12, paddingTop: "1rem", borderTop: "1px solid #f3f4f6",
//           }}>
//             <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
//               🔒 Billed securely through Shopify · Cancel any time
//             </p>
//             <button
//               className="pm-btn"
//               disabled={!selected || isSubmitting}
//               onClick={handleActivate}
//               style={{
//                 background: selectedPlan ? selectedPlan.color : "#e5e7eb",
//                 color: selectedPlan ? "#fff" : "#9ca3af",
//               }}
//             >
//               {isSubmitting
//                 ? "Redirecting to Shopify…"
//                 : selectedPlan
//                 ? `Activate ${selectedPlan.name} — $${selectedPlan.price.toFixed(2)}/mo`
//                 : "Select a plan to continue"}
//             </button>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

// // ─── Plan Gate Hook ───────────────────────────────────────────────────────────

// function usePlanGate(hasActivePlan: boolean) {
//   const [showModal, setShowModal] = useState(!hasActivePlan);
//   const location = useLocation();

//   useEffect(() => {
//     if (!hasActivePlan) setShowModal(true);
//   }, [location.pathname, hasActivePlan]);

//   return { showModal };
// }

// // ─── App Layout ───────────────────────────────────────────────────────────────

// export default function App() {
//   const { apiKey, host, hasActivePlan, managedPricingUrl } =
//     useLoaderData<typeof loader>();

//   const { showModal } = usePlanGate(hasActivePlan);

//   return (
//     <AppProvider isEmbeddedApp apiKey={apiKey} host={host}>
//       <NavMenu>
//         <Link to="/app" rel="home">Home</Link>
//         <Link to="/app/campaigns">Campaigns</Link>
//         <Link to="/app/customization">Customization</Link>
//         <Link to="/app/analytics">Analytics</Link>
//         <Link to="/app/plans">Plans</Link>
//         <Link to="/app/settings">Settings</Link>
//         <Link to="/app/helpandsupport">Help</Link>
//       </NavMenu>

//       {showModal && <PlanModal managedPricingUrl={managedPricingUrl} />}

//       <Outlet />
//     </AppProvider>
//   );
// }

// // ─── Shopify required exports ─────────────────────────────────────────────────

// export function ErrorBoundary() {
//   return boundary.error(useRouteError());
// }

// export const headers = (headersArgs: any) => {
//   return boundary.headers(headersArgs);
// };


import { useEffect, useState } from "react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import {
  Link,
  Outlet,
  useFetcher,
  useLoaderData,
  useLocation,
  useRouteError,
} from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

// ─── Styles ───────────────────────────────────────────────────────────────────

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// ─── Plan display data (UI only — no billing logic here) ─────────────────────

const PLAN_UI = [
  {
    id: "base",
    name: "Base",
    price: 9.99,
    badge: null,
    color: "#1D9E75",
    lightBg: "#E1F5EE",
    features: [
      "Up to 3 team members",
      "500 orders / month",
      "Basic analytics dashboard",
      "Email support",
      "API access",
      "Shopify POS support",
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    price: 19.99,
    badge: "Most popular",
    color: "#534AB7",
    lightBg: "#EEEDFE",
    features: [
      "Up to 10 team members",
      "5,000 orders / month",
      "Advanced analytics & reports",
      "Priority email + chat support",
      "Custom integrations",
      "Webhooks & automations",
      "Multi-store support",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: 29.99,
    badge: null,
    color: "#185FA5",
    lightBg: "#E6F1FB",
    features: [
      "Unlimited team members",
      "Unlimited orders",
      "Full analytics suite",
      "Dedicated account manager",
      "SSO & custom security",
      "SLA guarantee",
      "Custom onboarding",
      "White-label options",
    ],
  },
];

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const host = url.searchParams.get("host") ?? "";

  // ─── BILLING GATE SWITCH ───────────────────────────────────────────────────
  // Set REQUIRE_BILLING=false in your .env to bypass the plan gate entirely.
  // Useful during development/testing when you can't approve a test subscription.
  // Set to true (or remove the variable) to enforce billing in production.
  //
  //   .env → REQUIRE_BILLING=false   (modal hidden, all pages accessible)
  //   .env → REQUIRE_BILLING=true    (modal shown until plan is selected)
  // ──────────────────────────────────────────────────────────────────────────
  const billingEnabled = process.env.REQUIRE_BILLING !== "false";

  let hasActivePlan = !billingEnabled; // bypass = treat as already subscribed

  if (billingEnabled) {
    try {
      const response = await admin.graphql(`#graphql
        query {
          currentAppInstallation {
            activeSubscriptions {
              id
              status
              name
            }
          }
        }
      `);
      const data = await response.json();
      const subs = data?.data?.currentAppInstallation?.activeSubscriptions ?? [];
      hasActivePlan = subs.some(
        (s: { status: string }) => s.status === "ACTIVE"
      );
    } catch (err) {
      console.error("[app loader] subscription check failed:", err);
      hasActivePlan = false;
    }
  }

  const appHandle = process.env.SHOPIFY_APP_HANDLE ?? "";
  const storeHandle = session.shop.replace(/\.myshopify\.com$/, "");
  const managedPricingUrl = `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;

  return json({
    apiKey: process.env.SHOPIFY_API_KEY ?? "",
    host,
    hasActivePlan,
    managedPricingUrl,
  });
};

// ─── Plan Modal ───────────────────────────────────────────────────────────────

function PlanModal({ managedPricingUrl }: { managedPricingUrl: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const fetcher = useFetcher<{ redirectUrl: string | null; error: string | null }>();
  const isSubmitting = fetcher.state !== "idle";
  const selectedPlan = PLAN_UI.find((p) => p.id === selected);

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
        @keyframes planModalIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .pm-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 99999; padding: 1rem;
        }
        .pm-sheet {
          background: #fff; border-radius: 20px;
          padding: 2rem 2rem 1.5rem;
          max-width: 860px; width: 100%;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 32px 80px rgba(0,0,0,0.18);
          animation: planModalIn 0.35s cubic-bezier(0.16,1,0.3,1);
        }
        .pm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 16px; margin-bottom: 1.5rem;
        }
        .pm-card {
          border-radius: 14px; padding: 1.25rem;
          position: relative; cursor: pointer; outline: none;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .pm-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.09); }
        .pm-btn {
          border: none; border-radius: 99px;
          padding: 12px 36px; font-size: 14px; font-weight: 700;
          letter-spacing: 0.01em; cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
        }
        .pm-btn:active { transform: scale(0.97); }
        .pm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>

      <div className="pm-overlay">
        <div className="pm-sheet">

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <span style={{
              display: "inline-block", background: "#EEEDFE", color: "#534AB7",
              borderRadius: 99, padding: "4px 16px", fontSize: 12, fontWeight: 700,
              letterSpacing: "0.04em", marginBottom: 14, textTransform: "uppercase",
            }}>
              ✦ Activation required
            </span>
            <h2 style={{
              fontSize: 26, fontWeight: 800, color: "#111827",
              margin: "0 0 8px", letterSpacing: "-0.025em",
            }}>
              Choose a plan to unlock your app
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
              Select a plan below. You'll be taken to Shopify's secure billing page to confirm.
            </p>
          </div>

          {/* Cards */}
          <div className="pm-grid" role="radiogroup">
            {PLAN_UI.map((plan) => {
              const isSelected = selected === plan.id;
              return (
                <div
                  key={plan.id}
                  className="pm-card"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setSelected(plan.id)}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && setSelected(plan.id)
                  }
                  style={{
                    border: isSelected ? `2.5px solid ${plan.color}` : "1.5px solid #e5e7eb",
                    background: isSelected ? plan.lightBg : "#fff",
                  }}
                >
                  {plan.badge && (
                    <span style={{
                      position: "absolute", top: -13, left: "50%",
                      transform: "translateX(-50%)",
                      background: plan.color, color: "#fff",
                      fontSize: 11, fontWeight: 700, borderRadius: 99,
                      padding: "3px 14px", whiteSpace: "nowrap",
                    }}>
                      {plan.badge}
                    </span>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <p style={{
                      fontSize: 11, fontWeight: 700, color: plan.color,
                      margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>
                      {plan.name}
                    </p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
                        ${plan.price.toFixed(2)}
                      </span>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}>/month</span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
                    {plan.features.map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                        <span style={{ color: plan.color, fontSize: 13, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
                        <span style={{ fontSize: 13, color: "#374151" }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {isSelected && (
                    <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: plan.color }}>
                      ● Selected
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12, paddingTop: "1rem", borderTop: "1px solid #f3f4f6",
          }}>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
              🔒 Billed securely through Shopify · Cancel any time
            </p>
            <button
              className="pm-btn"
              disabled={!selected || isSubmitting}
              onClick={handleActivate}
              style={{
                background: selectedPlan ? selectedPlan.color : "#e5e7eb",
                color: selectedPlan ? "#fff" : "#9ca3af",
              }}
            >
              {isSubmitting
                ? "Redirecting to Shopify…"
                : selectedPlan
                ? `Activate ${selectedPlan.name} — $${selectedPlan.price.toFixed(2)}/mo`
                : "Select a plan to continue"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Plan Gate Hook ───────────────────────────────────────────────────────────

function usePlanGate(hasActivePlan: boolean) {
  const [showModal, setShowModal] = useState(!hasActivePlan);
  const location = useLocation();

  useEffect(() => {
    if (!hasActivePlan) setShowModal(true);
  }, [location.pathname, hasActivePlan]);

  return { showModal };
}

// ─── App Layout ───────────────────────────────────────────────────────────────

export default function App() {
  const { apiKey, host, hasActivePlan, managedPricingUrl } =
    useLoaderData<typeof loader>();

  const { showModal } = usePlanGate(hasActivePlan);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey} host={host}>
      <NavMenu>
        <Link to="/app" rel="home">Home</Link>
        <Link to="/app/campaigns">Campaigns</Link>
        <Link to="/app/customization">Customization</Link>
        <Link to="/app/analytics">Analytics</Link>
        <Link to="/app/plans">Plans</Link>
        <Link to="/app/settings">Settings</Link>
        <Link to="/app/helpandsupport">Help</Link>
      </NavMenu>

      {showModal && <PlanModal managedPricingUrl={managedPricingUrl} />}

      <Outlet />
    </AppProvider>
  );
}

// ─── Shopify required exports ─────────────────────────────────────────────────

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs: any) => {
  return boundary.headers(headersArgs);
};