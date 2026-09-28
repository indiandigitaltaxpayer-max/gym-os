import { Body, Controller, Get, Post } from "@nestjs/common";
import { TenantId } from "../common/tenant.decorator";
import { CreateBranchDto, CreatePlanDto } from "./setup.dto";
import { SetupService } from "./setup.service";
import { Permission } from "@gym/database";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";

@Controller("setup")
export class SetupController {
  constructor(private readonly service: SetupService) {}

  @Get()
  @RequirePermissions(Permission.MEMBER_READ)
  getSetup(@CurrentUser() principal: AuthPrincipal): Promise<unknown> {
    return this.service.getSetup(principal);
  }

  @Post("branches")
  @RequirePermissions(Permission.GYM_CONFIG)
  createBranch(@TenantId() tenantId: string, @Body() dto: CreateBranchDto): Promise<unknown> {
    return this.service.createBranch(tenantId, dto);
  }

  @Post("plans")
  @RequirePermissions(Permission.GYM_CONFIG)
  createPlan(@TenantId() tenantId: string, @Body() dto: CreatePlanDto): Promise<unknown> {
    return this.service.createPlan(tenantId, dto);
  }
}
