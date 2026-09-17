-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN     "unit_price" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "line_amount" DECIMAL(14,2) NOT NULL;
