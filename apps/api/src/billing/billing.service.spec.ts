import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { InvoiceStatus, PaymentStatus } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { BillingService } from "./billing.service";

const owner: AuthPrincipal = { userId: "u1", tenantId: "t1", sessionId: "s1", email: "owner@example.com", name: "Owner", roles: ["Owner"], permissions: ["payment.read", "payment.write", "finance.read"], branchIds: ["b1"] };
const frontDesk: AuthPrincipal = { ...owner, userId: "u2", roles: ["Front desk"], permissions: ["payment.read", "payment.write"], branchIds: ["b1"] };

describe("BillingService", () => {
  it("snapshots plan price and calculates tax when issuing an invoice", async () => {
    const tx = {
      tenant: { update: jest.fn().mockResolvedValue({ slug: "pulse-fitness", invoiceSequence: 7 }) },
      invoice: { create: jest.fn().mockImplementation(({ data }) => ({ id: "i1", ...data, lineItems: [data.lineItems.create] })) },
      auditEvent: { create: jest.fn() },
    };
    const service = new BillingService({} as never);
    const result = await service.issueMembershipInvoice(tx as never, owner, { id: "m1", homeBranchId: "b1" }, { name: "Annual", priceMinor: 100000, taxRateBps: 1800 }, "ms1", new Date("2026-10-01"));
    expect(result.invoiceNumber).toBe("PUL-INV-000007");
    expect(result.subtotalMinor).toBe(100000);
    expect(result.taxMinor).toBe(18000);
    expect(result.totalMinor).toBe(118000);
    expect(result.lineItems[0]).toMatchObject({ unitPriceMinor: 100000, taxRateBps: 1800, totalMinor: 118000 });
  });

  it("records a partial payment without changing membership state", async () => {
    const invoice = { id: "i1", tenantId: "t1", totalMinor: 10000, paidMinor: 0, status: InvoiceStatus.OPEN };
    const tx = {
      invoice: { findFirst: jest.fn().mockResolvedValue(invoice), update: jest.fn() },
      tenant: { update: jest.fn().mockResolvedValue({ slug: "pulse-fitness", receiptSequence: 2 }) },
      payment: { create: jest.fn().mockImplementation(({ data }) => ({ id: "pay1", status: PaymentStatus.CAPTURED, ...data })) },
      auditEvent: { create: jest.fn() },
    };
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const service = new BillingService(prisma as never);
    const result = await service.capturePayment(owner, { invoiceId: "i1", amountMinor: 4000, method: "UPI", idempotencyKey: "key-1" });
    expect(result.receiptNumber).toBe("PUL-RCT-000002");
    expect(tx.invoice.update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { paidMinor: 4000, status: InvoiceStatus.PARTIALLY_PAID } });
    expect((tx as Record<string, unknown>).membership).toBeUndefined();
  });

  it("rejects a payment greater than the remaining balance", async () => {
    const tx = { invoice: { findFirst: jest.fn().mockResolvedValue({ id: "i1", totalMinor: 10000, paidMinor: 8000, status: InvoiceStatus.PARTIALLY_PAID }) } };
    const prisma = { payment: { findUnique: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn().mockImplementation((callback) => callback(tx)) };
    const service = new BillingService(prisma as never);
    await expect(service.capturePayment(owner, { invoiceId: "i1", amountMinor: 3000, method: "CASH", idempotencyKey: "key-2" })).rejects.toThrow(new BadRequestException("Payment exceeds invoice balance"));
  });

  it("rejects an explicit branch filter outside the user's scope", async () => {
    const service = new BillingService({} as never);
    await expect(service.list(frontDesk, { page: 1, pageSize: 20, branchId: "b2" })).rejects.toThrow(ForbiddenException);
  });

  it("allows only owners and accountants to reverse a manual payment", async () => {
    const service = new BillingService({} as never);
    await expect(service.reversePayment(frontDesk, "pay1", { reason: "Incorrect amount" })).rejects.toThrow(ForbiddenException);
  });
});
