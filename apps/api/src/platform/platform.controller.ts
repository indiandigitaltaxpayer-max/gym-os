import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../common/public.decorator";
import { CurrentPlatformAdmin } from "./current-platform-admin.decorator";
import { PlatformAuthService } from "./platform-auth.service";
import type { PlatformAuthenticatedRequest } from "./platform-auth.guard";
import { CreateTenantDto, PlatformLoginDto, TenantListQueryDto, UpdateTenantDto } from "./platform.dto";
import { PlatformRoute } from "./platform-route.decorator";
import { PlatformService } from "./platform.service";
import type { PlatformPrincipal } from "./platform.types";

const accessCookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/v1/platform", maxAge: 15 * 60 * 1000 };
const refreshCookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/v1/platform/auth", maxAge: 7 * 24 * 60 * 60 * 1000 };

@PlatformRoute()
@Controller("platform/auth")
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Public() @Post("login")
  async login(@Body() dto: PlatformLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, this.metadata(req));
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { admin: result.admin };
  }

  @Public() @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(req.cookies?.platform_refresh, this.metadata(req));
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { admin: result.admin };
  }

  @Post("logout")
  async logout(@CurrentPlatformAdmin() principal: PlatformPrincipal, @Req() req: PlatformAuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.logout(principal, this.metadata(req));
    res.clearCookie("platform_access", accessCookie); res.clearCookie("platform_refresh", refreshCookie);
    return result;
  }

  @Get("me") me(@CurrentPlatformAdmin() principal: PlatformPrincipal) { return principal; }
  private setCookies(res: Response, accessToken: string, refreshToken: string) { res.cookie("platform_access", accessToken, accessCookie); res.cookie("platform_refresh", refreshToken, refreshCookie); }
  private metadata(req: Request) { return { ipAddress: req.ip, userAgent: req.header("user-agent") }; }
}

@PlatformRoute()
@Controller("platform/tenants")
export class PlatformTenantsController {
  constructor(private readonly platform: PlatformService) {}

  @Get() list(@Query() query: TenantListQueryDto) { return this.platform.listTenants(query); }
  @Get(":tenantId") get(@Param("tenantId") tenantId: string) { return this.platform.getTenant(tenantId); }
  @Post() create(@CurrentPlatformAdmin() principal: PlatformPrincipal, @Body() dto: CreateTenantDto, @Req() req: Request) { return this.platform.createTenant(principal, dto, req.ip); }
  @Patch(":tenantId") update(@CurrentPlatformAdmin() principal: PlatformPrincipal, @Param("tenantId") tenantId: string, @Body() dto: UpdateTenantDto, @Req() req: Request) { return this.platform.updateTenant(principal, tenantId, dto, req.ip); }
  @Post(":tenantId/suspend") suspend(@CurrentPlatformAdmin() principal: PlatformPrincipal, @Param("tenantId") tenantId: string, @Req() req: Request) { return this.platform.suspendTenant(principal, tenantId, req.ip); }
  @Post(":tenantId/reactivate") reactivate(@CurrentPlatformAdmin() principal: PlatformPrincipal, @Param("tenantId") tenantId: string, @Req() req: Request) { return this.platform.reactivateTenant(principal, tenantId, req.ip); }
  @Post(":tenantId/archive") archive(@CurrentPlatformAdmin() principal: PlatformPrincipal, @Param("tenantId") tenantId: string, @Req() req: Request) { return this.platform.archiveTenant(principal, tenantId, req.ip); }
  @Post(":tenantId/owner-invitations") inviteOwner(@CurrentPlatformAdmin() principal: PlatformPrincipal, @Param("tenantId") tenantId: string, @Req() req: Request) { return this.platform.inviteOwner(principal, tenantId, req.ip); }
}

@PlatformRoute()
@Controller("platform/audit-events")
export class PlatformAuditController {
  constructor(private readonly platform: PlatformService) {}
  @Get() list() { return this.platform.listAuditEvents(); }
}
