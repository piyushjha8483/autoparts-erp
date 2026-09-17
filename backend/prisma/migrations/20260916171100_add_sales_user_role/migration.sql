-- AlterEnum: Add SALES_USER to Role enum (safe, does not remove SALES)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SALES_USER';

-- Migrate existing users: update any rows still using the old SALES role to SALES_USER
-- This runs after the enum value is committed (PostgreSQL requires ADD VALUE to be in its own tx)
UPDATE "users" SET "role" = 'SALES_USER' WHERE "role" = 'SALES';

-- AlterTable: Change the column default from SALES to SALES_USER
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SALES_USER';
