import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PlatformAdminStatus, PlatformAuditAction } from "@gym/database";
import { verify } from "argon2";
import { PrismaService } from "../common/prisma.service";
import type { PlatformLoginDto } from "./platform.dto";
import type { PlatformPrincipal } from "./platform.types";

const ACCESS_SECONDS = 15 * 60;
const REFRESH_SECONDS = 7 * 24 * 60 * 60;
type RequestMetadata = { ipAddress?: string; userAgent?: string };
type PlatformPayload = { sub: string; sid: string; realm: "platform"; kind: "access" | "refresh" };

@Injectable()
export class PlatformAuthService {
  readonly secret: string;

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {
    this.secret = process.env.PLATFORM_JWT_SECRET
      ?? (process.env.NODE_ENV === "production" ? "" : process.env.JWT_SECRET ?? "");
    if (this.secret.length < 32) throw new Error("PLATFORM_JWT_SECRET must contain at least 32 characters");
  }

  async login(dto: PlatformLoginDto, metadata: RequestMetadata) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!admin || admin.status !== PlatformAdminStatus.ACTIVE || !(await verify(admin.passwordHash, dto.password))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const tokens = await this.createSession(admin.id, metadata);
    await this.prisma.$transaction([
      this.prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
      this.prisma.platformAuditEvent.create({ data: { platformAdminId: admin.id, action: PlatformAuditAction.LOGIN, entityType: "PlatformAdmin", entityId: admin.id, ipAddress: metadata.ipAddress } }),
    ]);
    return { admin: this.principal(admin, tokens.sessionId), ...tokens };
  }

  async refresh(refreshToken: string | undefined, metadata: RequestMetadata) {
    if (!refreshToken) throw new UnauthorizedException("Refresh token missing");
    const payload = await this.verifyToken(refreshToken, "refresh");
    const session = await this.prisma.platformAuthSession.findUnique({ where: { id: payload.sid }, include: { platformAdmin: true } });
    const candidateHash = this.tokenHash(refreshToken);
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !this.hashesMatch(session.tokenHash, candidateHash)) {
      if (session && !session.revokedAt) await this.prisma.platformAuthSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException("Refresh session is no longer valid");
    }
    if (session.platformAdmin.status !== PlatformAdminStatus.ACTIVE) throw new UnauthorizedException("Account is no longer active");
    const tokens = await this.rotateSession(session.id, session.platformAdminId, metadata);
    return { admin: this.principal(session.platformAdmin, session.id), ...tokens };
  }

  async logout(principal: PlatformPrincipal | undefined, metadata: RequestMetadata) {
    if (!principal) return { success: true };
    await this.prisma.$transaction([
      this.prisma.platformAuthSession.updateMany({ where: { id: principal.sessionId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.platformAuditEvent.create({ data: { platformAdminId: principal.platformAdminId, action: PlatformAuditAction.LOGOUT, entityType: "PlatformAdmin", entityId: principal.platformAdminId, ipAddress: metadata.ipAddress } }),
    ]);
    return { success: true };
  }

  async verifyAccess(token: string): Promise<PlatformPrincipal> {
    const payload = await this.verifyToken(token, "access");
    const admin = await this.prisma.platformAdmin.findFirst({
      where: { id: payload.sub, status: PlatformAdminStatus.ACTIVE, sessions: { some: { id: payload.sid, revokedAt: null, expiresAt: { gt: new Date() } } } },
    });
    if (!admin) throw new UnauthorizedException("Platform session is no longer active");
    return this.principal(admin, payload.sid);
  }

  private async verifyToken(token: string, kind: PlatformPayload["kind"]) {
    try {
      const payload = await this.jwt.verifyAsync<PlatformPayload>(token, { secret: this.secret });
      if (payload.realm !== "platform" || payload.kind !== kind) throw new Error("wrong realm");
      return payload;
    } catch {
      throw new UnauthorizedException("Platform session expired");
    }
  }

  private async createSession(platformAdminId: string, metadata: RequestMetadata) {
    const sessionId = randomUUID();
    const refreshToken = await this.jwt.signAsync({ sub: platformAdminId, sid: sessionId, realm: "platform", kind: "refresh" }, { secret: this.secret, expiresIn: REFRESH_SECONDS });
    await this.prisma.platformAuthSession.create({ data: { id: sessionId, platformAdminId, tokenHash: this.tokenHash(refreshToken), expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000), ipAddress: metadata.ipAddress, userAgent: metadata.userAgent } });
    const accessToken = await this.jwt.signAsync({ sub: platformAdminId, sid: sessionId, realm: "platform", kind: "access" }, { secret: this.secret, expiresIn: ACCESS_SECONDS });
    return { sessionId, accessToken, refreshToken };
  }

  private async rotateSession(sessionId: string, platformAdminId: string, metadata: RequestMetadata) {
    const refreshToken = await this.jwt.signAsync({ sub: platformAdminId, sid: sessionId, realm: "platform", kind: "refresh", nonce: randomUUID() }, { secret: this.secret, expiresIn: REFRESH_SECONDS });
    await this.prisma.platformAuthSession.update({ where: { id: sessionId }, data: { tokenHash: this.tokenHash(refreshToken), expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000), lastUsedAt: new Date(), ipAddress: metadata.ipAddress, userAgent: metadata.userAgent } });
    const accessToken = await this.jwt.signAsync({ sub: platformAdminId, sid: sessionId, realm: "platform", kind: "access" }, { secret: this.secret, expiresIn: ACCESS_SECONDS });
    return { sessionId, accessToken, refreshToken };
  }

  private principal(admin: { id: string; email: string; name: string }, sessionId: string): PlatformPrincipal {
    return { platformAdminId: admin.id, sessionId, email: admin.email, name: admin.name };
  }

  private tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
  private hashesMatch(expected: string, actual: string) {
    const a = Buffer.from(expected, "hex"); const b = Buffer.from(actual, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
