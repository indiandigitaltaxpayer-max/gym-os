import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuditAction, DeliveryAttemptStatus, InvoiceStatus, MembershipStatus, NotificationChannel, NotificationKind, NotificationStatus, Permission, Prisma, RoleName } from "@gym/database";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { AuthPrincipal } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { SimulatedNotificationProvider } from "./notification-provider";
import { ListNotificationsQueryDto, TestNotificationDto, UpdateNotificationPolicyDto, UpdateNotificationTemplateDto } from "./notifications.dto";

const DEFAULT_TEMPLATES = [
  { key: "membership-renewal", name: "Membership renewal", kind: NotificationKind.MEMBERSHIP_RENEWAL, channel: NotificationChannel.WHATSAPP, body: "Hi {{name}}, your {{plan}} membership at {{gym}} expires on {{date}}. Please contact us to renew." },
  { key: "payment-due", name: "Payment reminder", kind: NotificationKind.PAYMENT_DUE, channel: NotificationChannel.WHATSAPP, body: "Hi {{name}}, payment of {{amount}} for invoice {{invoiceNumber}} at {{gym}} is {{dueState}}." },
  { key: "lead-follow-up", name: "Lead follow-up task", kind: NotificationKind.LEAD_FOLLOW_UP, channel: NotificationChannel.IN_APP, body: "Follow up with {{leadName}} ({{phone}}): {{purpose}}." },
] as const;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly provider = new SimulatedNotificationProvider();
  private queue?: Queue<{ eventId: string }>;
  private worker?: Worker<{ eventId: string }>;
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (redisUrl) {
      const connection = this.redisConnection(redisUrl);
      this.queue = new Queue("gym-notifications", { connection, defaultJobOptions: { removeOnComplete: 200, removeOnFail: 500 } });
      this.worker = new Worker("gym-notifications", async (job) => this.deliver(job.data.eventId), { connection, concurrency: 5 });
      this.worker.on("failed", (job, error) => this.logger.warn(`Notification job ${job?.id ?? "unknown"} failed: ${error.message}`));
      this.logger.log("Notification queue using Redis/BullMQ");
    } else {
      this.logger.log("Notification queue using local PostgreSQL polling with simulated delivery");
    }
    await this.runAutomaticCycle();
    this.timer = setInterval(() => void this.runAutomaticCycle(), 15 * 60 * 1000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }

  async list(principal: AuthPrincipal, query: ListNotificationsQueryDto) {
    if (query.branchId && !this.canAccessBranch(principal, query.branchId)) throw new NotFoundException("Branch not found");
    const search = query.search?.trim();
    const where: Prisma.NotificationEventWhereInput = {
      tenantId: principal.tenantId,
      ...this.branchScope(principal),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(search ? { OR: [
        { recipientName: { contains: search, mode: "insensitive" } },
        { recipientAddress: { contains: search, mode: "insensitive" } },
        { renderedBody: { contains: search, mode: "insensitive" } },
      ] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationEvent.findMany({ where, include: { template: { select: { id: true, name: true, key: true } }, attempts: { orderBy: { attemptNumber: "desc" }, take: 3 } }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.notificationEvent.count({ where }),
    ]);
    return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
  }

  async summary(principal: AuthPrincipal) {
    const where: Prisma.NotificationEventWhereInput = { tenantId: principal.tenantId, ...this.branchScope(principal) };
    const grouped = await this.prisma.notificationEvent.groupBy({ by: ["status"], where, _count: { _all: true } });
    const count = (status: NotificationStatus) => grouped.find((item) => item.status === status)?._count._all ?? 0;
    return {
      total: grouped.reduce((sum, item) => sum + item._count._all, 0),
      scheduled: count(NotificationStatus.SCHEDULED) + count(NotificationStatus.QUEUED),
      delivered: count(NotificationStatus.DELIVERED) + count(NotificationStatus.SENT),
      failed: count(NotificationStatus.FAILED),
      cancelled: count(NotificationStatus.CANCELLED),
      queueMode: this.queue ? "REDIS" : "LOCAL",
      provider: process.env.NOTIFICATION_PROVIDER?.trim() || "simulated",
    };
  }

  async settings(principal: AuthPrincipal) {
    await this.ensureDefaults(principal.tenantId);
    const [templates, policy] = await Promise.all([
      this.prisma.notificationTemplate.findMany({ where: { tenantId: principal.tenantId }, orderBy: { name: "asc" } }),
      this.prisma.notificationPolicy.findUnique({ where: { tenantId: principal.tenantId } }),
    ]);
    return { templates, policy, canManage: principal.permissions.includes(Permission.NOTIFICATION_MANAGE) };
  }

  async updateTemplate(principal: AuthPrincipal, templateId: string, dto: UpdateNotificationTemplateDto, ipAddress?: string) {
    const existing = await this.prisma.notificationTemplate.findFirst({ where: { id: templateId, tenantId: principal.tenantId } });
    if (!existing) throw new NotFoundException("Notification template not found");
    const template = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.notificationTemplate.update({ where: { id: templateId }, data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}), ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
        ...(dto.providerTemplateName !== undefined ? { providerTemplateName: dto.providerTemplateName?.trim() || null } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale.trim() } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      } });
      await this.audit(tx, principal, AuditAction.UPDATE_NOTIFICATION_TEMPLATE, "NotificationTemplate", templateId, ipAddress, { fields: Object.keys(dto) });
      return updated;
    });
    return template;
  }

  async updatePolicy(principal: AuthPrincipal, dto: UpdateNotificationPolicyDto, ipAddress?: string) {
    await this.ensureDefaults(principal.tenantId);
    const policy = await this.prisma.notificationPolicy.update({ where: { tenantId: principal.tenantId }, data: {
      ...(dto.renewalReminderDays ? { renewalReminderDays: [...new Set(dto.renewalReminderDays)].sort((a, b) => b - a) } : {}),
      ...(dto.paymentReminderDays ? { paymentReminderDays: [...new Set(dto.paymentReminderDays)].sort((a, b) => a - b) } : {}),
      ...(dto.renewalEnabled !== undefined ? { renewalEnabled: dto.renewalEnabled } : {}),
      ...(dto.paymentEnabled !== undefined ? { paymentEnabled: dto.paymentEnabled } : {}),
      ...(dto.leadFollowUpEnabled !== undefined ? { leadFollowUpEnabled: dto.leadFollowUpEnabled } : {}),
    } });
    await this.prisma.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.UPDATE, entityType: "NotificationPolicy", entityId: policy.id, metadata: { fields: Object.keys(dto) }, ipAddress } });
    return policy;
  }

  async runScheduler(principal: AuthPrincipal, ipAddress?: string) {
    const result = await this.scheduleTenant(principal.tenantId);
    await this.prisma.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.QUEUE_NOTIFICATION, entityType: "NotificationScheduler", entityId: principal.tenantId, metadata: result, ipAddress } });
    return result;
  }

  async queueTest(principal: AuthPrincipal, dto: TestNotificationDto, ipAddress?: string) {
    await this.ensureDefaults(principal.tenantId);
    const template = await this.prisma.notificationTemplate.findFirst({ where: { tenantId: principal.tenantId, key: dto.templateKey, isActive: true } });
    if (!template) throw new NotFoundException("Notification template not found");
    const event = await this.createEvent({
      tenantId: principal.tenantId, templateId: template.id, createdByUserId: principal.userId, kind: template.kind, channel: template.channel,
      recipientName: dto.recipientName.trim(), recipientAddress: dto.recipientAddress.trim(), subjectType: "Test", subjectId: principal.userId,
      renderedBody: this.render(template.body, { name: dto.recipientName, gym: "your gym", plan: "sample", date: "soon", amount: "₹1,000", invoiceNumber: "TEST-001", dueState: "due", leadName: dto.recipientName, phone: dto.recipientAddress, purpose: "sample follow-up" }),
      payload: { simulateFailure: dto.simulateFailure }, scheduledAt: new Date(), idempotencyKey: `test:${principal.userId}:${Date.now()}`,
    });
    await this.prisma.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.QUEUE_NOTIFICATION, entityType: "NotificationEvent", entityId: event.id, metadata: { test: true }, ipAddress } });
    if (!this.queue) await this.processDue(principal.tenantId);
    return this.prisma.notificationEvent.findUnique({ where: { id: event.id }, include: { attempts: true } });
  }

  async retry(principal: AuthPrincipal, eventId: string, ipAddress?: string) {
    const event = await this.requireEvent(principal, eventId);
    if (event.status !== NotificationStatus.FAILED && event.status !== NotificationStatus.CANCELLED) throw new ConflictException("Only failed or cancelled notifications can be retried");
    const updated = await this.prisma.notificationEvent.update({ where: { id: eventId }, data: { status: NotificationStatus.QUEUED, nextAttemptAt: new Date(), failedAt: null, errorCode: null, errorMessage: null, maxAttempts: Math.max(event.maxAttempts, event.attemptCount + 1) } });
    await this.prisma.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.RETRY_NOTIFICATION, entityType: "NotificationEvent", entityId: eventId, ipAddress } });
    await this.dispatch(updated.id, updated.scheduledAt);
    if (!this.queue) await this.processDue(principal.tenantId);
    return this.prisma.notificationEvent.findUnique({ where: { id: eventId }, include: { attempts: { orderBy: { attemptNumber: "desc" } } } });
  }

  async cancel(principal: AuthPrincipal, eventId: string, ipAddress?: string) {
    const event = await this.requireEvent(principal, eventId);
    if (event.status === NotificationStatus.SENT || event.status === NotificationStatus.DELIVERED) throw new BadRequestException("A sent notification cannot be cancelled");
    const updated = await this.prisma.notificationEvent.update({ where: { id: eventId }, data: { status: NotificationStatus.CANCELLED, nextAttemptAt: null } });
    await this.prisma.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action: AuditAction.CANCEL_NOTIFICATION, entityType: "NotificationEvent", entityId: eventId, ipAddress } });
    return updated;
  }

  async processDue(tenantId?: string) {
    if (this.queue) return { processed: 0, failed: 0, mode: "REDIS" };
    const now = new Date();
    const events = await this.prisma.notificationEvent.findMany({ where: {
      ...(tenantId ? { tenantId } : {}), status: { in: [NotificationStatus.SCHEDULED, NotificationStatus.QUEUED, NotificationStatus.FAILED] },
      scheduledAt: { lte: now }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    }, orderBy: { scheduledAt: "asc" }, take: 50 });
    let processed = 0; let failed = 0;
    for (const event of events.filter((item) => item.attemptCount < item.maxAttempts)) {
      try { await this.deliver(event.id); processed += 1; } catch { failed += 1; }
    }
    return { processed, failed, mode: "LOCAL" };
  }

  private async deliver(eventId: string) {
    const claimed = await this.prisma.notificationEvent.updateMany({ where: { id: eventId, status: { in: [NotificationStatus.SCHEDULED, NotificationStatus.QUEUED, NotificationStatus.FAILED] } }, data: { status: NotificationStatus.PROCESSING, lastAttemptAt: new Date(), attemptCount: { increment: 1 } } });
    if (!claimed.count) return;
    const event = await this.prisma.notificationEvent.findUnique({ where: { id: eventId }, include: { tenant: { select: { status: true } } } });
    if (!event) return;
    if (event.tenant.status !== "ACTIVE" && event.tenant.status !== "TRIAL") {
      await this.prisma.notificationEvent.update({ where: { id: eventId }, data: { status: NotificationStatus.CANCELLED, nextAttemptAt: null, errorCode: "TENANT_INACTIVE", errorMessage: "Gym workspace is not active" } });
      return;
    }
    const attempt = await this.prisma.notificationDeliveryAttempt.create({ data: { tenantId: event.tenantId, eventId, attemptNumber: event.attemptCount, status: DeliveryAttemptStatus.STARTED, provider: "simulated" } });
    try {
      const payload = (event.payload ?? {}) as { simulateFailure?: boolean };
      const result = await this.provider.send({ recipientAddress: event.recipientAddress, body: event.renderedBody, simulateFailure: payload.simulateFailure });
      await this.prisma.$transaction([
        this.prisma.notificationDeliveryAttempt.update({ where: { id: attempt.id }, data: { status: DeliveryAttemptStatus.SENT, provider: result.provider, providerMessageId: result.providerMessageId, completedAt: new Date() } }),
        this.prisma.notificationEvent.update({ where: { id: eventId }, data: { status: result.delivered ? NotificationStatus.DELIVERED : NotificationStatus.SENT, provider: result.provider, providerMessageId: result.providerMessageId, sentAt: new Date(), ...(result.delivered ? { deliveredAt: new Date() } : {}), nextAttemptAt: null, errorCode: null, errorMessage: null } }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider failure";
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "PROVIDER_ERROR";
      const exhausted = event.attemptCount >= event.maxAttempts;
      const delayMinutes = Math.pow(2, Math.max(0, event.attemptCount - 1));
      await this.prisma.$transaction([
        this.prisma.notificationDeliveryAttempt.update({ where: { id: attempt.id }, data: { status: DeliveryAttemptStatus.FAILED, errorCode: code, errorMessage: message, completedAt: new Date() } }),
        this.prisma.notificationEvent.update({ where: { id: eventId }, data: { status: NotificationStatus.FAILED, failedAt: new Date(), errorCode: code, errorMessage: message, nextAttemptAt: exhausted ? null : new Date(Date.now() + delayMinutes * 60_000) } }),
      ]);
      throw error;
    }
  }

  private async runAutomaticCycle() {
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { status: { in: ["ACTIVE", "TRIAL"] } }, select: { id: true } });
      for (const tenant of tenants) await this.scheduleTenant(tenant.id);
      if (!this.queue) await this.processDue();
    } catch (error) {
      this.logger.error(`Notification cycle failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async scheduleTenant(tenantId: string) {
    await this.ensureDefaults(tenantId);
    const [tenant, policy, templates] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, timezone: true, currency: true } }),
      this.prisma.notificationPolicy.findUnique({ where: { tenantId } }),
      this.prisma.notificationTemplate.findMany({ where: { tenantId, isActive: true } }),
    ]);
    if (!tenant || !policy) return { created: 0, skipped: 0 };
    const templateByKey = new Map(templates.map((template) => [template.key, template]));
    let created = 0; let skipped = 0;
    const today = this.localDate(new Date(), tenant.timezone);

    if (policy.renewalEnabled) {
      const memberships = await this.prisma.membership.findMany({ where: { tenantId, status: { in: [MembershipStatus.ACTIVE, MembershipStatus.PENDING] }, member: { archivedAt: null } }, include: { member: true, plan: true } });
      const template = templateByKey.get("membership-renewal");
      if (template) for (const membership of memberships) {
        const days = this.dateDifference(today, this.localDate(membership.endsAt, tenant.timezone));
        if (!policy.renewalReminderDays.includes(days)) continue;
        const event = await this.createEventIfNew({ tenantId, branchId: membership.member.homeBranchId, templateId: template.id, kind: template.kind, channel: template.channel, recipientName: `${membership.member.firstName} ${membership.member.lastName}`, recipientAddress: membership.member.phone, subjectType: "Membership", subjectId: membership.id, renderedBody: this.render(template.body, { name: membership.member.firstName, plan: membership.plan.name, gym: tenant.name, date: this.displayDate(membership.endsAt, tenant.timezone) }), scheduledAt: new Date(), idempotencyKey: `renewal:${membership.id}:${days}:${today}`, payload: { daysUntilExpiry: days } });
        event ? created += 1 : skipped += 1;
      }
    }

    if (policy.paymentEnabled) {
      const invoices = await this.prisma.invoice.findMany({ where: { tenantId, status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID] } }, include: { member: true } });
      const template = templateByKey.get("payment-due");
      if (template) for (const invoice of invoices) {
        const overdueDays = this.dateDifference(this.localDate(invoice.dueAt, tenant.timezone), today);
        if (!policy.paymentReminderDays.includes(overdueDays)) continue;
        const dueState = overdueDays === 0 ? "due today" : `${overdueDays} days overdue`;
        const event = await this.createEventIfNew({ tenantId, branchId: invoice.branchId, templateId: template.id, kind: template.kind, channel: template.channel, recipientName: `${invoice.member.firstName} ${invoice.member.lastName}`, recipientAddress: invoice.member.phone, subjectType: "Invoice", subjectId: invoice.id, renderedBody: this.render(template.body, { name: invoice.member.firstName, amount: this.money(invoice.totalMinor - invoice.paidMinor, tenant.currency), invoiceNumber: invoice.invoiceNumber, gym: tenant.name, dueState }), scheduledAt: new Date(), idempotencyKey: `payment:${invoice.id}:${overdueDays}:${today}`, payload: { overdueDays } });
        event ? created += 1 : skipped += 1;
      }
    }

    if (policy.leadFollowUpEnabled) {
      const followUps = await this.prisma.followUpTask.findMany({ where: { tenantId, status: "OPEN", dueAt: { lte: new Date() }, lead: { archivedAt: null } }, include: { lead: true, assignedTo: true } });
      const template = templateByKey.get("lead-follow-up");
      if (template) for (const followUp of followUps) {
        const event = await this.createEventIfNew({ tenantId, branchId: followUp.lead.branchId, templateId: template.id, kind: template.kind, channel: template.channel, recipientName: followUp.assignedTo.name, recipientAddress: followUp.assignedTo.email, subjectType: "FollowUpTask", subjectId: followUp.id, renderedBody: this.render(template.body, { leadName: `${followUp.lead.firstName} ${followUp.lead.lastName}`, phone: followUp.lead.phone, purpose: followUp.purpose }), scheduledAt: new Date(), idempotencyKey: `followup:${followUp.id}:due`, payload: { leadId: followUp.leadId } });
        event ? created += 1 : skipped += 1;
      }
    }
    return { created, skipped };
  }

  private async createEventIfNew(data: Prisma.NotificationEventUncheckedCreateInput) {
    try { return await this.createEvent(data); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null; throw error; }
  }

  private async createEvent(data: Prisma.NotificationEventUncheckedCreateInput) {
    const event = await this.prisma.notificationEvent.create({ data });
    await this.dispatch(event.id, event.scheduledAt);
    return event;
  }

  private async dispatch(eventId: string, scheduledAt: Date) {
    if (!this.queue) return;
    await this.prisma.notificationEvent.update({ where: { id: eventId }, data: { status: NotificationStatus.QUEUED } });
    await this.queue.add("deliver", { eventId }, { jobId: eventId, delay: Math.max(0, scheduledAt.getTime() - Date.now()), attempts: 1 });
  }

  private async ensureDefaults(tenantId: string) {
    await this.prisma.notificationPolicy.upsert({ where: { tenantId }, update: {}, create: { tenantId } });
    for (const template of DEFAULT_TEMPLATES) await this.prisma.notificationTemplate.upsert({ where: { tenantId_key: { tenantId, key: template.key } }, update: {}, create: { tenantId, ...template } });
  }

  private async requireEvent(principal: AuthPrincipal, eventId: string) {
    const event = await this.prisma.notificationEvent.findFirst({ where: { id: eventId, tenantId: principal.tenantId, ...this.branchScope(principal) } });
    if (!event) throw new NotFoundException("Notification not found");
    return event;
  }

  private branchScope(principal: AuthPrincipal): Prisma.NotificationEventWhereInput { return principal.roles.includes(RoleName.OWNER) ? {} : { branchId: { in: principal.branchIds } }; }
  private canAccessBranch(principal: AuthPrincipal, branchId: string) { return principal.roles.includes(RoleName.OWNER) || principal.branchIds.includes(branchId); }
  private render(body: string, values: Record<string, string | number>) { return body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => String(values[key] ?? `{{${key}}}`)); }
  private localDate(value: Date, timezone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
  private displayDate(value: Date, timezone: string) { return new Intl.DateTimeFormat("en-IN", { timeZone: timezone, day: "numeric", month: "short", year: "numeric" }).format(value); }
  private dateDifference(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000); }
  private money(minor: number, currency: string) { return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 100); }
  private redisConnection(value: string): ConnectionOptions { const url = new URL(value); return { host: url.hostname, port: Number(url.port || 6379), username: url.username || undefined, password: url.password || undefined, ...(url.protocol === "rediss:" ? { tls: {} } : {}) }; }
  private audit(tx: Prisma.TransactionClient, principal: AuthPrincipal, action: AuditAction, entityType: string, entityId: string, ipAddress?: string, metadata?: Prisma.InputJsonValue) { return tx.auditEvent.create({ data: { tenantId: principal.tenantId, actorUserId: principal.userId, action, entityType, entityId, ipAddress, ...(metadata ? { metadata } : {}) } }); }
}
