/**
 * app/routes/app.api.variants.tsx
 * Returns variants for a given product ID.
 * Called client-side after a product is selected from the resource picker.
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  if (!productId) {
    return json({ variants: [] });
  }

  try {
    const res = await admin.graphql(
      `#graphql
      query getVariants($id: ID!) {
        product(id: $id) {
          id
          title
          variants(first: 100) {
            nodes {
              id
              title
              price
              sku
              availableForSale
              selectedOptions {
                name
                value
              }
              image {
                url
              }
            }
          }
        }
      }`,
      { variables: { id: productId } }
    );
    const result = await res.json();
    const variants = result.data?.product?.variants?.nodes || [];
    return json({ variants });
  } catch (error) {
    console.error("Failed to fetch variants:", error);
    return json({ variants: [] });
  }
};