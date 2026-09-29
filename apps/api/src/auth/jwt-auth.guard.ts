import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { TenantStatus, UserStatus } from "@gym/database";
import type { Request } from "express";
import { PrismaService } from "../common/prisma.service";
import { IS_PUBLIC } from "../common/public.decorator";
import type { AuthPrincipal } from "./auth.types";
import { IS_PLATFORM_ROUTE } from "../platform/platform-route.decorator";

type AccessPayload = { sub: string; sid: string; kind: "access" };
export type AuthenticatedRequest = Request & { user: AuthPrincipal; tenantId: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ROUTE, targets) === true) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = request.header("authorization")?.replace(/^Bearer\s+/i, "");
    const token = request.cookies?.gym_access ?? bearer;
    if (!token) throw new UnauthorizedException("Authentication required");

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token);
    } catch {
      throw new UnauthorizedException("Session expired");
    }
    if (payload.kind !== "access") throw new UnauthorizedException("Invalid access token");

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        status: UserStatus.ACTIVE,
        tenant: { status: { in: [TenantStatus.ACTIVE, TenantStatus.TRIAL] } },
        authSessions: { some: { id: payload.sid, revokedAt: null, expiresAt: { gt: new Date() } } },
      },
      include: { roles: { include: { role: true } }, branches: true },
    });
    if (!user) throw new UnauthorizedException("Session is no longer active");

    request.user = {
      userId: user.id,
      tenantId: user.tenantId,
      sessionId: payload.sid,
      email: user.email,
      name: user.name,
      roles: user.roles.map(({ role }) => role.name),
      permissions: [...new Set(user.roles.flatMap(({ role }) => role.permissions))],
      branchIds: user.branches.map(({ branchId }) => branchId),
    };
    request.tenantId = user.tenantId;
    return true;
  }
}
