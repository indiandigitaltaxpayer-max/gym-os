# Agent Brief: Multi-Tenant Gym Management and Gym Growth OS SaaS

## 1. Product Vision

Build a multi-tenant Gym Management / Gym Growth OS SaaS product that helps gyms run daily operations, increase revenue, reduce member churn, automate follow-ups, and give owners clear visibility into business performance.

This should be built as a generic SaaS platform that can be sold to many gyms, fitness studios, personal training centers, boutique fitness businesses, and multi-branch gym chains.

The product should not be treated as simple member management software. It should become the operating system for a gym business.

The platform should eventually support four primary surfaces:

1. **Gym Owner / Management Portal**
   - Revenue, memberships, leads, renewals, attendance, staff, trainers, branches, reports, settings.

2. **Staff / Trainer Portal**
   - Member handling, check-ins, workout plans, assessments, schedules, follow-ups, commissions.

3. **Member App / Member Portal**
   - Membership details, QR check-in, workout plans, progress, payments, class booking, trainer communication.

4. **Platform Admin Portal**
   - Tenant onboarding, subscriptions, feature flags, platform billing, support, usage analytics, operational controls.

The long-term positioning should be:

> A complete Gym Growth OS that combines operations, CRM, billing, attendance, member engagement, retention intelligence, and growth automation in one multi-tenant SaaS platform.

## 2. Business Goals

The product should help gyms:

- Manage members, plans, renewals, payments, and attendance efficiently.
- Convert more leads into paying members.
- Reduce missed follow-ups and manual staff work.
- Improve renewal rates and retention.
- Track trainer productivity and staff performance.
- Offer a better member experience through digital workflows.
- Understand business health through dashboards and reports.
- Operate multiple branches from a single account.

The SaaS business should:

- Support subscription revenue from gyms.
- Support tiered pricing by branch count, member count, and enabled features.
- Support add-on revenue through WhatsApp automation, payment processing, advanced analytics, premium support, branded member apps, and future AI features.
- Support implementation/setup charges for larger gyms or chains.

## 3. Non-Goals

Do not build everything at once.

The initial product should not include:

- Full AI coaching or AI diet planning.
- Complex marketplace features.
- Hardware manufacturing.
- Deep biometric device support for every vendor.
- Custom branded mobile apps for every tenant in MVP.
- Advanced accounting/ERP replacement.
- Payroll as a first-class module.
- Full nutrition marketplace.
- Social network features.

These can be deferred until the operational core is stable.

## 4. Target Personas

### Gym Owner

Needs:

- Revenue visibility.
- Membership and renewal tracking.
- Lead conversion tracking.
- Staff accountability.
- Branch-level reporting.
- Outstanding dues visibility.
- Retention insights.

Primary success metric:

- More revenue with less operational leakage.

### Gym Manager / Front Desk Staff

Needs:

- Fast member search.
- New member registration.
- Plan assignment and renewal.
- Check-in handling.
- Payment collection.
- Follow-up reminders.
- Daily task list.

Primary success metric:

- Faster daily operations and fewer missed tasks.

### Trainer

Needs:

- Assigned member list.
- Workout plans.
- Fitness assessments.
- Progress tracking.
- PT session scheduling.
- Commission visibility.

Primary success metric:

- Better client management and easier progress tracking.

### Gym Member

Needs:

- Membership status.
- QR check-in.
- Payment history.
- Workout plan.
- Progress tracking.
- Class booking.
- Renewal reminders.

Primary success metric:

- Simple, reliable, modern gym experience.

### SaaS Platform Admin

Needs:

- Create and manage tenants.
- Configure plans and limits.
- Monitor tenant usage.
- Handle support issues.
- Manage platform subscriptions.
- View system health.
- Control feature rollouts.

Primary success metric:

- Ability to operate many gym clients efficiently.

## 5. Core Product Domains

Build the system around these domains:

1. **Tenant and Branch Management**
   - Gyms, branches, tenant settings, branding, time zone, locale, tax settings.

2. **User, Staff, and RBAC**
   - Owners, admins, managers, front desk staff, trainers, members, platform admins.

3. **Member Management**
   - Profiles, contact details, documents, emergency contacts, membership history, notes, status.

4. **Membership Plans**
   - Plan catalog, duration, pricing, benefits, freeze rules, renewal rules, branch access.

5. **Billing and Payments**
   - Invoices, receipts, online payments, manual payments, refunds, discounts, taxes, dues.

6. **Attendance and Access**
   - QR check-in, manual check-in, attendance logs, branch-level access, basic device integration hooks.

7. **Leads and CRM**
   - Enquiries, trials, source tracking, pipeline stages, follow-ups, conversion tracking.

