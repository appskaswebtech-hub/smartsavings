/**
 * Webhook: app_subscriptions/update
 *
 * Fires when Shopify changes the status of an app subscription.
 * In Managed Pricing, this is the SOLE mechanism for the merchant signaling
 * a plan change. We re-fetch the live state from Shopify (rather than trust
 * the payload) and write it to our DB.
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { syncSubscriptionFromShopify } from "../billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin } = await authenticate.webhook(request);

  if (!admin) {
    // Some webhooks fire post-uninstall when admin context is gone.
    // Just acknowledge — there's nothing to sync.
    return new Response("OK", { status: 200 });
  }

  try {
    await syncSubscriptionFromShopify(admin, shop);
  } catch (err) {
    console.error("[subscriptions_update] sync failed:", err);
    // Still return 200 — Shopify retries on non-200, and we don't want loops
    // for transient errors. The next page load will re-sync anyway.
  }

  return new Response("OK", { status: 200 });
};