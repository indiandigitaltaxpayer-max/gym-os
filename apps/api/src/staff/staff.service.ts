import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Permission, RoleName, UserStatus } from "@gym/database";
import { PrismaService } from "../common/prisma.service";
import { AuthService } from "../auth/auth.service";
import type { AuthPrincipal } from "../auth/auth.types";
import { InviteStaffDto } from "./staff.dto";

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  list(principal: AuthPrincipal) {
    return this.prisma.user.findMany({
      where: { tenantId: principal.tenantId },
      select: {
        id: true, name: true, email: true, status: true, lastLoginAt: true, createdAt: true,
        roles: { select: { role: { select: { id: true, name: true } } } },
        branches: { select: { branch: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async options(principal: AuthPrincipal) {
    const owner = principal.roles.includes(RoleName.OWNER);
    const [roles, branches] = await Promise.all([
      this.prisma.role.findMany({
        where: { tenantId: principal.tenantId, ...(owner ? {} : { name: { in: [RoleName.FRONT_DESK, RoleName.TRAINER, RoleName.ACCOUNTANT] } }) },
        select: { id: true, name: true }, orderBy: { name: "asc" },
      }),
      this.prisma.branch.findMany({
        where: { tenantId: principal.tenantId, isActive: true, ...(owner ? {} : { id: { in: principal.branchIds } }) },
        select: { id: true, name: true }, orderBy: { name: "asc" },
      }),
    ]);
    return { roles, branches };
  }

  async invite(principal: AuthPrincipal, dto: InviteStaffDto, ipAddress?: string) {
    const email = dto.email.trim().toLowerCase();
    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId: principal.tenantId } });
    if (!role) throw new NotFoundException("Role not found");
    this.assertCanManageRole(principal, role.name);

    const uniqueBranchIds = [...new Set(dto.branchIds)];
    const branches = await this.prisma.branch.findMany({ where: { id: { in: uniqueBranchIds }, tenantId: principal.tenantId, isActive: true } });
    if (branches.length !== uniqueBranchIds.length) throw new BadRequestException("One or more branches are invalid");
    if (!principal.roles.includes(RoleName.OWNER) && uniqueBranchIds.some((id) => !principal.branchIds.includes(id))) {
      throw new ForbiddenException("Managers can assign only their own branches");
    }
    const existing = await this.prisma.user.findUnique({ where: { tenantId_email: { tenantId: principal.tenantId, email } } });
    if (existing?.status === UserStatus.ACTIVE) throw new BadRequestException("A staff account already exists for this email");

    await this.prisma.staffInvitation.deleteMany({ where: { tenantId: principal.tenantId, email, acceptedAt: null } });
    const { token, tokenHash } = this.auth.generateInvitationToken();
    const invitation = await this.prisma.staffInvitation.create({
      data: { tenantId: principal.tenantId, email, name: dto.name.trim(), roleId: role.id, branchIds: uniqueBranchIds, tokenHash, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), invitedById: principal.userId },
    });
    await this.prisma.auditEvent.create({
      data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.INVITE, entityType: "StaffInvitation", entityId: invitation.id, metadata: { email, role: role.name, branchIds: uniqueBranchIds }, ipAddress },
    });
    const baseUrl = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    return { id: invitation.id, email, expiresAt: invitation.expiresAt, invitationUrl: `${baseUrl}/?invite=${encodeURIComponent(token)}` };
  }

  async disable(principal: AuthPrincipal, userId: string, ipAddress?: string) {
    if (userId === principal.userId) throw new BadRequestException("You cannot disable your own account");
    const target = await this.prisma.user.findFirst({ where: { id: userId, tenantId: principal.tenantId }, include: { roles: { include: { role: true } } } });
    if (!target) throw new NotFoundException("Staff member not found");
    target.roles.forEach(({ role }) => this.assertCanManageRole(principal, role.name));
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: target.id }, data: { status: UserStatus.DISABLED } }),
      this.prisma.authSession.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.DISABLE_USER, entityType: "User", entityId: target.id, ipAddress } }),
    ]);
    return { success: true };
  }

  private assertCanManageRole(principal: AuthPrincipal, roleName: string) {
    if (principal.roles.includes(RoleName.OWNER)) return;
    if (!principal.permissions.includes(Permission.STAFF_MANAGE_LIMITED) || [RoleName.OWNER, RoleName.MANAGER].includes(roleName as typeof RoleName.OWNER)) {
      throw new ForbiddenException("Managers cannot manage owners or other managers");
    }
  }
}

