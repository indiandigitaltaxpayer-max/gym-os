import { ForbiddenException } from "@nestjs/common";
import { CheckInSource, FollowUpStatus, InvoiceStatus, LeadSource, LeadStage, PaymentMethod } from "@gym/database";
import { ReportsService } from "./reports.service";

const owner = { userId: "u1", tenantId: "t1", sessionId: "s1", email: "owner@example.com", name: "Owner", roles: ["Owner"], permissions: ["report.operations.read", "report.finance.read"], branchIds: [] };
const staff = { ...owner, roles: ["Front desk"], branchIds: ["b1"] };
const query = { from: "2026-09-01", to: "2026-09-30" };

function basePrisma() {
  return {
    tenant: { findUnique: jest.fn().mockResolvedValue({ timezone: "Asia/Kolkata" }) },
    branch: { findFirst: jest.fn() },
    invoice: { aggregate: jest.fn(), findMany: jest.fn() },
    payment: { aggregate: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    checkIn: { findMany: jest.fn() },
    lead: { groupBy: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    followUpTask: { findMany: jest.fn() },
    member: { groupBy: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    membership: { findMany: jest.fn() },
  };
}

describe("ReportsService", () => {
  it("reconciles invoiced, collected, outstanding, and overdue amounts", async () => {
    const prisma = basePrisma();
    prisma.invoice.aggregate
      .mockResolvedValueOnce({ _sum: { totalMinor: 25000 }, _count: { _all: 3 } })
      .mockResolvedValueOnce({ _sum: { totalMinor: 18000, paidMinor: 5000 } })
      .mockResolvedValueOnce({ _sum: { totalMinor: 10000, paidMinor: 2000 }, _count: { _all: 1 } });
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amountMinor: 12000 }, _count: { _all: 2 } });
    prisma.payment.groupBy.mockResolvedValue([{ method: PaymentMethod.UPI, _sum: { amountMinor: 12000 }, _count: { _all: 2 } }]);
    prisma.payment.findMany.mockResolvedValue([{ paidAt: new Date("2026-09-10T10:00:00Z"), amountMinor: 12000 }]);
    prisma.invoice.findMany.mockResolvedValue([{ id: "i1", status: InvoiceStatus.PARTIALLY_PAID }]);

    const result = await new ReportsService(prisma as never).revenue(owner, query);

    expect(result).toMatchObject({ invoicedMinor: 25000, collectedMinor: 12000, outstandingMinor: 13000, overdueMinor: 8000, invoiceCount: 3, paymentCount: 2, overdueCount: 1 });
    expect(result.byMethod.UPI).toBe(12000);
    expect(result.trend).toEqual([{ label: "2026-09-10", valueMinor: 12000 }]);
  });

  it("counts attendance visits, unique members, sources, and top members", async () => {
    const prisma = basePrisma();
    prisma.checkIn.findMany.mockResolvedValue([
      { id: "c1", checkedInAt: new Date("2026-09-10T04:30:00Z"), source: CheckInSource.QR, memberId: "m1", member: { memberNumber: "M1", firstName: "A", lastName: "One" }, branch: { name: "Main" } },
      { id: "c2", checkedInAt: new Date("2026-09-11T04:30:00Z"), source: CheckInSource.FRONT_DESK, memberId: "m1", member: { memberNumber: "M1", firstName: "A", lastName: "One" }, branch: { name: "Main" } },
      { id: "c3", checkedInAt: new Date("2026-09-11T05:30:00Z"), source: CheckInSource.QR, memberId: "m2", member: { memberNumber: "M2", firstName: "B", lastName: "Two" }, branch: { name: "Main" } },
    ]);

    const result = await new ReportsService(prisma as never).attendance(owner, query);

    expect(result).toMatchObject({ totalCheckIns: 3, uniqueMembers: 2, bySource: { QR: 2, FRONT_DESK: 1 } });
    expect(result.topMembers[0]).toMatchObject({ memberId: "m1", visits: 2 });
  });

  it("calculates lead conversion and follow-up health", async () => {
    const prisma = basePrisma();
    prisma.lead.groupBy
      .mockResolvedValueOnce([{ stage: LeadStage.CONVERTED, _count: { _all: 2 } }, { stage: LeadStage.NEW, _count: { _all: 2 } }, { stage: LeadStage.LOST, _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ source: LeadSource.WALK_IN, _count: { _all: 5 } }]);
    prisma.lead.count.mockResolvedValue(5);
    prisma.followUpTask.findMany.mockResolvedValue([
      { status: FollowUpStatus.COMPLETED, dueAt: new Date("2026-09-10") },
      { status: FollowUpStatus.OPEN, dueAt: new Date("2020-09-10") },
    ]);

    const result = await new ReportsService(prisma as never).leads(owner, query);

    expect(result).toMatchObject({ total: 5, converted: 2, lost: 1, active: 2, conversionRate: 40, followUps: { due: 2, completed: 1, open: 1, overdue: 1 } });
    expect(result.bySource.WALK_IN).toBe(5);
  });

  it("rejects a branch outside the staff member's assigned scope", async () => {
    const prisma = basePrisma();
    prisma.branch.findFirst.mockResolvedValue({ id: "b2", timezone: "Asia/Kolkata" });

    await expect(new ReportsService(prisma as never).attendance(staff, { ...query, branchId: "b2" })).rejects.toThrow(ForbiddenException);
    expect(prisma.checkIn.findMany).not.toHaveBeenCalled();
  });
});
