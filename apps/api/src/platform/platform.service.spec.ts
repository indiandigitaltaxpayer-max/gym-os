import { ConflictException } from "@nestjs/common";
import { NotificationStatus, PlatformAuditAction, RoleName, TenantStatus } from "@gym/database";
import { PlatformService } from "./platform.service";
import type { PlatformPrincipal } from "./platform.types";

const principal: PlatformPrincipal = {
  platformAdminId: "platform-1",
  sessionId: "platform-session-1",
  email: "platform@example.com",
  name: "Platform Admin",
};

describe("PlatformService", () => {
  it("creates the tenant, first branch, roles, and Owner invitation in one transaction", async () => {
    const tx = {
      tenant: { create: jest.fn().mockResolvedValue({ id: "tenant-2", name: "Second Gym", slug: "second-gym", subscriptionPlan: "PILOT" }) },
      branch: { create: jest.fn().mockResolvedValue({ id: "branch-2", name: "Main Branch" }) },
      role: { createMany: jest.fn(), findFirstOrThrow: jest.fn().mockResolvedValue({ id: "owner-role", name: RoleName.OWNER }) },
      staffInvitation: { create: jest.fn().mockResolvedValue({ id: "invite-2", email: "owner@second.test" }) },
      auditEvent: { create: jest.fn() },
      platformAuditEvent: { create: jest.fn() },
    };
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new PlatformService(prisma as never);
    const result = await service.createTenant(principal, {
      name: "Second Gym", slug: "second-gym", branchName: "Main Branch", branchCode: "HQ",
      ownerName: "Second Owner", ownerEmail: "OWNER@SECOND.TEST",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.role.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ name: RoleName.OWNER })]) }));
    expect(tx.staffInvitation.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tenantId: "tenant-2", email: "owner@second.test", roleId: "owner-role", branchIds: ["branch-2"],
      invitedByPlatformAdminId: "platform-1",
    }) });
    expect(tx.platformAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: PlatformAuditAction.CREATE_TENANT, tenantId: "tenant-2" }) });
    expect(result.invitationUrl).toContain("?invite=");
  });

  it("rejects a duplicate workspace before starting the transaction", async () => {
    const prisma = { tenant: { findUnique: jest.fn().mockResolvedValue({ id: "existing" }) }, $transaction: jest.fn() };
    const service = new PlatformService(prisma as never);
    await expect(service.createTenant(principal, { name: "Existing", slug: "existing", branchName: "Main", branchCode: "HQ", ownerName: "Owner", ownerEmail: "owner@example.com" })).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("suspends a tenant, revokes sessions, and cancels queued delivery", async () => {
    const tx = {
      tenant: { update: jest.fn().mockResolvedValue({ id: "tenant-2", status: TenantStatus.SUSPENDED }) },
      authSession: { updateMany: jest.fn() },
      notificationEvent: { updateMany: jest.fn() },
      platformAuditEvent: { create: jest.fn() },
    };
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: "tenant-2", status: TenantStatus.ACTIVE }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new PlatformService(prisma as never);
    await service.suspendTenant(principal, "tenant-2");

    expect(tx.authSession.updateMany).toHaveBeenCalledWith({ where: { tenantId: "tenant-2", revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(tx.notificationEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "tenant-2", status: { in: [NotificationStatus.SCHEDULED, NotificationStatus.QUEUED, NotificationStatus.PROCESSING] } },
      data: expect.objectContaining({ status: NotificationStatus.CANCELLED, errorCode: "TENANT_INACTIVE" }),
    }));
    expect(tx.platformAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: PlatformAuditAction.SUSPEND_TENANT, metadata: { from: TenantStatus.ACTIVE, to: TenantStatus.SUSPENDED } }) });
  });
});
