import { ConflictException } from "@nestjs/common";
import { NotificationChannel, NotificationKind, NotificationStatus } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { NotificationsService } from "./notifications.service";

const frontDesk: AuthPrincipal = { userId: "u1", tenantId: "t1", sessionId: "s1", email: "desk@example.com", name: "Desk", roles: ["Front desk"], permissions: ["notification.read"], branchIds: ["b1"] };
const owner: AuthPrincipal = { ...frontDesk, roles: ["Owner"], permissions: ["notification.read", "notification.manage"] };
const event = { id: "e1", tenantId: "t1", branchId: "b1", status: NotificationStatus.SCHEDULED, scheduledAt: new Date(), nextAttemptAt: null, attemptCount: 0, maxAttempts: 3, recipientAddress: "9999999999", renderedBody: "Hello", payload: {}, kind: NotificationKind.CUSTOM, channel: NotificationChannel.WHATSAPP };

function deliveryPrisma(value = event) {
  const transactionUpdates: unknown[] = [];
  const prisma = {
    notificationEvent: {
      findMany: jest.fn().mockResolvedValue([value]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ ...value, attemptCount: 1 }),
      update: jest.fn().mockImplementation(({ data }) => { transactionUpdates.push(data); return Promise.resolve({ ...value, ...data }); }),
    },
    notificationDeliveryAttempt: {
      create: jest.fn().mockResolvedValue({ id: "a1" }),
      update: jest.fn().mockImplementation(({ data }) => { transactionUpdates.push(data); return Promise.resolve(data); }),
    },
    $transaction: jest.fn().mockImplementation((operations) => Promise.all(operations)),
    transactionUpdates,
  };
  return prisma;
}

describe("NotificationsService", () => {
  it("applies tenant and branch scope to notification history", async () => {
    const prisma = { notificationEvent: { findMany: jest.fn(), count: jest.fn() }, $transaction: jest.fn().mockResolvedValue([[], 0]) };
    const service = new NotificationsService(prisma as never);
    await service.list(frontDesk, { page: 1, pageSize: 20 });
    expect(prisma.notificationEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "t1", branchId: { in: ["b1"] } }) }));
  });

  it("records a delivered event and delivery attempt", async () => {
    const prisma = deliveryPrisma(); const service = new NotificationsService(prisma as never);
    await expect(service.processDue("t1")).resolves.toMatchObject({ processed: 1, failed: 0, mode: "LOCAL" });
    expect(prisma.transactionUpdates).toEqual(expect.arrayContaining([expect.objectContaining({ status: NotificationStatus.DELIVERED })]));
  });

  it("records provider failure and keeps the event retryable", async () => {
    const prisma = deliveryPrisma({ ...event, payload: { simulateFailure: true } }); const service = new NotificationsService(prisma as never);
    await expect(service.processDue("t1")).resolves.toMatchObject({ processed: 0, failed: 1 });
    expect(prisma.transactionUpdates).toEqual(expect.arrayContaining([expect.objectContaining({ status: NotificationStatus.FAILED, errorCode: "SIMULATED_FAILURE" })]));
  });

  it("rejects retry for a notification that was already delivered", async () => {
    const prisma = { notificationEvent: { findFirst: jest.fn().mockResolvedValue({ ...event, status: NotificationStatus.DELIVERED }) } };
    const service = new NotificationsService(prisma as never);
    await expect(service.retry(owner, event.id)).rejects.toThrow(ConflictException);
  });
});
