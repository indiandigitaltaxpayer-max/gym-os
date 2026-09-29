# Gym Growth OS - Project Status

Last updated: 2026-09-29  
Source of truth for scope: [`outputs/agent.md`](outputs/agent.md)
Product operation guide: [`PRODUCT_OWNER_MANUAL.md`](PRODUCT_OWNER_MANUAL.md)

## Current Position

The project has a working local multi-tenant foundation with authentication,
session management, role-based access control, branch-aware authorization, staff
invitations, and the initial operations dashboard.

The authentication, tenant access, and RBAC foundation has passed engineering
verification; product-owner user acceptance is still pending. **Step 5: Member
Management** and **Step 6: Memberships** are accepted and have passed
engineering verification. **Step 7: Billing** is accepted and has passed
engineering verification. **Step 8: Attendance** is accepted and has passed
engineering verification. **Step 9: Leads and Follow-ups** is accepted and has
passed engineering verification. **Step 10A: Notification Foundation** is
accepted and has passed engineering verification. Real WhatsApp delivery
remains deferred to Step 10B because provider
credentials and approved Meta templates are not yet available.
**Step 11A: Core Reports** is accepted and has passed engineering verification.
**Step 12A: Platform Admin and Tenant Provisioning** is accepted and has
passed engineering verification.
**Step 12B.1: Render Staging Configuration** is implemented and awaiting the
first manual staging deployment review in Render.

### Completion Snapshot

| Area | Status | Completion | Acceptance |
| --- | --- | ---: | --- |
| Phase 0: Product and architecture foundation | In progress | 80% | Partial |
| Phase 1: SaaS and tenant foundation | Accepted | 100% | Step 12A accepted |
| Phase 2: Member and membership core | Accepted | 100% | Steps 5 and 6 accepted |
| Phase 3: Billing and payments | Accepted | 100% | Step 7 accepted |
| Phase 4: Attendance and access | Accepted | 100% | Step 8 accepted |
| Phase 5: Leads and CRM | Accepted | 100% | Step 9 accepted |
| Phase 6: Notifications and WhatsApp | In progress | 70% | Step 10A accepted; Step 10B external provider integration remains |
| Phase 7: Reports and analytics | Accepted | 100% | Step 11A accepted for the MVP; advanced reporting remains deferred |
| Phase 8: Production readiness | In progress | 45% | Step 12A accepted; Step 12B.1 awaits staging deployment review |
| Phases 9-10 | Not started | 0% | Not ready |

Completion percentages are planning estimates, not effort or billing measures.

## Execution Step Tracker

| Step | Scope | Status | Notes |
| ---: | --- | --- | --- |
| 1 | Initialize project | In progress | Monorepo, web, API, PostgreSQL, migrations, seed, and local environment work. Redis and CI remain outstanding. |
| 2 | Authentication foundation | Implemented | Login, logout, current user, short-lived access token, rotating refresh session, Argon2 password hashes, and guards are complete. |
| 3 | Tenant foundation | Accepted | Tenant, branch, user-role mapping, tenant request context, branch restrictions, isolation, and audited Platform Admin provisioning are accepted. |
| 4 | RBAC | Implemented | Owner, Manager, Front desk, Trainer, and Accountant roles; permission guards; UI permission metadata; invitation role assignment; and audit events are implemented. |
| 5 | Members | Accepted | Product owner accepted the workflow. Final M/F gender, height, and weight additions passed migration, validation, build, and test verification. |
| 6 | Memberships | Accepted | Plan administration, assignment, renewal, status refresh, freeze/resume, cancellation, expiry views, audit, tests, and visual QA passed. Product owner accepted the workflow. |
| 7 | Billing | Accepted | Automatic invoices, manual and partial payments, receipts, dues, summaries, corrections, audit, tests, responsive visual QA, and product-owner review passed. |
| 8 | Attendance | Accepted | Manual/QR admission, duplicate protection, QR lifecycle, branch-local summaries, logs, audit, migration, tests, responsive QA, and product-owner review passed. |
| 9 | Leads and follow-ups | Accepted | Pipeline, follow-ups, timeline, conversion, dashboard tasks, metrics, tests, responsive QA, and product-owner review complete. |
| 10 | Notifications | In progress | Step 10A accepted: templates, durable PostgreSQL queue, optional Redis transport, simulated provider, reminders, retries, and delivery history. Step 10B real WhatsApp delivery is deferred. |
| 11 | Reports | Accepted | Product owner accepted role-aware operational and financial reports, branch/date filters, charts, tables, and CSV exports. |
| 12 | Production readiness | In progress | Step 12A is accepted. Step 12B.1 Render staging configuration is implemented and awaits deployment review; production hosting, backups, monitoring, security review, and runbooks follow. |

Status meanings:

- **Implemented**: code and engineering checks are complete.
- **In progress**: usable work exists, but roadmap requirements remain.
- **Next**: proposed next increment; implementation awaits scope approval.
- **Accepted**: the product owner has manually verified the acceptance checklist.

## Completed Foundation

### Application and Database

- pnpm/Turborepo monorepo with Next.js, NestJS, TypeScript, and Prisma.
- Local PostgreSQL connection, migrations, and seed data.
- Tenant, branch, users, roles, permissions, audit records, auth sessions, and
  staff invitations represented in the database.
- Production builds for the API and web application.
- Local Docker is not required because PostgreSQL runs directly on Windows.

### Authentication and Sessions

- Workspace, email, and password login.
- Argon2 password hashing; plaintext passwords are not stored.
- HTTP-only access and refresh cookies.
- Refresh-token rotation and hashed refresh-token persistence.
- Logout revokes the active session.
- Protected endpoints reject unauthenticated requests.
- Active user, tenant, and session state are checked on authenticated requests.

### Authorization and Tenant Safety

- Permission guards protect setup, staff, member, membership, payment,
  check-in, and dashboard operations.
- Tenant identity comes from the authenticated session rather than a client
  supplied tenant header.
- Branch-restricted users are limited to their assigned branches.
- Dashboard financial values are hidden unless the user has `finance.read`.
- Owner and limited-management staff administration rules are enforced by the
  backend.

### Staff Administration

- Staff directory and staff invitation UI.
- Role and branch assignment when creating an invitation.
- One-time invitation token with expiry and acceptance tracking.
- Invitation acceptance and password setup.
- Staff account disable flow.
- Login, logout, invite, invitation acceptance, and disable actions are audited.
- Invitation links are shown in the UI; external email delivery is deferred.

## Verification Record

Last engineering verification: 2026-09-29

