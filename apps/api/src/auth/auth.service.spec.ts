jest.mock("@nestjs/jwt", () => ({ JwtService: class JwtService {} }));

import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  beforeAll(() => { process.env.JWT_SECRET = "test-secret-that-is-longer-than-thirty-two-characters"; });

  it("uses the same generic error when the workspace or user is unknown", async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AuthService(prisma as never, {} as never);
    await expect(service.login({ workspace: "wrong", email: "nobody@example.com", password: "not-a-password" }, {}))
      .rejects.toThrow(new UnauthorizedException("Invalid workspace, email, or password"));
  });
});
