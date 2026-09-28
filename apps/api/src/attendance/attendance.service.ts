import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AuditAction, CheckInSource, MemberStatus, MembershipStatus, Prisma, RoleName } from "@gym/database";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { AuthPrincipal } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { AttendanceMemberSearchQueryDto, AttendanceSummaryQueryDto, ListAttendanceQueryDto, ManualCheckInDto, QrCheckInDto } from "./attendance.dto";

const DUPLICATE_WINDOW_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async searchMembers(principal: AuthPrincipal, query: AttendanceMemberSearchQueryDto) {
    if (query.branchId) await this.requireBranch(principal, query.branchId);
    await this.refreshMembershipStatuses(principal.tenantId);
    const search = query.search?.trim();
    const members = await this.prisma.member.findMany({
      where: {
        tenantId: principal.tenantId,
        archivedAt: null,
        ...(search ? { OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { memberNumber: { contains: search, mode: "insensitive" } },
        ] } : {}),
      },
      select: {
        id: true, memberNumber: true, firstName: true, lastName: true, phone: true, status: true,
        homeBranch: { select: { id: true, name: true } },
        memberships: { include: { plan: { select: { name: true } } }, orderBy: { endsAt: "desc" }, take: 1 },
        qrCredential: { select: { revokedAt: true } },
      },
      orderBy: [{ status: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
      take: 20,
    });
    return { items: members.map((member) => ({ ...member, hasActiveQr: Boolean(member.qrCredential && !member.qrCredential.revokedAt) })) };
  }

  checkInManual(principal: AuthPrincipal, dto: ManualCheckInDto, ipAddress?: string) {
    return this.admit(principal, dto.memberId, dto.branchId, CheckInSource.FRONT_DESK, undefined, ipAddress);
  }

  async checkInQr(principal: AuthPrincipal, dto: QrCheckInDto, ipAddress?: string) {
    const credential = await this.resolveQr(principal.tenantId, dto.token);
    return this.admit(principal, credential.memberId, dto.branchId, CheckInSource.QR, credential.id, ipAddress);
  }

  async issueQr(principal: AuthPrincipal, memberId: string, ipAddress?: string) {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId: principal.tenantId, archivedAt: null } });
    if (!member) throw new NotFoundException("Member not found");
    const existing = await this.prisma.memberQrCredential.findUnique({ where: { memberId } });
    const id = existing?.id ?? randomUUID();
    const secret = randomBytes(32).toString("base64url");
    const tokenHash = this.hash(secret);
    const issuedAt = new Date();
    const credential = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.memberQrCredential.upsert({
        where: { memberId },
        update: { tokenHash, issuedByUserId: principal.userId, issuedAt, revokedAt: null },
        create: { id, tenantId: principal.tenantId, memberId, tokenHash, issuedByUserId: principal.userId, issuedAt },
      });
      await this.audit(tx, principal, AuditAction.ISSUE_QR, "MemberQrCredential", saved.id, ipAddress, { memberId, regenerated: Boolean(existing) });
      return saved;
    });
    return { credentialId: credential.id, token: `pulse:${credential.id}:${secret}`, issuedAt, regenerated: Boolean(existing) };
  }

  async revokeQr(principal: AuthPrincipal, memberId: string, ipAddress?: string) {
    const credential = await this.prisma.memberQrCredential.findFirst({ where: { memberId, tenantId: principal.tenantId } });
    if (!credential) throw new NotFoundException("QR credential not found");
    if (credential.revokedAt) return { success: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.memberQrCredential.update({ where: { id: credential.id }, data: { revokedAt: new Date() } });
      await this.audit(tx, principal, AuditAction.REVOKE_QR, "MemberQrCredential", credential.id, ipAddress, { memberId });
    });
    return { success: true };
  }

  async list(principal: AuthPrincipal, query: ListAttendanceQueryDto) {
    const timezone = await this.scopeTimezone(principal, query.branchId);
    const search = query.search?.trim();
    const where: Prisma.CheckInWhereInput = {
      tenantId: principal.tenantId,
      ...this.branchScope(principal),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.from || query.to ? { checkedInAt: {
        ...(query.from ? { gte: this.zonedBoundary(query.from.slice(0, 10), timezone) } : {}),
        ...(query.to ? { lt: this.zonedBoundary(this.nextDate(query.to.slice(0, 10)), timezone) } : {}),
      } } : {}),
      ...(search ? { member: { OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { memberNumber: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ] } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.checkIn.findMany({
        where,
        include: {
          member: { select: { id: true, memberNumber: true, firstName: true, lastName: true } },
          branch: { select: { id: true, name: true, timezone: true } },
          membership: { include: { plan: { select: { name: true } } } },
          checkedInBy: { select: { id: true, name: true } },
        },
        orderBy: { checkedInAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.checkIn.count({ where }),
    ]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
  }

  async summary(principal: AuthPrincipal, query: AttendanceSummaryQueryDto) {
    const branch = await this.requireBranch(principal, query.branchId);
    const localToday = this.localDate(new Date(), branch.timezone);
    const month = query.month ?? localToday.slice(0, 7);
    const todayStart = this.zonedBoundary(localToday, branch.timezone);
    const tomorrowStart = this.zonedBoundary(this.nextDate(localToday), branch.timezone);
    const monthStart = this.zonedBoundary(`${month}-01`, branch.timezone);
    const nextMonthStart = this.zonedBoundary(this.nextMonth(month), branch.timezone);
    const scope = { tenantId: principal.tenantId, branchId: branch.id };
    const [todayVisits, uniqueToday, monthVisits, sourceCounts] = await Promise.all([
      this.prisma.checkIn.count({ where: { ...scope, checkedInAt: { gte: todayStart, lt: tomorrowStart } } }),
      this.prisma.checkIn.findMany({ where: { ...scope, checkedInAt: { gte: todayStart, lt: tomorrowStart } }, distinct: ["memberId"], select: { memberId: true } }),
      this.prisma.checkIn.count({ where: { ...scope, checkedInAt: { gte: monthStart, lt: nextMonthStart } } }),
      this.prisma.checkIn.groupBy({ by: ["source"], where: { ...scope, checkedInAt: { gte: monthStart, lt: nextMonthStart } }, _count: { _all: true } }),
    ]);
    return {
      branch: { id: branch.id, name: branch.name, timezone: branch.timezone },
      localDate: localToday,
      month,
      todayVisits,
      uniqueToday: uniqueToday.length,
      monthVisits,
      monthBySource: Object.fromEntries(sourceCounts.map((item) => [item.source, item._count._all])),
    };
  }

  private async admit(principal: AuthPrincipal, memberId: string, branchId: string, source: CheckInSource, qrCredentialId?: string, ipAddress?: string) {
    await this.requireBranch(principal, branchId);
    await this.refreshMembershipStatuses(principal.tenantId);
    const now = new Date();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const member = await tx.member.findFirst({
          where: { id: memberId, tenantId: principal.tenantId },
          include: { memberships: { include: { plan: { select: { name: true } } }, orderBy: { endsAt: "desc" } } },
        });
        if (!member) throw new NotFoundException("Member not found");
        if (member.archivedAt) throw new BadRequestException("Member is archived");
        const membership = member.memberships.find((item) => item.status === MembershipStatus.ACTIVE && item.startsAt <= now && item.endsAt >= now);
        if (!membership) throw new BadRequestException(this.membershipRefusal(member.memberships[0], now));
        if (member.status !== MemberStatus.ACTIVE) throw new BadRequestException(`Member status is ${member.status.toLowerCase()}`);
        const duplicate = await tx.checkIn.findFirst({
          where: { tenantId: principal.tenantId, memberId, checkedInAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) } },
          orderBy: { checkedInAt: "desc" },
        });
        if (duplicate) throw new ConflictException(`Member already checked in at ${duplicate.checkedInAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`);
        const checkIn = await tx.checkIn.create({
          data: { tenantId: principal.tenantId, branchId, memberId, membershipId: membership.id, checkedInByUserId: principal.userId, qrCredentialId, source, checkedInAt: now },
          include: {
            member: { select: { id: true, memberNumber: true, firstName: true, lastName: true } },
            branch: { select: { id: true, name: true, timezone: true } },
            membership: { include: { plan: { select: { name: true } } } },
            checkedInBy: { select: { id: true, name: true } },
          },
        });
        await this.audit(tx, principal, AuditAction.CHECK_IN, "CheckIn", checkIn.id, ipAddress, { memberId, branchId, membershipId: membership.id, source });
        return checkIn;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      this.logger.warn({ event: "attendance_refused", tenantId: principal.tenantId, memberId, branchId, source, reason: error instanceof Error ? error.message : "Unknown error" });
      throw error;
    }
  }

  private async resolveQr(tenantId: string, token: string) {
    const match = /^pulse:([^:]+):([^:]+)$/.exec(token.trim());
    if (!match) throw new BadRequestException("QR credential is invalid");
    const credential = await this.prisma.memberQrCredential.findFirst({ where: { id: match[1], tenantId, revokedAt: null } });
    if (!credential) throw new BadRequestException("QR credential is invalid or revoked");
    const expected = Buffer.from(credential.tokenHash, "hex");
    const actual = Buffer.from(this.hash(match[2]), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new BadRequestException("QR credential is invalid or revoked");
    return credential;
  }

  private membershipRefusal(membership: { status: MembershipStatus; startsAt: Date; endsAt: Date } | undefined, now: Date) {
    if (!membership) return "Member does not have a membership";
    if (membership.status === MembershipStatus.FROZEN) return "Membership is frozen";
    if (membership.status === MembershipStatus.CANCELLED) return "Membership is cancelled";
    if (membership.status === MembershipStatus.PENDING || membership.startsAt > now) return "Membership has not started";
    if (membership.status === MembershipStatus.EXPIRED || membership.endsAt < now) return `Membership expired on ${membership.endsAt.toLocaleDateString("en-IN")}`;
    return "Member does not have an active membership";
  }

  private async refreshMembershipStatuses(tenantId: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.membership.updateMany({ where: { tenantId, status: MembershipStatus.PENDING, startsAt: { lte: now }, endsAt: { gte: now } }, data: { status: MembershipStatus.ACTIVE } }),
      this.prisma.membership.updateMany({ where: { tenantId, status: { in: [MembershipStatus.PENDING, MembershipStatus.ACTIVE] }, endsAt: { lt: now } }, data: { status: MembershipStatus.EXPIRED } }),
      this.prisma.member.updateMany({ where: { tenantId, archivedAt: null, memberships: { some: { status: MembershipStatus.ACTIVE, startsAt: { lte: now }, endsAt: { gte: now } } } }, data: { status: MemberStatus.ACTIVE } }),
      this.prisma.member.updateMany({ where: { tenantId, archivedAt: null, status: MemberStatus.ACTIVE, memberships: { none: { status: { in: [MembershipStatus.ACTIVE, MembershipStatus.FROZEN, MembershipStatus.PENDING] } } } }, data: { status: MemberStatus.EXPIRED } }),
    ]);
  }

  private async requireBranch(principal: AuthPrincipal, branchId: string) {
    if (!principal.roles.includes(RoleName.OWNER) && !principal.branchIds.includes(branchId)) throw new ForbiddenException("You do not have access to this branch");
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId: principal.tenantId, isActive: true }, select: { id: true, name: true, timezone: true } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  private async scopeTimezone(principal: AuthPrincipal, branchId?: string) {
    if (branchId) return (await this.requireBranch(principal, branchId)).timezone;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: principal.tenantId }, select: { timezone: true } });
    return tenant?.timezone ?? "UTC";
  }

  private branchScope(principal: AuthPrincipal): Prisma.CheckInWhereInput {
    return principal.roles.includes(RoleName.OWNER) ? {} : { branchId: { in: principal.branchIds } };
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

  private nextMonth(month: string) {
    const value = new Date(`${month}-01T12:00:00Z`);
    value.setUTCMonth(value.getUTCMonth() + 1);
    return value.toISOString().slice(0, 7) + "-01";
  }

  private hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

  private audit(tx: Prisma.TransactionClient, principal: AuthPrincipal, action: AuditAction, entityType: string, entityId: string, ipAddress?: string, metadata?: Prisma.InputJsonValue) {
    return tx.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action, entityType, entityId, ipAddress, metadata } });
  }
}
