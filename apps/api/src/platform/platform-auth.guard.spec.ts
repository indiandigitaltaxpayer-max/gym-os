jest.mock("@nestjs/jwt", () => ({ JwtService: class JwtService {} }));

import { UnauthorizedException } from "@nestjs/common";
import { PlatformAuthGuard } from "./platform-auth.guard";

function context(request: Record<string, unknown>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe("PlatformAuthGuard", () => {
  const reflector = { getAllAndOverride: jest.fn((key: string) => key === "isPlatformRoute") };

  beforeEach(() => reflector.getAllAndOverride.mockClear());

  it("requires a platform token on platform routes", async () => {
    const auth = { verifyAccess: jest.fn() };
    const guard = new PlatformAuthGuard(reflector as never, auth as never);
    await expect(guard.canActivate(context({ header: jest.fn(), cookies: {} }))).rejects.toThrow(UnauthorizedException);
    expect(auth.verifyAccess).not.toHaveBeenCalled();
  });

  it("uses the platform realm and attaches the platform principal", async () => {
    const principal = { platformAdminId: "platform-1", sessionId: "session-1", email: "admin@example.com", name: "Admin" };
    const auth = { verifyAccess: jest.fn().mockResolvedValue(principal) };
    const request = { header: jest.fn().mockReturnValue(undefined), cookies: { platform_access: "platform-token" } } as Record<string, unknown>;
    const guard = new PlatformAuthGuard(reflector as never, auth as never);
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(auth.verifyAccess).toHaveBeenCalledWith("platform-token");
    expect(request.platformAdmin).toEqual(principal);
  });
});
