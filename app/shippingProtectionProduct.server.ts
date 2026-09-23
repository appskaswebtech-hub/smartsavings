import { ApiVersion } from "@shopify/shopify-app-remix/server";
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { DEFAULT_FEE_PRODUCT_TITLE, type ProtectionConfig } from "./lib/shippingProtection";

/**
 * The Shipping protection fee product — the line item a shopper's protection
 * charge lives on ("Premium Shipping Protection"). Shopify can only charge for
 * cart lines, so this has to be a real product; the app creates and maintains
 * it so merchants never have to.
 *
 * Alongside it lives a hidden "coverage" component product that the Cart
 * Transform expands the fee line into and prices (see ensureFeeProduct).
 *
 * Both are published to the Online Store — unpublished, /cart/add.js can't add
 * them — but set to UNLISTED, which keeps them out of the catalog, storefront
 * search, recommendations and the sitemap while they stay addressable by id.
 *
 * App-managed products carry FEE_PRODUCT_TAG / COMPONENT_PRODUCT_TAG. Only
 * tagged products are ever updated or deleted here, so a product the merchant
 * picked by hand in an earlier version is left alone (a fresh managed one
 * replaces it).
 *
 * Requires write_products and write_publications.
 */

export const FEE_PRODUCT_TAG = "smartsavings-shipping-protection";
export const COMPONENT_PRODUCT_TAG = "smartsavings-shipping-protection-component";

const FEE_PRODUCT_QUERY = `#graphql
  query ShippingProtectionFeeProduct($id: ID!) {
    product(id: $id) {
      id
      tags
      variants(first: 1) { nodes { id } }
      media(first: 20) { nodes { id } }
    }
  }`;

const FEE_PRODUCT_CREATE = `#graphql
  mutation ShippingProtectionFeeProductCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product {
        id
        variants(first: 1) { nodes { id } }
      }
      userErrors { field message }
    }
  }`;

const FEE_PRODUCT_UPDATE = `#graphql
  mutation ShippingProtectionFeeProductUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
    productUpdate(product: $product, media: $media) {
      product { id }
      userErrors { field message }
    }
  }`;

// Deprecated in later API versions in favour of fileUpdate(referencesToRemove),
// but available on the 2025-01 version this app is pinned to — switch when bumping.
const FEE_MEDIA_DELETE = `#graphql
  mutation ShippingProtectionFeeMediaDelete($productId: ID!, $mediaIds: [ID!]!) {
    productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
      deletedMediaIds
      mediaUserErrors { field message }
    }
  }`;

const FEE_VARIANT_UPDATE = `#graphql
  mutation ShippingProtectionFeeVariantUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id }
      userErrors { field message }
    }
  }`;

// Sales-channel publications have no catalog, so match on name too (deprecated
// in later API versions, but the only label they carry), with
// supportsFuturePublishing as a name-independent fallback — only online-store
// channels support scheduled publishing.
const PUBLICATIONS = `#graphql
  query ShippingProtectionPublications {
    publications(first: 25) {
      nodes {
        id
        name
        supportsFuturePublishing
        catalog { title }
      }
    }
  }`;

const FEE_PRODUCT_PUBLISH = `#graphql
  mutation ShippingProtectionFeeProductPublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }`;

const FEE_PRODUCT_DELETE = `#graphql
  mutation ShippingProtectionFeeProductDelete($input: ProductDeleteInput!) {
    productDelete(input: $input) {
      deletedProductId
      userErrors { field message }
    }
  }`;

// Every app-made protection product still in the store, however it got there —
// the source of truth for the cleanup sweep, since a campaign's saved ids can
// go stale but the tag can't.
const PROTECTION_PRODUCTS = `#graphql
  query ShippingProtectionProducts($query: String!) {
    products(first: 250, query: $query) {
      nodes { id createdAt }
    }
  }`;

