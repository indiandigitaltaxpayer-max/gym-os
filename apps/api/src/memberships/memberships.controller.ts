import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Permission } from "@gym/database";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { AssignMembershipDto, CreateMembershipPlanDto, ExpiringMembershipsQueryDto, MembershipReasonDto, RenewMembershipDto, UpdateMembershipPlanDto } from "./memberships.dto";
import { MembershipsService } from "./memberships.service";

@Controller()
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  @Get("membership-plans")
  @RequirePermissions(Permission.MEMBER_READ)
  plans(@CurrentUser() principal: AuthPrincipal) { return this.service.listPlans(principal); }

  @Post("membership-plans")
  @RequirePermissions(Permission.GYM_CONFIG)
  createPlan(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateMembershipPlanDto, @Req() request: Request) { return this.service.createPlan(principal, dto, request.ip); }

  @Patch("membership-plans/:planId")
  @RequirePermissions(Permission.GYM_CONFIG)
  updatePlan(@CurrentUser() principal: AuthPrincipal, @Param("planId") planId: string, @Body() dto: UpdateMembershipPlanDto, @Req() request: Request) { return this.service.updatePlan(principal, planId, dto, request.ip); }

  @Post("membership-plans/:planId/deactivate")
  @RequirePermissions(Permission.GYM_CONFIG)
  deactivatePlan(@CurrentUser() principal: AuthPrincipal, @Param("planId") planId: string, @Req() request: Request) { return this.service.deactivatePlan(principal, planId, request.ip); }

  @Post("memberships")
  @RequirePermissions(Permission.MEMBERSHIP_SELL)
  assign(@CurrentUser() principal: AuthPrincipal, @Body() dto: AssignMembershipDto, @Req() request: Request) { return this.service.assign(principal, dto, request.ip); }

  @Post("memberships/:membershipId/renew")
  @RequirePermissions(Permission.MEMBERSHIP_SELL)
  renew(@CurrentUser() principal: AuthPrincipal, @Param("membershipId") membershipId: string, @Body() dto: RenewMembershipDto, @Req() request: Request) { return this.service.renew(principal, membershipId, dto, request.ip); }

  @Post("memberships/:membershipId/freeze")
  @RequirePermissions(Permission.MEMBERSHIP_SELL)
  freeze(@CurrentUser() principal: AuthPrincipal, @Param("membershipId") membershipId: string, @Body() dto: MembershipReasonDto, @Req() request: Request) { return this.service.freeze(principal, membershipId, dto, request.ip); }

  @Post("memberships/:membershipId/resume")
  @RequirePermissions(Permission.MEMBERSHIP_SELL)
  resume(@CurrentUser() principal: AuthPrincipal, @Param("membershipId") membershipId: string, @Req() request: Request) { return this.service.resume(principal, membershipId, request.ip); }

  @Post("memberships/:membershipId/cancel")
  @RequirePermissions(Permission.MEMBERSHIP_SELL)
  cancel(@CurrentUser() principal: AuthPrincipal, @Param("membershipId") membershipId: string, @Body() dto: MembershipReasonDto, @Req() request: Request) { return this.service.cancel(principal, membershipId, dto, request.ip); }

  @Get("memberships/expiring")
  @RequirePermissions(Permission.MEMBER_READ)
  expiring(@CurrentUser() principal: AuthPrincipal, @Query() query: ExpiringMembershipsQueryDto) { return this.service.expiring(principal, query); }
}
