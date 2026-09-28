-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('FRONT_DESK', 'QR');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ISSUE_QR';
ALTER TYPE "AuditAction" ADD VALUE 'REVOKE_QR';

-- AlterTable
ALTER TABLE "CheckIn" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "CheckIn" ALTER COLUMN "source" TYPE "CheckInSource" USING ("source"::"CheckInSource");
ALTER TABLE "CheckIn" ALTER COLUMN "source" SET DEFAULT 'FRONT_DESK';
ALTER TABLE "CheckIn"
  ADD COLUMN "membershipId" TEXT,
  ADD COLUMN "checkedInByUserId" TEXT,
  ADD COLUMN "qrCredentialId" TEXT;

-- CreateTable
CREATE TABLE "MemberQrCredential" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "issuedByUserId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemberQrCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckIn_tenantId_branchId_checkedInAt_idx" ON "CheckIn"("tenantId", "branchId", "checkedInAt");
CREATE INDEX "CheckIn_membershipId_idx" ON "CheckIn"("membershipId");
CREATE UNIQUE INDEX "MemberQrCredential_memberId_key" ON "MemberQrCredential"("memberId");
CREATE UNIQUE INDEX "MemberQrCredential_tokenHash_key" ON "MemberQrCredential"("tokenHash");
CREATE INDEX "MemberQrCredential_tenantId_revokedAt_idx" ON "MemberQrCredential"("tenantId", "revokedAt");

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_checkedInByUserId_fkey" FOREIGN KEY ("checkedInByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_qrCredentialId_fkey" FOREIGN KEY ("qrCredentialId") REFERENCES "MemberQrCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MemberQrCredential" ADD CONSTRAINT "MemberQrCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberQrCredential" ADD CONSTRAINT "MemberQrCredential_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberQrCredential" ADD CONSTRAINT "MemberQrCredential_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
