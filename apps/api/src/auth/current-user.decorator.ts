import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthPrincipal } from "./auth.types";
import type { AuthenticatedRequest } from "./jwt-auth.guard";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthPrincipal => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
});

