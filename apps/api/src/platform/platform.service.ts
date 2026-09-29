import { randomBytes, createHash } from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, NotificationStatus, PlatformAuditAction, Prisma, ROLE_PERMISSIONS, RoleName, TenantStatus } from "@gym/database";
import { PrismaService } from "../common/prisma.service";
import type { CreateTenantDto, TenantListQueryDto, UpdateTenantDto } from "./platform.dto";
import type { PlatformPrincipal } from "./platform.types";

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  listTenants(query: TenantListQueryDto) {
    const search = query.search?.trim();
    return this.prisma.tenant.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] } : {}),
      },
      select: {
        id: true, name: true, slug: true, status: true, subscriptionPlan: true, currency: true, timezone: true, createdAt: true, updatedAt: true,
        _count: { select: { branches: true, users: true, members: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true, name: true, slug: true, status: true, subscriptionPlan: true, currency: true, timezone: true, createdAt: true, updatedAt: true,
        branches: { select: { id: true, name: true, code: true, address: true, isActive: true }, orderBy: { createdAt: "asc" } },
        users: {
          where: { roles: { some: { role: { name: RoleName.OWNER } } } },
          select: { id: true, name: true, email: true, status: true, lastLoginAt: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        invitations: {
          where: { role: { name: RoleName.OWNER } },
          select: { id: true, name: true, email: true, expiresAt: true, acceptedAt: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { branches: true, users: true, members: true } },
      },
    });
    if (!tenant) throw new NotFoundException("Gym tenant not found");
    return tenant;
  }

  async createTenant(principal: PlatformPrincipal, dto: CreateTenantDto, ipAddress?: string) {
    const slug = dto.slug.trim().toLowerCase();
    const ownerEmail = dto.ownerEmail.trim().toLowerCase();
    const existing = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (existing) throw new ConflictException("Workspace slug is already in use");
    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.tokenHash(token);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.name.trim(), slug, status: TenantStatus.TRIAL,
            subscriptionPlan: dto.subscriptionPlan?.trim().toUpperCase() || "PILOT",
            currency: dto.currency?.trim().toUpperCase() || "INR",
            timezone: dto.timezone?.trim() || "Asia/Kolkata",
          },
        });
        const branch = await tx.branch.create({ data: { tenantId: tenant.id, name: dto.branchName.trim(), code: dto.branchCode.trim().toUpperCase(), address: dto.branchAddress?.trim() || null } });
        await tx.role.createMany({ data: Object.entries(ROLE_PERMISSIONS).map(([name, permissions]) => ({ tenantId: tenant.id, name, permissions })) });
        const ownerRole = await tx.role.findFirstOrThrow({ where: { tenantId: tenant.id, name: RoleName.OWNER } });
        const invitation = await tx.staffInvitation.create({
          data: {
            tenantId: tenant.id, name: dto.ownerName.trim(), email: ownerEmail, roleId: ownerRole.id,
            branchIds: [branch.id], tokenHash, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
            invitedByPlatformAdminId: principal.platformAdminId,
          },
        });
        await tx.auditEvent.create({ data: { tenantId: tenant.id, action: AuditAction.INVITE, entityType: "StaffInvitation", entityId: invitation.id, metadata: { email: ownerEmail, role: RoleName.OWNER, actorType: "PlatformAdmin" }, ipAddress } });
        await this.platformAudit(tx, principal, PlatformAuditAction.CREATE_TENANT, tenant.id, "Tenant", tenant.id, ipAddress, { slug, branchId: branch.id, ownerEmail, subscriptionPlan: tenant.subscriptionPlan });
        return { tenant, branch, invitation };
      });
      return { ...created, invitationUrl: this.invitationUrl(token) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Gym, branch, or owner details conflict with an existing record");
      throw error;
    }
  }

  async updateTenant(principal: PlatformPrincipal, tenantId: string, dto: UpdateTenantDto, ipAddress?: string) {
    await this.requireTenant(tenantId);
    if (!dto.name && !dto.subscriptionPlan) throw new BadRequestException("Provide a gym name or subscription plan to update");
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({ where: { id: tenantId }, data: { ...(dto.name ? { name: dto.name.trim() } : {}), ...(dto.subscriptionPlan ? { subscriptionPlan: dto.subscriptionPlan.trim().toUpperCase() } : {}) } });
      await this.platformAudit(tx, principal, PlatformAuditAction.UPDATE_TENANT, tenantId, "Tenant", tenantId, ipAddress, { name: tenant.name, subscriptionPlan: tenant.subscriptionPlan });
      return tenant;
    });
  }

  suspendTenant(principal: PlatformPrincipal, tenantId: string, ipAddress?: string) {
    return this.changeStatus(principal, tenantId, TenantStatus.SUSPENDED, PlatformAuditAction.SUSPEND_TENANT, ipAddress);
  }

  reactivateTenant(principal: PlatformPrincipal, tenantId: string, ipAddress?: string) {
    return this.changeStatus(principal, tenantId, TenantStatus.ACTIVE, PlatformAuditAction.REACTIVATE_TENANT, ipAddress);
  }

  archiveTenant(principal: PlatformPrincipal, tenantId: string, ipAddress?: string) {
    return this.changeStatus(principal, tenantId, TenantStatus.CANCELLED, PlatformAuditAction.ARCHIVE_TENANT, ipAddress);
  }

  async inviteOwner(principal: PlatformPrincipal, tenantId: string, ipAddress?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branches: { where: { isActive: true }, orderBy: { createdAt: "asc" } }, users: { where: { status: "ACTIVE", roles: { some: { role: { name: RoleName.OWNER } } } } }, invitations: { where: { role: { name: RoleName.OWNER } }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!tenant) throw new NotFoundException("Gym tenant not found");
    if (!(tenant.status === TenantStatus.ACTIVE || tenant.status === TenantStatus.TRIAL)) throw new BadRequestException("Reactivate the gym before inviting an owner");
    if (tenant.users.length) throw new ConflictException("This gym already has an active Owner");
    const previous = tenant.invitations[0];
    if (!previous) throw new NotFoundException("No initial Owner invitation exists");
    const ownerRole = await this.prisma.role.findFirst({ where: { tenantId, name: RoleName.OWNER } });
    if (!tenant.branches.length || !ownerRole) throw new BadRequestException("The gym is missing an active branch or Owner role");
    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.tokenHash(token);
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.staffInvitation.deleteMany({ where: { tenantId, roleId: ownerRole.id, acceptedAt: null } });
      const created = await tx.staffInvitation.create({ data: { tenantId, name: previous.name, email: previous.email, roleId: ownerRole.id, branchIds: tenant.branches.map(({ id }) => id), tokenHash, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), invitedByPlatformAdminId: principal.platformAdminId } });
      await tx.auditEvent.create({ data: { tenantId, action: AuditAction.INVITE, entityType: "StaffInvitation", entityId: created.id, metadata: { email: created.email, role: RoleName.OWNER, actorType: "PlatformAdmin", reissued: true }, ipAddress } });
      await this.platformAudit(tx, principal, PlatformAuditAction.INVITE_OWNER, tenantId, "StaffInvitation", created.id, ipAddress, { email: created.email, reissued: true });
      return created;
    });
    return { invitation, invitationUrl: this.invitationUrl(token) };
  }

  listAuditEvents() {
    return this.prisma.platformAuditEvent.findMany({
      select: { id: true, action: true, entityType: true, entityId: true, metadata: true, ipAddress: true, createdAt: true, platformAdmin: { select: { id: true, name: true, email: true } }, tenant: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" }, take: 100,
    });
  }

  private async changeStatus(principal: PlatformPrincipal, tenantId: string, status: TenantStatus, action: PlatformAuditAction, ipAddress?: string) {
    const current = await this.requireTenant(tenantId);
    if (current.status === status) throw new ConflictException(`Gym is already ${status.toLowerCase()}`);
    if (status === TenantStatus.SUSPENDED && !(current.status === TenantStatus.ACTIVE || current.status === TenantStatus.TRIAL)) throw new BadRequestException("Only an active or trial gym can be suspended");
    if (status === TenantStatus.ACTIVE && !(current.status === TenantStatus.SUSPENDED || current.status === TenantStatus.CANCELLED || current.status === TenantStatus.TRIAL)) throw new BadRequestException("Gym cannot be reactivated from its current status");
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({ where: { id: tenantId }, data: { status } });
      if (status === TenantStatus.SUSPENDED || status === TenantStatus.CANCELLED) {
        await tx.authSession.updateMany({ where: { tenantId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.notificationEvent.updateMany({ where: { tenantId, status: { in: [NotificationStatus.SCHEDULED, NotificationStatus.QUEUED, NotificationStatus.PROCESSING] } }, data: { status: NotificationStatus.CANCELLED, nextAttemptAt: null, errorCode: "TENANT_INACTIVE", errorMessage: "Gym access was suspended or archived" } });
      }
      await this.platformAudit(tx, principal, action, tenantId, "Tenant", tenantId, ipAddress, { from: current.status, to: status });
      return tenant;
    });
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, status: true } });
    if (!tenant) throw new NotFoundException("Gym tenant not found");
    return tenant;
  }

  private platformAudit(tx: Prisma.TransactionClient, principal: PlatformPrincipal, action: PlatformAuditAction, tenantId: string | undefined, entityType: string, entityId: string, ipAddress?: string, metadata?: Prisma.InputJsonValue) {
    return tx.platformAuditEvent.create({ data: { platformAdminId: principal.platformAdminId, tenantId, action, entityType, entityId, ipAddress, ...(metadata ? { metadata } : {}) } });
  }

  private tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
  private invitationUrl(token: string) { return `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/?invite=${encodeURIComponent(token)}`; }
}
