ALTER TABLE "tenants" ADD COLUMN "inbound_email" TEXT;
CREATE UNIQUE INDEX "tenants_inbound_email_key" ON "tenants"("inbound_email");
