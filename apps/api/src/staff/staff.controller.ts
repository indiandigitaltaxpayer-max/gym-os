import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { Permission } from "@gym/database";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { InviteStaffDto } from "./staff.dto";
import { StaffService } from "./staff.service";

@Controller("staff")
@RequirePermissions(Permission.STAFF_MANAGE, Permission.STAFF_MANAGE_LIMITED)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal) {
    return this.staff.list(principal);
  }

  @Get("options")
  options(@CurrentUser() principal: AuthPrincipal) {
    return this.staff.options(principal);
  }

  @Post("invitations")
  invite(@CurrentUser() principal: AuthPrincipal, @Body() dto: InviteStaffDto, @Req() req: Request) {
    return this.staff.invite(principal, dto, req.ip);
  }

  @Post(":userId/disable")
  disable(@CurrentUser() principal: AuthPrincipal, @Param("userId") userId: string, @Req() req: Request) {
    return this.staff.disable(principal, userId, req.ip);
  }
}

