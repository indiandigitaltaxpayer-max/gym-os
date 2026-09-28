import { Controller, Get, Query, Res } from "@nestjs/common";
import { Permission } from "@gym/database";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { ReportQueryDto } from "./reports.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get("members")
  @RequirePermissions(Permission.REPORT_OPERATIONS_READ)
  members(@CurrentUser() principal: AuthPrincipal, @Query() query: ReportQueryDto) {
    return this.service.members(principal, query);
  }

  @Get("revenue")
  @RequirePermissions(Permission.REPORT_FINANCE_READ)
  revenue(@CurrentUser() principal: AuthPrincipal, @Query() query: ReportQueryDto) {
    return this.service.revenue(principal, query);
  }

  @Get("attendance")
  @RequirePermissions(Permission.REPORT_OPERATIONS_READ)
  attendance(@CurrentUser() principal: AuthPrincipal, @Query() query: ReportQueryDto) {
    return this.service.attendance(principal, query);
  }

  @Get("leads")
  @RequirePermissions(Permission.REPORT_OPERATIONS_READ)
  leads(@CurrentUser() principal: AuthPrincipal, @Query() query: ReportQueryDto) {
    return this.service.leads(principal, query);
  }

  @Get("members/export")
  @RequirePermissions(Permission.REPORT_OPERATIONS_READ)
  async exportMembers(@CurrentUser() principal: AuthPrincipal, @Query() query: ReportQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.csvResponse(response, await this.service.exportMembers(principal, query));
  }

  @Get("revenue/export")
  @RequirePermissions(Permission.REPORT_FINANCE_READ)
  async exportRevenue(@CurrentUser() principal: AuthPrincipal, @Query() query: ReportQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.csvResponse(response, await this.service.exportRevenue(principal, query));
  }

  @Get("attendance/export")
  @RequirePermissions(Permission.REPORT_OPERATIONS_READ)
  async exportAttendance(@CurrentUser() principal: AuthPrincipal, @Query() query: ReportQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.csvResponse(response, await this.service.exportAttendance(principal, query));
  }

  @Get("leads/export")
  @RequirePermissions(Permission.REPORT_OPERATIONS_READ)
  async exportLeads(@CurrentUser() principal: AuthPrincipal, @Query() query: ReportQueryDto, @Res({ passthrough: true }) response: Response) {
    return this.csvResponse(response, await this.service.exportLeads(principal, query));
  }

  private csvResponse(response: Response, result: { filename: string; csv: string }) {
    response.type("text/csv");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return result.csv;
  }
}