8. **Trainer and PT Management**
   - Trainer profiles, schedules, assigned members, PT packages, PT session usage, commissions.

9. **Workout and Assessment**
   - Exercise library, workout templates, assigned plans, body measurements, progress photos, assessment history.

10. **Classes and Bookings**
   - Class schedules, capacity, bookings, cancellations, waitlists, instructor assignment.

11. **Engagement and Notifications**
   - WhatsApp, SMS/email-ready abstractions, push-ready abstractions, renewal reminders, payment reminders, lead follow-ups.

12. **Reports and Analytics**
   - Revenue, active members, expiring memberships, attendance, lead conversion, staff performance, trainer productivity.

13. **Platform Administration**
   - Tenant creation, subscription control, feature flags, support impersonation, system audit, usage limits.

## 6. MVP Scope

The MVP should prove that a gym can run its core business on the platform.

### MVP Must Include

- Multi-tenant foundation.
- Tenant onboarding by platform admin.
- Branch support, even if MVP supports one branch per tenant by default.
- Owner/admin login.
- Staff login.
- Member records.
- Membership plans.
- Assign membership to member.
- Manual payment recording.
- Invoice/receipt records.
- QR-based or manual attendance.
- Lead capture and follow-up tracking.
- Renewal dashboard.
- Basic revenue dashboard.
- WhatsApp notification hooks for renewal/payment reminders.
- RBAC foundation.
- Audit logging foundation.
- Platform admin portal.

### MVP Can Exclude

- Native mobile apps.
- Advanced AI features.
- Complex device integrations.
- Full accounting exports.
- Complex trainer commission engine.
- Advanced workout analytics.
- White-label apps.

### MVP Success Criteria

The MVP is successful when:

- A new gym tenant can be created by platform admin.
- A gym owner can configure basic settings, plans, staff, and branches.
- Staff can add members and assign memberships.
- Staff can record payments and check-ins.
- Owners can see revenue, attendance, expiring memberships, and lead metrics.
- Renewal reminders and payment reminders can be sent through WhatsApp integration.
- Data is tenant-isolated and role-restricted.

## 7. Recommended Tech Stack

### Frontend

- **Next.js**
- **TypeScript**
- App Router
- Server Components where useful
- Client Components for interactive workflows
- Tailwind CSS or a disciplined component system
- React Hook Form
- Zod for validation
- TanStack Query if using client-heavy data fetching
- Recharts or Tremor-style charts for dashboards

### Backend

- **NestJS**
- **TypeScript**
- REST API first, with OpenAPI documentation
- Modular domain architecture
- Background jobs for notifications, billing events, reminders, imports, and reports

### Database

- **PostgreSQL**
- Prefer one shared database with tenant isolation through `tenant_id` in application tables.
- Consider row-level security later if operational maturity supports it.
- Use UUID primary keys unless there is a strong reason not to.

### ORM

Use either:

- **Prisma** for faster product iteration and strong developer experience.
- **Drizzle** for SQL-first control and lighter abstractions.

Recommendation:

- Start with Prisma for MVP speed unless the team strongly prefers Drizzle.
- Keep domain boundaries clean enough that switching data access patterns later remains possible.

### Cache and Jobs

- **Redis**
- BullMQ or equivalent NestJS-compatible queue.
- Use for:
  - Reminder jobs
  - WhatsApp sending queues
  - Report generation
  - Import processing
  - Rate limiting
  - Short-lived cache

### Storage

- S3-compatible object storage.
- Store:
  - Member documents
  - Profile photos
  - Progress photos
  - Import files
  - Export files
  - Generated reports

### Payments

- **Razorpay**
- Support:
  - Payment links
  - Checkout
  - Webhooks
  - Refund records
  - Subscription billing for the SaaS product if applicable

### Communication

- WhatsApp Business API integration.
- Abstract notifications so additional channels can be added later.
- Support message templates, delivery status, retry handling, and opt-out rules.

### Monitoring and Observability

- Structured logs.
- Error tracking such as Sentry.
- Metrics through OpenTelemetry-compatible tooling.
- Uptime monitoring.
- Background job monitoring.
- Audit trails for business events.

### Deployment

- Dockerized services.
- Separate environments:
  - Local
  - Development
  - Staging
  - Production
- CI/CD with automated linting, type checks, tests, migrations, and deployment gates.

## 8. Monorepo Structure

Use a monorepo to keep shared types, validation schemas, and domain contracts consistent.

Suggested structure:

