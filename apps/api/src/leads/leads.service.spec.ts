import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { FollowUpStatus, LeadSource, LeadStage } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { LeadsService } from "./leads.service";

const owner: AuthPrincipal = {
  userId: "owner-1", tenantId: "tenant-1", sessionId: "session-1", email: "owner@example.com", name: "Owner",
  roles: ["Owner"], permissions: ["lead.read", "lead.write", "lead.convert"], branchIds: ["branch-a"],
};
const frontDesk: AuthPrincipal = { ...owner, userId: "desk-1", name: "Desk", roles: ["Front desk"], branchIds: ["branch-a"] };
const lead = { id: "lead-1", tenantId: "tenant-1", branchId: "branch-a", assignedToUserId: "desk-1", stage: LeadStage.NEW, archivedAt: null, convertedMemberId: null, phone: "9999999999", email: null };

describe("LeadsService", () => {
  it("applies tenant and branch scope to lead listings", async () => {
    const prisma = { lead: { findMany: jest.fn(), count: jest.fn() }, $transaction: jest.fn().mockResolvedValue([[], 0]) };
    const service = new LeadsService(prisma as never);
    await service.list(frontDesk, { includeArchived: false, page: 1, pageSize: 20 });
    expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-1", branchId: { in: ["branch-a"] }, archivedAt: null }) }));
  });

  it("rejects creation in a branch outside staff scope", async () => {
    const prisma = { branch: { findFirst: jest.fn() } };
    const service = new LeadsService(prisma as never);
    await expect(service.create(frontDesk, { branchId: "branch-b", firstName: "Asha", lastName: "Rao", phone: "9999999999", source: LeadSource.WALK_IN })).rejects.toThrow(ForbiddenException);
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
  });

  it("requires a reason before moving a lead to lost", async () => {
    const prisma = { lead: { findFirst: jest.fn().mockResolvedValue(lead) } };
    const service = new LeadsService(prisma as never);
    await expect(service.changeStage(frontDesk, lead.id, { stage: LeadStage.LOST })).rejects.toThrow(new BadRequestException("A loss reason is required"));
  });

  it("prevents front desk from assigning a lead to another user", async () => {
    const service = new LeadsService({} as never);
    await expect(service.assign(frontDesk, lead.id, { assignedToUserId: "other-user" })).rejects.toThrow(ForbiddenException);
  });

  it("prevents front desk from reassigning a follow-up", async () => {
    const service = new LeadsService({} as never);
    await expect(service.assignFollowUp(frontDesk, "follow-1", { assignedToUserId: "other-user" })).rejects.toThrow(ForbiddenException);
  });

  it("refuses a second conversion before creating another member", async () => {
    const converted = { ...lead, stage: LeadStage.CONVERTED, convertedMemberId: "member-1" };
    const tx = { lead: { findFirst: jest.fn().mockResolvedValue(converted) }, member: { create: jest.fn() } };
    const prisma = {
      lead: { findFirst: jest.fn().mockResolvedValue(converted), findMany: jest.fn().mockResolvedValue([]) },
      member: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const service = new LeadsService(prisma as never);
    await expect(service.convert(owner, lead.id)).rejects.toThrow(ConflictException);
    expect(tx.member.create).not.toHaveBeenCalled();
  });

  it("preserves closed follow-ups by rejecting repeat completion", async () => {
    const prisma = { followUpTask: { findFirst: jest.fn().mockResolvedValue({ id: "follow-1", leadId: lead.id, status: FollowUpStatus.COMPLETED }) } };
    const service = new LeadsService(prisma as never);
    await expect(service.completeFollowUp(frontDesk, "follow-1", { outcome: "Reached" })).rejects.toThrow(ConflictException);
  });
});