// UNLISTED keeps the product out of collections, storefront search,
// recommendations, the sitemap and Shopify Catalog while it stays reachable by
// id — so the cart, Cart Transform and checkout treat it like any active
// product. Only exists from the 2025-10 Admin API (see setUnlisted).
const PRODUCT_STATUS_UNLIST = `#graphql
  mutation ShippingProtectionProductUnlist($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id }
      userErrors { field message }
    }
  }`;

async function gql(
  admin: AdminApiContext,
  query: string,
  variables?: Record<string, unknown>,
  apiVersion?: ApiVersion
) {
  const res = await admin.graphql(query, {
    ...(variables ? { variables } : {}),
    ...(apiVersion ? { apiVersion } : {}),
  });
  const body: any = await res.json();
  // Top-level errors (e.g. a missing scope) come back here, not in userErrors.
  if (body?.errors?.length) {
    throw new Error(body.errors.map((e: any) => e.message).join(", "));
  }
  return body;
}

/**
 * Hides a managed product from the storefront catalog.
 *
 * ProductStatus.UNLISTED only exists from the 2025-10 Admin API and the app is
 * pinned to 2025-01, so this one call overrides the version — every other call
 * here stays on 2025-01, where the publication and media mutations it uses
 * behave as this file expects.
 *
 * Best effort: a failure leaves the product visible (what it was before this
 * existed), which is no reason to fail the merchant's save.
 */
async function setUnlisted(admin: AdminApiContext, productId: string): Promise<void> {
  try {
    const result = await gql(
      admin,
      PRODUCT_STATUS_UNLIST,
      { product: { id: productId, status: "UNLISTED" } },
      ApiVersion.October25
    );
    const err = userErrors(result?.data?.productUpdate);
    if (err) console.error("[shippingProtection] couldn't unlist protection product:", err);
  } catch (error) {
    console.error("[shippingProtection] couldn't unlist protection product", error);
  }
}

function userErrors(payload: any, key = "userErrors"): string | null {
  const errors = payload?.[key] ?? [];
  return errors.length ? errors.map((e: any) => e.message).join(", ") : null;
}

function describeFailure(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/access|scope|permission|forbidden/i.test(msg)) {
    return "Shipping protection needs the products and publications permissions. Re-open the app to approve them.";
  }
  return `Couldn't set up the shipping protection product: ${msg}`;
}

async function onlineStorePublicationId(admin: AdminApiContext): Promise<string | null> {
  const data = await gql(admin, PUBLICATIONS);
  const nodes: {
    id: string;
    name?: string;
    supportsFuturePublishing?: boolean;
    catalog?: { title?: string } | null;
  }[] = data?.data?.publications?.nodes ?? [];
  const byName = nodes.find((n) => n.name === "Online Store" || n.catalog?.title === "Online Store");
  return (byName ?? nodes.find((n) => n.supportsFuturePublishing))?.id ?? null;
}

interface ManagedProductSpec {
  existingId: string;
  tag: string;
  title: string;
  price: string;
  /** Image for a new product, or the replacement when iconChanged. */
  mediaUrl: string;
  iconChanged: boolean;
}

type ManagedProduct = { productId: string; variantId: string; created: boolean } | { error: string };

/**
 * Reuses the product if it still exists and carries `tag`, otherwise creates
 * it; then syncs title, icon, price (not tracked, not shipped) and publishes it
 * to the Online Store — unpublished, the storefront can't add it to a cart.
 */
