import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CheckInSource, FollowUpStatus, InvoiceStatus, LeadSource, LeadStage, MemberStatus, MembershipStatus, PaymentMethod, PaymentStatus, Prisma, RoleName } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { ReportQueryDto } from "./reports.dto";

type ReportScope = {
  start: Date;
  end: Date;
  timezone: string;
  branchId?: string;
  branchIds?: string[];
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async members(principal: AuthPrincipal, query: ReportQueryDto) {
    const scope = await this.scope(principal, query);
    const memberWhere: Prisma.MemberWhereInput = { tenantId: principal.tenantId, archivedAt: null, ...this.memberBranch(scope) };
    const period = { gte: scope.start, lt: scope.end };
    const [statusGroups, archived, newMembers, periodMemberships, previousMemberships, expiringCount, expiring] = await Promise.all([
      this.prisma.member.groupBy({ by: ["status"], where: memberWhere, _count: { _all: true } }),
      this.prisma.member.count({ where: { tenantId: principal.tenantId, archivedAt: { not: null }, ...this.memberBranch(scope) } }),
      this.prisma.member.count({ where: { ...memberWhere, joinedAt: period } }),
      this.prisma.membership.findMany({ where: { tenantId: principal.tenantId, createdAt: period, member: memberWhere }, select: { memberId: true } }),
      this.prisma.membership.findMany({ where: { tenantId: principal.tenantId, createdAt: { lt: scope.start }, member: memberWhere }, distinct: ["memberId"], select: { memberId: true } }),
      this.prisma.membership.count({ where: { tenantId: principal.tenantId, status: MembershipStatus.ACTIVE, endsAt: period, member: memberWhere } }),
      this.prisma.membership.findMany({
        where: { tenantId: principal.tenantId, status: MembershipStatus.ACTIVE, endsAt: period, member: memberWhere },
        orderBy: { endsAt: "asc" },
        take: 50,
        select: { id: true, endsAt: true, member: { select: { id: true, memberNumber: true, firstName: true, lastName: true, phone: true } }, plan: { select: { name: true } } },
      }),
    ]);

    const byStatus = Object.fromEntries(Object.values(MemberStatus).map((status) => [status, statusGroups.find((item) => item.status === status)?._count._all ?? 0]));
    const earlierMembers = new Set(previousMemberships.map((item) => item.memberId));
    const periodCounts = new Map<string, number>();
    for (const membership of periodMemberships) periodCounts.set(membership.memberId, (periodCounts.get(membership.memberId) ?? 0) + 1);
    const renewals = [...periodCounts].reduce((total, [memberId, count]) => total + (earlierMembers.has(memberId) ? count : Math.max(0, count - 1)), 0);

    return {
      range: this.range(query, scope),
      totalCurrent: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      newMembers,
      renewals,
      expiringCount,
      archived,
      byStatus,
      expiring,
    };
  }

  async revenue(principal: AuthPrincipal, query: ReportQueryDto) {
    const scope = await this.scope(principal, query);
    const period = { gte: scope.start, lt: scope.end };
    const branch = this.invoiceBranch(scope);
    const invoiceWhere: Prisma.InvoiceWhereInput = { tenantId: principal.tenantId, issuedAt: period, status: { not: InvoiceStatus.VOID }, ...branch };
    const openWhere: Prisma.InvoiceWhereInput = { ...invoiceWhere, status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID] } };
    const overdueBoundary = this.zonedBoundary(this.localDate(new Date(), scope.timezone), scope.timezone);
    const paymentWhere: Prisma.PaymentWhereInput = { tenantId: principal.tenantId, status: PaymentStatus.CAPTURED, paidAt: period, invoice: branch };
    const [invoiced, outstanding, overdue, collected, byMethod, payments, invoices] = await Promise.all([
      this.prisma.invoice.aggregate({ where: invoiceWhere, _sum: { totalMinor: true }, _count: { _all: true } }),
      this.prisma.invoice.aggregate({ where: openWhere, _sum: { totalMinor: true, paidMinor: true } }),
      this.prisma.invoice.aggregate({ where: { ...openWhere, dueAt: { lt: overdueBoundary } }, _sum: { totalMinor: true, paidMinor: true }, _count: { _all: true } }),
      this.prisma.payment.aggregate({ where: paymentWhere, _sum: { amountMinor: true }, _count: { _all: true } }),
      this.prisma.payment.groupBy({ by: ["method"], where: paymentWhere, _sum: { amountMinor: true }, _count: { _all: true } }),
      this.prisma.payment.findMany({ where: paymentWhere, orderBy: { paidAt: "asc" }, select: { paidAt: true, amountMinor: true } }),
      this.prisma.invoice.findMany({
        where: invoiceWhere,
        orderBy: { issuedAt: "desc" },
        take: 50,
        select: { id: true, invoiceNumber: true, issuedAt: true, dueAt: true, totalMinor: true, paidMinor: true, status: true, member: { select: { firstName: true, lastName: true, memberNumber: true } }, branch: { select: { name: true } } },
      }),
    ]);

    return {
      range: this.range(query, scope),
      invoicedMinor: invoiced._sum.totalMinor ?? 0,
      collectedMinor: collected._sum.amountMinor ?? 0,
      outstandingMinor: (outstanding._sum.totalMinor ?? 0) - (outstanding._sum.paidMinor ?? 0),
      overdueMinor: (overdue._sum.totalMinor ?? 0) - (overdue._sum.paidMinor ?? 0),
      invoiceCount: invoiced._count._all,
      paymentCount: collected._count._all,
      overdueCount: overdue._count._all,
      byMethod: Object.fromEntries(Object.values(PaymentMethod).map((method) => [method, byMethod.find((item) => item.method === method)?._sum.amountMinor ?? 0])),
      trend: this.moneyTrend(payments, scope),
      invoices,
    };
  }

  async attendance(principal: AuthPrincipal, query: ReportQueryDto) {
    const scope = await this.scope(principal, query);
    const checkIns = await this.prisma.checkIn.findMany({
      where: { tenantId: principal.tenantId, checkedInAt: { gte: scope.start, lt: scope.end }, ...this.checkInBranch(scope) },
      orderBy: { checkedInAt: "asc" },
      select: { id: true, checkedInAt: true, source: true, memberId: true, member: { select: { memberNumber: true, firstName: true, lastName: true } }, branch: { select: { name: true } } },
    });
    const memberVisits = new Map<string, { memberId: string; memberNumber: string; name: string; visits: number }>();
    const sources = Object.fromEntries(Object.values(CheckInSource).map((source) => [source, 0]));
    for (const entry of checkIns) {
      sources[entry.source] += 1;
      const current = memberVisits.get(entry.memberId);
      memberVisits.set(entry.memberId, { memberId: entry.memberId, memberNumber: entry.member.memberNumber, name: `${entry.member.firstName} ${entry.member.lastName}`, visits: (current?.visits ?? 0) + 1 });
    }
    return {
      range: this.range(query, scope),
      totalCheckIns: checkIns.length,
      uniqueMembers: memberVisits.size,
      averagePerDay: Math.round((checkIns.length / this.days(scope)) * 10) / 10,
      bySource: sources,
      trend: this.countTrend(checkIns.map((item) => item.checkedInAt), scope),
      topMembers: [...memberVisits.values()].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name)).slice(0, 20),
    };
  }

  async leads(principal: AuthPrincipal, query: ReportQueryDto) {
    const scope = await this.scope(principal, query);
    const period = { gte: scope.start, lt: scope.end };
    const branch = this.leadBranch(scope);
    const leadWhere: Prisma.LeadWhereInput = { tenantId: principal.tenantId, archivedAt: null, createdAt: period, ...branch };
    const [byStageRows, bySourceRows, total, followUps] = await Promise.all([
      this.prisma.lead.groupBy({ by: ["stage"], where: leadWhere, _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ["source"], where: leadWhere, _count: { _all: true } }),
      this.prisma.lead.count({ where: leadWhere }),
      this.prisma.followUpTask.findMany({ where: { tenantId: principal.tenantId, dueAt: period, lead: { archivedAt: null, ...branch } }, select: { status: true, dueAt: true } }),
    ]);
    const byStage = Object.fromEntries(Object.values(LeadStage).map((stage) => [stage, byStageRows.find((item) => item.stage === stage)?._count._all ?? 0]));
    const converted = byStage[LeadStage.CONVERTED];
    return {
      range: this.range(query, scope),
      total,
      converted,
      lost: byStage[LeadStage.LOST],
      active: total - converted - byStage[LeadStage.LOST],
      conversionRate: total ? Math.round((converted / total) * 1000) / 10 : 0,
      byStage,
      bySource: Object.fromEntries(Object.values(LeadSource).map((source) => [source, bySourceRows.find((item) => item.source === source)?._count._all ?? 0])),
      followUps: {
        due: followUps.length,
        completed: followUps.filter((item) => item.status === FollowUpStatus.COMPLETED).length,
        open: followUps.filter((item) => item.status === FollowUpStatus.OPEN).length,
        overdue: followUps.filter((item) => item.status === FollowUpStatus.OPEN && item.dueAt < new Date()).length,
      },
    };
  }

  async exportMembers(principal: AuthPrincipal, query: ReportQueryDto) {
    const scope = await this.scope(principal, query);
    const rows = await this.prisma.member.findMany({ where: { tenantId: principal.tenantId, archivedAt: null, joinedAt: { gte: scope.start, lt: scope.end }, ...this.memberBranch(scope) }, orderBy: { joinedAt: "desc" }, take: 10000, include: { homeBranch: { select: { name: true } } } });
    return this.exportResult("members", query, ["Member number", "Name", "Phone", "Email", "Branch", "Status", "Joined", "Archived"], rows.map((item) => [item.memberNumber, `${item.firstName} ${item.lastName}`, item.phone, item.email, item.homeBranch.name, item.status, item.joinedAt.toISOString(), item.archivedAt ? "Yes" : "No"]));
  }

  async exportRevenue(principal: AuthPrincipal, query: ReportQueryDto) {
    const scope = await this.scope(principal, query);
    const rows = await this.prisma.invoice.findMany({ where: { tenantId: principal.tenantId, issuedAt: { gte: scope.start, lt: scope.end }, status: { not: InvoiceStatus.VOID }, ...this.invoiceBranch(scope) }, orderBy: { issuedAt: "desc" }, take: 10000, include: { branch: { select: { name: true } }, member: { select: { memberNumber: true, firstName: true, lastName: true } } } });
    return this.exportResult("revenue", query, ["Invoice", "Issued", "Due", "Member number", "Member", "Branch", "Status", "Total minor", "Paid minor", "Balance minor"], rows.map((item) => [item.invoiceNumber, item.issuedAt.toISOString(), item.dueAt.toISOString(), item.member.memberNumber, `${item.member.firstName} ${item.member.lastName}`, item.branch.name, item.status, item.totalMinor, item.paidMinor, item.totalMinor - item.paidMinor]));
  }

  async exportAttendance(principal: AuthPrincipal, query: ReportQueryDto) {
    const scope = await this.scope(principal, query);
    const rows = await this.prisma.checkIn.findMany({ where: { tenantId: principal.tenantId, checkedInAt: { gte: scope.start, lt: scope.end }, ...this.checkInBranch(scope) }, orderBy: { checkedInAt: "desc" }, take: 10000, include: { branch: { select: { name: true } }, member: { select: { memberNumber: true, firstName: true, lastName: true } } } });
    return this.exportResult("attendance", query, ["Checked in", "Member number", "Member", "Branch", "Source"], rows.map((item) => [item.checkedInAt.toISOString(), item.member.memberNumber, `${item.member.firstName} ${item.member.lastName}`, item.branch.name, item.source]));
  }

  async exportLeads(principal: AuthPrincipal, query: ReportQueryDto) {
    const scope = await this.scope(principal, query);
    const rows = await this.prisma.lead.findMany({ where: { tenantId: principal.tenantId, archivedAt: null, createdAt: { gte: scope.start, lt: scope.end }, ...this.leadBranch(scope) }, orderBy: { createdAt: "desc" }, take: 10000, include: { branch: { select: { name: true } } } });
    return this.exportResult("leads", query, ["Created", "Name", "Phone", "Email", "Branch", "Source", "Stage", "Converted", "Archived"], rows.map((item) => [item.createdAt.toISOString(), `${item.firstName} ${item.lastName}`, item.phone, item.email, item.branch.name, item.source, item.stage, item.convertedAt?.toISOString(), item.archivedAt ? "Yes" : "No"]));
  }

  private async scope(principal: AuthPrincipal, query: ReportQueryDto): Promise<ReportScope> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: principal.tenantId }, select: { timezone: true } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    let timezone = tenant.timezone;
    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: query.branchId, tenantId: principal.tenantId, isActive: true }, select: { id: true, timezone: true } });
      if (!branch) throw new NotFoundException("Branch not found");
      if (!principal.roles.includes(RoleName.OWNER) && !principal.branchIds.includes(branch.id)) throw new ForbiddenException("You do not have access to this branch");
      timezone = branch.timezone;
    }
    const start = this.zonedBoundary(query.from, timezone);
    const end = this.zonedBoundary(this.nextDate(query.to), timezone);
    const days = Math.round((Date.parse(query.to) - Date.parse(query.from)) / 86400000) + 1;
    if (days < 1) throw new BadRequestException("The report end date must be on or after the start date");
    if (days > 366) throw new BadRequestException("Report ranges cannot exceed 366 days");
    return { start, end, timezone, branchId: query.branchId, branchIds: principal.roles.includes(RoleName.OWNER) ? undefined : principal.branchIds };
  }

  private memberBranch(scope: ReportScope): Prisma.MemberWhereInput {
    return scope.branchId ? { homeBranchId: scope.branchId } : scope.branchIds ? { homeBranchId: { in: scope.branchIds } } : {};
  }

  private invoiceBranch(scope: ReportScope): Prisma.InvoiceWhereInput {
    return scope.branchId ? { branchId: scope.branchId } : scope.branchIds ? { branchId: { in: scope.branchIds } } : {};
  }

  private checkInBranch(scope: ReportScope): Prisma.CheckInWhereInput {
    return scope.branchId ? { branchId: scope.branchId } : scope.branchIds ? { branchId: { in: scope.branchIds } } : {};
  }

  private leadBranch(scope: ReportScope): Prisma.LeadWhereInput {
    return scope.branchId ? { branchId: scope.branchId } : scope.branchIds ? { branchId: { in: scope.branchIds } } : {};
  }

  private range(query: ReportQueryDto, scope: ReportScope) {
    return { from: query.from, to: query.to, branchId: query.branchId ?? null, timezone: scope.timezone };
  }

  private days(scope: ReportScope) {
    return Math.max(1, Math.round((scope.end.getTime() - scope.start.getTime()) / 86400000));
  }

  private moneyTrend(rows: { paidAt: Date; amountMinor: number }[], scope: ReportScope) {
    const monthly = this.days(scope) > 62;
    const values = new Map<string, number>();
    for (const row of rows) {
      const date = this.localDate(row.paidAt, scope.timezone);
      const key = monthly ? date.slice(0, 7) : date;
      values.set(key, (values.get(key) ?? 0) + row.amountMinor);
    }
    return [...values].map(([label, valueMinor]) => ({ label, valueMinor }));
  }

  private countTrend(rows: Date[], scope: ReportScope) {
    const monthly = this.days(scope) > 62;
    const values = new Map<string, number>();
    for (const row of rows) {
      const date = this.localDate(row, scope.timezone);
      const key = monthly ? date.slice(0, 7) : date;
      values.set(key, (values.get(key) ?? 0) + 1);
    }
    return [...values].map(([label, count]) => ({ label, count }));
  }

  private exportResult(name: string, query: ReportQueryDto, headers: string[], rows: unknown[][]) {
    return { filename: `${name}-${query.from}-to-${query.to}.csv`, csv: `\uFEFF${[headers, ...rows].map((row) => row.map((value) => this.csv(value)).join(",")).join("\r\n")}` };
  }

  private csv(value: unknown) {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private localDate(value: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  private zonedBoundary(date: string, timezone: string) {
    const [year, month, day] = date.split("-").map(Number);
    const desired = Date.UTC(year, month - 1, day);
    let estimate = desired;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(estimate));
      const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
      const represented = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
      estimate += desired - represented;
    }
    return new Date(estimate);
  }

  private nextDate(date: string) {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
  }
}
