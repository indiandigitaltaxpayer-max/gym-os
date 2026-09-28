import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Permission } from "@gym/database";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { AddLeadNoteDto, AssignLeadDto, CancelFollowUpDto, ChangeLeadStageDto, CompleteFollowUpDto, CreateFollowUpDto, CreateLeadDto, LeadSummaryQueryDto, ListLeadsQueryDto, UpdateLeadDto } from "./leads.dto";
import { LeadsService } from "./leads.service";

@Controller()
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get("leads") @RequirePermissions(Permission.LEAD_READ)
  list(@CurrentUser() principal: AuthPrincipal, @Query() query: ListLeadsQueryDto) { return this.service.list(principal, query); }

  @Get("leads/options") @RequirePermissions(Permission.LEAD_READ)
  options(@CurrentUser() principal: AuthPrincipal) { return this.service.options(principal); }

  @Get("leads/summary") @RequirePermissions(Permission.LEAD_READ)
  summary(@CurrentUser() principal: AuthPrincipal, @Query() query: LeadSummaryQueryDto) { return this.service.summary(principal, query); }

  @Post("leads") @RequirePermissions(Permission.LEAD_WRITE)
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateLeadDto, @Req() request: Request) { return this.service.create(principal, dto, request.ip); }

  @Get("leads/:leadId") @RequirePermissions(Permission.LEAD_READ)
  detail(@CurrentUser() principal: AuthPrincipal, @Param("leadId") leadId: string) { return this.service.detail(principal, leadId); }

  @Patch("leads/:leadId") @RequirePermissions(Permission.LEAD_WRITE)
  update(@CurrentUser() principal: AuthPrincipal, @Param("leadId") leadId: string, @Body() dto: UpdateLeadDto, @Req() request: Request) { return this.service.update(principal, leadId, dto, request.ip); }

  @Post("leads/:leadId/stage") @RequirePermissions(Permission.LEAD_WRITE)
  changeStage(@CurrentUser() principal: AuthPrincipal, @Param("leadId") leadId: string, @Body() dto: ChangeLeadStageDto, @Req() request: Request) { return this.service.changeStage(principal, leadId, dto, request.ip); }

  @Post("leads/:leadId/assign") @RequirePermissions(Permission.LEAD_WRITE)
  assign(@CurrentUser() principal: AuthPrincipal, @Param("leadId") leadId: string, @Body() dto: AssignLeadDto, @Req() request: Request) { return this.service.assign(principal, leadId, dto, request.ip); }

  @Post("leads/:leadId/notes") @RequirePermissions(Permission.LEAD_WRITE)
  note(@CurrentUser() principal: AuthPrincipal, @Param("leadId") leadId: string, @Body() dto: AddLeadNoteDto, @Req() request: Request) { return this.service.addNote(principal, leadId, dto, request.ip); }

  @Post("leads/:leadId/archive") @RequirePermissions(Permission.LEAD_WRITE)
  archive(@CurrentUser() principal: AuthPrincipal, @Param("leadId") leadId: string, @Req() request: Request) { return this.service.archive(principal, leadId, request.ip); }

  @Post("leads/:leadId/reactivate") @RequirePermissions(Permission.LEAD_WRITE)
  reactivate(@CurrentUser() principal: AuthPrincipal, @Param("leadId") leadId: string, @Req() request: Request) { return this.service.reactivate(principal, leadId, request.ip); }

  @Post("leads/:leadId/follow-ups") @RequirePermissions(Permission.LEAD_WRITE)
  followUp(@CurrentUser() principal: AuthPrincipal, @Param("leadId") leadId: string, @Body() dto: CreateFollowUpDto, @Req() request: Request) { return this.service.createFollowUp(principal, leadId, dto, request.ip); }

  @Post("leads/:leadId/convert") @RequirePermissions(Permission.LEAD_CONVERT)
  convert(@CurrentUser() principal: AuthPrincipal, @Param("leadId") leadId: string, @Req() request: Request) { return this.service.convert(principal, leadId, request.ip); }

  @Post("follow-ups/:followUpId/complete") @RequirePermissions(Permission.LEAD_WRITE)
  complete(@CurrentUser() principal: AuthPrincipal, @Param("followUpId") followUpId: string, @Body() dto: CompleteFollowUpDto, @Req() request: Request) { return this.service.completeFollowUp(principal, followUpId, dto, request.ip); }

  @Post("follow-ups/:followUpId/assign") @RequirePermissions(Permission.LEAD_WRITE)
  assignFollowUp(@CurrentUser() principal: AuthPrincipal, @Param("followUpId") followUpId: string, @Body() dto: AssignLeadDto, @Req() request: Request) { return this.service.assignFollowUp(principal, followUpId, dto, request.ip); }

  @Post("follow-ups/:followUpId/cancel") @RequirePermissions(Permission.LEAD_WRITE)
  cancel(@CurrentUser() principal: AuthPrincipal, @Param("followUpId") followUpId: string, @Body() dto: CancelFollowUpDto, @Req() request: Request) { return this.service.cancelFollowUp(principal, followUpId, dto, request.ip); }
}