async function ensureManagedProduct(
  admin: AdminApiContext,
  spec: ManagedProductSpec,
  publicationId: string
): Promise<ManagedProduct> {
  const media = spec.mediaUrl
    ? [{ originalSource: spec.mediaUrl, mediaContentType: "IMAGE", alt: spec.title }]
    : [];
  let productId: string | null = null;
  let variantId: string | null = null;
  let created = false;

  if (spec.existingId) {
    const existing = (await gql(admin, FEE_PRODUCT_QUERY, { id: spec.existingId }))?.data?.product;
    if (existing?.tags?.includes(spec.tag)) {
      productId = existing.id as string;
      variantId = existing.variants?.nodes?.[0]?.id ?? null;

      const oldMediaIds: string[] = (existing.media?.nodes ?? []).map((m: any) => m.id);
      if (spec.iconChanged && oldMediaIds.length > 0) {
        const removed = await gql(admin, FEE_MEDIA_DELETE, { productId, mediaIds: oldMediaIds });
        const err = userErrors(removed?.data?.productDeleteMedia, "mediaUserErrors");
        if (err) return { error: `Couldn't replace the protection icon: ${err}` };
      }
      // No status here: setUnlisted owns it, and re-asserting ACTIVE on every
      // sync would put the product back in the catalog.
      const updated = await gql(admin, FEE_PRODUCT_UPDATE, {
        product: { id: productId, title: spec.title },
        media: spec.iconChanged ? media : [],
      });
      const err = userErrors(updated?.data?.productUpdate);
      if (err) return { error: `Couldn't update the protection product: ${err}` };
    }
  }

  if (!productId) {
    const result = await gql(admin, FEE_PRODUCT_CREATE, {
      product: {
        title: spec.title,
        status: "ACTIVE",
        productType: "Shipping protection",
        tags: [spec.tag],
        // Keeps it out of storefront search and the sitemap.
        metafields: [{ namespace: "seo", key: "hidden", type: "number_integer", value: "1" }],
      },
      media,
    });
    const payload = result?.data?.productCreate;
    const err = userErrors(payload);
    if (err || !payload?.product?.id) {
      return { error: `Couldn't create the protection product: ${err ?? "no product returned"}` };
    }
    productId = payload.product.id as string;
    variantId = payload.product.variants?.nodes?.[0]?.id ?? null;
    created = true;
  }

  if (!variantId) return { error: "The protection product has no variant." };

  const variant = await gql(admin, FEE_VARIANT_UPDATE, {
    productId,
    variants: [{ id: variantId, price: spec.price, inventoryItem: { tracked: false, requiresShipping: false } }],
  });
  const variantErr = userErrors(variant?.data?.productVariantsBulkUpdate);
  if (variantErr) return { error: `Couldn't update the protection product's price: ${variantErr}` };

  // Idempotent — also re-publishes a product someone unpublished by hand.
  const published = await gql(admin, FEE_PRODUCT_PUBLISH, { id: productId, input: [{ publicationId }] });
  const publishErr = userErrors(published?.data?.publishablePublish);
  if (publishErr) return { error: `Couldn't publish the protection product: ${publishErr}` };

  // Published so the cart can add it, unlisted so nobody can browse to it.
  // Last, because the create and update above leave it ACTIVE.
  await setUnlisted(admin, productId);

  return { productId, variantId, created };
}

type EnsureResult = { config: ProtectionConfig; createdProductIds: string[] } | { error: string };

/**
 * Ensures the campaign's two app-managed products and returns the config with
 * their ids filled in:
 *   - the fee product ("Name in cart") — what shoppers tick and see in the cart;
 *   - the hidden "coverage" component the Cart Transform expands the fee line
 *     into and prices. Expand operations run on every plan, unlike price
 *     overrides (Plus only), so this is what makes the fee exact everywhere.
 * On failure, any product created during this call is deleted again.
 */
