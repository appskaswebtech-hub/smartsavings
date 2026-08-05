/**
 * The merchant's store name, for the From header on discount emails.
 *
 * Resolved from the Admin API so an unconfigured store still sends as
 * "Nike Store" rather than the app's own name, with the shop domain as a
 * fallback. Runs on every popup submission, so the lookup is cached.
 *
 * Never throws: an email must not be lost over a display name.
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // shop names change rarely
const cache = new Map<string, { name: string; at: number }>();

/** "fashionhub.myshopify.com" -> "Fashionhub", "my-cool-store..." -> "My Cool Store" */
export function shopDomainToName(shop: string): string {
  const host = (shop || "").replace(/\.myshopify\.com$/i, "").replace(/^www\./i, "");
  return (
    (host.split(".")[0] || "")
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "Store"
  );
}

export async function getShopDisplayName(admin: any, shop: string): Promise<string> {
  const hit = cache.get(shop);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.name;

  // An uninstalled shop can still reach the proxy, leaving no admin client.
  if (admin) {
    try {
      const res = await admin.graphql(`#graphql
        query ShopDisplayName { shop { name } }`);
      const name = (await res.json())?.data?.shop?.name?.trim();
      if (name) {
        cache.set(shop, { name, at: Date.now() });
        return name;
      }
    } catch (error) {
      console.error("[shopName] lookup failed", { shop, error });
    }
  }
  return shopDomainToName(shop);
}