| Check | Result |
| --- | --- |
| API TypeScript check | Passed |
| Web TypeScript check | Passed |
| API unit tests | 9 suites, 30 tests passed |
| API production build | Passed |
| Web production build | Passed |
| API health endpoint | Passed |
| Web application response | HTTP 200 |
| Owner login/current-user/logout flow | Passed |
| Refresh-token flow | Passed |
| Staff invitation and acceptance flow | Passed |
| Disabled-user login rejection | Passed |
| Permission rejection for restricted staff | Passed |
| Branch-isolation test | Passed |
| Member schema migrations and sequence backfill | Applied successfully |
| Member create/search/detail/update/note/archive/reactivate HTTP flow | Passed |
| Temporary Step 5 verification member cleanup | Passed |
| Member workspace desktop/tablet visual QA | Passed |
| Member workspace 390 x 844 mobile visual QA | Passed |
| Mobile navigation and profile modal QA | Passed |
| M/F gender and metric-measurement validation tests | Passed |
| Legacy `Female` data migration to `F` | Passed |
| Final API and web production builds | Passed |
| Membership lifecycle database migration | Applied successfully |
| Assignment and overlap rejection HTTP flow | Passed |
| Freeze, resume, extension, renewal, and cancellation HTTP flow | Passed |
| Expiring-members query and plan deactivation HTTP flow | Passed |
| Memberships workspace and assignment-modal visual QA | Passed |
| Step 7 billing migration and Prisma generation | Passed |
| Automatic membership invoice and line-item snapshot flow | Passed |
| Partial payment, receipt numbering, and full-payment flow | Passed |
| Overpayment rejection and idempotency foundation | Passed |
| Manual payment reversal and unpaid-invoice void flow | Passed |
| Due-today versus overdue calendar-boundary behavior | Passed |
| Billing summaries and dashboard reconciliation | Passed |
| Billing desktop and 390 x 844 mobile visual QA | Passed |
| Invoice and receipt display visual QA | Passed |
| Step 8 attendance migration and Prisma generation | Passed; all 8 migrations are current |
| Manual attendance admission and two-hour duplicate rejection | Passed |
| QR issue, replacement, old-token rejection, QR admission, and revocation | Passed |
| Attendance log, branch-local summary, and source counts | Passed |
| Temporary Step 8 members, memberships, invoices, QR, check-ins, and audit cleanup | Passed |
| Attendance desktop and 390 x 844 mobile visual QA | Passed |
| Attendance mobile nested-scroll and page-overflow checks | Passed |
| Step 9 CRM schema and role-permission migrations | Passed; all 10 migrations are current |
| Lead create, follow-up, stage, timeline, and conversion HTTP lifecycle | Passed |
| Repeat lead conversion rejection | Passed with HTTP 409; no duplicate member created |
| Temporary Step 9 lead, member, follow-up, activity, and audit cleanup | Passed |
| Leads desktop and 390 x 844 mobile visual QA | Passed |
| Leads mobile page-overflow check | Passed; scroll width equals client width |
| Development/production Next.js cache-isolation regression check | Passed; production build completed while dev remained healthy, followed by repeated HTTP 200 responses |
| Step 10 notification schema and role-permission migrations | Passed; all 12 migrations are current |
| Notification provider, queue, reminder, retry, and authorization tests | Passed; full repository suite is 11 suites and 36 tests |
| Simulated notification success, failure, retry, and delivery-attempt history | Passed through live HTTP verification |
| Repeated reminder scheduler run | Passed; no duplicate reminder events were created |
| Step 10 verification data cleanup | Passed; temporary notifications and matching audit records removed |
| Notifications desktop and 390 x 844 mobile visual QA | Passed |
| Notifications page-overflow and browser-console checks | Passed; no page overflow or console errors |
| Canonical pnpm install and production builds after Step 10 | Passed |
| Step 11 report-permission migration | Passed; all 13 migrations are current |
| Report aggregation and authorization tests | Passed; full repository suite is 12 suites and 40 tests |
| Member, revenue, attendance, and lead report HTTP responses | Passed against seeded 2026 records |
| Report CSV response and active-filter consistency | Passed; UTF-8 CSV returned with matching exclusions and date/branch scope |
| Report range validation | Passed; ranges over 366 days return HTTP 400 |
| Reports desktop and 390 x 844 mobile visual QA | Passed |
| Reports mobile page-overflow check | Passed; scroll width equals client width |
| Clean-tab report switching and browser-console check | Passed; no warnings or errors |
| API and web production builds after Step 11 | Passed |
| Browser console errors | None |
| Step 12A platform-admin and invitation-actor migrations | Passed; all 15 migrations are current |
| Platform auth, tenant lifecycle, and suspended-invitation tests | Passed; full repository suite is 14 suites and 46 tests |
| Workspace TypeScript checks after Step 12A | Passed |
| API and web production builds after Step 12A | Passed |
| Create tenant, accept Owner invitation, suspend, reactivate, and archive HTTP lifecycle | Passed |
| Suspended tenant active-session invalidation and login rejection | Passed |
| Step 12A verification tenant and related records cleanup | Passed |
| Platform Admin desktop and 390 x 844 mobile visual QA | Passed |
| Platform Admin mobile page-overflow check | Passed; scroll width remains within viewport |
| Platform Admin browser-console check | Passed; no warnings or errors |

The temporary staff account created during end-to-end verification was removed.

## User Acceptance Checklist

Status: **Pending product-owner verification**

- [ ] Owner can sign in using credentials configured in the local `.env` file.
- [ ] Refreshing the page preserves the authenticated session.
- [ ] Owner can open the staff directory.
- [ ] Owner can create an invitation with a role and branch assignment.
- [ ] Invitee can open the one-time link and set a password.
- [ ] Invited staff can sign in with only their permitted capabilities visible.
- [ ] Restricted staff cannot access protected setup or financial operations.
- [ ] Owner can disable a staff account and the disabled account cannot sign in.
- [ ] Owner can sign out and protected data is no longer accessible.

Open an invitation link after signing out or in a private browser window so the
existing owner session does not take precedence.

## Known Gaps and Decisions

- CI has not been configured yet.
- Redis is not running locally and is not required by the current synchronous
  feature set. Add it when queues, rate limiting, or notification jobs need it.
- Platform Admin tenant provisioning is implemented; product-owner acceptance
  and production hardening remain outstanding.
- Invitation email and WhatsApp delivery are deferred; the one-time link is
  copied manually.
- Step 10A uses a local simulated delivery provider. Real WhatsApp sends,
  provider template approval, webhook delivery receipts, and provider-specific
  rate-limit behavior are deferred to Step 10B.
- Redis transport is supported when `REDIS_URL` is configured. Without Redis,
  the local API process polls the durable PostgreSQL queue, so Docker is not
  required for Step 10A review.
- Frontend automated tests have not been added.
- API documentation exists in the product plan but should be verified and
  completed as endpoints stabilize.
- Razorpay, object storage, monitoring, and production deployment are later
  roadmap items.
- Step 7 supports manual payment recording only. Live Razorpay checkout,
  webhooks, gateway refunds, discounts, PDF generation, and statutory GST tax
  invoice fields remain deferred.
- Step 11A exports filtered UTF-8 CSV files. Scheduled delivery, PDF reports,
  custom report builders, cohort analytics, trainer productivity, and
  AI-generated insights are deferred.
- Secrets and local passwords must remain in `.env` and must not be copied into
  this status document.

## Deferred Functionality - Post-MVP Backlog

This is the consolidated backlog for versions after the accepted MVP increments.
It is intentionally larger than one release. The recommended next release is
**production readiness + platform-admin onboarding + a Pulse Fitness WhatsApp
pilot**; later priorities should be re-evaluated from customer feedback.

### Priority 0 - Required Before Selling to Multiple Gyms

- Platform Admin portal for creating, suspending, and managing gym tenants,
  branches, initial Owner accounts, plans, feature flags, and usage limits.
- Secure Owner invitation delivery and a repeatable tenant onboarding checklist.
- SaaS subscription lifecycle: trials, plan changes, renewals, failed-payment
  handling, grace periods, cancellation, and tenant-level entitlements.
- Production hosting with HTTPS, managed PostgreSQL, backups and restore tests,
  secret management, CI/CD, environment separation, and deployment rollback.
- Production monitoring, alerting, structured logs, error tracking, health checks,
  support diagnostics, incident runbooks, and data-retention procedures.
- Security hardening: rate limits, dependency and vulnerability scanning, session
  review, webhook verification, encryption review, and tenant-isolation testing.
- CSV member/import migration with validation, duplicate handling, preview,
  rollback guidance, and an import audit trail.

### Priority 1 - Revenue and Customer Communication

- Step 10B Meta WhatsApp Cloud API integration: real provider adapter,
  per-tenant sender configuration, approved templates, member opt-in records,
  webhook delivery/read/failure statuses, signature verification, retries,
  throttling, and a controlled real-message acceptance test.
- Live Razorpay checkout, signed webhooks, payment reconciliation, refunds,
  failure recovery, and settlement reporting.
- Email delivery for invitations, receipts, and notifications; SMS remains an
  optional fallback after cost and provider evaluation.
- S3-compatible document storage, PDF receipts/reports, downloadable documents,
  and statutory GST invoice fields after accounting review.
- Discounts, coupons, credits, and controlled financial adjustments with audit
  history and permissions.

### Priority 2 - Gym Operations Expansion

- Member mobile/web portal for profile, membership, dues, receipts, attendance,
  class bookings, notifications, and a rotating member QR code.
- Public/self-service QR check-in, attendance check-out, visit duration, kiosk
  mode, duplicate-scan handling, and access decisions for expired memberships.
- RFID, biometric, and turnstile integrations through a separately tested device
  adapter; hardware procurement and site networking remain deployment concerns.
- Trainer management, client assignment, schedules, personal-training sessions,
  commissions, assessments, and progress tracking.
- Workout and exercise libraries, reusable plans, sets/repetitions, progression,
  and member delivery.
