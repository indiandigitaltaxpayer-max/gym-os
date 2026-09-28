import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Gender, MemberStatus, Permission, Prisma, RoleName } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { AddMemberNoteDto, CreateMemberDto, ListMembersQueryDto, UpdateMemberDto } from "./members.dto";

const listInclude = {
  homeBranch: { select: { id: true, name: true } },
  memberships: {
    include: { plan: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
};

type MemberProfileData = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string | null;
  dateOfBirth?: Date | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  gender?: Gender | null;
  heightCm?: number | null;
  weightKg?: number | null;
  address?: string | null;
  source?: string | null;
  joinedAt?: Date;
  status?: MemberStatus;
};

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthPrincipal, query: ListMembersQueryDto) {
    await this.refreshMembershipStatuses(principal.tenantId);
    if (query.branchId) await this.requireBranch(principal, query.branchId);
    const search = query.search?.trim();
    const where: Prisma.MemberWhereInput = {
      tenantId: principal.tenantId,
      ...this.memberScope(principal),
      ...(query.branchId ? { homeBranchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.includeArchived ? {} : { archivedAt: null }),
      ...(search ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { memberNumber: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.member.findMany({
        where,
        include: listInclude,
        orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.member.count({ where }),
    ]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
  }

  async detail(principal: AuthPrincipal, memberId: string) {
    await this.refreshMembershipStatuses(principal.tenantId);
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, tenantId: principal.tenantId, ...this.memberScope(principal) },
      include: {
        homeBranch: { select: { id: true, name: true } },
        memberships: { include: { plan: true, freezes: { orderBy: { startedAt: "desc" } } }, orderBy: { createdAt: "desc" } },
        ...(principal.permissions.includes(Permission.PAYMENT_READ) ? { invoices: { include: { lineItems: true }, orderBy: { issuedAt: "desc" } } } : {}),
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  async create(principal: AuthPrincipal, dto: CreateMemberDto, ipAddress?: string) {
    await this.requireBranch(principal, dto.branchId);
    const warnings = await this.duplicateWarnings(principal.tenantId, dto.phone, dto.email);
    const member = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: principal.tenantId },
        data: { memberSequence: { increment: 1 } },
        select: { slug: true, memberSequence: true },
      });
      const prefix = tenant.slug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
      const created = await tx.member.create({
        data: {
          tenantId: principal.tenantId,
          homeBranchId: dto.branchId,
          memberNumber: `${prefix}-${String(tenant.memberSequence).padStart(6, "0")}`,
          ...this.memberData(dto),
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone.trim(),
        },
        include: listInclude,
      });
      await tx.auditEvent.create({
        data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.CREATE, entityType: "Member", entityId: created.id, metadata: { memberNumber: created.memberNumber }, ipAddress },
      });
      return created;
    });
    return { member, warnings };
  }

  async update(principal: AuthPrincipal, memberId: string, dto: UpdateMemberDto, ipAddress?: string) {
    const existing = await this.requireMember(principal, memberId);
    if (existing.archivedAt) throw new BadRequestException("Reactivate this member before editing");
    if (dto.branchId) await this.requireBranch(principal, dto.branchId);
    const warnings = await this.duplicateWarnings(principal.tenantId, dto.phone, dto.email, memberId);
    const data = this.memberData(dto);
    const member = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.member.update({
        where: { id: memberId },
        data: { ...data, ...(dto.branchId ? { homeBranchId: dto.branchId } : {}) },
        include: listInclude,
      });
      await tx.auditEvent.create({
        data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.UPDATE, entityType: "Member", entityId: memberId, metadata: { fields: Object.keys(dto) }, ipAddress },
      });
      return updated;
    });
    return { member, warnings };
  }

  async addNote(principal: AuthPrincipal, memberId: string, dto: AddMemberNoteDto, ipAddress?: string) {
    await this.requireMember(principal, memberId);
    return this.prisma.$transaction(async (tx) => {
      const note = await tx.memberNote.create({
        data: { tenantId: principal.tenantId, memberId, authorUserId: principal.userId, body: dto.body.trim() },
        include: { author: { select: { id: true, name: true } } },
      });
      await tx.auditEvent.create({
        data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.NOTE, entityType: "Member", entityId: memberId, metadata: { noteId: note.id }, ipAddress },
      });
      return note;
    });
  }

  async archive(principal: AuthPrincipal, memberId: string, ipAddress?: string) {
    const member = await this.requireMember(principal, memberId);
    if (member.archivedAt) return { success: true };
    await this.prisma.$transaction([
      this.prisma.member.update({ where: { id: memberId }, data: { archivedAt: new Date() } }),
      this.prisma.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.ARCHIVE, entityType: "Member", entityId: memberId, ipAddress } }),
    ]);
    return { success: true };
  }

  async reactivate(principal: AuthPrincipal, memberId: string, ipAddress?: string) {
    const member = await this.requireMember(principal, memberId);
    if (!member.archivedAt) return { success: true };
    await this.prisma.$transaction([
      this.prisma.member.update({ where: { id: memberId }, data: { archivedAt: null } }),
      this.prisma.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.REACTIVATE, entityType: "Member", entityId: memberId, ipAddress } }),
    ]);
    return { success: true };
  }

  private async requireMember(principal: AuthPrincipal, memberId: string) {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId: principal.tenantId, ...this.memberScope(principal) } });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }

  private async requireBranch(principal: AuthPrincipal, branchId: string) {
    if (!principal.roles.includes(RoleName.OWNER) && !principal.branchIds.includes(branchId)) {
      throw new ForbiddenException("You do not have access to this branch");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId: principal.tenantId, isActive: true } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  private memberScope(principal: AuthPrincipal): Prisma.MemberWhereInput {
    return principal.roles.includes(RoleName.OWNER) ? {} : { homeBranchId: { in: principal.branchIds } };
  }

  private memberData(dto: CreateMemberDto | UpdateMemberDto): MemberProfileData {
    return {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email ? dto.email.trim().toLowerCase() : null } : {}),
      ...(dto.dateOfBirth !== undefined ? { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null } : {}),
      ...(dto.emergencyName !== undefined ? { emergencyName: dto.emergencyName ? dto.emergencyName.trim() : null } : {}),
      ...(dto.emergencyPhone !== undefined ? { emergencyPhone: dto.emergencyPhone ? dto.emergencyPhone.trim() : null } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.heightCm !== undefined ? { heightCm: dto.heightCm } : {}),
      ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
      ...(dto.address !== undefined ? { address: dto.address ? dto.address.trim() : null } : {}),
      ...(dto.source !== undefined ? { source: dto.source ? dto.source.trim() : null } : {}),
      ...(dto.joinedAt ? { joinedAt: new Date(dto.joinedAt) } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    };
  }

  private async duplicateWarnings(tenantId: string, phone?: string, email?: string | null, excludeId?: string) {
    if (!phone && !email) return [];
    const matches = await this.prisma.member.findMany({
      where: {
        tenantId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          ...(phone ? [{ phone: phone.trim() }] : []),
          ...(email ? [{ email: { equals: email.trim().toLowerCase(), mode: "insensitive" as const } }] : []),
        ],
      },
      select: { id: true, memberNumber: true, firstName: true, lastName: true, phone: true, email: true },
      take: 5,
    });
    return matches.map((match) => ({
      memberId: match.id,
      memberNumber: match.memberNumber,
      message: `Possible duplicate: ${match.firstName} ${match.lastName} (${match.memberNumber})`,
    }));
  }

  private async refreshMembershipStatuses(tenantId: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.membership.updateMany({ where: { tenantId, status: "PENDING", startsAt: { lte: now }, endsAt: { gte: now } }, data: { status: "ACTIVE" } }),
      this.prisma.membership.updateMany({ where: { tenantId, status: { in: ["PENDING", "ACTIVE"] }, endsAt: { lt: now } }, data: { status: "EXPIRED" } }),
      this.prisma.member.updateMany({ where: { tenantId, archivedAt: null, memberships: { some: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } } } }, data: { status: "ACTIVE" } }),
      this.prisma.member.updateMany({ where: { tenantId, archivedAt: null, status: "ACTIVE", memberships: { none: { status: { in: ["ACTIVE", "FROZEN", "PENDING"] } } } }, data: { status: "EXPIRED" } }),
    ]);
  }
}
