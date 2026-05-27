-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'SEEN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'BILLING_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_DECLINED';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "is_paid" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "message_receipts" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "MessageDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_receipts_comment_id_idx" ON "message_receipts"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_receipts_comment_id_user_id_key" ON "message_receipts"("comment_id", "user_id");

-- AddForeignKey
ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "ticket_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