- Classes, capacity, bookings, waitlists, cancellations, rooms, and instructor
  scheduling.
- Family, corporate, and multi-branch membership variants plus richer freeze,
  transfer, upgrade, and downgrade rules.

### Priority 3 - Growth, Analytics, and AI

- CRM automation: WhatsApp/email follow-ups, campaigns, public lead forms,
  configurable pipelines, lead scoring, call-centre workflows, and attribution.
- Scheduled report delivery, PDF reports, saved presets, a custom report builder,
  cohort/retention analysis, trainer productivity, and branch benchmarking.
- AI remains deferred until reliable operational data exists: churn-risk scoring,
  next-best actions, lead prioritization, workout suggestions, conversation
  summaries, natural-language analytics, and owner insight narratives.

### Cross-Cutting Engineering Backlog

- Frontend component and end-to-end automated tests for critical workflows.
- Stable OpenAPI/API documentation, versioning policy, and integration examples.
- Production Redis decision for queues, distributed rate limiting, and scheduled
  jobs; local development may continue with the PostgreSQL-backed fallback.
- Accessibility review, browser/device compatibility matrix, performance budgets,
  localization, timezone handling, and regional tax/currency support.

## WhatsApp Integration Configuration Checklist

The MVP currently uses a simulated provider. For the first real Pulse Fitness
pilot, one server-side Meta configuration in the deployment environment is
acceptable. Before onboarding multiple gyms, credentials and sender settings
must be encrypted and stored per tenant, or onboarding should use Meta Embedded
Signup. Gym credentials must never be committed to Git, written in this file, or
sent through chat.

### Required Values

| Value | Purpose | How to obtain it | Secret |
| --- | --- | --- | --- |
| `NOTIFICATION_PROVIDER=meta` | Enables the future real Meta adapter | Set by the application operator after Step 10B is deployed | No |
| `WHATSAPP_GRAPH_API_VERSION` | Selects the supported Graph API version | Use the version supported when Step 10B is implemented and record it in deployment configuration | No |
| `WHATSAPP_ACCESS_TOKEN` | Authorizes server-to-server API requests | Create a Meta Business system user, assign the app and WhatsApp assets, grant `whatsapp_business_messaging` and `whatsapp_business_management`, then generate a system-user token | **Yes** |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifies the sending phone number | Meta App Dashboard, **WhatsApp > API Setup/Getting Started**, or query the WABA phone numbers endpoint | No, but keep server-side |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Identifies the WhatsApp Business Account (WABA) | WhatsApp Manager/App Dashboard, or query owned WABAs for the business portfolio | No, but keep server-side |
| `WHATSAPP_BUSINESS_PORTFOLIO_ID` | Identifies the owning Meta business | Meta Business Suite settings or the `business_id` value in its URL | No, but keep server-side |
| `WHATSAPP_APP_ID` | Identifies the Meta app | Meta App Dashboard, **App settings > Basic** | No, but keep server-side |
| `WHATSAPP_APP_SECRET` | Verifies webhook signatures | Meta App Dashboard, **App settings > Basic** | **Yes** |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Completes Meta's initial webhook verification | Generate a long random value ourselves and enter the identical value in Meta's webhook configuration | **Yes** |
| `WHATSAPP_WEBHOOK_URL` | Receives message and delivery-status events | Deploy a public HTTPS endpoint, proposed as `https://<api-domain>/v1/webhooks/whatsapp` | No |
| `WHATSAPP_DEFAULT_LANGUAGE_CODE` | Selects the template language, such as `en_US` | Match the language approved for each template in WhatsApp Manager | No |
| Approved template names | Maps Gym OS notifications to Meta templates | Create templates in WhatsApp Manager and wait for approval; store the exact approved name and parameter order in each tenant's notification template record | No |

`WHATSAPP_REGISTRATION_PIN` may be needed temporarily while registering a phone
number. It is a six-digit PIN selected during setup and should be handled as a
secret rather than retained in normal application configuration when no longer
needed.

### Meta Setup Sequence

1. Create or verify a Meta Business Portfolio and complete business verification
   when Meta requires it.
2. Create a Meta developer app with the WhatsApp product, then create or attach a
   WABA.
3. Add a dedicated sending phone number that can receive the verification SMS or
   voice call. Complete phone verification and registration.
4. Use Meta's temporary test token and test number only for an initial smoke test.
   Create a system user and system-user access token for the deployed server.
5. Assign the WABA, phone number, and app assets to the system user and grant the
   minimum WhatsApp management and messaging permissions.
6. Create the membership-renewal and payment-due templates in WhatsApp Manager.
   Record their exact approved names, languages, categories, and variable order.
7. Deploy the public HTTPS webhook, configure the generated verify token, validate
   GET verification, validate every POST using `X-Hub-Signature-256` and the app
   secret, and subscribe the app to the WABA once.
8. Record explicit member opt-in, provide opt-out handling, and document which
   gym is the message sender before sending production notifications.
9. Send test messages only to approved test recipients, verify sent/delivered/
   read/failed status updates, retries, idempotency, audit history, and cost.
10. Move production secrets into the hosting provider's secret manager and rotate
    any token exposed in logs, screenshots, source control, or chat.

