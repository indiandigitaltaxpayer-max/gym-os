import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { CheckInSource, MemberStatus, MembershipStatus } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { AttendanceService } from "./attendance.service";

const principal: AuthPrincipal = {
  userId: "u1", tenantId: "t1", sessionId: "s1", email: "desk@example.com", name: "Desk",
  roles: ["Front desk"], permissions: ["attendance.read", "checkin.create"], branchIds: ["b1"],
};

function prismaForAdmission(overrides: Record<string, unknown> = {}) {
  const tx = {
    member: { findFirst: jest.fn().mockResolvedValue({
      id: "m1", archivedAt: null, status: MemberStatus.ACTIVE,
      memberships: [{ id: "ms1", status: MembershipStatus.ACTIVE, startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01"), plan: { name: "Annual" } }],
    }) },
    checkIn: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({ id: "ci1", ...data })),
    },
    auditEvent: { create: jest.fn() },
    ...overrides,
  };
  return {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: "b1", name: "Central", timezone: "Asia/Kolkata" }) },
    membership: { updateMany: jest.fn() }, member: { updateMany: jest.fn() },
    $transaction: jest.fn().mockImplementation((value) => typeof value === "function" ? value(tx) : Promise.all(value)),
    tx,
  };
}

describe("AttendanceService", () => {
  it("rejects a branch outside front-desk scope before admission", async () => {
    const prisma = prismaForAdmission();
    const service = new AttendanceService(prisma as never);
    await expect(service.checkInManual(principal, { memberId: "m1", branchId: "b2" })).rejects.toThrow(ForbiddenException);
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
  });

  it("records membership, staff user, source, and audit for an eligible member", async () => {
    const prisma = prismaForAdmission();
    const service = new AttendanceService(prisma as never);
    const result = await service.checkInManual(principal, { memberId: "m1", branchId: "b1" });
    expect(result).toMatchObject({ id: "ci1", membershipId: "ms1", checkedInByUserId: "u1", source: CheckInSource.FRONT_DESK });
    expect(prisma.tx.auditEvent.create).toHaveBeenCalled();
  });

  it("refuses a second visit inside the two-hour cooldown", async () => {
    const prisma = prismaForAdmission();
    prisma.tx.checkIn.findFirst.mockResolvedValue({ id: "existing", checkedInAt: new Date() });
    const service = new AttendanceService(prisma as never);
    await expect(service.checkInManual(principal, { memberId: "m1", branchId: "b1" })).rejects.toThrow(ConflictException);
    expect(prisma.tx.checkIn.create).not.toHaveBeenCalled();
  });

  it("returns a clear refusal for frozen membership", async () => {
    const prisma = prismaForAdmission();
    prisma.tx.member.findFirst.mockResolvedValue({
      id: "m1", archivedAt: null, status: MemberStatus.FROZEN,
      memberships: [{ id: "ms1", status: MembershipStatus.FROZEN, startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01") }],
    });
    const service = new AttendanceService(prisma as never);
    await expect(service.checkInManual(principal, { memberId: "m1", branchId: "b1" })).rejects.toThrow(new BadRequestException("Membership is frozen"));
  });

  it("rejects a revoked QR before admission", async () => {
    const prisma = prismaForAdmission() as ReturnType<typeof prismaForAdmission> & { memberQrCredential: { findFirst: jest.Mock } };
    prisma.memberQrCredential = { findFirst: jest.fn().mockResolvedValue(null) };
    const service = new AttendanceService(prisma as never);
    await expect(service.checkInQr(principal, { branchId: "b1", token: "pulse:credential:secret" })).rejects.toThrow(new BadRequestException("QR credential is invalid or revoked"));
  });
});
