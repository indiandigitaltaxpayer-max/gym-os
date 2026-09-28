import { Body, Controller, Delete, Get, Param, Post, Query, Req } from "@nestjs/common";
import { Permission } from "@gym/database";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { AttendanceMemberSearchQueryDto, AttendanceSummaryQueryDto, ListAttendanceQueryDto, ManualCheckInDto, QrCheckInDto } from "./attendance.dto";
import { AttendanceService } from "./attendance.service";

@Controller("attendance")
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get("members")
  @RequirePermissions(Permission.ATTENDANCE_READ)
  members(@CurrentUser() principal: AuthPrincipal, @Query() query: AttendanceMemberSearchQueryDto) {
    return this.service.searchMembers(principal, query);
  }

  @Get("logs")
  @RequirePermissions(Permission.ATTENDANCE_READ)
  logs(@CurrentUser() principal: AuthPrincipal, @Query() query: ListAttendanceQueryDto) {
    return this.service.list(principal, query);
  }

  @Get("summary")
  @RequirePermissions(Permission.ATTENDANCE_READ)
  summary(@CurrentUser() principal: AuthPrincipal, @Query() query: AttendanceSummaryQueryDto) {
    return this.service.summary(principal, query);
  }

  @Post("check-ins/manual")
  @RequirePermissions(Permission.CHECK_IN)
  manual(@CurrentUser() principal: AuthPrincipal, @Body() dto: ManualCheckInDto, @Req() request: Request) {
    return this.service.checkInManual(principal, dto, request.ip);
  }

  @Post("check-ins/qr")
  @RequirePermissions(Permission.CHECK_IN)
  qr(@CurrentUser() principal: AuthPrincipal, @Body() dto: QrCheckInDto, @Req() request: Request) {
    return this.service.checkInQr(principal, dto, request.ip);
  }

  @Post("members/:memberId/qr")
  @RequirePermissions(Permission.CHECK_IN)
  issueQr(@CurrentUser() principal: AuthPrincipal, @Param("memberId") memberId: string, @Req() request: Request) {
    return this.service.issueQr(principal, memberId, request.ip);
  }

  @Delete("members/:memberId/qr")
  @RequirePermissions(Permission.CHECK_IN)
  revokeQr(@CurrentUser() principal: AuthPrincipal, @Param("memberId") memberId: string, @Req() request: Request) {
    return this.service.revokeQr(principal, memberId, request.ip);
  }
}
