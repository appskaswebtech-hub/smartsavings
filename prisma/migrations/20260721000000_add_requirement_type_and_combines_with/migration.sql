-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "requirementType" TEXT NOT NULL DEFAULT 'amount';
ALTER TABLE "Campaign" ADD COLUMN "combineWithProducts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Campaign" ADD COLUMN "combineWithOrders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Campaign" ADD COLUMN "combineWithShipping" BOOLEAN NOT NULL DEFAULT true;