export async function ensureFeeProduct(
  admin: AdminApiContext,
  config: ProtectionConfig,
  previous: ProtectionConfig | null
): Promise<EnsureResult> {
  const title = config.feeProductTitle || DEFAULT_FEE_PRODUCT_TITLE;
  const createdProductIds: string[] = [];
  const fail = async (error: string): Promise<EnsureResult> => {
    await deleteManagedProducts(admin, createdProductIds);
    return { error };
  };

  try {
    const publicationId = await onlineStorePublicationId(admin);
    if (!publicationId) {
      return { error: "Couldn't find your Online Store sales channel to publish the protection product." };
    }

    const fee = await ensureManagedProduct(
      admin,
      {
        existingId: config.feeProductId,
        tag: FEE_PRODUCT_TAG,
        title,
        // The Cart Transform sets the real price; this is the fallback if it
        // can't run — right for a fixed fee, zero for a percentage.
        price: config.pricingType === "fixed_amount" ? config.fixedAmount.toFixed(2) : "0.00",
        mediaUrl: config.feeImageUrl,
        iconChanged: (previous?.feeImageUrl || "") !== (config.feeImageUrl || ""),
      },
      publicationId
    );
    if ("error" in fee) return fail(fee.error);
    if (fee.created) createdProductIds.push(fee.productId);

    const component = await ensureManagedProduct(
      admin,
      {
        existingId: config.componentProductId,
        tag: COMPONENT_PRODUCT_TAG,
        title: `${title} – coverage`,
        price: "0.00",
        mediaUrl: "",
        iconChanged: false,
      },
      publicationId
    );
    if ("error" in component) return fail(component.error);
    if (component.created) createdProductIds.push(component.productId);

    return {
      config: {
        ...config,
        feeProductId: fee.productId,
        feeVariantId: fee.variantId,
        feeProductTitle: title,
        componentProductId: component.productId,
        componentVariantId: component.variantId,
      },
      createdProductIds,
    };
  } catch (error) {
    console.error("[shippingProtection] ensureFeeProduct failed", error);
    return fail(describeFailure(error));
  }
}

/** Deletes products by id — only ones the app created (tagged). Returns error messages. */
export async function deleteManagedProducts(
  admin: AdminApiContext,
  productIds: (string | null | undefined)[]
): Promise<string[]> {
  const errors: string[] = [];
  for (const productId of productIds) {
    if (!productId) continue;
    try {
      const existing = (await gql(admin, FEE_PRODUCT_QUERY, { id: productId }))?.data?.product;
      const tags: string[] = existing?.tags ?? [];
      if (!tags.includes(FEE_PRODUCT_TAG) && !tags.includes(COMPONENT_PRODUCT_TAG)) continue;
      const deleted = await gql(admin, FEE_PRODUCT_DELETE, { input: { id: productId } });
      const err = userErrors(deleted?.data?.productDelete);
      if (err) errors.push(err);
    } catch (error) {
      console.error("[shippingProtection] deleteManagedProducts failed", error);
      errors.push(describeFailure(error));
    }
  }
  return errors;
}

/**
 * Deletes every app-made protection product the shop no longer needs — the ones
 * belonging to the campaign just deleted, plus any left behind by an earlier
 * deletion or a half-finished save.
 *
 * `deleteNow` are the deleted campaign's own products, removed whatever their
 * age. `keepProductIds` are the fee and coverage products of the campaigns that
 * remain (see protectionProductIdsInUse); every other tagged product is a
 * leftover and goes too, unless it was made in the last few minutes — that one
 * is most likely a campaign being saved in another tab, whose row doesn't exist
 * yet.
 *
 * Products are found by the app's own tags and deleteManagedProducts re-checks
 * the tag before deleting, so nothing the merchant made can be caught by this.
 */
const SWEEP_GRACE_MS = 10 * 60 * 1000;

export async function sweepProtectionProducts(
  admin: AdminApiContext,
  keepProductIds: string[],
  deleteNow: (string | null | undefined)[] = []
): Promise<string[]> {
  try {
    const data = await gql(admin, PROTECTION_PRODUCTS, {
      query: `tag:${FEE_PRODUCT_TAG} OR tag:${COMPONENT_PRODUCT_TAG}`,
    });
    const found: { id: string; createdAt: string }[] = data?.data?.products?.nodes ?? [];
    const keep = new Set(keepProductIds.filter(Boolean));
    const doomed = new Set(deleteNow.filter((id): id is string => !!id));
    const cutoff = Date.now() - SWEEP_GRACE_MS;

    for (const product of found) {
      if (keep.has(product.id) || doomed.has(product.id)) continue;
      if (Date.parse(product.createdAt) < cutoff) doomed.add(product.id);
    }
    return deleteManagedProducts(admin, [...doomed]);
  } catch (error) {
    console.error("[shippingProtection] sweepProtectionProducts failed", error);
    return [describeFailure(error)];
  }
}
