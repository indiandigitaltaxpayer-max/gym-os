import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, MemberStatus, MembershipStatus, Prisma, RoleName } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { BillingService } from "../billing/billing.service";
import { AssignMembershipDto, CreateMembershipPlanDto, ExpiringMembershipsQueryDto, MembershipReasonDto, RenewMembershipDto, UpdateMembershipPlanDto } from "./memberships.dto";

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService, private readonly billing: BillingService) {}

  listPlans(principal: AuthPrincipal) {
    return this.prisma.membershipPlan.findMany({ where: { tenantId: principal.tenantId }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  }

  async createPlan(principal: AuthPrincipal, dto: CreateMembershipPlanDto, ipAddress?: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.membershipPlan.create({ data: { tenantId: principal.tenantId, ...dto, description: dto.description?.trim(), name: dto.name.trim(), taxRateBps: dto.taxRateBps ?? 0 } });
      await this.audit(tx, principal, AuditAction.CREATE, "MembershipPlan", plan.id, ipAddress);
      return plan;
    });
  }

  async updatePlan(principal: AuthPrincipal, planId: string, dto: UpdateMembershipPlanDto, ipAddress?: string) {
    await this.requirePlan(principal.tenantId, planId, false);
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.membershipPlan.update({ where: { id: planId }, data: { ...dto, ...(dto.name ? { name: dto.name.trim() } : {}), ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}) } });
      await this.audit(tx, principal, AuditAction.UPDATE, "MembershipPlan", plan.id, ipAddress, { fields: Object.keys(dto) });
      return plan;
    });
  }

  async deactivatePlan(principal: AuthPrincipal, planId: string, ipAddress?: string) {
    await this.requirePlan(principal.tenantId, planId, false);
    await this.prisma.$transaction(async (tx) => {
      await tx.membershipPlan.update({ where: { id: planId }, data: { isActive: false } });
      await this.audit(tx, principal, AuditAction.ARCHIVE, "MembershipPlan", planId, ipAddress);
    });
    return { success: true };
  }

  async assign(principal: AuthPrincipal, dto: AssignMembershipDto, ipAddress?: string) {
    return this.createMembership(principal, dto.memberId, dto.planId, new Date(dto.startsAt), dto.dueAt ? new Date(dto.dueAt) : undefined, AuditAction.ASSIGN_MEMBERSHIP, ipAddress);
  }

  async renew(principal: AuthPrincipal, membershipId: string, dto: RenewMembershipDto, ipAddress?: string) {
    const current = await this.requireMembership(principal, membershipId);
    const latest = await this.prisma.membership.findFirst({ where: { tenantId: principal.tenantId, memberId: current.memberId, status: { not: MembershipStatus.CANCELLED } }, orderBy: { endsAt: "desc" } });
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date((latest ?? current).endsAt.getTime() + 24 * 60 * 60 * 1000);
    return this.createMembership(principal, current.memberId, dto.planId ?? current.planId, startsAt, dto.dueAt ? new Date(dto.dueAt) : undefined, AuditAction.RENEW_MEMBERSHIP, ipAddress);
  }

  async freeze(principal: AuthPrincipal, membershipId: string, dto: MembershipReasonDto, ipAddress?: string) {
    this.requireManager(principal);
    const membership = await this.requireMembership(principal, membershipId);
    if (membership.status !== MembershipStatus.ACTIVE) throw new BadRequestException("Only an active membership can be frozen");
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.membershipFreeze.create({ data: { tenantId: principal.tenantId, membershipId, startedAt: now, reason: dto.reason?.trim() } });
      await tx.membership.update({ where: { id: membershipId }, data: { status: MembershipStatus.FROZEN, frozenAt: now } });
      await tx.member.update({ where: { id: membership.memberId }, data: { status: MemberStatus.FROZEN } });
      await this.audit(tx, principal, AuditAction.FREEZE_MEMBERSHIP, "Membership", membershipId, ipAddress, { reason: dto.reason });
    });
    return { success: true };
  }

  async resume(principal: AuthPrincipal, membershipId: string, ipAddress?: string) {
    this.requireManager(principal);
    const membership = await this.requireMembership(principal, membershipId);
    if (membership.status !== MembershipStatus.FROZEN) throw new BadRequestException("Membership is not frozen");
    const freeze = await this.prisma.membershipFreeze.findFirst({ where: { tenantId: principal.tenantId, membershipId, endedAt: null }, orderBy: { startedAt: "desc" } });
    if (!freeze) throw new BadRequestException("Open freeze period not found");
    const now = new Date();
    const extendedEnd = new Date(membership.endsAt.getTime() + (now.getTime() - freeze.startedAt.getTime()));
    await this.prisma.$transaction(async (tx) => {
      await tx.membershipFreeze.update({ where: { id: freeze.id }, data: { endedAt: now } });
      await tx.membership.update({ where: { id: membershipId }, data: { status: MembershipStatus.ACTIVE, frozenAt: null, endsAt: extendedEnd } });
      await tx.member.update({ where: { id: membership.memberId }, data: { status: MemberStatus.ACTIVE } });
      await this.audit(tx, principal, AuditAction.RESUME_MEMBERSHIP, "Membership", membershipId, ipAddress, { extendedEnd });
    });
    return { success: true, endsAt: extendedEnd };
  }

  async cancel(principal: AuthPrincipal, membershipId: string, dto: MembershipReasonDto, ipAddress?: string) {
    this.requireManager(principal);
    const membership = await this.requireMembership(principal, membershipId);
    if (membership.status === MembershipStatus.CANCELLED || membership.status === MembershipStatus.EXPIRED) throw new BadRequestException("Membership cannot be cancelled");
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.membershipFreeze.updateMany({ where: { tenantId: principal.tenantId, membershipId, endedAt: null }, data: { endedAt: now } });
      await tx.membership.update({ where: { id: membershipId }, data: { status: MembershipStatus.CANCELLED, cancelledAt: now, cancellationReason: dto.reason?.trim(), frozenAt: null } });
      await tx.member.update({ where: { id: membership.memberId }, data: { status: MemberStatus.CANCELLED } });
      await this.audit(tx, principal, AuditAction.CANCEL_MEMBERSHIP, "Membership", membershipId, ipAddress, { reason: dto.reason });
    });
    return { success: true };
  }

  async expiring(principal: AuthPrincipal, query: ExpiringMembershipsQueryDto) {
    if (query.branchId && !principal.roles.includes(RoleName.OWNER) && !principal.branchIds.includes(query.branchId)) throw new ForbiddenException("You do not have access to this branch");
    await this.refreshStatuses(principal.tenantId);
    const cutoff = new Date(Date.now() + query.days * 24 * 60 * 60 * 1000);
    return this.prisma.membership.findMany({
      where: { tenantId: principal.tenantId, status: MembershipStatus.ACTIVE, endsAt: { gte: new Date(), lte: cutoff }, member: { archivedAt: null, ...this.memberScope(principal), ...(query.branchId ? { homeBranchId: query.branchId } : {}) } },
      include: { plan: true, member: { include: { homeBranch: { select: { id: true, name: true } } } } },
      orderBy: { endsAt: "asc" },
    });
  }

  async refreshStatuses(tenantId: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.membership.updateMany({ where: { tenantId, status: MembershipStatus.PENDING, startsAt: { lte: now }, endsAt: { gte: now } }, data: { status: MembershipStatus.ACTIVE } }),
      this.prisma.membership.updateMany({ where: { tenantId, status: { in: [MembershipStatus.PENDING, MembershipStatus.ACTIVE] }, endsAt: { lt: now } }, data: { status: MembershipStatus.EXPIRED } }),
    ]);
  }

  private async createMembership(principal: AuthPrincipal, memberId: string, planId: string, startsAt: Date, dueAt: Date | undefined, action: AuditAction, ipAddress?: string) {
    if (Number.isNaN(startsAt.valueOf())) throw new BadRequestException("Invalid start date");
    if (dueAt && Number.isNaN(dueAt.valueOf())) throw new BadRequestException("Invalid invoice due date");
    const [member, plan] = await Promise.all([this.requireMember(principal, memberId), this.requirePlan(principal.tenantId, planId, true)]);
    const endsAt = new Date(startsAt); endsAt.setDate(endsAt.getDate() + plan.durationDays);
    const overlap = await this.prisma.membership.findFirst({ where: { tenantId: principal.tenantId, memberId, status: { in: [MembershipStatus.PENDING, MembershipStatus.ACTIVE, MembershipStatus.FROZEN] }, startsAt: { lte: endsAt }, endsAt: { gte: startsAt } } });
    if (overlap) throw new BadRequestException("Membership dates overlap an existing membership");
    const now = new Date();
    const status = startsAt > now ? MembershipStatus.PENDING : endsAt < now ? MembershipStatus.EXPIRED : MembershipStatus.ACTIVE;
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({ data: { tenantId: principal.tenantId, memberId, planId, startsAt, endsAt, status }, include: { plan: true, freezes: true } });
      const invoice = await this.billing.issueMembershipInvoice(tx, principal, member, plan, membership.id, dueAt ?? startsAt, ipAddress);
      await tx.member.update({ where: { id: member.id }, data: { status: status === MembershipStatus.ACTIVE ? MemberStatus.ACTIVE : status === MembershipStatus.EXPIRED ? MemberStatus.EXPIRED : member.status } });
      await this.audit(tx, principal, action, "Membership", membership.id, ipAddress, { memberId, planId, startsAt, endsAt });
      return { ...membership, invoice };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async requireMember(principal: AuthPrincipal, memberId: string) {
    const member = await this.prisma.member.findFirst({ where: { id: memberId, tenantId: principal.tenantId, archivedAt: null, ...this.memberScope(principal) } });
    if (!member) throw new NotFoundException("Member not found");
    return member;
  }
  private async requirePlan(tenantId: string, planId: string, activeOnly: boolean) {
    const plan = await this.prisma.membershipPlan.findFirst({ where: { id: planId, tenantId, ...(activeOnly ? { isActive: true } : {}) } });
    if (!plan) throw new NotFoundException("Membership plan not found");
    return plan;
  }
  private async requireMembership(principal: AuthPrincipal, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({ where: { id: membershipId, tenantId: principal.tenantId, member: this.memberScope(principal) } });
    if (!membership) throw new NotFoundException("Membership not found");
    return membership;
  }
  private requireManager(principal: AuthPrincipal) {
    if (!principal.roles.some((role) => [RoleName.OWNER, RoleName.MANAGER].includes(role as typeof RoleName.OWNER))) throw new ForbiddenException("Only owners and managers can perform this action");
  }
  private memberScope(principal: AuthPrincipal): Prisma.MemberWhereInput { return principal.roles.includes(RoleName.OWNER) ? {} : { homeBranchId: { in: principal.branchIds } }; }
  private audit(tx: Prisma.TransactionClient, principal: AuthPrincipal, action: AuditAction, entityType: string, entityId: string, ipAddress?: string, metadata?: Prisma.InputJsonValue) {
    return tx.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action, entityType, entityId, ipAddress, metadata } });
  }
}
