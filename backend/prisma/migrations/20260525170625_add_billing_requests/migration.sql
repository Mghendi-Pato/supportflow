-- CreateEnum
CREATE TYPE "BillingRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "billing_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "description" TEXT NOT NULL,
    "status" "BillingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_requests_ticket_id_idx" ON "billing_requests"("ticket_id");

-- CreateIndex
CREATE INDEX "billing_requests_tenant_id_idx" ON "billing_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "billing_requests_client_id_idx" ON "billing_requests"("client_id");

-- CreateIndex
CREATE INDEX "billing_requests_status_idx" ON "billing_requests"("status");

-- AddForeignKey
ALTER TABLE "billing_requests" ADD CONSTRAINT "billing_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_requests" ADD CONSTRAINT "billing_requests_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_requests" ADD CONSTRAINT "billing_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_requests" ADD CONSTRAINT "billing_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