Official setup references: [Meta WhatsApp Business Platform](https://www.postman.com/meta/whatsapp-business-platform/overview),
[Cloud API documentation](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api),
and [webhook subscriptions](https://www.postman.com/meta/whatsapp-business-platform/folder/ypn8q0n/webhook-subscriptions).

## Decision and Incident Log

| Date | Type | Record |
| --- | --- | --- |
| 2026-09-20 | Decision | `PROJECT_STATUS.md` is the durable progress, acceptance, incident, and instruction ledger for every future increment. |
| 2026-09-20 | Decision | Step 5 uses archival instead of destructive member deletion. |
| 2026-09-20 | Decision | Phone numbers are not globally unique because family members may share contact details; potential duplicates produce warnings. |
| 2026-09-20 | Decision | Member search, status/branch filtering, and pagination are performed by the API so the directory can scale beyond the initial local dataset. |
| 2026-09-20 | Decision | Membership assignment, renewal, expiry, invoicing, and payments remain outside Step 5. |
| 2026-09-20 | Instruction | Do not mark product-owner acceptance complete until the user manually verifies the checklist. |
| 2026-09-20 | Decision | Member numbers use an atomic tenant sequence and a tenant-slug prefix, for example `PUL-000002`; a backfill migration aligns existing tenant sequences. |
| 2026-09-20 | Incident | Running the Next.js build and standalone TypeScript check concurrently briefly removed generated `.next/types` files during the check. The build passed and the typecheck passed when rerun serially. Run these checks serially in future. |
| 2026-09-20 | Incident | Tablet-width visual QA found page-level horizontal overflow and mobile QA found that the existing menu button did not open navigation. Constrained table overflow, page overflow protection, and functional mobile navigation were added and reverified. |
| 2026-09-20 | Acceptance | Product owner accepted Step 5 subject to an M/F gender choice and member height/weight fields. Final acceptance will be recorded after migration and verification. |
| 2026-09-20 | Decision | Member measurements use centimetres (`heightCm`) and kilograms (`weightKg`); gender is constrained to `M` or `F` in both API validation and the database. |
| 2026-09-20 | Incident | Prisma client generation initially failed with Windows `EPERM` because the running API held the query-engine DLL. The API was stopped, generation succeeded, and the service remained stopped per user instruction. Stop the API before Prisma generation on Windows. |
| 2026-09-20 | Acceptance | The requested M/F selector and optional height/weight fields were implemented and verified; Step 5 is accepted. |
| 2026-09-20 | Instruction | Web and API services were shut down at the user's request. Keep them stopped until explicitly needed or requested. |
| 2026-09-20 | Approval | Step 6 plan approved: no overlaps, renewal defaults after current expiry, freeze extends expiry, and Owner/Manager control freeze/cancel. |
| 2026-09-20 | Decision | Step 6 membership assignment is separated from invoice/payment creation. Historical invoices remain intact; complete billing behavior is owned by Step 7. |
| 2026-09-20 | Incident | Expiry-query review found that a requested branch filter could override the normal staff branch scope. Explicit branch authorization was added before live testing. |
| 2026-09-20 | Verification | Temporary member, plan, memberships, freeze, renewal, and audit records used for the live lifecycle test were removed after the checks passed. |
| 2026-09-20 | Instruction | Services were started temporarily for Step 6 HTTP/UI verification and shut down again afterward. Ports 3000 and 4000 should remain stopped until requested. |
| 2026-09-20 | Acceptance | Product owner manually verified and accepted Step 6 membership workflows. Step 7 billing planning may proceed. |
| 2026-09-20 | Instruction | Web and API services were restarted at the product owner's request and verified at ports 3000 and 4000. Leave them running until a shutdown is requested. |
| 2026-09-20 | Planning | Step 7 billing plan was reviewed. Implementation is deferred until next week and must not begin until the pending product decisions are approved. |
| 2026-09-24 | Planning | Step 7 planning resumed. The existing invoice/payment schema, manual payment endpoint, permissions, and dashboard aggregates are demo foundations to harden rather than completed billing behavior. No Step 7 implementation has begun. |
| 2026-09-24 | Approval | Product owner approved all Step 7 defaults: automatic invoices, partial payments, server-calculated plan price/tax, printable receipts, immutable financial history, deferred Razorpay/refunds, payment-independent membership status, membership-start due dates, non-statutory MVP documents, and audited manual-payment reversals. |
| 2026-09-24 | Incident | The repository's root `dotenv`/filtered Prisma command did not resolve correctly on Windows. The established PowerShell environment loader and package-local Prisma executable were used; the migration applied successfully. |
| 2026-09-24 | Incident | Initial live billing verification treated an invoice due today as overdue because the date parsed at midnight. Overdue calculation now begins only after the due calendar day has passed and was reverified live. |
| 2026-09-24 | Verification | Two temporary billing lifecycle members and one date-boundary member were created for HTTP verification. Their memberships, invoices, line items, payments, audit events, and member records were removed after guarded cleanup. |
| 2026-09-24 | Verification | Step 7 passed migration status, 7 test suites/18 tests, API and web production builds, HTTP lifecycle checks, desktop/mobile visual QA, and browser console inspection. |
| 2026-09-25 | Incident | Tablet-width review found the Billing branch filter extending beyond the Collections/Billing block because the three-column filter grid exceeded the available content width beside the sidebar. |
| 2026-09-25 | Verification | Billing filters now use a full-width search row and two flexible selector columns at the tablet breakpoint. The branch selector remains inside the block at 900 x 685, the web production build passes, and the corrected app was restarted. |
| 2026-09-25 | Acceptance | Product owner manually verified and accepted Step 7 billing, including the responsive branch-filter correction. Step 8 Attendance planning may proceed. |
| 2026-09-25 | Planning | Step 8 Attendance implementation plan prepared. No application implementation has started; proposed MVP defaults are awaiting product-owner approval. |
| 2026-09-25 | Approval | Product owner approved the Step 8 Attendance recommendation and proposed defaults. Implementation may proceed. |
| 2026-09-25 | Incident | Prisma client generation initially hit the known Windows query-engine DLL lock because the API and web services were still running. Only the workspace listeners on ports 3000 and 4000 were stopped; generation then passed. |
| 2026-09-25 | Incident | The `tsx` seed launcher twice failed before execution with Windows `uv_os_get_passwd ENOMEM`. The seed was run successfully with Node's TypeScript stripping and the established quoted-value-aware PowerShell environment loader. |
| 2026-09-25 | Verification | Step 8 passed migration status, 8 test suites/23 tests, API and web production builds, a temporary two-member manual/QR HTTP lifecycle, guarded cleanup, desktop/mobile visual QA, overflow checks, and browser console inspection. |
| 2026-09-25 | Incident | The running website later produced React Client Manifest and `__webpack_modules__` errors because `next build` and `next dev` shared `.next`; the production build had invalidated the live development cache. |
| 2026-09-25 | Decision | Next.js development artifacts now use `.next-dev` while production builds continue using `.next`. This permits verification builds without corrupting the running development server. Both directories are ignored. |
| 2026-09-25 | Verification | The web service was restarted on a clean `.next-dev` cache. Five initial loads returned HTTP 200, a production build passed while dev remained active, and three post-build loads returned HTTP 200 with no manifest errors. |
| 2026-09-25 | Incident | Browser review later showed `Failed to fetch` because the Nest watch process exited after Windows denied its internal `taskkill` during a file-change restart; port 4000 was no longer listening. |
| 2026-09-25 | Instruction | For stable Windows manual-review sessions, run the built API with `pnpm --filter @gym/api start`. Use watch mode during active API editing, but expect to restart it manually if Windows denies the watcher process-tree termination. |
| 2026-09-25 | Verification | The built API was restarted without watch mode, `/v1/health` returned HTTP 200 with the correct CORS origin, and both open browser tabs recovered to the normal sign-in page without an error overlay. |
| 2026-09-25 | Instruction | Web and API services were shut down at the product owner's request. Ports 3000 and 4000 were verified closed; PostgreSQL was left running. |
| 2026-09-26 | Instruction | Web and API services were restarted at the product owner's request. Both health checks returned HTTP 200 and the authenticated dashboard was opened in the in-app browser. |
| 2026-09-26 | Acceptance | Product owner accepted Step 8 Attendance after manual review. Step 9 Leads and Follow-ups planning may proceed. |
| 2026-09-26 | Approval | Product owner approved the documented Step 9 defaults and requested implementation. |
| 2026-09-26 | Incident | Prisma schema formatting passed, but generation again hit the known Windows query-engine DLL lock after terminal sessions closed. Five remaining workspace Node processes were identified by their Node installation path and stopped; client generation and migration then succeeded. |
| 2026-09-26 | Incident | Root `pnpm exec dotenv` and filtered `prisma` resolution failed on Windows. The package-local Prisma executable and root `dotenv.cmd` were used successfully, matching the established local workaround. |
| 2026-09-26 | Decision | CRM permissions are granted to Owner, Manager, and Front Desk only. A dedicated data migration upgrades matching roles in every existing tenant; future tenant roles use the shared permission defaults. |
| 2026-09-26 | Verification | Step 9 passed 9 test suites/30 tests, database migration status, API and web production builds, a real HTTP lifecycle with HTTP 409 double-conversion protection, guarded verification-data cleanup, desktop/mobile visual QA, overflow checks, and browser console inspection. |
| 2026-09-26 | Incident | Restarting the built API with Ctrl+C left its child process listening on port 4000, causing `EADDRINUSE`. The exact listener PID from `netstat` was verified as the workspace Node runtime, stopped, and the latest build started successfully. |
| 2026-09-26 | Instruction | API and web services are running on ports 4000 and 3000 for product-owner review. Keep them running until a shutdown is requested. |
| 2026-09-27 | Acceptance | Product owner accepted Step 9 Leads and Follow-ups after manual review. Step 10 Notifications planning may proceed. |
| 2026-09-27 | Approval | Product owner approved the Step 10 defaults: local simulated-provider foundation first, provider-neutral architecture, Owner/Manager template and retry control, approved reminder timings, internal lead reminders, idempotency, and optional Redis transport. |
| 2026-09-27 | Incident | Initial BullMQ installation used a different pnpm store than the existing workspace links. Reusing the existing user-level pnpm store completed installation; the optional `msgpackr-extract` native build was ignored and BullMQ retains its JavaScript fallback. |
| 2026-09-27 | Incident | An earlier interactive `pnpm approve-builds` attempt left a placeholder value for `msgpackr-extract` in `pnpm-workspace.yaml`, causing installs to return `ERR_PNPM_IGNORED_BUILDS`. The optional package is now explicitly denied in the workspace build policy; canonical `pnpm install` passes. |
| 2026-09-27 | Incident | The `tsx` launcher again failed with Windows `uv_os_get_passwd ENOMEM` during verification-data maintenance. The equivalent Prisma operation ran successfully through Node without changing application behavior. |
| 2026-09-27 | Incident | Desktop visual QA found a small page-level horizontal overflow caused by an absolutely positioned screen-reader-only table label. The table wrapper now provides the positioning boundary; desktop and mobile widths were reverified. |
| 2026-09-27 | Verification | Step 10A passed all 12 database migrations, 11 test suites/36 tests, API and web production builds, simulated success/failure/retry HTTP lifecycles, reminder idempotency, guarded cleanup, responsive visual QA, overflow checks, and browser console inspection. |
| 2026-09-27 | Instruction | API and web services were restarted for Step 10A product-owner review. Both health checks return HTTP 200; leave ports 4000 and 3000 running until a shutdown is requested. |
| 2026-09-27 | Acceptance | Product owner reviewed and accepted the Step 10A Notification Foundation. Step 10B real WhatsApp integration remains separately deferred. |
| 2026-09-27 | Incident | During shutdown, the restricted PowerShell host denied `Stop-Process` and `taskkill` despite the exact listener PIDs being verified. Node's process API terminated the same two processes successfully. |
| 2026-09-27 | Instruction | API and web services were shut down at the product owner's request. Ports 3000 and 4000 were verified closed; PostgreSQL was left running. |
| 2026-09-27 | Approval | Product owner approved Step 11A Core Reports: role-aware member, revenue, attendance, and lead reports with date/branch filters, charts, detailed tables, CSV exports, and deferred advanced reporting. |
| 2026-09-27 | Decision | Operational reports are available to Owner, Manager, and Front Desk. Financial reports are available to Owner, Manager, and Accountant. Trainer report access remains disabled in Step 11A. |
| 2026-09-27 | Incident | Browser QA found that switching from Members to Revenue could briefly render the previous report data shape before the new request completed, causing a client exception. Report responses are now tagged with their source tab and stale data is cleared before transitions; a clean-tab retest showed no console errors. |
| 2026-09-27 | Verification | Step 11A passed all 13 migrations, 12 test suites/40 tests, API and web production builds, seeded-data HTTP checks, UTF-8 CSV export checks, one-year range enforcement, desktop/mobile visual QA, page-overflow checks, and clean browser-console inspection. |
| 2026-09-27 | Instruction | API and web services are running on ports 4000 and 3000 for Step 11A product-owner review. Keep them running until a shutdown is requested. |
| 2026-09-27 | Acceptance | Product owner reviewed and accepted Step 11A Core Reports. Advanced and scheduled reporting remains deferred outside the MVP increment. |
| 2026-09-27 | Documentation | Added `PRODUCT_OWNER_MANUAL.md` covering current tenant inventory, SaaS Product Owner versus Gym Owner responsibilities, module workflows, roles, demonstrations, multi-gym onboarding, local operation, data handling, and production-readiness limits. |
| 2026-09-27 | Verification | Live database review confirmed one active tenant (`pulse-fitness`), one branch, two user accounts, and exactly one user assigned the Owner role. Platform Admin tenant provisioning remains the required capability before normal multi-gym onboarding. |
| 2026-09-28 | Planning | Consolidated the post-MVP deferred backlog. The recommended next release is production readiness, Platform Admin onboarding, and a controlled Pulse Fitness Meta WhatsApp pilot; credentials remain unavailable and must never be recorded in this file or chat. |
| 2026-09-29 | Approval | Product owner approved the Step 12A Platform Admin and Tenant Provisioning plan. Implementation remains pending completion of the pre-implementation audit. |
| 2026-09-29 | Incident | Moving the workspace left pnpm's `node_modules` links tied to the prior location. Dependencies were relinked from the frozen lockfile, pnpm supply-chain verification passed, and Prisma Client regenerated successfully. |
| 2026-09-29 | Verification | Step 12A preflight passed all 13 migrations, 12 test suites/40 tests, workspace type checks, API and web production builds, required local environment checks, and live database continuity checks. Pulse Fitness remains active with one branch, two users, and three members. Ports 3000 and 4000 remain closed. |
| 2026-09-29 | Resolution | The moved workspace initially had no Git metadata. A new `main` repository was initialized and connected to `https://github.com/indiandigitaltaxpayer-max/gym-os.git`; `.env`, dependencies, package stores, build output, and TypeScript caches are excluded from version control. |
| 2026-09-29 | Planning | Preflight found that `StaffInvitation.invitedById` currently requires a tenant user. Step 12A must add an explicit platform-admin invitation actor path while preserving the existing one-time token and acceptance flow; it must not fabricate a tenant user as the inviter. |
| 2026-09-29 | Decision | Platform administrators use a separate authentication realm, session table, JWT secret, cookie paths, and fail-closed route marker. They are not tenant users and cannot use Platform Admin endpoints to read operational member or finance records. |
| 2026-09-29 | Decision | A first-owner invitation records the Platform Administrator as its actor. A database constraint requires exactly one inviter: either a tenant user or a Platform Administrator. |
| 2026-09-29 | Incident | The first Step 12A migration had already been applied before the invitation-actor exclusivity constraint was finalized. The constraint was added in a second forward-only migration instead of rewriting applied migration history. |
| 2026-09-29 | Decision | Local seeding may fall back to the development Owner credentials when dedicated Platform Admin variables are absent. Production requires `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`, and `PLATFORM_JWT_SECRET`; no production fallback is allowed. |
| 2026-09-29 | Verification | Step 12A passed all 15 migrations, 14 test suites/46 tests, workspace type checks, API and web production builds, and a live tenant lifecycle covering provisioning, Owner invitation acceptance, suspension, session invalidation, reactivation, and archival. Guarded cleanup removed the temporary tenant. |
| 2026-09-29 | Verification | Platform Admin sign-in, tenant directory, Pulse Fitness details, create-gym form, mobile navigation, audit history, responsive containment, and browser console were verified at desktop and 390 x 844 mobile sizes. The temporary browser-QA administrator is removed after verification. |
| 2026-09-29 | Incident | Starting the review services through pnpm triggered a local store-mismatch reinstall prompt. The prompt was declined and the already-built API and web servers were launched directly through the installed Node entry points; no dependency files were changed. |
| 2026-09-29 | Acceptance | Product owner manually accepted Step 12A Platform Admin and Tenant Provisioning. Step 12B Production Readiness planning may proceed. |
| 2026-09-29 | Approval | Product owner selected Render as the deployment provider, connected GitHub, linked the `gym-os` repository, and approved Step 12B.1 Render deployment configuration. No Render services have been created. |
| 2026-09-29 | Decision | Step 12B uses a staging-first Render Blueprint in the Singapore region: distinct web/API services and one managed Postgres database. Auto-deploy is disabled pending manual review. |
| 2026-09-29 | Decision | Render's free Postgres plan is permitted for the short staging proof only. It expires after 30 days and has no backups; it must never hold real customer data or be treated as production infrastructure. |
| 2026-09-29 | Decision | The planned production domain is `gymgrowthos.com`. Future production service addresses will use `app.gymgrowthos.com` and `api.gymgrowthos.com`; temporary Render `onrender.com` URLs remain the staging addresses until deployment is intentionally started. Domain registration and DNS configuration are deferred. |
| 2026-09-29 | Decision | The planned production data region is Singapore. Before onboarding real gym data, the production environment must use paid Render PostgreSQL with backups enabled and a documented restore test; the temporary free staging database is not eligible for production use. |
| 2026-09-29 | Decision | Cloudflare R2 is the planned object-storage provider for documents, exports, and generated receipts. Its S3-compatible API is the required application boundary so the storage provider can later be migrated to AWS S3 without changing the domain model or application-facing storage interface. |
| 2026-09-29 | Decision | Initial production observability will use Sentry for frontend and API error tracking, paired with Render health checks. Better Stack uptime monitoring is deferred until the production launch; Grafana Cloud or Datadog will be reconsidered only when system scale justifies broader observability. |
| 2026-09-29 | Decision | Resend is the planned transactional-email provider for Owner and staff invitations, receipts, and operational notices. The team has prior implementation familiarity from Layabalita; API keys, sender-domain verification, templates, and actual delivery integration remain deferred to the production-email increment. |
| 2026-09-29 | Decision | First-year planning assumptions are five gyms, up to three branches and 1,000 members per gym, up to 20 staff accounts per gym, and up to 100,000 stored documents/receipts overall. The initial production infrastructure budget is USD 75-150 per month, excluding WhatsApp, payment-gateway, and transactional-email usage charges. These are capacity-planning assumptions, not enforced SaaS quotas. |
| 2026-09-29 | Decision | The delivery environments are Local (Windows and local PostgreSQL), Staging (isolated Render resources with test data only), and Production (paid Render services, backed-up PostgreSQL, the production domain, and real customer data). Configuration, data, credentials, and external-provider accounts must remain isolated across these environments. |
| 2026-09-29 | Decision | Release flow: local `feature/<name>` branches merge into `staging` for manual staging deployment and acceptance. A tested `staging` snapshot becomes `release/<version>` for production deployment. Each production release is tagged and then merged into `main`, which represents the latest production state. Automatic production deploys remain disabled initially. |
| 2026-09-29 | Verification | Step 12B.1 database and API TypeScript checks passed. The Blueprint has not yet been applied in Render, so no service, database, or production deployment has been created. |

## Completed Increment: Step 5 - Member Management

Implemented deliverables:

- Complete member schema and validation.
- Paginated member directory with search and branch/status filters.
- Create and edit member forms.
- Member profile with contact, emergency contact, branch, status, and notes.
- Archive and reactivate behavior instead of destructive deletion.
- Tenant and branch isolation on every query.
- `member.read` and `member.write` enforcement in API and UI.
- Audit records for member creation, update, archive, and reactivation.
- Tests for permissions, tenant isolation, branch isolation, search, pagination,
  validation, and archive behavior.

Acceptance criteria:

- [ ] Authorized staff can create, view, update, search, and filter members.
- [ ] Authorized staff can add notes and archive/reactivate a member.
- [ ] Read-only staff cannot modify member records.
- [ ] Branch-restricted staff cannot access members from other branches.
- [ ] One tenant cannot read or modify another tenant's members.
- [ ] Validation and duplicate warnings are clear to staff.
- [x] API and web type checks, tests, and production builds pass.
- [x] Product owner manually verifies and accepts the complete member workflow.

Membership assignment, renewal, expiry calculation, invoices, and payments are
outside Step 5 and remain in Steps 6 and 7.

### Step 5 Review Instructions

1. Sign in and open **Members** from the primary navigation.
2. Create a member with personal, emergency, branch, source, and address data.
3. Search for the member and test the status and branch filters.
4. Open the profile, edit its details, and add a staff note.
5. Archive the member and confirm it disappears from the default directory.
6. Enable **Include archived**, open the profile, and reactivate it.
7. Repeat the navigation and profile check on a narrow browser window.

## Completed Increment: Step 6 - Memberships

Status: **Accepted.**

Implemented scope:

- Membership-plan administration and validation.
- Assign a plan to a member with an explicit start date.
- Renewal flow that preserves membership history.
- Reliable active, pending, frozen, expired, and cancelled status calculation.
- Freeze/cancel foundation with audit events.
- Expiring-members filters and dashboard visibility.
- Tenant, branch, and permission enforcement with focused tests.

Acceptance checklist:

- [x] Authorized staff can assign an active plan with an explicit start date.
- [x] Overlapping membership dates are rejected.
- [x] Renewal creates a new record and preserves history.
- [x] Future renewals are shown as pending.
- [x] Owner/Manager can freeze and resume; the expiry is extended.
- [x] Owner/Manager can cancel with an optional reason.
- [x] Expiring memberships appear in the selected 7/15/30-day window.
- [x] Plan creation, editing, and deactivation work without changing history.
- [x] API/web typechecks, 13 tests, production builds, HTTP lifecycle, and visual QA pass.
- [x] Product owner manually verifies and accepts Step 6.

## Completed Engineering Increment: Step 7 - Billing

Status: **Accepted.**

Objective: connect memberships to reliable financial records so a gym can see
what each member owes, collect full or partial payments, issue receipts, and
track revenue and outstanding dues.

Proposed scope:

- Create an invoice when a membership is assigned or renewed.
- Preserve charged plan, price, discount, and tax as historical invoice data.
- Support open, partially paid, paid, overdue, and void invoice states.
- Record cash, card, UPI, bank-transfer, and other manual payments.
- Support partial payments while preventing overpayments and duplicate requests.
- Generate tenant-scoped sequential invoice and receipt numbers.
- Provide invoice lists, member billing history, payment collection, printable
  receipts, outstanding-dues views, and revenue summaries.
- Enforce tenant, branch, and finance permissions throughout the API and UI.
- Audit invoice creation, payment recording, and invoice voiding.
- Introduce a provider-neutral payment integration boundary that is ready for
  Razorpay without requiring live gateway credentials in this increment.

Recommended role access:

- Owner: full billing access.
- Manager: view invoices and record payments.
- Accountant: view invoices, record payments, and view revenue reports.
- Front desk: view member balances and record payments.
- Trainer: no financial access.

Proposed acceptance criteria:

- Membership assignment and renewal create invoices with correct totals.
- Subtotal, discount, tax, total, paid amount, and balance are calculated by the
  backend rather than trusted from the client.
- Full and partial payments produce the correct invoice status.
- Duplicate payment submissions and overpayments are rejected.
- Receipts have stable tenant-specific identifiers and can be printed.
- Revenue and outstanding-dues summaries reconcile with payment records.
- Tenant and branch boundaries prevent unauthorized financial-data access.
- Unauthorized roles cannot read or modify billing information.
- Financial actions produce audit records.
- Focused tests, typechecks, production builds, HTTP verification, and visual QA
  pass.

Approved product decisions:

1. Approve automatic invoice creation for membership assignment and renewal.
2. Approve partial payments.
3. Use plan price and configured tax with discounts deferred from this increment.
4. Use printable browser receipts with PDF generation deferred.
5. Disallow financial-record deletion and permit voiding of unpaid invoices only,
   with a mandatory reason.
6. Defer refunds, live Razorpay checkout, and Razorpay webhooks until the manual
   billing workflow is accepted.
7. Keep membership lifecycle status date-based and independent of payment
   status; unpaid invoices create dues but do not automatically deactivate a
   membership.
8. Default an automatically generated invoice's due date to the membership start
   date, with an explicit due-date field available during assignment or renewal.
9. Treat the MVP document as a standard commercial invoice/receipt rather than a
   statutory GST tax invoice; full GST business details and compliance fields are
   deferred unless required for the pilot gym.
10. Allow Owner/Accountant to reverse an incorrectly recorded manual payment with
    a mandatory reason and audit history; this is an accounting correction, not
    a Razorpay refund.

All ten decisions above were approved on 2026-09-24.

Implemented deliverables:

- Automatic invoice creation within the membership assignment/renewal
  transaction.
- Immutable invoice line-item snapshots of plan name, price, and tax.
- Tenant-scoped sequential invoice and receipt identifiers.
- Invoice list, branch/status/search filters, detail, due tracking, and member
  billing history.
- Full and partial manual payment recording for cash, card, UPI, bank transfer,
  and other methods.
- Server-calculated balances and open, partially paid, paid, overdue, and void
  presentation.
- Printable browser invoice and receipt views.
- Owner invoice voiding and Owner/Accountant manual-payment reversal with
  mandatory reasons.
- Revenue, outstanding, overdue, and monthly invoice summaries.
- Tenant/branch permission enforcement and billing audit records.
- Provider reference and idempotency fields ready for a future Razorpay adapter.

Acceptance checklist:

- [x] Assigning or renewing a membership automatically creates one invoice.
- [x] Invoice price and tax match the selected plan and remain historical.
- [x] A payment can be recorded using each supported manual method.
- [x] Partial payment updates the balance and status correctly.
- [x] Full payment produces a paid invoice and a printable receipt.
- [x] Overpayments are rejected with a clear message.
- [x] An invoice due today is not shown as overdue; past-due balances are.
- [x] Owner can void an unpaid invoice with a reason.
- [x] Owner/Accountant can reverse an incorrect payment with a reason.
- [x] Revenue, outstanding, overdue, and member billing history are accurate.
- [x] Billing remains usable on desktop and a narrow mobile viewport.
- [x] Migration, typechecks, 18 tests, production builds, HTTP verification,
  visual QA, and temporary-data cleanup pass.
- [x] Product owner manually verifies and accepts Step 7.

### Step 7 Review Instructions

1. Sign in and create a temporary member.
2. Open the member profile and assign a plan with start and invoice due dates.
3. Open **Billing** and confirm the new invoice total and tax.
4. Record a partial payment and confirm the balance and receipt.
5. Record the remaining amount and confirm the invoice becomes paid.
6. Open the member profile and confirm the invoice appears in billing history.
7. Create another unpaid invoice and test Owner-only voiding with a reason.
8. Open an eligible payment as Owner or Accountant and test reversal with a
   reason.
9. Review the revenue, outstanding, overdue, and invoice-count summaries.
10. Repeat the Billing navigation and invoice-detail check in a narrow window.

## Implemented Increment: Step 8 - Attendance

**Status:** Accepted by product owner on 2026-09-29.

Existing foundation to retain:

- The `CheckIn` table already stores tenant, branch, member, source, and time.
- `POST /v1/check-ins` already validates branch access, member status, and an
  active membership date range.
- The dashboard already shows today's count, recent check-ins, and a basic
  manual check-in action.
- Existing behavior will move behind the Attendance module's shared admission
  service without breaking the dashboard workflow.

Proposed implementation sequence:

1. Extend the attendance model with the membership used for admission, the
   recording staff user, a controlled source value, and reporting indexes.
2. Add a revocable member QR credential. Store only its hash, reveal its
   printable value when issued, and invalidate the prior credential when it is
   regenerated.
3. Add tenant- and branch-scoped APIs for member lookup, manual check-in,
   authenticated QR check-in, QR issue/regeneration, paginated logs, and
   daily/monthly summaries.
4. Centralize admission validation so manual, QR, and dashboard check-ins apply
   identical member, membership, branch, tenant, and duplicate rules.
5. Build a dedicated Attendance page with fast member search, manual check-in,
   QR scanning or token-entry fallback, clear success/refusal messages, branch
   and date filters, summary metrics, and a paginated log.
6. Add audit events for QR issue/regeneration and successful check-ins, plus
   structured operational logging for refused attempts.
7. Add API, permission, isolation, duplicate-window, date-boundary, QR, and
   responsive UI tests, followed by desktop/mobile browser verification.

Approved MVP defaults:

- Duplicate rule: reject another check-in for the same member anywhere in the
  tenant within two hours; allow a later visit on the same day.
- Branch access: allow an active member at any active branch in the same tenant
  until branch-restricted plans are introduced.
- QR model: use a reusable, opaque, revocable member QR credential scanned by
  an authenticated staff session. Rotating member-app QR codes remain deferred.
- Roles: Owner, Manager, and Front Desk can record check-ins and view attendance.
  Trainers and Accountants receive no attendance access in this step.
- Admission: require an active member and active, in-date membership. Do not
  permit staff overrides for expired, frozen, cancelled, pending, or archived
  records in the MVP.
- Event model: record check-in only; check-out and duration are deferred.
- Time handling: calculate summaries using the selected branch timezone.

Acceptance criteria:

- Authorized staff can find an eligible member and complete a manual check-in.
- Ineligible, cross-tenant, and duplicate admissions are refused with a clear
  reason and do not create an attendance event.
- Staff can issue/regenerate a member QR and use it through an authenticated
  scanner or token-entry fallback.
- Logs can be filtered by branch, date range, member, and source and remain
  tenant scoped.
- The page reports today's visits, today's unique members, and selected-month
  visits using branch-local dates.
- Dashboard and Attendance-page check-ins use the same admission rules.
- Automated checks and desktop/mobile visual verification pass before manual
  product-owner acceptance is requested.

Explicitly deferred: RFID, biometric and turnstile integrations, public or
unauthenticated QR admission, rotating member-app QR codes, offline kiosk mode,
check-out, visit duration, guest passes, geofencing, attendance exports, and
advanced analytics.

### Step 8 User Acceptance Checklist

Status: **Accepted by product owner on 2026-09-26**

- [x] Open Attendance and confirm the correct operating branch is selected.
- [x] Search for an active member and complete a manual check-in.
- [x] Try the same member again and confirm the duplicate attempt is refused.
- [x] Confirm an inactive or membership-ineligible member cannot be checked in.
- [x] Issue or replace a member QR and confirm the printable QR is displayed.
- [x] Open the scanner and scan the member QR, or use the token-entry fallback.
- [x] Revoke or replace the QR and confirm the previous credential is rejected.
- [x] Filter the attendance log by member, source, and date.
- [x] Confirm today's visits, unique members, and monthly totals update correctly.
- [x] Repeat the main Attendance workflow in a narrow browser window.

## Implemented Increment: Step 9 - Leads and Follow-Ups

**Status:** Accepted by product owner on 2026-09-27.

Completed implementation:

1. Add tenant- and branch-scoped Lead, FollowUpTask, and LeadActivity models,
   including assignment, status history, conversion linkage, archive state, and
   reporting indexes.
2. Add dedicated lead permissions and role defaults. Owner, Manager, and Front
   Desk can manage leads in their permitted branches; Trainer and Accountant
   have no CRM access in this increment.
3. Add APIs for lead creation, search, filtering, pagination, detail, editing,
   stage changes, archival, follow-up scheduling/completion, activity timeline,
   conversion, and summary metrics.
4. Build a Leads workspace with a compact pipeline view, searchable table,
   branch/source/stage/assignee filters, lead detail, timeline, and follow-up
   actions.
5. Add due and overdue follow-ups to the overview dashboard and provide lead
   counts, conversions, lost leads, and conversion rate for the selected period.
6. Convert a lead to a member in one transaction, retaining the CRM history and
   linking both records while reusing member duplicate-warning behavior.
7. Add audit events, tenant/branch isolation tests, lifecycle tests, conversion
   tests, builds, live HTTP verification, cleanup, and desktop/mobile visual QA.

Approved MVP defaults:

- Pipeline stages: `NEW`, `CONTACTED`, `TRIAL_SCHEDULED`, `TRIAL_COMPLETED`,
  `CONVERTED`, and `LOST`.
- Lead sources: Walk-in, phone, website, referral, social media, and other.
- Duplicate handling: warn on matching phone or email, but allow staff to save
  because family members and repeated enquiries may legitimately share details.
- Assignment: default new leads to the creating staff user; Owner or Manager can
  reassign them to another CRM-enabled user in the same tenant.
- Branch scope: every lead belongs to one branch. Owners can see all branches;
  other CRM users see only assigned branches.
- Follow-ups: track due date/time, assignee, purpose, completion time, outcome,
  and status. Due/overdue tasks appear in-app; WhatsApp/email reminders remain
  Step 10 work.
- Conversion: create a linked member with `TRIAL` status at the lead's branch.
  Membership, invoice, and payment creation remain explicit existing workflows.
- Lost leads: require a loss reason and preserve the complete timeline.
- Removal: archive leads instead of deleting CRM history.
- Metrics: count new, active, converted, and lost leads and calculate conversion
  rate for a selected date range.

### Step 9 User Acceptance Checklist

Status: **Accepted by product owner on 2026-09-27**

- [x] Create a lead and confirm duplicate phone/email warnings do not block saving.
- [x] Search and filter leads by stage, source, branch, assignee, and due state.
- [x] Edit a lead, change its stage, reassign it, and confirm the timeline updates.
- [x] Move a lead to Lost and confirm a reason is required and retained.
- [x] Schedule a follow-up, confirm it appears as due/overdue, and complete it
  with an outcome.
- [x] Confirm assigned due follow-ups appear on the overview dashboard.
- [x] Convert a lead and confirm one linked `TRIAL` member is created without a
  membership or invoice.
- [x] Attempt to convert the same lead again and confirm it is refused.
- [x] Archive and reactivate a lead without losing its timeline.
- [x] Repeat the primary Leads workflow in a narrow browser window.

Engineering acceptance criteria for branch/tenant isolation, audit history,
transactional conversion, automated checks, and responsive layout have passed.
The acceptance checklist is complete. Step 10 implementation must not begin
before its plan and delivery defaults are reviewed and approved.

Explicitly deferred: automated WhatsApp/email delivery, lead scoring, campaign
automation, AI follow-up suggestions, public website lead forms, call-center
integration, and advanced customizable CRM pipelines.

## Implemented Increment: Step 10A - Notification Foundation

**Status:** Accepted by the product owner on 2026-09-27.

Implemented deliverables:

- Tenant-scoped notification templates, policies, events, delivery attempts,
  statuses, provider identifiers, retry metadata, and audit actions.
- Provider-neutral delivery interface with a deterministic local simulator for
  successful and failed sends.
- Durable PostgreSQL queue processing with retry backoff and cancellation.
- Optional BullMQ/Redis transport when `REDIS_URL` is available; local polling
  remains the default so the MVP does not require Docker or Redis.
- Idempotent membership-renewal and payment-due reminder scheduling using the
  approved 7/3/1-day and due-date/3-days-overdue defaults.
- Internal lead follow-up reminders without automatic customer messaging.
- Notifications workspace with summary, search, status/kind/branch filters,
  delivery-attempt history, manual retry/cancel, test send, template editing,
  policy editing, and manual reminder processing.
- Owner/Manager notification administration and branch-scoped Front Desk read
  access through API and UI permissions.
- Responsive desktop/mobile behavior, stable table overflow, tests, and audit
  coverage.

### Step 10A User Acceptance Checklist

- [x] Open **Notifications** and confirm the summary, queue mode, templates, and
  reminder policy load.
- [x] Edit a notification template, save it, reload the page, and confirm the
  change persists.
- [x] Change a reminder-policy value, save it, and confirm it persists.
- [x] Use **Test send** without failure simulation and confirm the event becomes
  `DELIVERED` with a delivery attempt.
- [x] Use **Test send** with failure simulation, confirm it becomes `FAILED`,
  then retry it and confirm another attempt is recorded.
- [x] Run reminders twice and confirm the second run does not create duplicate
  reminders for the same source and schedule date.
- [x] Filter notification history by status, kind, branch, and search text.
- [x] Repeat the primary Notifications workflow in a narrow browser window.
- [x] Confirm no real WhatsApp message is expected in Step 10A; all sends use
  the clearly identified simulated provider.

Explicitly deferred to **Step 10B**: direct Meta Cloud API credentials, approved
provider template mapping, real WhatsApp delivery, delivery-status webhooks,
provider rate-limit handling, and a controlled real-message test. Step 10B
planning should begin only after Step 10A acceptance and provider-account
readiness are confirmed.

## Implemented Increment: Step 11A - Core Reports

**Status:** Accepted by the product owner on 2026-09-27.

Implemented deliverables:

- Dedicated operational and financial report permissions with a migration for
  every existing tenant role.
- Member reporting for current status mix, new members, repeat memberships,
  archived-profile context, and memberships expiring in the selected period.
- Revenue reporting for invoiced, collected, outstanding, and overdue amounts,
  payment-method mix, collection trend, and invoice reconciliation.
- Attendance reporting for visits, unique members, daily average, check-in
  source, activity trend, and most-active members.
- Lead reporting for stage/source mix, active pipeline, losses, conversions,
  conversion rate, and follow-up health.
- Server-validated inclusive date filters, a maximum 366-day range, tenant
  isolation, and branch authorization on every aggregation and export query.
- UTF-8 CSV exports that use the same date, branch, status, archive, and void
  exclusions as the visible report.
- Responsive Reports workspace with role-aware tabs, stable visualizations,
  detailed tables, loading/error/empty states, and contained mobile overflow.

### Step 11A User Acceptance Checklist

- [x] Open **Reports** and confirm the available tabs match the signed-in role.
- [x] Change the date range and confirm every metric and table updates.
- [x] Select a branch and confirm all report values are branch-specific.
- [x] Review the Members status mix, new-member count, renewals, and expiring
  membership list.
- [x] Confirm Revenue totals reconcile with Billing for the same date range and
  branch.
- [x] Review payment-method and collection-trend values.
- [x] Review Attendance totals, unique visitors, source mix, trend, and active
  member ranking.
- [x] Review Lead stage/source mix, conversion rate, and follow-up health.
- [x] Download a CSV from each available tab and confirm it matches the active
  filters.
- [x] Enter a range longer than one year and confirm the report explains that
  the maximum range is 366 days.
- [x] Repeat the primary Reports workflow in a narrow browser window.

Explicitly deferred: scheduled report delivery, PDF generation, custom report
builders, saved report presets, cohort and retention analysis, trainer
productivity, comparative branch benchmarking, and AI-generated narratives.

## Implemented Increment: Step 12A - Platform Admin and Tenant Provisioning

**Status:** Engineering complete; pending product-owner acceptance.

Implemented deliverables:

- Separate Platform Administrator accounts, JWT realm, rotating sessions,
  HTTP-only cookies, login, logout, and current-admin endpoints.
- Audited tenant directory with search, status filters, aggregate branch/staff/
  member counts, tenant details, and responsive desktop/mobile layouts.
- Transactional gym provisioning that creates the tenant, first branch,
  standard roles and permissions, and a single-use first-Owner invitation.
- Tenant lifecycle controls for suspension, reactivation, and archival.
  Suspension and archival revoke active tenant sessions and cancel queued
  notifications; inactive tenants cannot accept invitations or sign in.
- First-Owner invitation reissue while no active Owner exists.
- Platform audit history for authentication, provisioning, invitation, and
  lifecycle actions.
- A strict Platform Admin data boundary: platform endpoints expose onboarding
  metadata and aggregate counts, not tenant member, payment, attendance, CRM,
  or report records.
- Local seed support plus explicit production-only Platform Admin secret
  requirements in `.env.example`.

### Step 12A User Acceptance Checklist

Status: **Accepted by product owner on 2026-09-29**

- [x] Open `/platform` and sign in with the locally configured Platform Admin.
- [x] Confirm Pulse Fitness appears with the expected status, branch, staff,
  and member counts.
- [x] Open Pulse Fitness and confirm only tenant onboarding metadata is shown;
  operational member and finance details are not exposed.
- [x] Create a temporary gym with a unique workspace slug and first branch.
- [x] Copy the first-Owner invitation, open it while signed out or in a private
  window, set the Owner password, and sign in to the new workspace.
- [x] Suspend the temporary gym and confirm its active session and new sign-ins
  are rejected.
- [x] Reactivate the gym and confirm its Owner can sign in again.
- [x] Archive the temporary gym and confirm it remains visible as historical
  customer metadata but cannot be used operationally.
- [x] Review Platform audit history and confirm the provisioning and lifecycle
  actions are present.
- [x] Repeat the tenant directory and create-gym form review in a narrow browser
  window.

Explicitly deferred to **Step 12B**: production hosting and HTTPS, managed
secrets, backups and restore drills, CI/CD, monitoring and alerting, rate
limiting, security review, incident/support runbooks, CSV import tooling,
customer SaaS billing, feature entitlements, and controlled support access.

## In Progress: Step 12B.1 - Render Staging Configuration

**Status:** Implemented; pending product-owner deployment review.

Implemented deliverables:

- `render.yaml` Blueprint for a Singapore staging environment with distinct
  public API and web services plus a managed PostgreSQL database.
- Render-compatible API binding using `PORT`, while preserving `API_PORT` for
  local Windows development.
- API health check at `/v1/health` and an idempotent Prisma migration command
  before the staging API starts.
- A minimal first-Platform-Administrator bootstrap that runs after migrations
  without creating demo tenant data or requiring a development gym Owner.
- Explicit frontend-to-API URL and API CORS origin configuration.
- Generated tenant and Platform Admin JWT secrets; Platform Admin credentials
  remain dashboard-only values and are not stored in Git.
- Disabled automatic deploys so the product owner reviews each staging release.
- Repository instructions for creating and validating the staging Blueprint.

### Step 12B.1 Review Checklist

- [ ] Create the staging Blueprint in Render from `render.yaml`.
- [ ] Confirm all resources are located in Singapore.
- [ ] Provide only the requested Platform Admin bootstrap values in Render.
- [ ] Confirm the API health endpoint returns `{"status":"ok"}`.
- [ ] Open the web URL and complete a Platform Admin and Pulse Fitness sign-in.
- [ ] Confirm no local `.env` file or secret appears in the Render Blueprint,
  deploy logs, or repository.
- [ ] Confirm the free database is labelled staging-only and has no customer data.

## Status Update Rules

Update this file at every review checkpoint:

1. Change the relevant implementation status and planning percentage.
2. Record engineering verification results and the verification date.
3. Leave acceptance as pending until the product owner confirms it.
4. Check completed user-acceptance items only after manual confirmation.
5. Add known limitations instead of treating deferred work as complete.
6. Identify exactly one next implementation increment and its boundaries.
