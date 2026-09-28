-- Add enum values used by the immutable billing ledger.
ALTER TYPE "AuditAction" ADD VALUE 'ISSUE_INVOICE';
ALTER TYPE "AuditAction" ADD VALUE 'VOID_INVOICE';
ALTER TYPE "AuditAction" ADD VALUE 'REVERSE_PAYMENT';
ALTER TYPE "PaymentStatus" ADD VALUE 'REVERSED';

-- Add nullable branch first so existing demo invoices can be backfilled safely.
ALTER TABLE "Invoice"
ADD COLUMN "branchId" TEXT,
ADD COLUMN "discountMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "issuedByUserId" TEXT,
ADD COLUMN "voidReason" TEXT,
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedByUserId" TEXT;

UPDATE "Invoice" invoice
SET "branchId" = member."homeBranchId"
FROM "Member" member
WHERE member.id = invoice."memberId";

ALTER TABLE "Invoice" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "Payment"
ADD COLUMN "note" TEXT,
ADD COLUMN "receiptNumber" TEXT,
ADD COLUMN "recordedByUserId" TEXT,
ADD COLUMN "reversalReason" TEXT,
ADD COLUMN "reversedAt" TIMESTAMP(3),
ADD COLUMN "reversedByUserId" TEXT;

ALTER TABLE "Tenant"
ADD COLUMN "invoiceSequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "receiptSequence" INTEGER NOT NULL DEFAULT 0;

UPDATE "Tenant" tenant
SET "invoiceSequence" = (
  SELECT COUNT(*)::INTEGER FROM "Invoice" invoice WHERE invoice."tenantId" = tenant.id
),
"receiptSequence" = (
  SELECT COUNT(*)::INTEGER FROM "Payment" payment WHERE payment."tenantId" = tenant.id
);

CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- Legacy demo invoices receive a best-effort snapshot from their linked plan.
INSERT INTO "InvoiceLineItem" (
  "id", "tenantId", "invoiceId", "description", "quantity",
  "unitPriceMinor", "subtotalMinor", "taxRateBps", "taxMinor", "totalMinor"
)
SELECT
  'legacy_' || invoice.id,
  invoice."tenantId",
  invoice.id,
  COALESCE(plan.name, 'Membership'),
  1,
  invoice."subtotalMinor",
  invoice."subtotalMinor",
  COALESCE(plan."taxRateBps", 0),
  invoice."taxMinor",
  invoice."totalMinor"
FROM "Invoice" invoice
LEFT JOIN "Membership" membership ON membership.id = invoice."membershipId"
LEFT JOIN "MembershipPlan" plan ON plan.id = membership."planId";

CREATE INDEX "InvoiceLineItem_tenantId_invoiceId_idx" ON "InvoiceLineItem"("tenantId", "invoiceId");
CREATE INDEX "Invoice_tenantId_branchId_issuedAt_idx" ON "Invoice"("tenantId", "branchId", "issuedAt");
CREATE INDEX "Payment_tenantId_invoiceId_status_idx" ON "Payment"("tenantId", "invoiceId", "status");
CREATE UNIQUE INDEX "Payment_tenantId_receiptNumber_key" ON "Payment"("tenantId", "receiptNumber");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing role rows need the newly approved front-desk read permission.
UPDATE "Role"
SET permissions = array_append(permissions, 'payment.read')
WHERE name = 'Front desk' AND NOT ('payment.read' = ANY(permissions));
