import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";

function context(permissions: string[]) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  it("allows a user with one of the required permissions", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["member.write"]) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(context(["member.write"]))).toBe(true);
  });

  it("rejects a user without a required permission", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["staff.manage"]) } as unknown as Reflector;
    expect(() => new PermissionsGuard(reflector).canActivate(context(["member.read"]))).toThrow(ForbiddenException);
  });
});

