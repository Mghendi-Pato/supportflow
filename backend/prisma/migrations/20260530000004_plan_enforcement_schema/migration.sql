-- Migration: Plan enforcement schema
-- 1. Rename TenantPlan enum values PRO→STANDARD, AGENCY→PREMIUM
-- 2. Add plan_renews_at column to tenants
-- 3. Create pending_registrations table

-- Step 1a: rename enum values (Postgres requires renaming one at a time via ALTER TYPE)
ALTER TYPE "TenantPlan" RENAME VALUE 'PRO' TO 'STANDARD';
ALTER TYPE "TenantPlan" RENAME VALUE 'AGENCY' TO 'PREMIUM';

-- Step 2: add plan_renews_at to tenants
ALTER TABLE "tenants" ADD COLUMN "plan_renews_at" TIMESTAMP(3);

-- Step 3: create pending_registrations table
CREATE TABLE "pending_registrations" (
    "id"         TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "metadata"   JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_registrations_email_key" ON "pending_registrations"("email");
CREATE UNIQUE INDEX "pending_registrations_token_key" ON "pending_registrations"("token");
CREATE INDEX "pending_registrations_token_idx" ON "pending_registrations"("token");
CREATE INDEX "pending_registrations_email_idx" ON "pending_registrations"("email");
