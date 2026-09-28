import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MembershipStatus } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { MembershipsService } from "./memberships.service";

const owner: AuthPrincipal = { userId: "u1", tenantId: "t1", sessionId: "s1", email: "owner@example.com", name: "Owner", roles: ["Owner"], permissions: ["membership.sell"], branchIds: ["b1"] };
const staff: AuthPrincipal = { ...owner, userId: "u2", roles: ["Front desk"] };
const member = { id: "m1", tenantId: "t1", homeBranchId: "b1", status: "LEAD", archivedAt: null };
const plan = { id: "p1", tenantId: "t1", name: "Monthly", durationDays: 30, priceMinor: 1000, taxRateBps: 0, isActive: true };
const billing = { issueMembershipInvoice: jest.fn().mockResolvedValue({ id: "invoice-1" }) };

describe("MembershipsService", () => {
  it("rejects an assignment that overlaps an existing membership", async () => {
    const prisma = {
      member: { findFirst: jest.fn().mockResolvedValue(member) },
      membershipPlan: { findFirst: jest.fn().mockResolvedValue(plan) },
      membership: { findFirst: jest.fn().mockResolvedValue({ id: "existing" }) },
    };
    const service = new MembershipsService(prisma as never, billing as never);
    await expect(service.assign(owner, { memberId: "m1", planId: "p1", startsAt: "2026-10-01" })).rejects.toThrow(new BadRequestException("Membership dates overlap an existing membership"));
  });

  it("creates a pending membership when its start date is in the future", async () => {
    const tx = {
      membership: { create: jest.fn().mockImplementation(({ data }) => ({ id: "new", ...data, plan, freezes: [] })) },
      member: { update: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      member: { findFirst: jest.fn().mockResolvedValue(member) },
      membershipPlan: { findFirst: jest.fn().mockResolvedValue(plan) },
      membership: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const service = new MembershipsService(prisma as never, billing as never);
    const result = await service.assign(owner, { memberId: "m1", planId: "p1", startsAt: "2099-01-01" });
    expect(result.status).toBe(MembershipStatus.PENDING);
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it("allows only owners and managers to freeze memberships", async () => {
    const service = new MembershipsService({} as never, billing as never);
    await expect(service.freeze(staff, "membership-1", {})).rejects.toThrow(ForbiddenException);
  });

  it("rejects an expiry filter for a branch outside the staff scope", async () => {
    const service = new MembershipsService({} as never, billing as never);
    await expect(service.expiring(staff, { days: 30, branchId: "b2" })).rejects.toThrow(ForbiddenException);
  });
});
