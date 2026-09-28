-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('MEMBERSHIP_RENEWAL', 'PAYMENT_DUE', 'LEAD_FOLLOW_UP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SCHEDULED', 'QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryAttemptStatus" AS ENUM ('STARTED', 'SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_NOTIFICATION_TEMPLATE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_NOTIFICATION_TEMPLATE';
ALTER TYPE "AuditAction" ADD VALUE 'QUEUE_NOTIFICATION';
ALTER TYPE "AuditAction" ADD VALUE 'RETRY_NOTIFICATION';
ALTER TYPE "AuditAction" ADD VALUE 'CANCEL_NOTIFICATION';

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "body" TEXT NOT NULL,
    "providerTemplateName" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "renewalReminderDays" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
    "paymentReminderDays" INTEGER[] DEFAULT ARRAY[0, 3]::INTEGER[],
    "renewalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "leadFollowUpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "templateId" TEXT,
    "createdByUserId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "renderedBody" TEXT NOT NULL,
    "payload" JSONB,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "provider" TEXT,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "DeliveryAttemptStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationTemplate_tenantId_kind_channel_isActive_idx" ON "NotificationTemplate"("tenantId", "kind", "channel", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_tenantId_key_key" ON "NotificationTemplate"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPolicy_tenantId_key" ON "NotificationPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationEvent_tenantId_status_scheduledAt_idx" ON "NotificationEvent"("tenantId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_tenantId_branchId_createdAt_idx" ON "NotificationEvent"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationEvent_tenantId_subjectType_subjectId_idx" ON "NotificationEvent"("tenantId", "subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_tenantId_idempotencyKey_key" ON "NotificationEvent"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationDeliveryAttempt_tenantId_eventId_startedAt_idx" ON "NotificationDeliveryAttempt"("tenantId", "eventId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_eventId_attemptNumber_key" ON "NotificationDeliveryAttempt"("eventId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPolicy" ADD CONSTRAINT "NotificationPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
