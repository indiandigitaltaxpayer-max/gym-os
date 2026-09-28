-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'TRIAL_SCHEDULED', 'TRIAL_COMPLETED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WALK_IN', 'PHONE', 'WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('CREATED', 'UPDATED', 'STAGE_CHANGED', 'ASSIGNED', 'NOTE', 'FOLLOW_UP_SCHEDULED', 'FOLLOW_UP_COMPLETED', 'FOLLOW_UP_CANCELLED', 'CONVERTED', 'ARCHIVED', 'REACTIVATED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_LEAD';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_LEAD';
ALTER TYPE "AuditAction" ADD VALUE 'STAGE_LEAD';
ALTER TYPE "AuditAction" ADD VALUE 'ASSIGN_LEAD';
ALTER TYPE "AuditAction" ADD VALUE 'SCHEDULE_FOLLOW_UP';
ALTER TYPE "AuditAction" ADD VALUE 'COMPLETE_FOLLOW_UP';
ALTER TYPE "AuditAction" ADD VALUE 'CANCEL_FOLLOW_UP';
ALTER TYPE "AuditAction" ADD VALUE 'CONVERT_LEAD';

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "convertedMemberId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "source" "LeadSource" NOT NULL,
    "sourceDetail" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "lossReason" TEXT,
    "convertedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "LeadActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedMemberId_key" ON "Lead"("convertedMemberId");

-- CreateIndex
CREATE INDEX "Lead_tenantId_branchId_stage_archivedAt_idx" ON "Lead"("tenantId", "branchId", "stage", "archivedAt");

-- CreateIndex
CREATE INDEX "Lead_tenantId_assignedToUserId_stage_idx" ON "Lead"("tenantId", "assignedToUserId", "stage");

-- CreateIndex
CREATE INDEX "Lead_tenantId_createdAt_idx" ON "Lead"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_tenantId_phone_idx" ON "Lead"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "Lead_tenantId_email_idx" ON "Lead"("tenantId", "email");

-- CreateIndex
CREATE INDEX "FollowUpTask_tenantId_assignedToUserId_status_dueAt_idx" ON "FollowUpTask"("tenantId", "assignedToUserId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "FollowUpTask_tenantId_leadId_dueAt_idx" ON "FollowUpTask"("tenantId", "leadId", "dueAt");

-- CreateIndex
CREATE INDEX "LeadActivity_tenantId_leadId_createdAt_idx" ON "LeadActivity"("tenantId", "leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedMemberId_fkey" FOREIGN KEY ("convertedMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
