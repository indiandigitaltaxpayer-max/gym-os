import { Body, Controller, Get, Post } from "@nestjs/common";
import { CheckInDto } from "./operations.dto";
import { OperationsService } from "./operations.service";
import { Permission } from "@gym/database";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";

@Controller()
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  @Get("dashboard")
  @RequirePermissions(Permission.MEMBER_READ)
  dashboard(@CurrentUser() principal: AuthPrincipal) {
    return this.service.dashboard(principal);
  }

  @Post("check-ins")
  @RequirePermissions(Permission.CHECK_IN)
  checkIn(@CurrentUser() principal: AuthPrincipal, @Body() dto: CheckInDto): Promise<unknown> {
    return this.service.checkIn(principal, dto);
  }
}
