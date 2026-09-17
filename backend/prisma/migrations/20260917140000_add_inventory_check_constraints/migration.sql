ALTER TABLE "inventory" ADD CONSTRAINT "check_reserved_qty" CHECK (reserved_qty <= physical_qty);
ALTER TABLE "inventory" ADD CONSTRAINT "check_positive_reserved" CHECK (reserved_qty >= 0);
ALTER TABLE "inventory" ADD CONSTRAINT "check_positive_physical" CHECK (physical_qty >= 0);