```text
gym-growth-os/
  apps/
    web/
      # Next.js owner/staff/platform admin web app
    api/
      # NestJS backend API
    worker/
      # Background workers if separated from API
  packages/
    config/
      # Shared eslint, tsconfig, prettier, env helpers
    database/
      # Prisma/Drizzle schema, migrations, seed scripts
    domain/
      # Shared domain types, constants, permissions
    validation/
      # Zod schemas shared by web and api
    ui/
      # Shared UI components if needed
    integrations/
      # Razorpay, WhatsApp, storage adapters
  docs/
    architecture/
    api/
    product/
    runbooks/
  scripts/
    import/
    seed/
    maintenance/
  infra/
    docker/
    terraform-or-pulumi/
  .github/
    workflows/
```

## 9. Multi-Tenant Architecture

### Tenant Model

Core concepts:

- `Tenant`: A gym business account.
- `Branch`: A physical location under a tenant.
- `User`: A login identity.
- `StaffProfile`: Staff-specific profile linked to user and tenant.
- `Member`: Gym customer profile.
- `Role`: Named permission set scoped by tenant.
- `Permission`: Fine-grained action.

### Tenant Isolation

Every tenant-owned business table must include:

- `tenant_id`
- `created_at`
- `updated_at`
- Optional `deleted_at` for soft delete where appropriate.

Branch-specific tables should also include:

- `branch_id`

Never allow tenant context to be supplied blindly by the client for privileged queries.

The backend must resolve tenant context from:

- Auth token
- Current selected tenant
- Staff/member association
- Platform admin override when explicitly allowed

### Tenant-Aware Query Rule

Every service method that reads or writes tenant data must include tenant scoping.

Example convention:

- Application controller resolves `tenantContext`.
- Service receives `tenantContext`.
- Repository/data access layer applies `tenant_id` filter.

Avoid scattered direct ORM calls in controllers.

### Platform Admin Access

Platform admins may access tenants only through explicit platform-admin flows.

Support:

- View tenant summary.
- Create tenant.
- Suspend tenant.
- Change subscription.
- Enable/disable features.
- Impersonate tenant admin only with audit logging.

## 10. Data and Domain Model Guidance

The agent should design the data model around business events and clean domain boundaries.

### Foundational Entities

- `Tenant`
- `Branch`
- `User`
- `Role`
- `Permission`
- `UserTenantRole`
- `StaffProfile`
- `Member`
- `MemberNote`
- `MemberDocument`
- `MembershipPlan`
- `Membership`
- `Invoice`
- `Payment`
- `Refund`
- `AttendanceLog`
- `Lead`
- `LeadActivity`
- `FollowUpTask`
- `TrainerAssignment`
- `WorkoutTemplate`
- `WorkoutPlan`
- `Exercise`
- `Assessment`
- `Class`
- `ClassSession`
- `ClassBooking`
- `NotificationTemplate`
- `NotificationEvent`
- `AuditLog`
- `SubscriptionPlan`
- `TenantSubscription`
- `FeatureFlag`

### Important Status Enums

Use explicit statuses instead of loose strings.

Examples:

- Member status:
  - `ACTIVE`
  - `INACTIVE`
  - `EXPIRED`
  - `FROZEN`
  - `BLOCKED`

- Membership status:
  - `ACTIVE`
  - `PENDING`
  - `EXPIRED`
  - `CANCELLED`
  - `FROZEN`

- Invoice status:
  - `DRAFT`
  - `ISSUED`
  - `PARTIALLY_PAID`
  - `PAID`
  - `VOID`
  - `OVERDUE`

- Payment status:
  - `PENDING`
  - `SUCCESS`
  - `FAILED`
  - `REFUNDED`

- Lead status:
  - `NEW`
  - `CONTACTED`
  - `TRIAL_BOOKED`
  - `TRIAL_COMPLETED`
  - `WON`
  - `LOST`

### Business Event Logging

Important business actions should create audit or domain event records.

Examples:

- Member created.
- Membership assigned.
- Membership renewed.
- Payment recorded.
- Check-in recorded.
- Invoice voided.
- Discount applied.
- Lead converted.
- Role changed.
- Tenant suspended.
- Admin impersonation started.

## 11. API Conventions

### API Style

Use REST for MVP.

Conventions:

- JSON request/response.
- Versioned route prefix, such as `/api/v1`.
- Resource-oriented endpoints.
- Pagination for list endpoints.
- Filtering and sorting conventions.
- Idempotency keys for payment and webhook-sensitive operations.
- OpenAPI documentation generated from backend decorators/schemas.

### Example Endpoint Groups

