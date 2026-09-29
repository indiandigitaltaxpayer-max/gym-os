import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuditAction, TenantStatus, UserStatus } from "@gym/database";
import { hash, verify } from "argon2";
import { PrismaService } from "../common/prisma.service";
import { AcceptInvitationDto, LoginDto } from "./auth.dto";
import type { AuthPrincipal } from "./auth.types";

const ACCESS_SECONDS = 15 * 60;
const REFRESH_SECONDS = 7 * 24 * 60 * 60;

type RequestMetadata = { ipAddress?: string; userAgent?: string };
type RefreshPayload = { sub: string; sid: string; kind: "refresh" };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters");
    }
  }

  async login(dto: LoginDto, metadata: RequestMetadata) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.trim().toLowerCase(),
        tenant: { slug: dto.workspace.trim().toLowerCase(), status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] } },
      },
      include: { tenant: true, roles: { include: { role: true } }, branches: true },
    });
    if (!user?.passwordHash || user.status !== UserStatus.ACTIVE || !(await verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Invalid workspace, email, or password");
    }

    const tokens = await this.createSession(user.id, user.tenantId, metadata);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.auditEvent.create({
        data: { tenantId: user.tenantId, actorUserId: user.id, action: AuditAction.LOGIN, entityType: "User", entityId: user.id, ipAddress: metadata.ipAddress },
      }),
    ]);
    return { user: this.toPrincipal(user, tokens.sessionId), ...tokens };
  }

  async refresh(refreshToken: string | undefined, metadata: RequestMetadata) {
    if (!refreshToken) throw new UnauthorizedException("Refresh token missing");
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException("Refresh session expired");
    }
    if (payload.kind !== "refresh") throw new UnauthorizedException("Invalid refresh token");

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: { include: { tenant: true, roles: { include: { role: true } }, branches: true } } },
    });
    const candidateHash = this.tokenHash(refreshToken);
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !this.hashesMatch(session.tokenHash, candidateHash)) {
      if (session && !session.revokedAt) {
        await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      }
      throw new UnauthorizedException("Refresh session is no longer valid");
    }
    if (session.user.status !== UserStatus.ACTIVE ||
      (session.user.tenant.status !== TenantStatus.ACTIVE && session.user.tenant.status !== TenantStatus.TRIAL)) {
      throw new UnauthorizedException("Account is no longer active");
    }

    const tokens = await this.rotateSession(session.id, session.userId, metadata);
    return { user: this.toPrincipal(session.user, session.id), ...tokens };
  }

  async logout(refreshToken: string | undefined, principal: AuthPrincipal | undefined, metadata: RequestMetadata) {
    let sessionId = principal?.sessionId;
    if (!sessionId && refreshToken) {
      try { sessionId = (await this.jwt.verifyAsync<RefreshPayload>(refreshToken)).sid; } catch { /* already invalid */ }
    }
    if (sessionId) {
      await this.prisma.authSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    if (principal) {
      await this.prisma.auditEvent.create({
        data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.LOGOUT, entityType: "User", entityId: principal.userId, ipAddress: metadata.ipAddress },
      });
    }
    return { success: true };
  }

  async acceptInvitation(dto: AcceptInvitationDto, metadata: RequestMetadata) {
    const invitation = await this.prisma.staffInvitation.findUnique({
      where: { tokenHash: this.tokenHash(dto.token) },
      include: { role: true, tenant: true },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
      throw new BadRequestException("Invitation is invalid or has expired");
    }
    if (invitation.tenant.status !== TenantStatus.ACTIVE && invitation.tenant.status !== TenantStatus.TRIAL) {
      throw new BadRequestException("This gym workspace is not active");
    }
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: invitation.tenantId, email: invitation.email } },
    });
    if (existing?.status === UserStatus.ACTIVE) throw new BadRequestException("This account is already active");

    const passwordHash = await hash(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const acceptedUser = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { name: invitation.name, passwordHash, status: UserStatus.ACTIVE } })
        : await tx.user.create({ data: { tenantId: invitation.tenantId, email: invitation.email, name: invitation.name, passwordHash, status: UserStatus.ACTIVE } });
      await tx.userRole.deleteMany({ where: { userId: acceptedUser.id } });
      await tx.userBranch.deleteMany({ where: { userId: acceptedUser.id } });
      await tx.userRole.create({ data: { userId: acceptedUser.id, roleId: invitation.roleId } });
      if (invitation.branchIds.length) {
        await tx.userBranch.createMany({ data: invitation.branchIds.map((branchId) => ({ userId: acceptedUser.id, branchId })) });
      }
      await tx.staffInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      await tx.auditEvent.create({
        data: { tenantId: invitation.tenantId, actorUserId: acceptedUser.id, action: AuditAction.ACCEPT_INVITE, entityType: "User", entityId: acceptedUser.id, ipAddress: metadata.ipAddress },
      });
      return acceptedUser;
    });
    return { success: true, email: user.email, workspaceRequired: true };
  }

  generateInvitationToken() {
    const token = randomBytes(32).toString("base64url");
    return { token, tokenHash: this.tokenHash(token) };
  }

  private async createSession(userId: string, tenantId: string, metadata: RequestMetadata) {
    const sessionId = randomUUID();
    const refreshToken = await this.jwt.signAsync({ sub: userId, sid: sessionId, kind: "refresh" }, { expiresIn: REFRESH_SECONDS });
    await this.prisma.authSession.create({
      data: { id: sessionId, tenantId, userId, tokenHash: this.tokenHash(refreshToken), expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000), ipAddress: metadata.ipAddress, userAgent: metadata.userAgent },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: sessionId, kind: "access" }, { expiresIn: ACCESS_SECONDS });
    return { sessionId, accessToken, refreshToken };
  }

  private async rotateSession(sessionId: string, userId: string, metadata: RequestMetadata) {
    const refreshToken = await this.jwt.signAsync({ sub: userId, sid: sessionId, kind: "refresh", nonce: randomUUID() }, { expiresIn: REFRESH_SECONDS });
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { tokenHash: this.tokenHash(refreshToken), expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000), lastUsedAt: new Date(), ipAddress: metadata.ipAddress, userAgent: metadata.userAgent },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: sessionId, kind: "access" }, { expiresIn: ACCESS_SECONDS });
    return { sessionId, accessToken, refreshToken };
  }

  private toPrincipal(user: { id: string; tenantId: string; email: string; name: string; roles: { role: { name: string; permissions: string[] } }[]; branches: { branchId: string }[] }, sessionId: string): AuthPrincipal {
    return { userId: user.id, tenantId: user.tenantId, sessionId, email: user.email, name: user.name, roles: user.roles.map(({ role }) => role.name), permissions: [...new Set(user.roles.flatMap(({ role }) => role.permissions))], branchIds: user.branches.map(({ branchId }) => branchId) };
  }

  private tokenHash(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashesMatch(expected: string, actual: string) {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(actual, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
