-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "discountCode" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "popupEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN "popupPages" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "popupHeading" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "popupDescription" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "popupButtonText" TEXT;

-- CreateTable
CREATE TABLE "PopupSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PopupSubmission_shop_idx" ON "PopupSubmission"("shop");

-- CreateIndex
CREATE INDEX "PopupSubmission_shop_campaignId_idx" ON "PopupSubmission"("shop", "campaignId");
