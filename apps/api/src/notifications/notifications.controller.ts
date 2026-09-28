import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { Permission } from "@gym/database";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { RequirePermissions } from "../auth/permissions.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { ListNotificationsQueryDto, TestNotificationDto, UpdateNotificationPolicyDto, UpdateNotificationTemplateDto } from "./notifications.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get() @RequirePermissions(Permission.NOTIFICATION_READ)
  list(@CurrentUser() principal: AuthPrincipal, @Query() query: ListNotificationsQueryDto) { return this.service.list(principal, query); }

  @Get("summary") @RequirePermissions(Permission.NOTIFICATION_READ)
  summary(@CurrentUser() principal: AuthPrincipal) { return this.service.summary(principal); }

  @Get("settings") @RequirePermissions(Permission.NOTIFICATION_READ)
  settings(@CurrentUser() principal: AuthPrincipal) { return this.service.settings(principal); }

  @Patch("templates/:templateId") @RequirePermissions(Permission.NOTIFICATION_MANAGE)
  updateTemplate(@CurrentUser() principal: AuthPrincipal, @Param("templateId") templateId: string, @Body() dto: UpdateNotificationTemplateDto, @Req() request: Request) { return this.service.updateTemplate(principal, templateId, dto, request.ip); }

  @Patch("policy") @RequirePermissions(Permission.NOTIFICATION_MANAGE)
  updatePolicy(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateNotificationPolicyDto, @Req() request: Request) { return this.service.updatePolicy(principal, dto, request.ip); }

  @Post("run-scheduler") @RequirePermissions(Permission.NOTIFICATION_MANAGE)
  runScheduler(@CurrentUser() principal: AuthPrincipal, @Req() request: Request) { return this.service.runScheduler(principal, request.ip); }

  @Post("process") @RequirePermissions(Permission.NOTIFICATION_MANAGE)
  process(@CurrentUser() principal: AuthPrincipal) { return this.service.processDue(principal.tenantId); }

  @Post("test") @RequirePermissions(Permission.NOTIFICATION_MANAGE)
  test(@CurrentUser() principal: AuthPrincipal, @Body() dto: TestNotificationDto, @Req() request: Request) { return this.service.queueTest(principal, dto, request.ip); }

  @Post(":eventId/retry") @RequirePermissions(Permission.NOTIFICATION_MANAGE)
  retry(@CurrentUser() principal: AuthPrincipal, @Param("eventId") eventId: string, @Req() request: Request) { return this.service.retry(principal, eventId, request.ip); }

  @Post(":eventId/cancel") @RequirePermissions(Permission.NOTIFICATION_MANAGE)
  cancel(@CurrentUser() principal: AuthPrincipal, @Param("eventId") eventId: string, @Req() request: Request) { return this.service.cancel(principal, eventId, request.ip); }
}
