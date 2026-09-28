import { OperationsService } from "./operations.service";
import type { AuthPrincipal } from "../auth/auth.types";

describe("OperationsService attendance handoff", () => {
  it("routes the legacy dashboard check-in through the shared attendance service", async () => {
    const attendance = { checkInManual: jest.fn().mockResolvedValue({ id: "ci1" }) };
    const service = new OperationsService({} as never, attendance as never);
    const principal: AuthPrincipal = { userId: "u1", tenantId: "t1", sessionId: "s1", email: "staff@example.com", name: "Staff", roles: ["Front desk"], permissions: ["checkin.create"], branchIds: ["branch-a"] };
    await expect(service.checkIn(principal, { memberId: "m1", branchId: "branch-a" })).resolves.toEqual({ id: "ci1" });
    expect(attendance.checkInManual).toHaveBeenCalledWith(principal, { memberId: "m1", branchId: "branch-a" });
  });
});
