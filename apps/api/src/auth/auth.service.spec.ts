jest.mock("@nestjs/jwt", () => ({ JwtService: class JwtService {} }));

import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  beforeAll(() => { process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters"; });

  it("uses the same generic error when the workspace or user is unknown", async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AuthService(prisma as never, {} as never);
    await expect(service.login({ workspace: "wrong", email: "nobody@example.com", password: "not-a-password" }, {}))
      .rejects.toThrow(new UnauthorizedException("Invalid workspace, email, or password"));
  });

  it("does not activate an invitation while its gym is suspended", async () => {
    const prisma = { staffInvitation: { findUnique: jest.fn().mockResolvedValue({
      acceptedAt: null, expiresAt: new Date(Date.now() + 60_000), tenant: { status: "SUSPENDED" }, role: { id: "owner-role" },
    }) } };
    const service = new AuthService(prisma as never, {} as never);
    await expect(service.acceptInvitation({ token: "invitation-token", password: "StrongPassword1" }, {}))
      .rejects.toThrow(new BadRequestException("This gym workspace is not active"));
  });
});
