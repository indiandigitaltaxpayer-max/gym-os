import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../common/public.decorator";
import { AcceptInvitationDto, LoginDto } from "./auth.dto";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import type { AuthenticatedRequest } from "./jwt-auth.guard";
import type { AuthPrincipal } from "./auth.types";

const accessCookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 15 * 60 * 1000 };
const refreshCookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/v1/auth", maxAge: 7 * 24 * 60 * 60 * 1000 };

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, this.metadata(req));
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(req.cookies?.gym_refresh, this.metadata(req));
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post("logout")
  async logout(@Req() req: AuthenticatedRequest, @CurrentUser() principal: AuthPrincipal, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.logout(req.cookies?.gym_refresh, principal, this.metadata(req));
    res.clearCookie("gym_access", accessCookie);
    res.clearCookie("gym_refresh", refreshCookie);
    return result;
  }

  @Get("me")
  me(@CurrentUser() principal: AuthPrincipal) {
    return principal;
  }

  @Public()
  @Post("accept-invitation")
  acceptInvitation(@Body() dto: AcceptInvitationDto, @Req() req: Request) {
    return this.auth.acceptInvitation(dto, this.metadata(req));
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie("gym_access", accessToken, accessCookie);
    res.cookie("gym_refresh", refreshToken, refreshCookie);
  }

  private metadata(req: Request) {
    return { ipAddress: req.ip, userAgent: req.header("user-agent") };
  }
}

