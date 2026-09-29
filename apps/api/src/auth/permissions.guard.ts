import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "./jwt-auth.guard";
import { REQUIRED_PERMISSIONS } from "./permissions.decorator";
import { IS_PLATFORM_ROUTE } from "../platform/platform-route.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ROUTE, [context.getHandler(), context.getClass()]) === true) return true;
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    if (!required.length) return true;

    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!principal || !required.some((permission) => principal.permissions.includes(permission))) {
      throw new ForbiddenException("You do not have permission to perform this action");
    }
    return true;
  }
}
