import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthPrincipal } from "../auth/auth.types";
import { MembersService } from "./members.service";

const owner: AuthPrincipal = {
  userId: "owner-1",
  tenantId: "tenant-1",
  sessionId: "session-1",
  email: "owner@example.com",
  name: "Owner",
  roles: ["Owner"],
  permissions: ["member.read", "member.write"],
  branchIds: ["branch-a"],
};

const frontDesk: AuthPrincipal = {
  ...owner,
  userId: "staff-1",
  roles: ["Front desk"],
  branchIds: ["branch-a"],
};

describe("MembersService", () => {
  it("applies tenant, branch, search, archive, and pagination filters", async () => {
    const prisma = {
      member: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
      membership: { updateMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };
    const service = new MembersService(prisma as never);

    const result = await service.list(frontDesk, {
      search: "Asha",
      includeArchived: false,
      page: 2,
      pageSize: 10,
    });

    expect(prisma.member.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: "tenant-1",
        homeBranchId: { in: ["branch-a"] },
        archivedAt: null,
        OR: expect.any(Array),
      }),
      skip: 10,
      take: 10,
    }));
    expect(result.pagination).toEqual({ page: 2, pageSize: 10, total: 0, totalPages: 1 });
  });

  it("rejects member creation in a branch not assigned to the staff user", async () => {
    const prisma = { branch: { findFirst: jest.fn() } };
    const service = new MembersService(prisma as never);

    await expect(service.create(frontDesk, {
      branchId: "branch-b",
      firstName: "Asha",
      lastName: "Rao",
      phone: "+91 99999 00000",
    })).rejects.toThrow(ForbiddenException);
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
  });

  it("does not expose a member outside the authenticated tenant", async () => {
    const prisma = {
      member: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() },
      membership: { updateMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new MembersService(prisma as never);

    await expect(service.detail(owner, "member-from-another-tenant")).rejects.toThrow(NotFoundException);
    expect(prisma.member.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "member-from-another-tenant", tenantId: "tenant-1" }),
    }));
  });
});
