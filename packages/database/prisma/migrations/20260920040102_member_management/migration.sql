-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ARCHIVE';
ALTER TYPE "AuditAction" ADD VALUE 'REACTIVATE';
ALTER TYPE "AuditAction" ADD VALUE 'NOTE';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "address" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "memberSequence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MemberNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberNote_tenantId_memberId_createdAt_idx" ON "MemberNote"("tenantId", "memberId", "createdAt");

-- CreateIndex
CREATE INDEX "Member_tenantId_homeBranchId_archivedAt_idx" ON "Member"("tenantId", "homeBranchId", "archivedAt");

-- AddForeignKey
ALTER TABLE "MemberNote" ADD CONSTRAINT "MemberNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberNote" ADD CONSTRAINT "MemberNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberNote" ADD CONSTRAINT "MemberNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
