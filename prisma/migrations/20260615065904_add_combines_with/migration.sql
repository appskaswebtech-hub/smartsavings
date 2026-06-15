-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "discountType" TEXT NOT NULL,
    "discountValue" REAL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "productIds" TEXT,
    "collectionIds" TEXT,
    "excludeProductIds" TEXT,
    "minimumQuantity" INTEGER,
    "maximumQuantity" INTEGER,
    "minimumAmount" REAL,
    "geoTarget" TEXT,
    "shopifyDiscountId" TEXT,
    "combineWithProducts" BOOLEAN NOT NULL DEFAULT false,
    "combineWithOrders" BOOLEAN NOT NULL DEFAULT false,
    "combineWithShipping" BOOLEAN NOT NULL DEFAULT false,
    "tiers" TEXT,
    "discountedVariants" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Campaign" ("appliesTo", "collectionIds", "createdAt", "discountType", "discountValue", "discountedVariants", "endDate", "excludeProductIds", "geoTarget", "id", "maximumQuantity", "minimumAmount", "minimumQuantity", "name", "priority", "productIds", "shop", "shopifyDiscountId", "stackable", "startDate", "status", "tiers", "type", "updatedAt") SELECT "appliesTo", "collectionIds", "createdAt", "discountType", "discountValue", "discountedVariants", "endDate", "excludeProductIds", "geoTarget", "id", "maximumQuantity", "minimumAmount", "minimumQuantity", "name", "priority", "productIds", "shop", "shopifyDiscountId", "stackable", "startDate", "status", "tiers", "type", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE INDEX "Campaign_shop_idx" ON "Campaign"("shop");
CREATE INDEX "Campaign_shop_status_idx" ON "Campaign"("shop", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
