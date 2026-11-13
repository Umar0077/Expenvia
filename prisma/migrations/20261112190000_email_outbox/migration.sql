-- Additive only. No existing records are rewritten or deleted.
ALTER TABLE "user_preferences"
  ADD COLUMN "email_expense_updates" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "email_invoice_updates" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "email_branch_updates" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "email_activity_updates" BOOLEAN NOT NULL DEFAULT true;
CREATE TYPE "EmailStatus" AS ENUM ('PENDING','PROCESSING','SENT','RETRY_SCHEDULED','FAILED','PREVIEWED','CANCELLED');
CREATE TABLE "email_outbox" (
  "id" UUID PRIMARY KEY,
  "idempotency_key" TEXT NOT NULL UNIQUE,
  "event_type" TEXT NOT NULL, "template" TEXT NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "recipient" TEXT NOT NULL, "language" "Locale" NOT NULL DEFAULT 'en',
  "entity_type" TEXT, "entity_id" TEXT, "auth_token_id" UUID,
  "payload" TEXT,
  "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  "max_attempts" INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 15),
  "manual_retries" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_attempt_at" TIMESTAMPTZ, "sent_at" TIMESTAMPTZ, "completed_at" TIMESTAMPTZ,
  "locked_until" TIMESTAMPTZ, "claim_id" UUID,
  "error_category" TEXT, "provider" TEXT, "provider_reference" TEXT
);
CREATE INDEX "email_outbox_status_next_attempt_at_idx" ON "email_outbox"("status", "next_attempt_at");
CREATE INDEX "email_outbox_created_at_idx" ON "email_outbox"("created_at");
CREATE INDEX "email_outbox_user_id_idx" ON "email_outbox"("user_id");
