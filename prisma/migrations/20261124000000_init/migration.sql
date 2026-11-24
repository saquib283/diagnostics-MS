-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PortalType" AS ENUM ('CONSULTANCY', 'PARTNER');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('CONSULTANCY', 'PARTNER');

-- CreateEnum
CREATE TYPE "PartnerRoleCode" AS ENUM ('PARTNER_ADMIN', 'PARTNER_STAFF', 'PARTNER_REPORT_MANAGER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('DATA_PROCESSING', 'WHATSAPP_COMMUNICATION', 'EMAIL_COMMUNICATION', 'PARTNER_SHARING');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CommercialModel" AS ENUM ('MODEL_A_CONSULTANCY_COLLECTS', 'MODEL_B_PATIENT_PAYS_PARTNER');

-- CreateEnum
CREATE TYPE "AllowedContractModels" AS ENUM ('MODEL_A_ONLY', 'MODEL_B_ONLY', 'BOTH');

-- CreateEnum
CREATE TYPE "CommissionCalculationBasis" AS ENUM ('UNCONFIGURED', 'NET_AFTER_DISCOUNT_EXCL_TAX', 'GROSS_BEFORE_DISCOUNT_EXCL_TAX', 'NET_INCL_TAX');

-- CreateEnum
CREATE TYPE "PartnerPhoneVisibility" AS ENUM ('MASKED', 'FULL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SettlementCycle" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "DocumentSequenceType" AS ENUM ('PATIENT', 'ORDER', 'INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'RECEIPT', 'REFUND', 'SETTLEMENT', 'JOURNAL');

-- CreateEnum
CREATE TYPE "SupplyCategory" AS ENUM ('DIAGNOSTIC_SERVICE', 'CONSULTANCY_COMMISSION', 'OTHER_FEE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'UNABLE_TO_PERFORM');

-- CreateEnum
CREATE TYPE "SettlementLockStatus" AS ENUM ('UNSETTLED', 'IN_SETTLEMENT', 'SETTLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOID');

-- CreateEnum
CREATE TYPE "AdjustmentNoteType" AS ENUM ('CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('ISSUED_INVOICE_PDF', 'ACCOUNT_STATEMENT_PDF', 'RECEIPT_PDF', 'CREDIT_NOTE_PDF', 'DEBIT_NOTE_PDF', 'SETTLEMENT_PDF');

-- CreateEnum
CREATE TYPE "ShareResourceType" AS ENUM ('INVOICE', 'RECEIPT', 'STATEMENT', 'REPORT');

-- CreateEnum
CREATE TYPE "ShareChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'LINK_COPY', 'DOWNLOAD', 'PRINT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'MANUAL', 'PROVIDER_NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI_QR', 'UPI_ONLINE', 'CARD', 'NETBANKING', 'BANK_TRANSFER', 'WALLET', 'STATIC_QR_MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('RAZORPAY');

-- CreateEnum
CREATE TYPE "GatewaySettlementState" AS ENUM ('UNSETTLED', 'SETTLED_BY_GATEWAY', 'BANK_RECONCILED');

-- CreateEnum
CREATE TYPE "QrMode" AS ENUM ('DYNAMIC_SINGLE_USE', 'STATIC_FALLBACK');

-- CreateEnum
CREATE TYPE "QrSessionStatus" AS ENUM ('ACTIVE', 'CREDITED', 'EXPIRED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED_DUPLICATE', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('GATEWAY_REVERSAL', 'CASH', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CollectionRecordType" AS ENUM ('MODEL_B_PARTNER_DIRECT', 'STATIC_QR_UNMATCHED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('UNRECONCILED', 'MATCHED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ReportTrackingStatus" AS ENUM ('AWAITING', 'PROCESSING', 'UPLOADED', 'REVIEWED', 'READY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "SettlementDirection" AS ENUM ('PAYABLE_TO_PARTNER', 'RECEIVABLE_FROM_PARTNER');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_SETTLED', 'SETTLED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PartnerPaymentDirection" AS ENUM ('OUTFLOW_TO_PARTNER', 'INFLOW_FROM_PARTNER');

-- CreateEnum
CREATE TYPE "PartnerPayoutMethod" AS ENUM ('NEFT', 'RTGS', 'IMPS', 'UPI', 'CHEQUE', 'CASH');

-- CreateEnum
CREATE TYPE "PartnerAdjustmentType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "gstin" VARCHAR(20),
    "pan" VARCHAR(16),
    "cin" VARCHAR(30),
    "registered_address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "state_name" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(12) NOT NULL,
    "contact_email" VARCHAR(160) NOT NULL,
    "contact_phone" VARCHAR(24) NOT NULL,
    "website" VARCHAR(200),
    "logo_storage_key" VARCHAR(255),
    "signature_storage_key" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "default_commission_basis" "CommissionCalculationBasis" NOT NULL DEFAULT 'UNCONFIGURED',
    "require_consultancy_completion_approval" BOOLEAN NOT NULL DEFAULT false,
    "allow_invoice_overpayment" BOOLEAN NOT NULL DEFAULT false,
    "partner_patient_phone_visibility" "PartnerPhoneVisibility" NOT NULL DEFAULT 'MASKED',
    "require_settlement_approval" BOOLEAN NOT NULL DEFAULT true,
    "gst_enabled" BOOLEAN NOT NULL DEFAULT false,
    "invoice_document_title" VARCHAR(80) NOT NULL DEFAULT 'Invoice',
    "static_qr_fallback_enabled" BOOLEAN NOT NULL DEFAULT false,
    "static_qr_vpa_label" VARCHAR(120),
    "share_link_default_ttl_hours" INTEGER NOT NULL DEFAULT 72,
    "invoice_terms_text" TEXT,
    "invoice_footer_note" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_sequences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "doc_type" "DocumentSequenceType" NOT NULL,
    "financial_year" VARCHAR(12) NOT NULL,
    "prefix" VARCHAR(24) NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "padding_length" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "hsn_sac_code" VARCHAR(20) NOT NULL,
    "supply_category" "SupplyCategory" NOT NULL,
    "cgst_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "is_exempt" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateway_settings" (
    "id" UUID NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "environment" VARCHAR(20) NOT NULL DEFAULT 'SANDBOX',
    "key_id_env_ref" VARCHAR(64) NOT NULL DEFAULT 'RAZORPAY_KEY_ID',
    "webhook_enabled" BOOLEAN NOT NULL DEFAULT false,
    "dynamic_qr_enabled" BOOLEAN NOT NULL DEFAULT false,
    "supported_methods_json" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_gateway_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "actor_id" UUID NOT NULL,
    "route" VARCHAR(160) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_json" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "mobile" VARCHAR(24),
    "full_name" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "portal_type" "PortalType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token_hash" CHAR(64) NOT NULL,
    "csrf_token" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "scope" "RoleScope" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "module" VARCHAR(60) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_users" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "partner_role" "PartnerRoleCode" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_role_snapshot" VARCHAR(160),
    "partner_scope_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" VARCHAR(80) NOT NULL,
    "request_id" VARCHAR(64),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "before_json" JSONB,
    "after_json" JSONB,
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "patient_code" VARCHAR(32) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "mobile" VARCHAR(24) NOT NULL,
    "alternate_mobile" VARCHAR(24),
    "email" VARCHAR(160),
    "date_of_birth" DATE,
    "age_years_snapshot" SMALLINT,
    "gender" "Gender" NOT NULL,
    "address_line" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(12),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo_data" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_contacts" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "contact_name" VARCHAR(160) NOT NULL,
    "relationship" VARCHAR(60) NOT NULL,
    "mobile" VARCHAR(24) NOT NULL,
    "email" VARCHAR(160),
    "is_primary_guardian" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_consents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "consent_type" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "captured_by_id" UUID NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "notes" VARCHAR(255),

    CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "test_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category_id" UUID NOT NULL,
    "description" TEXT,
    "sample_type" VARCHAR(80),
    "turnaround_hours" INTEGER,
    "default_selling_price" DECIMAL(14,2) NOT NULL,
    "tax_code_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_packages" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "default_selling_price" DECIMAL(14,2) NOT NULL,
    "tax_code_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "test_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_package_items" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "allocation_weight" DECIMAL(7,4) NOT NULL DEFAULT 1.0000,

    CONSTRAINT "test_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "partner_code" VARCHAR(32) NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "contact_person" VARCHAR(160) NOT NULL,
    "email" VARCHAR(160),
    "phone" VARCHAR(24) NOT NULL,
    "address_line" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state_code" CHAR(2) NOT NULL,
    "state_name" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(12) NOT NULL,
    "gstin" VARCHAR(20),
    "pan" VARCHAR(16),
    "default_payment_model" "CommercialModel" NOT NULL,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 15,
    "bank_account_name" VARCHAR(160),
    "bank_account_number_masked" VARCHAR(40),
    "bank_ifsc" VARCHAR(16),
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_demo_data" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_contracts" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "contract_number" VARCHAR(48) NOT NULL,
    "allowed_models" "AllowedContractModels" NOT NULL,
    "commission_basis" "CommissionCalculationBasis" NOT NULL DEFAULT 'UNCONFIGURED',
    "settlement_cycle" "SettlementCycle" NOT NULL DEFAULT 'MONTHLY',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "agreement_storage_key" VARCHAR(255),
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_test_prices" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "agreed_purchase_price" DECIMAL(14,2) NOT NULL,
    "partner_mrp_reference" DECIMAL(14,2),
    "is_performed" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_test_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_package_prices" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "agreed_purchase_price" DECIMAL(14,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_package_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_commission_rates" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "test_id" UUID,
    "commission_percentage" DECIMAL(7,4) NOT NULL,
    "calculation_basis" "CommissionCalculationBasis" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_commission_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(36) NOT NULL,
    "patient_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "contract_id" UUID,
    "payment_model" "CommercialModel" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "referring_doctor" VARCHAR(160),
    "clinical_notes" TEXT,
    "internal_notes" TEXT,
    "subtotal_selling" DECIMAL(14,2) NOT NULL,
    "discount_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_selling_total" DECIMAL(14,2) NOT NULL,
    "partner_payable_estimate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commission_estimate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "diagnostic_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "source_package_id" UUID,
    "test_code_snapshot" VARCHAR(40) NOT NULL,
    "test_name_snapshot" VARCHAR(200) NOT NULL,
    "hsn_sac_snapshot" VARCHAR(20),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_selling_price_snapshot" DECIMAL(14,2) NOT NULL,
    "discount_amount_snapshot" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxable_amount_snapshot" DECIMAL(14,2) NOT NULL,
    "tax_code_snapshot" VARCHAR(32),
    "cgst_rate_snapshot" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "sgst_rate_snapshot" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "igst_rate_snapshot" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "tax_amount_snapshot" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_selling_amount_snapshot" DECIMAL(14,2) NOT NULL,
    "partner_unit_price_snapshot" DECIMAL(14,2) NOT NULL,
    "partner_net_payable_snapshot" DECIMAL(14,2) NOT NULL,
    "commission_percentage_snapshot" DECIMAL(7,4),
    "commission_basis_snapshot" "CommissionCalculationBasis",
    "commission_amount_snapshot" DECIMAL(14,2),
    "status" "OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_user_id" UUID,
    "completion_approved_at" TIMESTAMPTZ(3),
    "completion_approved_by_id" UUID,
    "settlement_lock_status" "SettlementLockStatus" NOT NULL DEFAULT 'UNSETTLED',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID,
    "previous_status" VARCHAR(40) NOT NULL,
    "new_status" VARCHAR(40) NOT NULL,
    "reason" TEXT,
    "actor_user_id" UUID NOT NULL,
    "actor_portal" "PortalType" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "invoice_number" VARCHAR(40) NOT NULL,
    "order_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "document_title_snapshot" VARCHAR(80) NOT NULL DEFAULT 'Invoice',
    "issue_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMPTZ(3),
    "issuer_legal_name_snapshot" VARCHAR(200) NOT NULL,
    "issuer_gstin_snapshot" VARCHAR(20),
    "issuer_address_snapshot" TEXT NOT NULL,
    "patient_name_snapshot" VARCHAR(160) NOT NULL,
    "patient_code_snapshot" VARCHAR(32) NOT NULL,
    "patient_mobile_snapshot" VARCHAR(24) NOT NULL,
    "partner_name_snapshot" VARCHAR(200) NOT NULL,
    "place_of_supply_state_code" CHAR(2),
    "subtotal_amount" DECIMAL(14,2) NOT NULL,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(14,2) NOT NULL,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(14,2) NOT NULL,
    "credit_note_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "debit_note_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "effective_total" DECIMAL(14,2) NOT NULL,
    "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount_refunded" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_collected" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(14,2) NOT NULL,
    "terms_snapshot" TEXT,
    "issued_by_id" UUID NOT NULL,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "description_snapshot" VARCHAR(220) NOT NULL,
    "test_code_snapshot" VARCHAR(40) NOT NULL,
    "hsn_sac_snapshot" VARCHAR(20),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxable_amount" DECIMAL(14,2) NOT NULL,
    "cgst_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_tax_snapshots" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "tax_code_snapshot" VARCHAR(32) NOT NULL,
    "hsn_sac_snapshot" VARCHAR(20),
    "taxable_value" DECIMAL(14,2) NOT NULL,
    "cgst_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_tax_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_adjustment_notes" (
    "id" UUID NOT NULL,
    "note_number" VARCHAR(40) NOT NULL,
    "invoice_id" UUID NOT NULL,
    "note_type" "AdjustmentNoteType" NOT NULL,
    "reason" TEXT NOT NULL,
    "taxable_delta" DECIMAL(14,2) NOT NULL,
    "tax_delta" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_delta" DECIMAL(14,2) NOT NULL,
    "pdf_storage_key" VARCHAR(255),
    "approved_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_adjustment_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_invoice_references" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "partner_invoice_number" VARCHAR(80) NOT NULL,
    "partner_receipt_number" VARCHAR(80),
    "invoice_date" DATE NOT NULL,
    "gross_amount" DECIMAL(14,2) NOT NULL,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_amount_paid_by_patient" DECIMAL(14,2) NOT NULL,
    "payment_mode_reported" VARCHAR(40),
    "document_storage_key" VARCHAR(255),
    "notes" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_invoice_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_documents" (
    "id" UUID NOT NULL,
    "invoice_id" UUID,
    "receipt_id" UUID,
    "doc_kind" "DocumentKind" NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "sha256_checksum" CHAR(64) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "generated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_share_tokens" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "resource_type" "ShareResourceType" NOT NULL,
    "resource_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "max_views" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_share_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_share_logs" (
    "id" UUID NOT NULL,
    "invoice_id" UUID,
    "receipt_id" UUID,
    "report_file_id" UUID,
    "channel" "ShareChannel" NOT NULL,
    "destination_masked" VARCHAR(160),
    "share_token_id" UUID,
    "provider_message_id" VARCHAR(160),
    "delivery_status" "DeliveryStatus" NOT NULL,
    "error_message" TEXT,
    "shared_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_share_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_payments" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collected_by_id" UUID,
    "external_reference" VARCHAR(120),
    "idempotency_key" VARCHAR(128),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patient_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateway_transactions" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "gateway" "GatewayProvider" NOT NULL,
    "gateway_order_id" VARCHAR(80),
    "gateway_payment_id" VARCHAR(80),
    "gateway_qr_id" VARCHAR(80),
    "gateway_signature_verified" BOOLEAN NOT NULL DEFAULT false,
    "gateway_method" VARCHAR(40),
    "gateway_status" VARCHAR(40) NOT NULL,
    "gross_amount" DECIMAL(14,2) NOT NULL,
    "gateway_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gateway_fee_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_settlement_estimate" DECIMAL(14,2),
    "settlement_status" "GatewaySettlementState" NOT NULL DEFAULT 'UNSETTLED',
    "minimized_payload_json" JSONB,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_gateway_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_qr_sessions" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "gateway_qr_id" VARCHAR(80) NOT NULL,
    "qr_mode" "QrMode" NOT NULL DEFAULT 'DYNAMIC_SINGLE_USE',
    "amount" DECIMAL(14,2) NOT NULL,
    "qr_image_url" TEXT,
    "qr_payload" TEXT,
    "status" "QrSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_qr_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "gateway" "GatewayProvider" NOT NULL,
    "event_id" VARCHAR(120) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "signature_verified" BOOLEAN NOT NULL,
    "processing_status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "redacted_payload_json" JSONB NOT NULL,
    "error_message" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" UUID NOT NULL,
    "receipt_number" VARCHAR(40) NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "payment_method_snapshot" VARCHAR(40) NOT NULL,
    "invoice_balance_after" DECIMAL(14,2) NOT NULL,
    "pdf_storage_key" VARCHAR(255),
    "issued_by_id" UUID,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "refund_number" VARCHAR(40) NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "refund_method" "RefundMethod" NOT NULL,
    "gateway_refund_id" VARCHAR(80),
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_settlements" (
    "id" UUID NOT NULL,
    "gateway" "GatewayProvider" NOT NULL,
    "gateway_settlement_id" VARCHAR(80) NOT NULL,
    "utr_number" VARCHAR(80),
    "gross_amount" DECIMAL(14,2) NOT NULL,
    "total_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "settled_at" TIMESTAMPTZ(3) NOT NULL,
    "bank_reconciled_at" TIMESTAMPTZ(3),
    "reconciled_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_settlement_allocations" (
    "id" UUID NOT NULL,
    "gateway_settlement_id" UUID NOT NULL,
    "gateway_transaction_id" UUID NOT NULL,
    "allocated_gross" DECIMAL(14,2) NOT NULL,
    "allocated_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "allocated_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "allocated_net" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "gateway_settlement_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_records" (
    "id" UUID NOT NULL,
    "record_type" "CollectionRecordType" NOT NULL,
    "order_id" UUID,
    "partner_id" UUID,
    "matched_invoice_id" UUID,
    "matched_payment_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference_number" VARCHAR(120) NOT NULL,
    "collected_at" TIMESTAMPTZ(3) NOT NULL,
    "reconciliation_status" "ReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "reconciled_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_tracking" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "status" "ReportTrackingStatus" NOT NULL DEFAULT 'AWAITING',
    "expected_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,
    "delivered_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_files" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "sha256_checksum" CHAR(64) NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by_user_id" UUID NOT NULL,
    "uploaded_portal" "PortalType" NOT NULL,
    "superseded_at" TIMESTAMPTZ(3),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_attachments" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "category" VARCHAR(60) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "sha256_checksum" CHAR(64) NOT NULL,
    "storage_key" VARCHAR(255) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_logs" (
    "id" UUID NOT NULL,
    "resource_type" VARCHAR(40) NOT NULL,
    "resource_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "share_token_id" UUID,
    "action" VARCHAR(40) NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "settlement_number" VARCHAR(40) NOT NULL,
    "partner_id" UUID NOT NULL,
    "direction" "SettlementDirection" NOT NULL,
    "commercial_model" "CommercialModel" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "gross_eligible_amount" DECIMAL(14,2) NOT NULL,
    "adjustments_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "settled_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(14,2) NOT NULL,
    "prepared_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "reversal_reason" TEXT,
    "reversed_at" TIMESTAMPTZ(3),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_items" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "is_active_lock" BOOLEAN NOT NULL DEFAULT true,
    "test_name_snapshot" VARCHAR(200) NOT NULL,
    "completed_at_snapshot" TIMESTAMPTZ(3) NOT NULL,
    "base_amount" DECIMAL(14,2) NOT NULL,
    "commission_rate_snapshot" DECIMAL(7,4),
    "settlement_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_payments" (
    "id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "direction" "PartnerPaymentDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "unallocated_amount" DECIMAL(14,2) NOT NULL,
    "payment_method" "PartnerPayoutMethod" NOT NULL,
    "utr_or_reference" VARCHAR(120) NOT NULL,
    "payment_date" TIMESTAMPTZ(3) NOT NULL,
    "bank_account_id" UUID,
    "recorded_by_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "partner_payment_id" UUID NOT NULL,
    "allocated_amount" DECIMAL(14,2) NOT NULL,
    "allocated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_adjustments" (
    "id" UUID NOT NULL,
    "settlement_id" UUID,
    "partner_id" UUID NOT NULL,
    "adjustment_type" "PartnerAdjustmentType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "approved_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(24) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" UUID NOT NULL,
    "code" VARCHAR(24) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "entry_number" VARCHAR(40) NOT NULL,
    "period_id" UUID,
    "posting_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference_type" VARCHAR(60) NOT NULL,
    "reference_id" VARCHAR(80) NOT NULL,
    "narration" TEXT NOT NULL,
    "reversal_of_entry_id" UUID,
    "posted_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" UUID NOT NULL,
    "journal_entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "partner_id" UUID,
    "memo" VARCHAR(255),

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "bank_name" VARCHAR(120) NOT NULL,
    "account_number_masked" VARCHAR(40) NOT NULL,
    "ifsc_code" VARCHAR(16) NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_records" (
    "id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "gateway_settlement_id" UUID,
    "statement_date" DATE NOT NULL,
    "bank_reference_utr" VARCHAR(100) NOT NULL,
    "statement_amount" DECIMAL(14,2) NOT NULL,
    "variance_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'MATCHED',
    "reconciled_by_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "channel" "ShareChannel" NOT NULL,
    "provider_template_id" VARCHAR(120),
    "subject_template" VARCHAR(200),
    "body_template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "template_id" UUID,
    "channel" "ShareChannel" NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "recipient_masked" VARCHAR(160) NOT NULL,
    "reference_type" VARCHAR(60) NOT NULL,
    "reference_id" UUID NOT NULL,
    "provider_message_id" VARCHAR(160),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organization_id_key" ON "organization_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_sequences_organization_id_doc_type_financial_year_key" ON "invoice_sequences"("organization_id", "doc_type", "financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_code_key" ON "tax_codes"("code");

-- CreateIndex
CREATE INDEX "tax_codes_supply_category_is_active_idx" ON "tax_codes"("supply_category", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateway_settings_provider_key" ON "payment_gateway_settings"("provider");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_id_route_key_key" ON "idempotency_records"("actor_id", "route", "key");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_portal_type_is_active_idx" ON "users"("portal_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_hash_key" ON "sessions"("session_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "partner_users_partner_id_is_active_idx" ON "partner_users"("partner_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "partner_users_user_id_partner_id_key" ON "partner_users"("user_id", "partner_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_partner_scope_id_created_at_idx" ON "audit_logs"("partner_scope_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "patients_patient_code_key" ON "patients"("patient_code");

-- CreateIndex
CREATE INDEX "patients_mobile_idx" ON "patients"("mobile");

-- CreateIndex
CREATE INDEX "patients_full_name_idx" ON "patients"("full_name");

-- CreateIndex
CREATE INDEX "patients_created_at_idx" ON "patients"("created_at" DESC);

-- CreateIndex
CREATE INDEX "patient_contacts_patient_id_idx" ON "patient_contacts"("patient_id");

-- CreateIndex
CREATE INDEX "patient_consents_patient_id_consent_type_idx" ON "patient_consents"("patient_id", "consent_type");

-- CreateIndex
CREATE UNIQUE INDEX "test_categories_code_key" ON "test_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tests_code_key" ON "tests"("code");

-- CreateIndex
CREATE INDEX "tests_category_id_is_active_idx" ON "tests"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "tests_name_idx" ON "tests"("name");

-- CreateIndex
CREATE UNIQUE INDEX "test_packages_code_key" ON "test_packages"("code");

-- CreateIndex
CREATE INDEX "test_packages_is_active_idx" ON "test_packages"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "test_package_items_package_id_test_id_key" ON "test_package_items"("package_id", "test_id");

-- CreateIndex
CREATE UNIQUE INDEX "partners_partner_code_key" ON "partners"("partner_code");

-- CreateIndex
CREATE INDEX "partners_status_idx" ON "partners"("status");

-- CreateIndex
CREATE UNIQUE INDEX "partner_contracts_contract_number_key" ON "partner_contracts"("contract_number");

-- CreateIndex
CREATE INDEX "partner_contracts_partner_id_status_idx" ON "partner_contracts"("partner_id", "status");

-- CreateIndex
CREATE INDEX "partner_test_prices_partner_id_test_id_is_active_effective__idx" ON "partner_test_prices"("partner_id", "test_id", "is_active", "effective_from");

-- CreateIndex
CREATE INDEX "partner_package_prices_partner_id_package_id_is_active_idx" ON "partner_package_prices"("partner_id", "package_id", "is_active");

-- CreateIndex
CREATE INDEX "partner_commission_rates_partner_id_test_id_is_active_effec_idx" ON "partner_commission_rates"("partner_id", "test_id", "is_active", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_orders_order_number_key" ON "diagnostic_orders"("order_number");

-- CreateIndex
CREATE INDEX "diagnostic_orders_patient_id_created_at_idx" ON "diagnostic_orders"("patient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "diagnostic_orders_partner_id_status_created_at_idx" ON "diagnostic_orders"("partner_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "diagnostic_orders_status_created_at_idx" ON "diagnostic_orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_status_settlement_lock_status_idx" ON "order_items"("status", "settlement_lock_status");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "order_status_history_order_item_id_created_at_idx" ON "order_status_history"("order_item_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_order_id_key" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX "invoices_patient_id_issue_date_idx" ON "invoices"("patient_id", "issue_date" DESC);

-- CreateIndex
CREATE INDEX "invoices_partner_id_status_idx" ON "invoices"("partner_id", "status");

-- CreateIndex
CREATE INDEX "invoices_status_issue_date_idx" ON "invoices"("status", "issue_date" DESC);

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_tax_snapshots_invoice_id_idx" ON "invoice_tax_snapshots"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_adjustment_notes_note_number_key" ON "invoice_adjustment_notes"("note_number");

-- CreateIndex
CREATE INDEX "invoice_adjustment_notes_invoice_id_idx" ON "invoice_adjustment_notes"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_invoice_references_order_id_key" ON "partner_invoice_references"("order_id");

-- CreateIndex
CREATE INDEX "partner_invoice_references_partner_id_invoice_date_idx" ON "partner_invoice_references"("partner_id", "invoice_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_documents_storage_key_key" ON "invoice_documents"("storage_key");

-- CreateIndex
CREATE INDEX "invoice_documents_invoice_id_doc_kind_idx" ON "invoice_documents"("invoice_id", "doc_kind");

-- CreateIndex
CREATE UNIQUE INDEX "document_share_tokens_token_hash_key" ON "document_share_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "document_share_tokens_resource_type_resource_id_idx" ON "document_share_tokens"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "document_share_tokens_expires_at_idx" ON "document_share_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "invoice_share_logs_invoice_id_created_at_idx" ON "invoice_share_logs"("invoice_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "patient_payments_invoice_id_payment_status_idx" ON "patient_payments"("invoice_id", "payment_status");

-- CreateIndex
CREATE INDEX "patient_payments_payment_date_payment_method_idx" ON "patient_payments"("payment_date" DESC, "payment_method");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateway_transactions_payment_id_key" ON "payment_gateway_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "payment_gateway_transactions_gateway_order_id_idx" ON "payment_gateway_transactions"("gateway_order_id");

-- CreateIndex
CREATE INDEX "payment_gateway_transactions_settlement_status_idx" ON "payment_gateway_transactions"("settlement_status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateway_transactions_gateway_gateway_payment_id_key" ON "payment_gateway_transactions"("gateway", "gateway_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_qr_sessions_gateway_qr_id_key" ON "payment_qr_sessions"("gateway_qr_id");

-- CreateIndex
CREATE INDEX "payment_qr_sessions_invoice_id_status_idx" ON "payment_qr_sessions"("invoice_id", "status");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processing_status_received_at_idx" ON "payment_webhook_events"("processing_status", "received_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_gateway_event_id_key" ON "payment_webhook_events"("gateway", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_receipt_number_key" ON "payment_receipts"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_payment_id_key" ON "payment_receipts"("payment_id");

-- CreateIndex
CREATE INDEX "payment_receipts_invoice_id_idx" ON "payment_receipts"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_refund_number_key" ON "refunds"("refund_number");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_gateway_refund_id_key" ON "refunds"("gateway_refund_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_invoice_id_status_idx" ON "refunds"("invoice_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_settlements_gateway_settlement_id_key" ON "gateway_settlements"("gateway_settlement_id");

-- CreateIndex
CREATE INDEX "gateway_settlements_settled_at_idx" ON "gateway_settlements"("settled_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "gateway_settlement_allocations_gateway_settlement_id_gatewa_key" ON "gateway_settlement_allocations"("gateway_settlement_id", "gateway_transaction_id");

-- CreateIndex
CREATE INDEX "collection_records_record_type_reconciliation_status_idx" ON "collection_records"("record_type", "reconciliation_status");

-- CreateIndex
CREATE UNIQUE INDEX "report_tracking_order_item_id_key" ON "report_tracking"("order_item_id");

-- CreateIndex
CREATE INDEX "report_tracking_status_idx" ON "report_tracking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "report_files_storage_key_key" ON "report_files"("storage_key");

-- CreateIndex
CREATE INDEX "report_files_order_item_id_is_latest_idx" ON "report_files"("order_item_id", "is_latest");

-- CreateIndex
CREATE UNIQUE INDEX "file_attachments_storage_key_key" ON "file_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "document_access_logs_resource_type_resource_id_created_at_idx" ON "document_access_logs"("resource_type", "resource_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "settlements_settlement_number_key" ON "settlements"("settlement_number");

-- CreateIndex
CREATE INDEX "settlements_partner_id_status_period_end_idx" ON "settlements"("partner_id", "status", "period_end" DESC);

-- CreateIndex
CREATE INDEX "settlement_items_order_item_id_is_active_lock_idx" ON "settlement_items"("order_item_id", "is_active_lock");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_items_settlement_id_order_item_id_key" ON "settlement_items"("settlement_id", "order_item_id");

-- CreateIndex
CREATE INDEX "partner_payments_partner_id_payment_date_idx" ON "partner_payments"("partner_id", "payment_date" DESC);

-- CreateIndex
CREATE INDEX "payment_allocations_settlement_id_idx" ON "payment_allocations"("settlement_id");

-- CreateIndex
CREATE INDEX "payment_allocations_partner_payment_id_idx" ON "payment_allocations"("partner_payment_id");

-- CreateIndex
CREATE INDEX "partner_adjustments_partner_id_idx" ON "partner_adjustments"("partner_id");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_code_key" ON "chart_of_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_code_key" ON "accounting_periods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_entry_number_key" ON "journal_entries"("entry_number");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversal_of_entry_id_key" ON "journal_entries"("reversal_of_entry_id");

-- CreateIndex
CREATE INDEX "journal_entries_reference_type_reference_id_idx" ON "journal_entries"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "journal_entries_posting_date_idx" ON "journal_entries"("posting_date" DESC);

-- CreateIndex
CREATE INDEX "journal_entry_lines_journal_entry_id_idx" ON "journal_entry_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_entry_lines_account_id_idx" ON "journal_entry_lines"("account_id");

-- CreateIndex
CREATE INDEX "reconciliation_records_bank_account_id_statement_date_idx" ON "reconciliation_records"("bank_account_id", "statement_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE INDEX "notification_logs_reference_type_reference_id_idx" ON "notification_logs"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "notification_logs_status_created_at_idx" ON "notification_logs"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_contacts" ADD CONSTRAINT "patient_contacts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_captured_by_id_fkey" FOREIGN KEY ("captured_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "test_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_packages" ADD CONSTRAINT "test_packages_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_package_items" ADD CONSTRAINT "test_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "test_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_package_items" ADD CONSTRAINT "test_package_items_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contracts" ADD CONSTRAINT "partner_contracts_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contracts" ADD CONSTRAINT "partner_contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_test_prices" ADD CONSTRAINT "partner_test_prices_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_test_prices" ADD CONSTRAINT "partner_test_prices_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_test_prices" ADD CONSTRAINT "partner_test_prices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_package_prices" ADD CONSTRAINT "partner_package_prices_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_package_prices" ADD CONSTRAINT "partner_package_prices_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "test_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commission_rates" ADD CONSTRAINT "partner_commission_rates_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commission_rates" ADD CONSTRAINT "partner_commission_rates_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commission_rates" ADD CONSTRAINT "partner_commission_rates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "partner_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_source_package_id_fkey" FOREIGN KEY ("source_package_id") REFERENCES "test_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_completion_approved_by_id_fkey" FOREIGN KEY ("completion_approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_tax_snapshots" ADD CONSTRAINT "invoice_tax_snapshots_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_adjustment_notes" ADD CONSTRAINT "invoice_adjustment_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_adjustment_notes" ADD CONSTRAINT "invoice_adjustment_notes_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_invoice_references" ADD CONSTRAINT "partner_invoice_references_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_invoice_references" ADD CONSTRAINT "partner_invoice_references_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_invoice_references" ADD CONSTRAINT "partner_invoice_references_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_documents" ADD CONSTRAINT "invoice_documents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_documents" ADD CONSTRAINT "invoice_documents_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "payment_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_documents" ADD CONSTRAINT "invoice_documents_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_share_tokens" ADD CONSTRAINT "document_share_tokens_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_share_logs" ADD CONSTRAINT "invoice_share_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_share_logs" ADD CONSTRAINT "invoice_share_logs_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "payment_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_share_logs" ADD CONSTRAINT "invoice_share_logs_report_file_id_fkey" FOREIGN KEY ("report_file_id") REFERENCES "report_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_share_logs" ADD CONSTRAINT "invoice_share_logs_share_token_id_fkey" FOREIGN KEY ("share_token_id") REFERENCES "document_share_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_share_logs" ADD CONSTRAINT "invoice_share_logs_shared_by_id_fkey" FOREIGN KEY ("shared_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_payments" ADD CONSTRAINT "patient_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_payments" ADD CONSTRAINT "patient_payments_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_gateway_transactions" ADD CONSTRAINT "payment_gateway_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "patient_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_qr_sessions" ADD CONSTRAINT "payment_qr_sessions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "patient_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_qr_sessions" ADD CONSTRAINT "payment_qr_sessions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_qr_sessions" ADD CONSTRAINT "payment_qr_sessions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "patient_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "patient_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_settlements" ADD CONSTRAINT "gateway_settlements_reconciled_by_id_fkey" FOREIGN KEY ("reconciled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_settlement_allocations" ADD CONSTRAINT "gateway_settlement_allocations_gateway_settlement_id_fkey" FOREIGN KEY ("gateway_settlement_id") REFERENCES "gateway_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateway_settlement_allocations" ADD CONSTRAINT "gateway_settlement_allocations_gateway_transaction_id_fkey" FOREIGN KEY ("gateway_transaction_id") REFERENCES "payment_gateway_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_records" ADD CONSTRAINT "collection_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_records" ADD CONSTRAINT "collection_records_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_records" ADD CONSTRAINT "collection_records_matched_invoice_id_fkey" FOREIGN KEY ("matched_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_records" ADD CONSTRAINT "collection_records_matched_payment_id_fkey" FOREIGN KEY ("matched_payment_id") REFERENCES "patient_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_records" ADD CONSTRAINT "collection_records_reconciled_by_id_fkey" FOREIGN KEY ("reconciled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_tracking" ADD CONSTRAINT "report_tracking_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_tracking" ADD CONSTRAINT "report_tracking_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_files" ADD CONSTRAINT "report_files_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_files" ADD CONSTRAINT "report_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_logs" ADD CONSTRAINT "document_access_logs_share_token_id_fkey" FOREIGN KEY ("share_token_id") REFERENCES "document_share_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_prepared_by_id_fkey" FOREIGN KEY ("prepared_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payments" ADD CONSTRAINT "partner_payments_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payments" ADD CONSTRAINT "partner_payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payments" ADD CONSTRAINT "partner_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_partner_payment_id_fkey" FOREIGN KEY ("partner_payment_id") REFERENCES "partner_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_allocated_by_id_fkey" FOREIGN KEY ("allocated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_adjustments" ADD CONSTRAINT "partner_adjustments_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_adjustments" ADD CONSTRAINT "partner_adjustments_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_adjustments" ADD CONSTRAINT "partner_adjustments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_entry_id_fkey" FOREIGN KEY ("reversal_of_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_gateway_settlement_id_fkey" FOREIGN KEY ("gateway_settlement_id") REFERENCES "gateway_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_reconciled_by_id_fkey" FOREIGN KEY ("reconciled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================================
-- Custom Financial & Integrity Constraints (DCMS Invariants)
-- ============================================================================

-- Prevent duplicate active settlement of the same completed order item
CREATE UNIQUE INDEX "settlement_items_active_order_item_lock_key"
  ON "settlement_items" ("order_item_id")
  WHERE ("is_active_lock" = true);

-- Enforce strictly positive financial transaction amounts
ALTER TABLE "patient_payments"
  ADD CONSTRAINT "patient_payments_amount_positive_chk" CHECK ("amount" > 0);

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_positive_chk" CHECK ("amount" > 0);

ALTER TABLE "partner_payments"
  ADD CONSTRAINT "partner_payments_amount_positive_chk" CHECK ("amount" > 0);

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_amount_positive_chk" CHECK ("allocated_amount" > 0);

ALTER TABLE "journal_entry_lines"
  ADD CONSTRAINT "journal_entry_lines_non_negative_chk"
  CHECK ("debit_amount" >= 0 AND "credit_amount" >= 0 AND NOT ("debit_amount" > 0 AND "credit_amount" > 0));
