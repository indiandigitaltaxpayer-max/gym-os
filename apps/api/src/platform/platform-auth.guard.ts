import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC } from "../common/public.decorator";
import { IS_PLATFORM_ROUTE } from "./platform-route.decorator";
import { PlatformAuthService } from "./platform-auth.service";
import type { PlatformPrincipal } from "./platform.types";

export type PlatformAuthenticatedRequest = Request & { platformAdmin: PlatformPrincipal };

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: PlatformAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ROUTE, targets) !== true) return true;
    const request = context.switchToHttp().getRequest<PlatformAuthenticatedRequest>();
    const bearer = request.header("authorization")?.replace(/^Bearer\s+/i, "");
    const token = request.cookies?.platform_access ?? bearer;
    if (!token) throw new UnauthorizedException("Platform authentication required");
    request.platformAdmin = await this.auth.verifyAccess(token);
    return true;
  }
}
