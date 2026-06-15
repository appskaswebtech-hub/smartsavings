import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

export async function countDiscountedVariants(admin: AdminApiContext): Promise<number> {
  try {
    const res = await admin.graphql(
      `#graphql
      query activeDiscounts {
        discountNodes(first: 100, query: "status:active") {
          nodes {
            id
            discount {
              __typename
              ... on DiscountAutomaticBasic {
                title
                status
                customerGets {
                  items {
                    ... on AllDiscountItems { allItems }
                    ... on DiscountProducts {
                      productVariants(first: 100) { nodes { id } }
                      products(first: 100) {
                        nodes {
                          totalVariants
                        }
                      }
                    }
                    ... on DiscountCollections {
                      collections(first: 50) {
                        nodes {
                          productsCount {
                            count
                          }
                        }
                      }
                    }
                  }
                }
              }
              ... on DiscountAutomaticBxgy {
                title
                status
                customerBuys {
                  items {
                    ... on AllDiscountItems { allItems }
                    ... on DiscountProducts {
                      products(first: 100) {
                        nodes { totalVariants }
                      }
                    }
                  }
                }
              }
              ... on DiscountCodeBasic {
                title
                status
                customerGets {
                  items {
                    ... on AllDiscountItems { allItems }
                    ... on DiscountProducts {
                      productVariants(first: 100) { nodes { id } }
                      products(first: 100) {
                        nodes { totalVariants }
                      }
                    }
                    ... on DiscountCollections {
                      collections(first: 50) {
                        nodes {
                          productsCount { count }
                        }
                      }
                    }
                  }
                }
              }
              ... on DiscountAutomaticFreeShipping { title status }
              ... on DiscountCodeFreeShipping { title status }
            }
          }
        }
      }`
    );

    const result = await res.json();
    const nodes = result.data?.discountNodes?.nodes || [];

    let totalVariants = 0;
    let hasAllProducts = false;

    for (const node of nodes) {
      const d = node.discount;
      if (!d) continue;

      // Get items from customerGets or customerBuys
      const items = d.customerGets?.items || d.customerBuys?.items;
      if (!items) continue;

      // "All products" discount
      if (items.allItems) {
        hasAllProducts = true;
        continue;
      }

      // Specific product variants
      if (items.productVariants?.nodes) {
        totalVariants += items.productVariants.nodes.length;
      }

      // Specific products (count their variants)
      if (items.products?.nodes) {
        for (const product of items.products.nodes) {
          totalVariants += product.totalVariants || 1;
        }
      }

      // Collections (estimate from product count)
      if (items.collections?.nodes) {
        for (const col of items.collections.nodes) {
          // Rough estimate: each product has ~3 variants on average
          totalVariants += (col.productsCount?.count || 0) * 3;
        }
      }
    }

    // If any discount applies to all products, get total store variant count
    if (hasAllProducts) {
      try {
        const countRes = await admin.graphql(
          `#graphql
          query variantCount {
            productVariants(first: 1) {
              totalCount
            }
          }`
        );
        const countResult = await countRes.json();
        const storeTotal = countResult.data?.productVariants?.totalCount || 0;
        totalVariants = Math.max(totalVariants, storeTotal);
      } catch {
        // Fallback: just use what we have
      }
    }

    return totalVariants;
  } catch (error) {
    console.error("Error counting discounted variants:", error);
    return 0;
  }
}