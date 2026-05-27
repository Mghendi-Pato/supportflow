-- CreateTable
CREATE TABLE "notification_preferences" (
    "id"                   TEXT         NOT NULL,
    "user_id"              TEXT         NOT NULL,
    "tenant_id"            TEXT         NOT NULL,
    "email_new_ticket"     BOOLEAN      NOT NULL DEFAULT true,
    "email_status_changed" BOOLEAN      NOT NULL DEFAULT true,
    "email_assigned"       BOOLEAN      NOT NULL DEFAULT true,
    "email_new_message"    BOOLEAN      NOT NULL DEFAULT true,
    "email_new_attachment" BOOLEAN      NOT NULL DEFAULT false,
    "email_billing_request" BOOLEAN     NOT NULL DEFAULT true,
    "email_payment_update" BOOLEAN      NOT NULL DEFAULT true,
    "email_ticket_closed"  BOOLEAN      NOT NULL DEFAULT true,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_tenant_id_key"
    ON "notification_preferences"("user_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
