-- Widen JSON / long-text columns from VARCHAR(191) to TEXT on MySQL.
--
-- WHY
-- Prisma maps a bare `String` to VARCHAR(191) on MySQL. Every JSON blob in this
-- schema was declared as a bare String?, so each was capped at 191 characters.
-- SQLite (used locally) ignores length entirely, so these overflows are invisible
-- in development and only surface in production as:
--
--   PrismaClientKnownRequestError P2000
--   The provided value for the column is too long for the column's type. Column: tiers
--
-- Measured overflows against the 191 cap:
--   Campaign.tiers              4 tiers                  245 chars
--   Campaign.productIds         6 product GIDs           229 chars
--   Campaign.collectionIds      6 collection GIDs        223 chars
--   WidgetCustomization.config  13-key widget config     353 chars
--
-- SAFETY
-- Widening a column is non-destructive: VARCHAR -> TEXT preserves every existing
-- row and cannot truncate. Take a mysqldump first regardless. These ALTERs can
-- briefly lock the table, so prefer a quiet window.
--
-- NOT INCLUDED, deliberately:
--   * Indexed columns (shop, id, widgetType, campaignId) stay VARCHAR(191) —
--     MySQL cannot index a TEXT column without a prefix length.
--   * Setting.customCss becomes VARCHAR(5000) rather than TEXT, because MySQL
--     before 8.0.13 cannot put a DEFAULT on a TEXT column and that field is
--     `String @default("")`.
--   * The `Session` table is left alone — it is managed by Shopify's session
--     storage adapter and altering it on a live app risks breaking auth.
--
-- Apply with:
--   mysql -u <user> -p <database> < 2026-07-21-widen-json-columns-mysql.sql

ALTER TABLE `Campaign`
  MODIFY `productIds`        TEXT NULL,
  MODIFY `collectionIds`     TEXT NULL,
  MODIFY `excludeProductIds` TEXT NULL,
  MODIFY `tiers`             TEXT NULL,
  MODIFY `popupPages`        TEXT NULL,
  MODIFY `popupHeading`      TEXT NULL,
  MODIFY `popupDescription`  TEXT NULL,
  MODIFY `popupButtonText`   TEXT NULL;

ALTER TABLE `WidgetCustomization`
  MODIFY `config` TEXT NOT NULL;

ALTER TABLE `Subscription`
  MODIFY `confirmationUrl` TEXT NULL;

ALTER TABLE `CampaignAnalytics`
  MODIFY `productIds`        TEXT NULL,
  MODIFY `collectionIds`     TEXT NULL,
  MODIFY `tierBreakdown`     TEXT NULL,
  MODIFY `bxgyBreakdown`     TEXT NULL,
  MODIFY `shippingBreakdown` TEXT NULL,
  MODIFY `topProducts`       TEXT NULL;

ALTER TABLE `Setting`
  MODIFY `customCss` VARCHAR(5000) NOT NULL DEFAULT '';

-- Verify:
--   DESCRIBE `Campaign`;             -- tiers, productIds, collectionIds => text
--   DESCRIBE `WidgetCustomization`;  -- config => text
--   DESCRIBE `Setting`;              -- customCss => varchar(5000)
