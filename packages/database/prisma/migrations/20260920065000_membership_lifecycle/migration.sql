ALTER TYPE "AuditAction" ADD VALUE 'ASSIGN_MEMBERSHIP';
ALTER TYPE "AuditAction" ADD VALUE 'RENEW_MEMBERSHIP';
ALTER TYPE "AuditAction" ADD VALUE 'FREEZE_MEMBERSHIP';
ALTER TYPE "AuditAction" ADD VALUE 'RESUME_MEMBERSHIP';
ALTER TYPE "AuditAction" ADD VALUE 'CANCEL_MEMBERSHIP';

ALTER TABLE "MembershipPlan" ADD COLUMN "description" TEXT;

ALTER TABLE "Membership"
ADD COLUMN "frozenAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT;

CREATE TABLE "MembershipFreeze" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipFreeze_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MembershipFreeze_tenantId_membershipId_startedAt_idx"
ON "MembershipFreeze"("tenantId", "membershipId", "startedAt");

ALTER TABLE "MembershipFreeze"
ADD CONSTRAINT "MembershipFreeze_membershipId_fkey"
FOREIGN KEY ("membershipId") REFERENCES "Membership"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
