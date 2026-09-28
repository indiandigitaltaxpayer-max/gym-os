import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, InvoiceStatus, PaymentStatus, Prisma, RoleName } from "@gym/database";
import type { AuthPrincipal } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { BillingReasonDto, CapturePaymentDto, ListInvoicesQueryDto } from "./billing.dto";

type InvoicePlan = { name: string; priceMinor: number; taxRateBps: number };
type InvoiceMember = { id: string; homeBranchId: string };

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthPrincipal, query: ListInvoicesQueryDto) {
    if (query.branchId) this.requireBranchAccess(principal, query.branchId);
    const where = this.invoiceWhere(principal, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: {
          member: { select: { id: true, memberNumber: true, firstName: true, lastName: true } },
          branch: { select: { id: true, name: true } },
          lineItems: true,
        },
        orderBy: { issuedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return {
      items: items.map((invoice) => this.withEffectiveStatus(invoice)),
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
    };
  }

  async detail(principal: AuthPrincipal, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: principal.tenantId, ...this.branchScope(principal) },
      include: {
        tenant: { select: { name: true, currency: true } },
        branch: { select: { id: true, name: true, address: true } },
        member: { select: { id: true, memberNumber: true, firstName: true, lastName: true, email: true, phone: true } },
        membership: { include: { plan: { select: { id: true, name: true } } } },
        issuedBy: { select: { id: true, name: true } },
        voidedBy: { select: { id: true, name: true } },
        lineItems: { orderBy: { createdAt: "asc" } },
        payments: {
          include: { recordedBy: { select: { id: true, name: true } }, reversedBy: { select: { id: true, name: true } } },
          orderBy: { paidAt: "desc" },
        },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    return this.withEffectiveStatus(invoice);
  }

  async summary(principal: AuthPrincipal) {
    const now = new Date();
    const overdueCutoff = this.startOfToday();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const scope = { tenantId: principal.tenantId, ...this.branchScope(principal) };
    const [open, overdue, revenue, invoiceCount] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...scope, status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID] } },
        _sum: { totalMinor: true, paidMinor: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...scope, status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID] }, dueAt: { lt: overdueCutoff } },
        _sum: { totalMinor: true, paidMinor: true },
      }),
      this.prisma.payment.aggregate({
        where: { tenantId: principal.tenantId, status: PaymentStatus.CAPTURED, paidAt: { gte: monthStart }, invoice: this.branchScope(principal) },
        _sum: { amountMinor: true },
      }),
      this.prisma.invoice.count({ where: { ...scope, issuedAt: { gte: monthStart }, status: { not: InvoiceStatus.VOID } } }),
    ]);
    return {
      revenueThisMonthMinor: revenue._sum.amountMinor ?? 0,
      outstandingMinor: (open._sum.totalMinor ?? 0) - (open._sum.paidMinor ?? 0),
      overdueMinor: (overdue._sum.totalMinor ?? 0) - (overdue._sum.paidMinor ?? 0),
      invoicesThisMonth: invoiceCount,
    };
  }

  async capturePayment(principal: AuthPrincipal, dto: CapturePaymentDto, ipAddress?: string) {
    const existing = await this.prisma.payment.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: principal.tenantId, idempotencyKey: dto.idempotencyKey } },
    });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId, tenantId: principal.tenantId, ...this.branchScope(principal) },
      });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (invoice.status === InvoiceStatus.VOID) throw new BadRequestException("A void invoice cannot receive payments");
      const balance = invoice.totalMinor - invoice.paidMinor;
      if (balance <= 0) throw new BadRequestException("Invoice is already paid");
      if (dto.amountMinor > balance) throw new BadRequestException("Payment exceeds invoice balance");

      const sequence = await tx.tenant.update({
        where: { id: principal.tenantId },
        data: { receiptSequence: { increment: 1 } },
        select: { slug: true, receiptSequence: true },
      });
      const payment = await tx.payment.create({
        data: {
          tenantId: principal.tenantId,
          invoiceId: invoice.id,
          recordedByUserId: principal.userId,
          receiptNumber: this.number(sequence.slug, "RCT", sequence.receiptSequence),
          amountMinor: dto.amountMinor,
          method: dto.method,
          idempotencyKey: dto.idempotencyKey,
          providerRef: dto.providerRef?.trim() || null,
          note: dto.note?.trim() || null,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        },
      });
      const paidMinor = invoice.paidMinor + dto.amountMinor;
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { paidMinor, status: paidMinor === invoice.totalMinor ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID },
      });
      await this.audit(tx, principal, AuditAction.PAYMENT, "Payment", payment.id, ipAddress, { invoiceId: invoice.id, amountMinor: dto.amountMinor, receiptNumber: payment.receiptNumber });
      return payment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async voidInvoice(principal: AuthPrincipal, invoiceId: string, dto: BillingReasonDto, ipAddress?: string) {
    this.requireOwner(principal);
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId: principal.tenantId, ...this.branchScope(principal) } });
      if (!invoice) throw new NotFoundException("Invoice not found");
      if (invoice.status === InvoiceStatus.VOID) return invoice;
      if (invoice.paidMinor > 0) throw new BadRequestException("An invoice with payments cannot be voided");
      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.VOID, voidedAt: new Date(), voidReason: dto.reason.trim(), voidedByUserId: principal.userId },
      });
      await this.audit(tx, principal, AuditAction.VOID_INVOICE, "Invoice", invoice.id, ipAddress, { reason: dto.reason.trim() });
      return updated;
    });
  }

  async reversePayment(principal: AuthPrincipal, paymentId: string, dto: BillingReasonDto, ipAddress?: string) {
    this.requireAccountingCorrection(principal);
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, tenantId: principal.tenantId, invoice: this.branchScope(principal) },
        include: { invoice: true },
      });
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status !== PaymentStatus.CAPTURED) throw new BadRequestException("Only a captured payment can be reversed");
      const paidMinor = Math.max(0, payment.invoice.paidMinor - payment.amountMinor);
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REVERSED, reversedAt: new Date(), reversalReason: dto.reason.trim(), reversedByUserId: principal.userId },
      });
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { paidMinor, status: paidMinor === 0 ? InvoiceStatus.OPEN : InvoiceStatus.PARTIALLY_PAID },
      });
      await this.audit(tx, principal, AuditAction.REVERSE_PAYMENT, "Payment", payment.id, ipAddress, { invoiceId: payment.invoiceId, amountMinor: payment.amountMinor, reason: dto.reason.trim() });
      return { success: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async issueMembershipInvoice(tx: Prisma.TransactionClient, principal: AuthPrincipal, member: InvoiceMember, plan: InvoicePlan, membershipId: string, dueAt: Date, ipAddress?: string) {
    const subtotalMinor = plan.priceMinor;
    const taxMinor = Math.round(subtotalMinor * plan.taxRateBps / 10000);
    const totalMinor = subtotalMinor + taxMinor;
    const sequence = await tx.tenant.update({
      where: { id: principal.tenantId },
      data: { invoiceSequence: { increment: 1 } },
      select: { slug: true, invoiceSequence: true },
    });
    const invoice = await tx.invoice.create({
      data: {
        tenantId: principal.tenantId,
        branchId: member.homeBranchId,
        memberId: member.id,
        membershipId,
        issuedByUserId: principal.userId,
        invoiceNumber: this.number(sequence.slug, "INV", sequence.invoiceSequence),
        subtotalMinor,
        taxMinor,
        totalMinor,
        dueAt,
        status: totalMinor === 0 ? InvoiceStatus.PAID : InvoiceStatus.OPEN,
        lineItems: {
          create: {
            tenantId: principal.tenantId,
            description: plan.name,
            quantity: 1,
            unitPriceMinor: plan.priceMinor,
            subtotalMinor,
            taxRateBps: plan.taxRateBps,
            taxMinor,
            totalMinor,
          },
        },
      },
      include: { lineItems: true },
    });
    await this.audit(tx, principal, AuditAction.ISSUE_INVOICE, "Invoice", invoice.id, ipAddress, { membershipId, invoiceNumber: invoice.invoiceNumber, totalMinor });
    return invoice;
  }

  private invoiceWhere(principal: AuthPrincipal, query: ListInvoicesQueryDto): Prisma.InvoiceWhereInput {
    const overdueCutoff = this.startOfToday();
    const search = query.search?.trim();
    const status = query.status === "OVERDUE"
      ? { status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID] }, dueAt: { lt: overdueCutoff } }
      : query.status === "OPEN"
        ? { status: InvoiceStatus.OPEN, dueAt: { gte: overdueCutoff } }
        : query.status === "PARTIALLY_PAID"
          ? { status: InvoiceStatus.PARTIALLY_PAID, dueAt: { gte: overdueCutoff } }
          : query.status ? { status: query.status as InvoiceStatus } : {};
    return {
      tenantId: principal.tenantId,
      ...this.branchScope(principal),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...status,
      ...(query.from || query.to ? { issuedAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}) } } : {}),
      ...(search ? { OR: [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { member: { firstName: { contains: search, mode: "insensitive" } } },
        { member: { lastName: { contains: search, mode: "insensitive" } } },
        { member: { memberNumber: { contains: search, mode: "insensitive" } } },
      ] } : {}),
    };
  }

  private withEffectiveStatus<T extends { status: InvoiceStatus; dueAt: Date; totalMinor: number; paidMinor: number }>(invoice: T) {
    const canBeOverdue = invoice.status === InvoiceStatus.OPEN || invoice.status === InvoiceStatus.PARTIALLY_PAID;
    return { ...invoice, balanceMinor: invoice.totalMinor - invoice.paidMinor, effectiveStatus: canBeOverdue && invoice.dueAt < this.startOfToday() ? "OVERDUE" : invoice.status };
  }

  private branchScope(principal: AuthPrincipal): Prisma.InvoiceWhereInput {
    return principal.roles.includes(RoleName.OWNER) ? {} : { branchId: { in: principal.branchIds } };
  }

  private requireBranchAccess(principal: AuthPrincipal, branchId: string) {
    if (!principal.roles.includes(RoleName.OWNER) && !principal.branchIds.includes(branchId)) throw new ForbiddenException("You do not have access to this branch");
  }

  private requireOwner(principal: AuthPrincipal) {
    if (!principal.roles.includes(RoleName.OWNER)) throw new ForbiddenException("Only owners can void invoices");
  }

  private requireAccountingCorrection(principal: AuthPrincipal) {
    if (!principal.roles.some((role) => role === RoleName.OWNER || role === RoleName.ACCOUNTANT)) throw new ForbiddenException("Only owners and accountants can reverse payments");
  }

  private number(slug: string, kind: "INV" | "RCT", sequence: number) {
    const prefix = slug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
    return `${prefix}-${kind}-${String(sequence).padStart(6, "0")}`;
  }

  private startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private audit(tx: Prisma.TransactionClient, principal: AuthPrincipal, action: AuditAction, entityType: string, entityId: string, ipAddress?: string, metadata?: Prisma.InputJsonValue) {
    return tx.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action, entityType, entityId, ipAddress, metadata } });
  }
}
