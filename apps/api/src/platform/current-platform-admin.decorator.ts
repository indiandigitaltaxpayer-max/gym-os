import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { PlatformAuthenticatedRequest } from "./platform-auth.guard";

export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<PlatformAuthenticatedRequest>().platformAdmin,
);
