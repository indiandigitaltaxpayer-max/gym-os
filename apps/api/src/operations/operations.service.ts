import { Injectable } from "@nestjs/common";
import { FollowUpStatus, InvoiceStatus, MemberStatus, PaymentStatus, Permission, RoleName } from "@gym/database";
import { PrismaService } from "../common/prisma.service";
import type { AuthPrincipal } from "../auth/auth.types";
import { CheckInDto } from "./operations.dto";
import { AttendanceService } from "../attendance/attendance.service";

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService, private readonly attendance: AttendanceService) {}

  async dashboard(principal: AuthPrincipal) {
    const tenantId = principal.tenantId;
    const memberScope = this.memberScope(principal);
    const canViewFinance = principal.permissions.includes(Permission.FINANCE_READ);
    const canViewLeads = principal.permissions.includes(Permission.LEAD_READ);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [activeMembers, checkInsToday, outstanding, revenue, recentCheckIns, dueFollowUps] = await Promise.all([
      this.prisma.member.count({ where: { tenantId, status: MemberStatus.ACTIVE, ...memberScope } }),
      this.prisma.checkIn.count({ where: { tenantId, branchId: this.branchFilter(principal), checkedInAt: { gte: today } } }),
      this.prisma.invoice.aggregate({
        where: { tenantId, member: memberScope, status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID] } },
        _sum: { totalMinor: true, paidMinor: true },
      }),
      this.prisma.payment.aggregate({
        where: { tenantId, invoice: { member: memberScope }, status: PaymentStatus.CAPTURED, paidAt: { gte: monthStart } },
        _sum: { amountMinor: true },
      }),
      this.prisma.checkIn.findMany({
        where: { tenantId, branchId: this.branchFilter(principal) },
        take: 8,
        orderBy: { checkedInAt: "desc" },
        include: { member: { select: { firstName: true, lastName: true, memberNumber: true } }, branch: { select: { name: true } } },
      }),
      canViewLeads ? this.prisma.followUpTask.findMany({
        where: { tenantId, assignedToUserId: principal.userId, status: FollowUpStatus.OPEN, dueAt: { lte: new Date(new Date().setHours(23, 59, 59, 999)) }, lead: { archivedAt: null, ...this.leadScope(principal) } },
        take: 8,
        orderBy: { dueAt: "asc" },
        include: { lead: { select: { id: true, firstName: true, lastName: true, phone: true, stage: true } } },
      }) : Promise.resolve([]),
    ]);

    const invoiced = outstanding._sum.totalMinor ?? 0;
    const paid = outstanding._sum.paidMinor ?? 0;
    return {
      activeMembers,
      checkInsToday,
      outstandingMinor: canViewFinance ? invoiced - paid : null,
      revenueThisMonthMinor: canViewFinance ? revenue._sum.amountMinor ?? 0 : null,
      recentCheckIns,
      dueFollowUps,
    };
  }

  async checkIn(principal: AuthPrincipal, dto: CheckInDto): Promise<unknown> {
    return this.attendance.checkInManual(principal, dto);
  }

  private memberScope(principal: AuthPrincipal) {
    return principal.roles.includes(RoleName.OWNER) ? {} : { homeBranchId: { in: principal.branchIds } };
  }

  private branchFilter(principal: AuthPrincipal) {
    return principal.roles.includes(RoleName.OWNER) ? undefined : { in: principal.branchIds };
  }

  private leadScope(principal: AuthPrincipal) {
    return principal.roles.includes(RoleName.OWNER) ? {} : { branchId: { in: principal.branchIds } };
  }
}
