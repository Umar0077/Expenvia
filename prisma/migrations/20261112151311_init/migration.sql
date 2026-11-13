-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'USER', 'VENDOR');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_VERIFICATION', 'PENDING_APPROVAL', 'INFO_REQUESTED', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RequestedAccountType" AS ENUM ('USER', 'VENDOR');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'INFO_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentEntryType" AS ENUM ('PAYMENT', 'CORRECTION');

-- CreateEnum
CREATE TYPE "ReconciliationType" AS ENUM ('DUPLICATE_OF', 'RELATED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MotionPreference" AS ENUM ('FULL', 'REDUCED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'ur');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified_at" TIMESTAMPTZ,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_key" TEXT,
    "role" "Role",
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "window_ends" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "registration_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_type" "RequestedAccountType" NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "business_name" TEXT,
    "business_address" TEXT,
    "business_category" TEXT,
    "tax_identifier" TEXT,
    "applicant_note" TEXT,
    "review_note" TEXT,
    "public_message" TEXT,
    "terms_accepted_at" TIMESTAMPTZ NOT NULL,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "manager_name" TEXT,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_branch_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "user_branch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "business_email" TEXT NOT NULL,
    "business_phone" TEXT,
    "business_address" TEXT,
    "business_category" TEXT,
    "tax_identifier" TEXT,
    "payment_details" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vendor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_branch_assignments" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ,

    CONSTRAINT "vendor_branch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ur" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "expense_date" DATE NOT NULL,
    "payee_name" TEXT,
    "payment_method" TEXT,
    "reference_number" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_attachments" (
    "id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_status_history" (
    "id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "from_status" "ExpenseStatus",
    "to_status" "ExpenseStatus" NOT NULL,
    "actor_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_supply_records" (
    "id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "supply_date" DATE NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "invoice_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vendor_supply_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "vendor_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
    "invoice_date" DATE NOT NULL,
    "supply_date" DATE,
    "due_date" DATE,
    "notes" TEXT,
    "payment_terms" TEXT,
    "payment_details" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ,
    "approved_at" TIMESTAMPTZ,
    "review_note" TEXT,
    "revision_of_id" UUID,
    "snapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "tax_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "line_subtotal" DECIMAL(18,2) NOT NULL,
    "line_tax" DECIMAL(18,2) NOT NULL,
    "line_total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_status_history" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "from_status" "InvoiceStatus",
    "to_status" "InvoiceStatus" NOT NULL,
    "actor_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "entry_type" "PaymentEntryType" NOT NULL DEFAULT 'PAYMENT',
    "amount" DECIMAL(18,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "proof_key" TEXT,
    "corrects_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_reconciliations" (
    "id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "type" "ReconciliationType" NOT NULL,
    "note" TEXT,
    "linked_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinked_at" TIMESTAMPTZ,

    CONSTRAINT "financial_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "params" JSONB,
    "entity_type" TEXT,
    "entity_id" UUID,
    "href" TEXT,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" "Role",
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "branch_id" UUID,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "summary" JSONB,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "motion" "MotionPreference" NOT NULL DEFAULT 'SYSTEM',
    "notify_expense_updates" BOOLEAN NOT NULL DEFAULT true,
    "notify_invoice_updates" BOOLEAN NOT NULL DEFAULT true,
    "notify_account_updates" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "registration_requests_user_id_key" ON "registration_requests"("user_id");

-- CreateIndex
CREATE INDEX "registration_requests_status_created_at_idx" ON "registration_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE INDEX "branches_status_idx" ON "branches"("status");

-- CreateIndex
CREATE INDEX "user_branch_assignments_user_id_ended_at_idx" ON "user_branch_assignments"("user_id", "ended_at");

-- CreateIndex
CREATE INDEX "user_branch_assignments_branch_id_idx" ON "user_branch_assignments"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_user_id_key" ON "vendor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "vendor_branch_assignments_vendor_id_removed_at_idx" ON "vendor_branch_assignments"("vendor_id", "removed_at");

-- CreateIndex
CREATE INDEX "vendor_branch_assignments_branch_id_idx" ON "vendor_branch_assignments"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_key_key" ON "expense_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_number_key" ON "expenses"("number");

-- CreateIndex
CREATE INDEX "expenses_owner_id_status_idx" ON "expenses"("owner_id", "status");

-- CreateIndex
CREATE INDEX "expenses_branch_id_status_idx" ON "expenses"("branch_id", "status");

-- CreateIndex
CREATE INDEX "expenses_status_submitted_at_idx" ON "expenses"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE UNIQUE INDEX "expense_attachments_storage_key_key" ON "expense_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "expense_attachments_expense_id_idx" ON "expense_attachments"("expense_id");

-- CreateIndex
CREATE INDEX "expense_status_history_expense_id_created_at_idx" ON "expense_status_history"("expense_id", "created_at");

-- CreateIndex
CREATE INDEX "vendor_supply_records_vendor_id_branch_id_idx" ON "vendor_supply_records"("vendor_id", "branch_id");

-- CreateIndex
CREATE INDEX "vendor_supply_records_invoice_id_idx" ON "vendor_supply_records"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_vendor_id_status_idx" ON "invoices"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "invoices_branch_id_status_idx" ON "invoices"("branch_id", "status");

-- CreateIndex
CREATE INDEX "invoices_invoice_date_idx" ON "invoices"("invoice_date");

-- CreateIndex
CREATE INDEX "invoices_status_submitted_at_idx" ON "invoices"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_line_items_invoice_id_position_key" ON "invoice_line_items"("invoice_id", "position");

-- CreateIndex
CREATE INDEX "invoice_status_history_invoice_id_created_at_idx" ON "invoice_status_history"("invoice_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payments_idempotency_key_key" ON "invoice_payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payments_payment_date_idx" ON "invoice_payments"("payment_date");

-- CreateIndex
CREATE INDEX "financial_reconciliations_expense_id_idx" ON "financial_reconciliations"("expense_id");

-- CreateIndex
CREATE INDEX "financial_reconciliations_invoice_id_idx" ON "financial_reconciliations"("invoice_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_branch_id_created_at_idx" ON "audit_logs"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_assignments" ADD CONSTRAINT "user_branch_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_assignments" ADD CONSTRAINT "user_branch_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_assignments" ADD CONSTRAINT "user_branch_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_branch_assignments" ADD CONSTRAINT "vendor_branch_assignments_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_branch_assignments" ADD CONSTRAINT "vendor_branch_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_branch_assignments" ADD CONSTRAINT "vendor_branch_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_status_history" ADD CONSTRAINT "expense_status_history_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_status_history" ADD CONSTRAINT "expense_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_supply_records" ADD CONSTRAINT "vendor_supply_records_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_supply_records" ADD CONSTRAINT "vendor_supply_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_supply_records" ADD CONSTRAINT "vendor_supply_records_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_revision_of_id_fkey" FOREIGN KEY ("revision_of_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "invoice_status_history_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_status_history" ADD CONSTRAINT "invoice_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_corrects_id_fkey" FOREIGN KEY ("corrects_id") REFERENCES "invoice_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliations" ADD CONSTRAINT "financial_reconciliations_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliations" ADD CONSTRAINT "financial_reconciliations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reconciliations" ADD CONSTRAINT "financial_reconciliations_linked_by_id_fkey" FOREIGN KEY ("linked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═════════════════════ Expenvia hand-written guarantees ═════════════════════

-- Concurrency-safe document numbering (EXP-INV-2026-000001 / EXP-EXP-2026-000001)
CREATE SEQUENCE invoice_number_seq START 1;
CREATE SEQUENCE expense_number_seq START 1;

-- One ACTIVE branch per employee, one ACTIVE assignment per vendor/branch pair
CREATE UNIQUE INDEX user_branch_one_active ON user_branch_assignments (user_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX vendor_branch_one_active ON vendor_branch_assignments (vendor_id, branch_id) WHERE removed_at IS NULL;

-- Money / quantity sanity
ALTER TABLE expenses ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);
ALTER TABLE invoices ADD CONSTRAINT invoices_totals_nonneg CHECK (
  subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND grand_total >= 0 AND amount_paid >= 0
);
ALTER TABLE invoices ADD CONSTRAINT invoices_not_overpaid CHECK (amount_paid <= grand_total);
ALTER TABLE invoice_line_items ADD CONSTRAINT line_qty_positive CHECK (quantity > 0);
ALTER TABLE invoice_line_items ADD CONSTRAINT line_price_nonneg CHECK (unit_price >= 0);
ALTER TABLE invoice_line_items ADD CONSTRAINT line_tax_range CHECK (tax_rate >= 0 AND tax_rate <= 100);
ALTER TABLE invoice_line_items ADD CONSTRAINT line_discount_nonneg CHECK (discount >= 0 AND discount <= line_subtotal);
ALTER TABLE vendor_supply_records ADD CONSTRAINT supply_qty_positive CHECK (quantity > 0);
ALTER TABLE vendor_supply_records ADD CONSTRAINT supply_price_nonneg CHECK (unit_price >= 0);
ALTER TABLE invoice_payments ADD CONSTRAINT payment_nonzero CHECK (amount <> 0);
ALTER TABLE invoice_payments ADD CONSTRAINT payment_positive_unless_correction CHECK (entry_type = 'CORRECTION' OR amount > 0);
ALTER TABLE expenses ADD CONSTRAINT expenses_currency_upper CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE invoices ADD CONSTRAINT invoices_currency_upper CHECK (currency ~ '^[A-Z]{3}$');

-- Append-only tables: audit log, payment ledger, status histories.
CREATE OR REPLACE FUNCTION expenvia_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only (% not permitted)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION expenvia_forbid_mutation();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION expenvia_forbid_mutation();
CREATE TRIGGER invoice_payments_append_only BEFORE UPDATE OR DELETE ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION expenvia_forbid_mutation();
CREATE TRIGGER expense_history_append_only BEFORE UPDATE OR DELETE ON expense_status_history
  FOR EACH ROW EXECUTE FUNCTION expenvia_forbid_mutation();
CREATE TRIGGER invoice_history_append_only BEFORE UPDATE OR DELETE ON invoice_status_history
  FOR EACH ROW EXECUTE FUNCTION expenvia_forbid_mutation();

-- Submitted invoice line items are frozen (snapshot integrity)
CREATE OR REPLACE FUNCTION expenvia_lock_submitted_lines() RETURNS trigger AS $$
DECLARE s "InvoiceStatus";
BEGIN
  SELECT status INTO s FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF s IS NOT NULL AND s NOT IN ('DRAFT', 'REVISION_REQUESTED') THEN
    RAISE EXCEPTION 'Line items of a % invoice cannot be changed', s USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_lines_locked BEFORE INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION expenvia_lock_submitted_lines();
