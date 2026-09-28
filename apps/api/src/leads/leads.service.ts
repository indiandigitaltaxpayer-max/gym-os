import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, FollowUpStatus, LeadActivityType, LeadSource, LeadStage, MemberStatus, Permission, Prisma, RoleName, UserStatus } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { AddLeadNoteDto, AssignLeadDto, CancelFollowUpDto, ChangeLeadStageDto, CompleteFollowUpDto, CreateFollowUpDto, CreateLeadDto, LeadSummaryQueryDto, ListLeadsQueryDto, UpdateLeadDto } from "./leads.dto";

const listInclude = {
  branch: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  convertedMember: { select: { id: true, memberNumber: true } },
  followUps: {
    where: { status: FollowUpStatus.OPEN },
    orderBy: { dueAt: "asc" as const },
    take: 1,
    include: { assignedTo: { select: { id: true, name: true } } },
  },
};

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthPrincipal, query: ListLeadsQueryDto) {
    if (query.branchId) await this.requireBranch(principal, query.branchId);
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const search = query.search?.trim();
    const where: Prisma.LeadWhereInput = {
      tenantId: principal.tenantId,
      ...this.leadScope(principal),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.assignedToUserId ? { assignedToUserId: query.assignedToUserId } : {}),
      ...(query.includeArchived ? {} : { archivedAt: null }),
      ...(query.due ? { followUps: { some: { status: FollowUpStatus.OPEN, dueAt: query.due === "OVERDUE" ? { lt: now } : { gte: now, lte: endOfToday } } } } : {}),
      ...(search ? { OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, include: listInclude, orderBy: [{ archivedAt: "asc" }, { updatedAt: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.lead.count({ where }),
    ]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
  }

  async options(principal: AuthPrincipal) {
    const branchWhere = principal.roles.includes(RoleName.OWNER)
      ? { tenantId: principal.tenantId, isActive: true }
      : { tenantId: principal.tenantId, isActive: true, id: { in: principal.branchIds } };
    const [branches, users] = await Promise.all([
      this.prisma.branch.findMany({ where: branchWhere, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.user.findMany({
        where: { tenantId: principal.tenantId, status: UserStatus.ACTIVE, roles: { some: { role: { permissions: { has: Permission.LEAD_WRITE } } } } },
        select: { id: true, name: true, roles: { select: { role: { select: { name: true } } } }, branches: { select: { branchId: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
    const visibleBranchIds = new Set(branches.map((branch) => branch.id));
    return {
      branches,
      assignees: users.filter((user) => user.roles.some(({ role }) => role.name === RoleName.OWNER) || user.branches.some(({ branchId }) => visibleBranchIds.has(branchId)))
        .map((user) => ({ id: user.id, name: user.name, branchIds: user.branches.map(({ branchId }) => branchId), isOwner: user.roles.some(({ role }) => role.name === RoleName.OWNER) })),
      canReassign: this.canReassign(principal),
    };
  }

  async summary(principal: AuthPrincipal, query: LeadSummaryQueryDto) {
    if (query.branchId) await this.requireBranch(principal, query.branchId);
    const createdAt = this.dateRange(query.from, query.to);
    const where: Prisma.LeadWhereInput = { tenantId: principal.tenantId, archivedAt: null, ...this.leadScope(principal), ...(query.branchId ? { branchId: query.branchId } : {}), ...(createdAt ? { createdAt } : {}) };
    const grouped = await this.prisma.lead.groupBy({ by: ["stage"], where, _count: { _all: true } });
    const byStage = Object.fromEntries(Object.values(LeadStage).map((stage) => [stage, grouped.find((item) => item.stage === stage)?._count._all ?? 0]));
    const total = Object.values(byStage).reduce((sum, count) => sum + count, 0);
    const converted = byStage[LeadStage.CONVERTED];
    return {
      total,
      new: byStage[LeadStage.NEW],
      active: total - converted - byStage[LeadStage.LOST],
      converted,
      lost: byStage[LeadStage.LOST],
      conversionRate: total ? Math.round((converted / total) * 1000) / 10 : 0,
      byStage,
    };
  }

  async detail(principal: AuthPrincipal, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId: principal.tenantId, ...this.leadScope(principal) },
      include: {
        branch: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } }, convertedMember: { select: { id: true, memberNumber: true, firstName: true, lastName: true } },
        followUps: { include: { assignedTo: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } }, orderBy: { dueAt: "desc" } },
        activities: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!lead) throw new NotFoundException("Lead not found");
    return lead;
  }

  async create(principal: AuthPrincipal, dto: CreateLeadDto, ipAddress?: string) {
    await this.requireBranch(principal, dto.branchId);
    const assignedToUserId = dto.assignedToUserId ?? principal.userId;
    if (assignedToUserId !== principal.userId && !this.canReassign(principal)) throw new ForbiddenException("Only an Owner or Manager can assign leads to another user");
    await this.requireAssignee(principal.tenantId, assignedToUserId, dto.branchId);
    const warnings = await this.duplicateWarnings(principal.tenantId, dto.phone, dto.email);
    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({ data: {
        tenantId: principal.tenantId, branchId: dto.branchId, assignedToUserId, createdByUserId: principal.userId,
        firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), phone: dto.phone.trim(), email: dto.email?.trim().toLowerCase() || null,
        source: dto.source, sourceDetail: dto.sourceDetail?.trim() || null,
      }, include: listInclude });
      await this.activity(tx, principal, created.id, LeadActivityType.CREATED, "Lead created", { stage: LeadStage.NEW });
      if (dto.note) await this.activity(tx, principal, created.id, LeadActivityType.NOTE, dto.note.trim());
      await this.audit(tx, principal, AuditAction.CREATE_LEAD, "Lead", created.id, ipAddress, { branchId: dto.branchId, source: dto.source });
      return created;
    });
    return { lead, warnings };
  }

  async update(principal: AuthPrincipal, leadId: string, dto: UpdateLeadDto, ipAddress?: string) {
    const existing = await this.requireLead(principal, leadId, true);
    const branchId = dto.branchId ?? existing.branchId;
    if (dto.branchId) {
      await this.requireBranch(principal, dto.branchId);
      await this.requireAssignee(principal.tenantId, existing.assignedToUserId, dto.branchId);
    }
    const warnings = await this.duplicateWarnings(principal.tenantId, dto.phone, dto.email, leadId);
    const data: Prisma.LeadUpdateInput = {
      ...(dto.branchId ? { branch: { connect: { id: dto.branchId } } } : {}),
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
      ...(dto.source !== undefined ? { source: dto.source } : {}),
      ...(dto.sourceDetail !== undefined ? { sourceDetail: dto.sourceDetail?.trim() || null } : {}),
    };
    const lead = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({ where: { id: leadId }, data, include: listInclude });
      await this.activity(tx, principal, leadId, LeadActivityType.UPDATED, "Lead details updated", { fields: Object.keys(dto), branchId });
      await this.audit(tx, principal, AuditAction.UPDATE_LEAD, "Lead", leadId, ipAddress, { fields: Object.keys(dto) });
      return updated;
    });
    return { lead, warnings };
  }

  async changeStage(principal: AuthPrincipal, leadId: string, dto: ChangeLeadStageDto, ipAddress?: string) {
    const existing = await this.requireLead(principal, leadId, true);
    if (dto.stage === LeadStage.CONVERTED) throw new BadRequestException("Use the Convert to member action");
    if (dto.stage === LeadStage.LOST && !dto.lossReason?.trim()) throw new BadRequestException("A loss reason is required");
    if (existing.stage === LeadStage.CONVERTED) throw new BadRequestException("A converted lead cannot change stage");
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({ where: { id: leadId }, data: { stage: dto.stage, lossReason: dto.stage === LeadStage.LOST ? dto.lossReason!.trim() : null }, include: listInclude });
      await this.activity(tx, principal, leadId, LeadActivityType.STAGE_CHANGED, `Stage changed from ${this.label(existing.stage)} to ${this.label(dto.stage)}`, { from: existing.stage, to: dto.stage, lossReason: lead.lossReason });
      await this.audit(tx, principal, AuditAction.STAGE_LEAD, "Lead", leadId, ipAddress, { from: existing.stage, to: dto.stage });
      return lead;
    });
  }

  async assign(principal: AuthPrincipal, leadId: string, dto: AssignLeadDto, ipAddress?: string) {
    if (!this.canReassign(principal)) throw new ForbiddenException("Only an Owner or Manager can reassign leads");
    const existing = await this.requireLead(principal, leadId, true);
    const assignee = await this.requireAssignee(principal.tenantId, dto.assignedToUserId, existing.branchId);
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({ where: { id: leadId }, data: { assignedToUserId: dto.assignedToUserId }, include: listInclude });
      await this.activity(tx, principal, leadId, LeadActivityType.ASSIGNED, `Lead assigned to ${assignee.name}`, { from: existing.assignedToUserId, to: dto.assignedToUserId });
      await this.audit(tx, principal, AuditAction.ASSIGN_LEAD, "Lead", leadId, ipAddress, { assignedToUserId: dto.assignedToUserId });
      return lead;
    });
  }

  async addNote(principal: AuthPrincipal, leadId: string, dto: AddLeadNoteDto, ipAddress?: string) {
    await this.requireLead(principal, leadId, true);
    return this.prisma.$transaction(async (tx) => {
      const activity = await this.activity(tx, principal, leadId, LeadActivityType.NOTE, dto.body.trim());
      await this.audit(tx, principal, AuditAction.NOTE, "Lead", leadId, ipAddress, { activityId: activity.id });
      return activity;
    });
  }

  async archive(principal: AuthPrincipal, leadId: string, ipAddress?: string) {
    const existing = await this.requireLead(principal, leadId, false);
    if (existing.archivedAt) return { success: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: leadId }, data: { archivedAt: new Date() } });
      await this.activity(tx, principal, leadId, LeadActivityType.ARCHIVED, "Lead archived");
      await this.audit(tx, principal, AuditAction.ARCHIVE, "Lead", leadId, ipAddress);
    });
    return { success: true };
  }

  async reactivate(principal: AuthPrincipal, leadId: string, ipAddress?: string) {
    const existing = await this.requireLead(principal, leadId, false);
    if (!existing.archivedAt) return { success: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: leadId }, data: { archivedAt: null } });
      await this.activity(tx, principal, leadId, LeadActivityType.REACTIVATED, "Lead reactivated");
      await this.audit(tx, principal, AuditAction.REACTIVATE, "Lead", leadId, ipAddress);
    });
    return { success: true };
  }

  async createFollowUp(principal: AuthPrincipal, leadId: string, dto: CreateFollowUpDto, ipAddress?: string) {
    const lead = await this.requireLead(principal, leadId, true);
    if (lead.stage === LeadStage.CONVERTED || lead.stage === LeadStage.LOST) throw new BadRequestException("Reopen this lead before scheduling a follow-up");
    const assignedToUserId = dto.assignedToUserId ?? principal.userId;
    if (assignedToUserId !== principal.userId && !this.canReassign(principal)) throw new ForbiddenException("Only an Owner or Manager can assign follow-ups to another user");
    const assignee = await this.requireAssignee(principal.tenantId, assignedToUserId, lead.branchId);
    const dueAt = new Date(dto.dueAt);
    return this.prisma.$transaction(async (tx) => {
      const followUp = await tx.followUpTask.create({ data: { tenantId: principal.tenantId, leadId, assignedToUserId, createdByUserId: principal.userId, purpose: dto.purpose.trim(), dueAt }, include: { assignedTo: { select: { id: true, name: true } } } });
      await this.activity(tx, principal, leadId, LeadActivityType.FOLLOW_UP_SCHEDULED, `Follow-up scheduled for ${assignee.name}`, { followUpId: followUp.id, dueAt: dueAt.toISOString(), purpose: followUp.purpose });
      await this.audit(tx, principal, AuditAction.SCHEDULE_FOLLOW_UP, "FollowUpTask", followUp.id, ipAddress, { leadId, dueAt: dueAt.toISOString() });
      return followUp;
    });
  }

  async completeFollowUp(principal: AuthPrincipal, followUpId: string, dto: CompleteFollowUpDto, ipAddress?: string) {
    const followUp = await this.requireFollowUp(principal, followUpId);
    if (followUp.status !== FollowUpStatus.OPEN) throw new ConflictException("Follow-up is already closed");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.followUpTask.update({ where: { id: followUpId }, data: { status: FollowUpStatus.COMPLETED, completedAt: new Date(), outcome: dto.outcome.trim() }, include: { assignedTo: { select: { id: true, name: true } } } });
      await this.activity(tx, principal, followUp.leadId, LeadActivityType.FOLLOW_UP_COMPLETED, `Follow-up completed: ${updated.outcome}`, { followUpId });
      await this.audit(tx, principal, AuditAction.COMPLETE_FOLLOW_UP, "FollowUpTask", followUpId, ipAddress, { leadId: followUp.leadId });
      return updated;
    });
  }

  async assignFollowUp(principal: AuthPrincipal, followUpId: string, dto: AssignLeadDto, ipAddress?: string) {
    if (!this.canReassign(principal)) throw new ForbiddenException("Only an Owner or Manager can reassign follow-ups");
    const followUp = await this.requireFollowUp(principal, followUpId);
    if (followUp.status !== FollowUpStatus.OPEN) throw new ConflictException("Only open follow-ups can be reassigned");
    const lead = await this.requireLead(principal, followUp.leadId, true);
    const assignee = await this.requireAssignee(principal.tenantId, dto.assignedToUserId, lead.branchId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.followUpTask.update({ where: { id: followUpId }, data: { assignedToUserId: dto.assignedToUserId }, include: { assignedTo: { select: { id: true, name: true } } } });
      await this.activity(tx, principal, followUp.leadId, LeadActivityType.ASSIGNED, `Follow-up assigned to ${assignee.name}`, { followUpId, from: followUp.assignedToUserId, to: dto.assignedToUserId });
      await this.audit(tx, principal, AuditAction.ASSIGN_LEAD, "FollowUpTask", followUpId, ipAddress, { leadId: followUp.leadId, assignedToUserId: dto.assignedToUserId });
      return updated;
    });
  }

  async cancelFollowUp(principal: AuthPrincipal, followUpId: string, dto: CancelFollowUpDto, ipAddress?: string) {
    const followUp = await this.requireFollowUp(principal, followUpId);
    if (followUp.status !== FollowUpStatus.OPEN) throw new ConflictException("Follow-up is already closed");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.followUpTask.update({ where: { id: followUpId }, data: { status: FollowUpStatus.CANCELLED, cancelledAt: new Date(), outcome: dto.reason.trim() }, include: { assignedTo: { select: { id: true, name: true } } } });
      await this.activity(tx, principal, followUp.leadId, LeadActivityType.FOLLOW_UP_CANCELLED, `Follow-up cancelled: ${updated.outcome}`, { followUpId });
      await this.audit(tx, principal, AuditAction.CANCEL_FOLLOW_UP, "FollowUpTask", followUpId, ipAddress, { leadId: followUp.leadId });
      return updated;
    });
  }

  async convert(principal: AuthPrincipal, leadId: string, ipAddress?: string) {
    const visible = await this.requireLead(principal, leadId, true);
    const warnings = await this.memberDuplicateWarnings(principal.tenantId, visible.phone, visible.email);
    try {
      const member = await this.prisma.$transaction(async (tx) => {
        const lead = await tx.lead.findFirst({ where: { id: leadId, tenantId: principal.tenantId, ...this.leadScope(principal) } });
        if (!lead) throw new NotFoundException("Lead not found");
        if (lead.convertedMemberId || lead.stage === LeadStage.CONVERTED) throw new ConflictException("Lead has already been converted");
        if (lead.archivedAt) throw new BadRequestException("Reactivate this lead before converting it");
        const tenant = await tx.tenant.update({ where: { id: principal.tenantId }, data: { memberSequence: { increment: 1 } }, select: { slug: true, memberSequence: true } });
        const prefix = tenant.slug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
        const created = await tx.member.create({ data: {
          tenantId: principal.tenantId, homeBranchId: lead.branchId, memberNumber: `${prefix}-${String(tenant.memberSequence).padStart(6, "0")}`,
          firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone, email: lead.email, status: MemberStatus.TRIAL,
          source: `Lead: ${this.label(lead.source)}`,
        } });
        await tx.lead.update({ where: { id: leadId }, data: { convertedMemberId: created.id, convertedAt: new Date(), stage: LeadStage.CONVERTED, lossReason: null } });
        await tx.followUpTask.updateMany({ where: { leadId, status: FollowUpStatus.OPEN }, data: { status: FollowUpStatus.CANCELLED, cancelledAt: new Date(), outcome: "Lead converted to member" } });
        await this.activity(tx, principal, leadId, LeadActivityType.CONVERTED, `Converted to member ${created.memberNumber}`, { memberId: created.id, memberNumber: created.memberNumber });
        await this.audit(tx, principal, AuditAction.CONVERT_LEAD, "Lead", leadId, ipAddress, { memberId: created.id, memberNumber: created.memberNumber });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { member, warnings };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Lead has already been converted");
      throw error;
    }
  }

  private async requireLead(principal: AuthPrincipal, leadId: string, activeOnly: boolean) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, tenantId: principal.tenantId, ...this.leadScope(principal), ...(activeOnly ? { archivedAt: null } : {}) } });
    if (!lead) throw new NotFoundException("Lead not found");
    return lead;
  }

  private async requireFollowUp(principal: AuthPrincipal, followUpId: string) {
    const followUp = await this.prisma.followUpTask.findFirst({ where: { id: followUpId, tenantId: principal.tenantId, lead: this.leadScope(principal) } });
    if (!followUp) throw new NotFoundException("Follow-up not found");
    return followUp;
  }

  private async requireBranch(principal: AuthPrincipal, branchId: string) {
    if (!principal.roles.includes(RoleName.OWNER) && !principal.branchIds.includes(branchId)) throw new ForbiddenException("You do not have access to this branch");
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId: principal.tenantId, isActive: true } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  private async requireAssignee(tenantId: string, userId: string, branchId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId, status: UserStatus.ACTIVE }, include: { roles: { include: { role: true } }, branches: true } });
    const hasPermission = user?.roles.some(({ role }) => role.permissions.includes(Permission.LEAD_WRITE));
    const isOwner = user?.roles.some(({ role }) => role.name === RoleName.OWNER);
    if (!user || !hasPermission || (!isOwner && !user.branches.some((branch) => branch.branchId === branchId))) throw new BadRequestException("Assignee is not available for this branch");
    return user;
  }

  private async duplicateWarnings(tenantId: string, phone?: string, email?: string | null, excludeLeadId?: string) {
    if (!phone && !email) return [];
    const normalizedEmail = email?.trim().toLowerCase();
    const contact = { OR: [
      ...(phone ? [{ phone: phone.trim() }] : []),
      ...(normalizedEmail ? [{ email: { equals: normalizedEmail, mode: "insensitive" as const } }] : []),
    ] };
    const [leads, members] = await Promise.all([
      this.prisma.lead.findMany({ where: { tenantId, ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}), ...contact }, select: { id: true, firstName: true, lastName: true, stage: true }, take: 5 }),
      this.prisma.member.findMany({ where: { tenantId, ...contact }, select: { id: true, memberNumber: true, firstName: true, lastName: true }, take: 5 }),
    ]);
    return [
      ...leads.map((lead) => ({ type: "LEAD", id: lead.id, message: `Possible lead duplicate: ${lead.firstName} ${lead.lastName} (${this.label(lead.stage)})` })),
      ...members.map((member) => ({ type: "MEMBER", id: member.id, message: `Possible member duplicate: ${member.firstName} ${member.lastName} (${member.memberNumber})` })),
    ];
  }

  private async memberDuplicateWarnings(tenantId: string, phone: string, email: string | null) {
    const warnings = await this.duplicateWarnings(tenantId, phone, email);
    return warnings.filter((warning) => warning.type === "MEMBER");
  }

  private activity(tx: Prisma.TransactionClient, principal: AuthPrincipal, leadId: string, type: LeadActivityType, summary: string, metadata?: Prisma.InputJsonValue) {
    return tx.leadActivity.create({ data: { tenantId: principal.tenantId, leadId, actorUserId: principal.userId, type, summary, ...(metadata ? { metadata } : {}) } });
  }

  private audit(tx: Prisma.TransactionClient, principal: AuthPrincipal, action: AuditAction, entityType: string, entityId: string, ipAddress?: string, metadata?: Prisma.InputJsonValue) {
    return tx.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action, entityType, entityId, ipAddress, ...(metadata ? { metadata } : {}) } });
  }

  private canReassign(principal: AuthPrincipal) { return principal.roles.includes(RoleName.OWNER) || principal.roles.includes(RoleName.MANAGER); }
  private leadScope(principal: AuthPrincipal): Prisma.LeadWhereInput { return principal.roles.includes(RoleName.OWNER) ? {} : { branchId: { in: principal.branchIds } }; }

  private dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    const end = to ? new Date(to) : undefined;
    if (end) end.setUTCDate(end.getUTCDate() + 1);
    return { ...(from ? { gte: new Date(from) } : {}), ...(end ? { lt: end } : {}) };
  }

  private label(value: LeadStage | LeadSource) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
}