```text
/api/v1/auth/*
/api/v1/platform/tenants/*
/api/v1/tenants/current
/api/v1/branches/*
/api/v1/staff/*
/api/v1/members/*
/api/v1/membership-plans/*
/api/v1/memberships/*
/api/v1/invoices/*
/api/v1/payments/*
/api/v1/attendance/*
/api/v1/leads/*
/api/v1/follow-ups/*
/api/v1/trainers/*
/api/v1/workouts/*
/api/v1/classes/*
/api/v1/notifications/*
/api/v1/reports/*
```

### Response Shape

Use a consistent response shape.

Example:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

For errors:

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "MEMBERSHIP_EXPIRED",
    "message": "The member does not have an active membership.",
    "details": {}
  }
}
```

### Validation

- Validate every request.
- Use shared Zod schemas where practical.
- Never trust tenant IDs, prices, permissions, or payment status from the client.

## 12. Integration Conventions

### Razorpay

Required:

- Webhook signature verification.
- Idempotent webhook handling.
- Payment status reconciliation.
- Stored gateway event payloads for debugging.
- Separate internal payment status from gateway event status.

Do not mark payment success only because the frontend says payment succeeded.

### WhatsApp

Required:

- Template management.
- Tenant-level sender configuration if supported.
- Delivery status tracking.
- Retry rules.
- Rate limiting.
- Opt-out handling.
- Message audit history.

Initial templates:

- Lead follow-up.
- Trial reminder.
- Membership expiry reminder.
- Payment due reminder.
- Payment receipt.
- Renewal confirmation.

### Storage

Required:

- Signed upload URLs or backend-mediated upload.
- File type validation.
- Size limits.
- Tenant-scoped object keys.
- Virus scanning hook if possible later.

### Future Integrations

Design extension points for:

- Biometric attendance devices.
- Accounting exports.
- Email providers.
- SMS providers.
- Mobile push.
- Google Calendar.
- Fitness wearables.

## 13. Security, RBAC, and Audit Requirements

### Authentication

Support:

- Email/password login.
- Password reset.
- Session/token refresh.
- Optional OTP login later.
- Optional SSO for enterprise later.

Passwords must be hashed using a strong algorithm such as Argon2 or bcrypt.

### RBAC

Start with built-in roles:

- Platform Super Admin
- Platform Support Admin
- Tenant Owner
- Tenant Admin
- Branch Manager
- Front Desk Staff
- Trainer
- Member

Permissions should be action-based.

Examples:

- `member.read`
- `member.create`
- `member.update`
- `membership.assign`
- `payment.record`
- `payment.refund`
- `report.view`
- `staff.manage`
- `settings.manage`
- `platform.tenant.manage`

### Audit Logging

Audit logs must include:

- Actor ID
- Actor role
- Tenant ID
- Branch ID where relevant
- Action
- Target entity type
- Target entity ID
- Before/after diff where reasonable
- IP address
- User agent
- Timestamp

Audit logs should be append-only from application perspective.

### Security Rules

- Enforce tenant isolation in backend, not only frontend.
- Never expose another tenant's data.
- Do not log secrets, passwords, tokens, or payment card details.
- Use environment variables for secrets.
- Validate webhooks.
- Rate-limit sensitive endpoints.
- Use secure cookies or secure token handling.
- Use least privilege for storage and database access.
- Include security checks in code review.

## 14. Billing and Subscription Model

The SaaS should support tiered pricing.

### Suggested Plans

#### Starter

For small gyms.

- 1 branch
- Limited active members
- Member management
- Memberships
- Manual payments
- Attendance
- Basic reports

#### Growth

For growing gyms.

- Multiple branches
- Leads/CRM
- WhatsApp reminders
- Staff roles
- Trainer module
- Advanced reports

#### Pro

For serious operators.

- Advanced automation
- Custom reports
- Priority support
- More branches
- Higher message limits
- API access
- Import support

#### Enterprise

For chains.

- Custom pricing
- Dedicated onboarding
- SLA
- Advanced permissions
- Custom integrations
- White-label options

### Add-On Revenue

- WhatsApp message bundles.
- Branded member app later.
- Advanced analytics later.
- AI retention assistant later.
- Implementation/setup fee.
- Data migration fee.
- Premium support.
- Custom integrations.

### Billing System Requirements

- Tenant subscription record.
- Plan limits.
- Feature flags.
- Usage tracking.
- Billing status.
- Grace period handling.
- Tenant suspension handling.
- Invoice records for SaaS subscription.

## 15. Operational and Admin Tooling

The platform admin portal should include:

- Tenant list.
- Tenant creation.
- Tenant status: active, trial, suspended, cancelled.
- Subscription plan assignment.
- Feature flags.
- Usage summary.
- Branch count.
- Active member count.
- Payment status.
- Support notes.
- Audit logs.
- Admin impersonation with reason capture.
- Webhook event viewer.
- Background job status.
- Failed notification queue.
- Import job status.

Operational tooling should be available before scale becomes painful.

## 16. UX Expectations

The product should feel practical, fast, and operational.

### General UX Principles

- Optimize for daily repeated use.
- Make member search extremely fast.
- Keep front desk workflows short.
- Use clear status badges.
- Put renewal and due payment risks in front of staff.
- Make dashboards scannable.
- Avoid decorative marketing-style layouts inside the app.
- Support keyboard-friendly workflows where useful.
- Use responsive layouts, but prioritize desktop/tablet for staff/admin surfaces.

### Core Screens

MVP screens should include:

- Login
- Platform admin tenant list
- Platform admin tenant detail
- Tenant dashboard
- Branch selector
- Member list
- Member detail
- Add/edit member
- Membership plan list
- Assign/renew membership
- Payment recording
- Invoice/receipt detail
- Attendance check-in
- Lead pipeline/list
- Lead detail
- Follow-up tasks
- Reports dashboard
- Staff management
- Settings

### Dashboard Expectations

Owner dashboard should show:

- Monthly revenue
- Today's collections
- Active members
- Expiring memberships
- Overdue payments
- Today's check-ins
- Lead conversion
- Follow-up tasks

Staff dashboard should show:

- Today's check-ins
- Follow-ups due
- Expiring memberships
- Pending payments
- Recent leads

## 17. Engineering Principles

The AI development agent should follow these principles:

- Build incrementally.
- Keep domain boundaries clear.
- Prefer boring, reliable technology.
- Make tenant isolation explicit.
- Use typed APIs and shared validation.
- Keep business logic out of UI components.
- Keep controllers thin and services focused.
- Do not over-engineer before product validation.
- Use feature flags for premium or unfinished features.
- Add tests around money, permissions, tenant isolation, and renewals.
- Log important business and operational events.
- Document decisions in architecture notes.

## 18. Testing Strategy

### Unit Tests

Required for:

- Membership date calculations.
- Renewal logic.
- Invoice totals.
- Discount/tax calculation.
- Permission checks.
- Tenant scoping helpers.
- Notification template rendering.

### Integration Tests

Required for:

- Auth flows.
- Member creation.
- Membership assignment.
- Payment recording.
- Attendance check-in.
- Lead conversion.
- Razorpay webhook handling.
- WhatsApp queue creation.

### End-to-End Tests

Required for MVP happy paths:

- Platform admin creates tenant.
- Tenant admin creates staff.
- Staff creates member.
- Staff assigns membership.
- Staff records payment.
- Staff records check-in.
- Owner views dashboard.

### Security Tests

Required:

- User from Tenant A cannot read Tenant B data.
- Staff cannot access owner-only reports.
- Trainer cannot manage billing unless permission is granted.
- Platform admin access is audited.
- Webhook signature validation rejects invalid payloads.

### Data Tests

Required:

- Migration tests.
- Seed data tests.
- Import validation tests.
- Soft delete behavior tests where used.

## 19. CI/CD

CI pipeline should run:

- Install dependencies.
- Type checks.
- Linting.
- Formatting check.
- Unit tests.
- Integration tests where feasible.
- Build web app.
- Build API.
- Generate/validate database client.
- Check migrations.

Deployment pipeline should:

- Deploy to staging first.
- Run migrations safely.
- Run smoke tests.
- Require approval or automated gate for production.
- Support rollback.
- Store release metadata.

## 20. Observability

Implement observability early.

Required:

- Request logs with correlation IDs.
- Error tracking.
- Background job logs.
- Payment webhook logs.
- Notification delivery logs.
- Audit logs.
- Slow query monitoring.
- Uptime checks.

Key metrics:

- API error rate.
- API latency.
- Job failure rate.
- Payment webhook failure count.
- WhatsApp send failure count.
- Active tenants.
- Active members per tenant.
- Daily check-ins.
- Payment volume.
- Renewal conversion rate.

## 21. Migration and Import Support

Gyms will often move from Excel, WhatsApp, notebooks, or another tool.

MVP import support should include:

- Member CSV import.
- Membership CSV import if practical.
- Lead CSV import.
- Import preview.
- Row-level validation errors.
- Duplicate detection by phone/email.
- Import history.

Future import support:

- Payment history import.
- Attendance import.
- Migration from common gym management tools.
- Assisted onboarding scripts.

## 22. AI Features Deferred to Later Phases

Do not build AI features in MVP unless explicitly approved.

Future AI features:

- Churn risk scoring.
- Renewal likelihood prediction.
- Smart follow-up suggestions.
- AI sales assistant for lead nurturing.
- AI-generated workout plans reviewed by trainers.
- Member engagement summaries.
- Owner insights assistant.
- Anomaly detection for revenue or attendance.
- Natural language reporting.

AI features should be built only after clean data capture and reliable workflows exist.

## 23. Phased Roadmap

### Phase 0: Product and Architecture Foundation

Deliverables:

- Product requirements document.
- Domain model draft.
- Architecture decision records.
- Monorepo setup.
- Environment strategy.
- CI basics.
- Database setup.
- Auth and tenant strategy.

Acceptance criteria:

- Team can run web and API locally.
- Database migrations work.
- Initial architecture is documented.
- Tenant isolation strategy is decided.

### Phase 1: SaaS and Tenant Foundation

Deliverables:

- Platform admin login.
- Tenant creation.
- Tenant settings.
- Branch model.
- User model.
- Role and permission model.
- Tenant-aware backend request context.
- Audit log foundation.

Acceptance criteria:

- Platform admin can create a tenant.
- Tenant owner can log in.
- Tenant-scoped APIs cannot access another tenant's records.
- Role checks work for at least owner/admin/staff.

### Phase 2: Member and Membership Core

Deliverables:

- Member CRUD.
- Member search and filters.
- Membership plan CRUD.
- Assign membership.
- Renew membership.
- Freeze/cancel foundation.
- Member detail timeline.

Acceptance criteria:

- Staff can create members.
- Staff can assign and renew memberships.
- Owner can view active/expired members.
- Membership status updates correctly based on dates.

### Phase 3: Billing and Payments

Deliverables:

- Invoice model.
- Payment model.
- Manual payment recording.
- Receipt display.
- Due payment tracking.
- Razorpay integration foundation.
- Razorpay webhook handling.

Acceptance criteria:

- Payments can be recorded against invoices.
- Invoice status updates correctly.
- Razorpay webhooks are verified and idempotent.
- Owner can see revenue totals.

### Phase 4: Attendance and Daily Operations

Deliverables:

- Manual check-in.
- QR check-in token flow.
- Attendance logs.
- Today's check-ins dashboard.
- Basic access validation based on membership status.

Acceptance criteria:

- Staff can check in a member.
- Expired members are clearly flagged.
- Attendance report shows daily and monthly counts.

### Phase 5: Leads and CRM

Deliverables:

- Lead capture.
- Lead source tracking.
- Lead stages.
- Follow-up tasks.
- Lead activity timeline.
- Lead conversion to member.

Acceptance criteria:

- Staff can create and update leads.
- Follow-ups appear on dashboard.
- Converted leads create member records.
- Owner can see lead conversion metrics.

### Phase 6: Notifications and WhatsApp

Deliverables:

- Notification templates.
- Notification event records.
- WhatsApp provider adapter.
- Renewal reminders.
- Payment reminders.
- Lead follow-up reminders.
- Queue-based sending.

Acceptance criteria:

- Reminders can be scheduled and sent.
- Failed sends are visible.
- Message delivery status is stored when available.
- Notification events are tenant-scoped.

### Phase 7: Dashboards and Reports

Deliverables:

- Owner dashboard.
- Staff dashboard.
- Revenue reports.
- Membership expiry reports.
- Attendance reports.
- Lead reports.
- Export basics.

Acceptance criteria:

- Owner can understand revenue, members, renewals, attendance, and leads from one screen.
- Reports respect tenant and branch scope.
- Common reports can be filtered by date range.

### Phase 8: Trainer, Workout, and Class Modules

Deliverables:

- Trainer profile.
- Trainer assignment.
- Basic workout templates.
- Assign workout to member.
- Fitness assessments.
- Class sessions.
- Class booking.

Acceptance criteria:

- Trainers can manage assigned members.
- Members can have workout plans and assessments.
- Classes can be scheduled and booked.

### Phase 9: SaaS Billing, Limits, and Commercialization

Deliverables:

- SaaS plans.
- Tenant subscription status.
- Plan limits.
- Feature flags.
- Usage tracking.
- Grace period and suspension.
- Internal billing dashboard.

Acceptance criteria:

- Platform admin can assign a SaaS plan.
- Feature access changes based on subscription.
- Tenant suspension prevents normal tenant operations while preserving data.

### Phase 10: Hardening and Scale

Deliverables:

- Performance tuning.
- Security review.
- Backup and restore process.
- Import tools.
- Operational runbooks.
- Monitoring dashboards.
- Production readiness checklist.

Acceptance criteria:

- System can support multiple tenants safely.
- Backups are tested.
- Critical errors are monitored.
- Support team has tools for tenant issues.

## 24. Detailed Execution Plan for AI Development Agent

The AI agent should work in small, reviewable increments.

### Step 1: Initialize Project

Tasks:

- Create monorepo.
- Configure TypeScript.
- Configure formatting and linting.
- Add Next.js app.
- Add NestJS API.
- Add database package.
- Add environment variable validation.
- Add Docker Compose for local PostgreSQL and Redis.

Acceptance criteria:

- Local web app starts.
- Local API starts.
- Database is reachable.
- Redis is reachable.
- CI runs basic checks.

### Step 2: Implement Auth Foundation

Tasks:

- Create user table.
- Implement password hashing.
- Implement login.
- Implement token/session strategy.
- Implement current user endpoint.
- Add auth guards.

Acceptance criteria:

- User can log in.
- Protected endpoint rejects unauthenticated requests.
- Passwords are not stored in plaintext.

### Step 3: Implement Tenant Foundation

Tasks:

- Add tenant and branch tables.
- Add user-tenant role mapping.
- Add request tenant context.
- Add tenant-scoped repository conventions.
- Seed platform admin.

Acceptance criteria:

- Platform admin can create tenant.
- Tenant owner can access own tenant.
- Cross-tenant access test fails correctly.

### Step 4: Implement RBAC

Tasks:

- Define roles and permissions.
- Add permission guards.
- Add role assignment.
- Add UI-aware permission metadata.

Acceptance criteria:

- Owner has full tenant permissions.
- Staff has limited permissions.
- Unauthorized actions are rejected by backend.

### Step 5: Implement Members

Tasks:

- Member schema.
- Member CRUD API.
- Member list UI.
- Member detail UI.
- Member search.
- Member notes.

Acceptance criteria:

- Staff can add, update, search, and view members.
- Member records are tenant-scoped.

### Step 6: Implement Memberships

Tasks:

- Membership plan schema.
- Membership assignment.
- Renewal flow.
- Status calculation.
- Expiry dashboard query.

Acceptance criteria:

- Staff can assign and renew memberships.
- Expiring members are visible.
- Active/expired status is accurate.

### Step 7: Implement Billing

Tasks:

- Invoice schema.
- Payment schema.
- Manual payment recording.
- Receipt screen.
- Revenue summary.

Acceptance criteria:

- Invoice totals are correct.
- Payment updates invoice status.
- Owner dashboard revenue reflects payments.

### Step 8: Implement Attendance

Tasks:

- Attendance log schema.
- Manual check-in.
- QR token generation.
- QR check-in endpoint.
- Attendance dashboard.

Acceptance criteria:

- Staff can check in member.
- Duplicate check-in rules are defined.
- Expired membership warnings appear.

### Step 9: Implement Leads and Follow-Ups

Tasks:

- Lead schema.
- Lead list.
- Lead detail.
- Follow-up task schema.
- Activity timeline.
- Convert lead to member.

Acceptance criteria:

- Staff can manage leads.
- Follow-ups appear when due.
- Converted lead links to member.

### Step 10: Implement Notifications

Tasks:

- Notification template model.
- Notification event model.
- Queue worker.
- WhatsApp adapter interface.
- Reminder scheduling.

Acceptance criteria:

- Renewal reminder can be queued.
- Failed send can be retried.
- Notification history is visible.

### Step 11: Implement Reports

Tasks:

- Revenue report.
- Attendance report.
- Membership report.
- Lead report.
- Export foundation.

Acceptance criteria:

- Reports filter by date and branch.
- Reports are tenant-scoped.
- Dashboard queries are performant enough for MVP data size.

### Step 12: Production Readiness

Tasks:

- Add monitoring.
- Add error tracking.
- Add backup runbook.
- Add migration runbook.
- Add support admin tools.
- Add security checklist.

Acceptance criteria:

- Production deployment checklist is complete.
- Critical logs and errors are visible.
- Basic backup and restore has been tested.

## 25. Agent Working Rules

The AI development agent must:

- Read this document before planning implementation.
- Create a short implementation plan before each phase.
- Keep changes scoped to the current phase.
- Preserve tenant isolation in every feature.
- Add or update tests for critical logic.
- Update documentation when architecture or behavior changes.
- Prefer simple, maintainable code over clever abstractions.
- Never trust client-supplied tenant, role, payment, or price data.
- Treat payments, permissions, and audit logging as high-risk areas.
- Use feature flags for incomplete or premium features.
- Keep a running backlog of deferred decisions.

The agent should not:

- Skip backend authorization because the UI hides a button.
- Mix platform admin and tenant admin logic casually.
- Store files without tenant-scoped paths.
- Process payment webhooks without signature verification.
- Create cross-tenant reports unless explicitly designed for platform admins.
- Build AI features before operational data capture is stable.

## 26. Definition of Done

A feature is done when:

- Product behavior is implemented.
- Backend authorization is enforced.
- Tenant isolation is tested.
- Validation is in place.
- Important events are audited.
- UI handles loading, empty, success, and error states.
- Tests cover core business rules.
- API documentation is updated where relevant.
- No critical lint/type/test failures remain.
- Feature works in local and staging environments.
- Monitoring/logging is adequate for production debugging.

For payment, subscription, permission, and tenant features, definition of done also requires:

- Edge cases tested.
- Security implications reviewed.
- Audit log created.
- Failure states handled.

## 27. Prioritized Backlog

### P0: Must Have for MVP

- Monorepo setup.
- Local development environment.
- PostgreSQL schema foundation.
- Redis queue foundation.
- Auth.
- Tenant and branch model.
- Platform admin tenant creation.
- User roles and permissions.
- Audit log foundation.
- Member CRUD.
- Membership plans.
- Membership assignment and renewal.
- Manual payment recording.
- Invoice and receipt records.
- Attendance check-in.
- Lead management.
- Follow-up tasks.
- Owner dashboard.
- Staff dashboard.
- WhatsApp notification abstraction.
- Renewal reminders.
- Payment reminders.
- Basic reports.
- Seed data.
- Tests for tenant isolation, permissions, payments, and membership logic.

### P1: Should Have Soon After MVP

- Razorpay checkout.
- Razorpay webhooks.
- Import from CSV.
- Trainer assignment.
- Basic workout templates.
- Fitness assessments.
- Class scheduling.
- Class booking.
- Export reports.
- Feature flags.
- SaaS subscription limits.
- Failed notification retry UI.
- Support admin notes.
- Job monitoring screen.

### P2: Growth Features

- Multi-branch analytics.
- Advanced CRM pipeline.
- Trainer commissions.
- PT session packages.
- Member portal.
- Branded payment links.
- Advanced WhatsApp campaigns.
- Referral tracking.
- Corporate/family memberships.
- Discount and coupon rules.
- Freeze policy automation.
- Advanced import/migration tools.

### P3: Differentiators and USP

- Retention risk dashboard.
- Smart renewal follow-up suggestions.
- Lead conversion assistant.
- Automated member engagement journeys.
- AI owner insights assistant.
- Natural language reports.
- Benchmarking across anonymized gym segments.
- White-label mobile app.
- Hardware/device marketplace integrations.

## 28. Suggested USP Direction

The strongest USP should combine operations with revenue growth.

Possible positioning:

> Most gym software helps you record what happened. This product helps the gym owner prevent revenue leakage, recover renewals, convert leads, and understand what to do next.

Build toward these differentiators:

- Renewal recovery automation.
- Missed payment recovery.
- Lead follow-up automation.
- Member inactivity alerts.
- Trainer accountability.
- Business health dashboard.
- WhatsApp-first engagement for markets where WhatsApp is the primary business channel.
- Future AI insights built on clean operational data.

## 29. Launch Strategy

Recommended launch sequence:

1. Build MVP with 1-2 pilot gyms.
2. Migrate their member and membership data.
3. Run daily operations for 30 days.
4. Measure renewal tracking, payment recovery, lead conversion, and staff usage.
5. Fix workflow friction.
6. Add WhatsApp reminders and reports.
7. Convert pilots into paid customers.
8. Productize onboarding and pricing.
9. Launch to similar gyms in the same market segment.

## 30. Key Metrics to Track

For gyms:

- Active members.
- Monthly recurring revenue.
- Collection amount.
- Outstanding dues.
- Expiring memberships.
- Renewal rate.
- Lead conversion rate.
- Trial-to-member conversion.
- Average daily check-ins.
- Inactive members.
- Staff follow-up completion.

For the SaaS business:

- Active tenants.
- Trial-to-paid conversion.
- Monthly recurring revenue.
- Churn.
- Average revenue per tenant.
- Support tickets per tenant.
- WhatsApp messages sent.
- Payment volume processed.
- Feature adoption.

## 31. First Development Milestone

The first milestone should deliver a usable internal alpha.

Scope:

- Platform admin can create tenant.
- Tenant owner can log in.
- Staff can be created.
- Members can be created.
- Membership plans can be created.
- Membership can be assigned.
- Payment can be recorded.
- Attendance can be recorded.
- Owner can view a basic dashboard.

Acceptance criteria:

- One pilot gym can manage core member, membership, payment, and attendance workflows for one branch.
- All tenant data is isolated.
- Core actions are audited.
- The system can be deployed to staging.

