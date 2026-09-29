# Gym Growth OS - Product Owner Manual

Last updated: 2026-09-29
Applies to: Current local MVP through Step 12A

## 1. Purpose of This Manual

This manual explains:

- The difference between the SaaS Product Owner and a Gym Owner.
- What is currently available in the application.
- How a gym owner and gym staff use each module.
- How the product is intended to support multiple gym businesses.
- What is still required before another gym can be safely onboarded.
- How to demonstrate and evaluate the MVP without presenting deferred features
  as complete.

This is a product and operating manual. It does not replace production security,
deployment, backup, support, or legal documentation.

## 2. Product Owner Versus Gym Owner

These are different responsibilities.

### SaaS Product Owner

The SaaS Product Owner is you or your product company. You own and operate Gym
Growth OS as a product that will eventually serve many independent gym
businesses.

The Product Owner should be able to:

- Create and manage gym customer accounts.
- Choose customer subscription plans and enabled features.
- Monitor service usage and operational health.
- Support customers without mixing one gym's data with another gym's data.
- Suspend, reactivate, or cancel a gym subscription.
- Control product configuration, releases, and pricing.

The dedicated Platform Admin portal is available at `/platform`. It is a
separate security realm from every gym workspace.

The planned production product domain is `gymgrowthos.com`. It is a naming
decision only at this stage; domain registration, DNS, and HTTPS configuration
are deferred until the production deployment milestone.

The planned production data region is Singapore. Real gym data will only be
hosted in paid, backed-up PostgreSQL infrastructure after a restore test passes.

Cloudflare R2 is the planned object store for documents and generated files.
The application will use its S3-compatible API, preserving a future migration
path to AWS S3.

Initial production observability will use Sentry for frontend and API error
tracking, paired with Render health checks. Uptime and on-call tooling will be
added separately before public production launch.

Resend is the planned transactional-email provider for Owner and staff
invitations, receipts, and operational notices. Its sender domain, templates,
and API credentials will be configured only during the production-email
increment.

First-year infrastructure planning assumes five gyms, up to three branches and
1,000 members per gym, up to 20 staff accounts per gym, and up to 100,000
documents or receipts in total. The initial infrastructure budget target is
USD 75-150 per month, excluding WhatsApp, payment, and email usage charges.

### Gym Owner

A Gym Owner is a user inside one gym customer account. In the application this
is the `Owner` role.

A Gym Owner can manage their own gym's:

- Branches and membership plans.
- Staff and staff invitations.
- Members and memberships.
- Billing and recorded payments.
- Attendance and QR credentials.
- Leads and follow-ups.
- Notification policies and templates.
- Operational and financial reports.

A Gym Owner must never see another gym customer's data.

## 3. Current MVP Inventory

The current local database contains:

| Item | Current value |
| --- | --- |
| Gym tenants | 1 |
| Active tenant | Pulse Fitness |
| Workspace slug | `pulse-fitness` |
| Branches | 1 (`Indiranagar`) |
| Total user accounts | 2 |
| Users assigned the Owner role | 1 (`Pulse Owner`) |
| Current member profiles | 3 |

Therefore, your understanding is correct: there is currently one gym customer
tenant and one Gym Owner account for Pulse Fitness. There is one additional user
account, but it is not another gym owner or another gym tenant.

The database and authorization model are designed for multiple tenants. However,
only the Pulse Fitness demo tenant is currently provisioned.

## 4. Current Multi-Tenant Readiness

### Already implemented

- Every operational record belongs to a tenant.
- Users belong to a tenant.
- Members, branches, invoices, attendance, leads, notifications, and reports are
  filtered by tenant.
- Non-owner staff are additionally restricted by assigned branches.
- The login screen asks for a workspace slug so the same email address can exist
  in different gym tenants.
- Roles and permissions determine which modules and actions are available.

### Still outstanding

- Automated SaaS subscription billing and plan entitlements.
- Per-tenant feature flags and usage limits.
- Production support and controlled tenant impersonation.
- A repeatable tenant import/onboarding tool.

New gyms must be created through `/platform`, never through ad hoc SQL. Step 12A
creates the data boundary, first branch, standard permissions, and first-Owner
invitation in one transaction with a platform audit record.

## 5. Signing In

1. Open the application URL.
2. Enter the gym's workspace slug. The current demo value is `pulse-fitness`.
3. Enter the user's email and password.
4. Select **Sign in**.

Local development credentials are stored in `.env`. Passwords must not be
written in this manual, screenshots, support tickets, or customer documents.

After sign-in, the navigation only displays modules permitted for the user's
role. A user should sign out when using a shared front-desk computer.

## 6. Owner Workflow

The recommended setup order for a newly provisioned gym is:

1. Confirm gym name, currency, timezone, and workspace slug.
2. Create or confirm branches.
3. Create membership plans.
4. Invite staff and assign their roles and branches.
5. Import or add members.
6. Assign memberships.
7. Review invoices and record opening payments if required.
8. Configure attendance and issue member QR credentials.
9. Configure notification templates and reminder timings.
10. Review reports and reconcile starting totals.

The Platform Admin workflow now supports step 1 and first-Owner provisioning;
the gym Owner completes steps 2 through 10 inside the new workspace.

## 7. Application Modules

### Overview

The Overview provides a daily operating summary:

- Active members.
- Check-ins today.
- Current-month captured revenue.
- Outstanding invoice balance.
- Recent check-ins.
- Follow-ups due for the signed-in user.

Financial totals are hidden from roles without financial access.

### Staff

Use Staff to invite team members and assign their role and branches.

1. Open **Staff**.
2. Create an invitation.
3. Select a role and one or more branches.
4. Give the one-time invitation link to the intended staff member securely.
5. Ask the staff member to open it while signed out or in a private window.
6. The staff member creates a password and signs in.

Owners can disable staff accounts. Invitation delivery is currently manual;
email and WhatsApp invitation delivery are deferred.

### Members

Use Members to manage customer profiles.

- Add contact and emergency-contact information.
- Record gender, height, and weight when provided.
- Assign the member's home branch.
- Search and filter the member directory.
- Add internal notes.
- Review membership and billing history.
- Archive or reactivate a profile.

Archiving preserves history and should be used instead of deleting a member.

### Memberships

Use Memberships to define products and manage membership lifecycles.

- Create and deactivate membership plans.
- Assign a plan to a member.
- Renew a membership.
- Freeze and resume an active membership.
- Cancel a membership with a reason.
- Review memberships approaching expiry.

Membership dates determine operational access. A recorded payment does not by
itself activate or cancel a membership.

### Billing

Use Billing to review invoices and record payments received outside the system.

- Membership sales create invoices automatically.
- Partial payments are supported.
- Receipts can be viewed and printed.
- Outstanding and overdue balances are visible.
- Authorized users can void invoices or reverse incorrectly recorded payments.

The MVP records manual payment methods such as cash, card, UPI, and bank
transfer. Razorpay checkout, gateway webhooks, gateway refunds, and statutory
GST invoices are not yet implemented.

### Attendance

Use Attendance for front-desk admission and visit tracking.

- Search for an eligible member and check them in manually.
- Issue, replace, or revoke a member QR credential.
- Scan a valid member QR code.
- Review check-in history and branch-level attendance summaries.

The system rejects duplicate check-ins inside the configured protection window
and refuses members without an eligible membership. RFID and biometric devices
are not part of the current MVP.

### Leads

Use Leads to manage enquiries until they become members or are lost.

- Create and assign a lead.
- Track pipeline stage and source.
- Add notes and follow-up tasks.
- Complete, cancel, or reassign follow-ups.
- Convert a lead into a member once.
- Archive and reactivate leads without losing history.

Lead scoring, campaigns, public lead forms, and AI follow-up suggestions are
deferred.

### Notifications

Use Notifications to configure and monitor reminder operations.

- Review membership-renewal, payment, and internal lead-reminder templates.
- Configure renewal and payment reminder timing.
- Run the reminder scheduler.
- Review delivery history and attempts.
- Retry or cancel eligible events.
- Run successful or failed test sends.

Important: the current provider is a local simulator. It does not send a real
WhatsApp message. Direct Meta Cloud API delivery, approved provider templates,
delivery webhooks, and provider rate-limit handling belong to Step 10B.

### Reports

Use Reports for operational and financial review.

- Select a date range of up to 366 days.
- Select all accessible branches or one branch.
- Review Members, Revenue, Attendance, and Leads reports.
- Compare metrics, trends, and detailed records.
- Export the currently filtered report as UTF-8 CSV.

Financial reports are restricted to authorized roles. CSV exports apply the
same tenant, branch, date, archive, and void rules as the visible report.

## 8. Role Guide

| Role | Intended use |
| --- | --- |
| Owner | Full administration of one gym tenant, including staff, configuration, finance, notifications, and reports |
| Manager | Daily operations across assigned branches, including CRM, notifications, reports, and limited staff management |
| Front desk | Members, memberships, payments, attendance, leads, notification history, and operational reports for assigned branches |
| Accountant | Billing, payments, financial summaries, and financial reports |
| Trainer | Basic member access only in the current MVP |

Permissions are enforced by both the API and the visible interface. Hiding a
button is not the only security control.

## 9. Multi-Gym Customer Workflow

Each new gym should follow this process:

1. The SaaS Product Owner creates a tenant with a unique workspace slug.
2. The Product Owner selects currency, timezone, subscription plan, limits, and
   enabled features.
3. The platform creates the standard tenant roles and default permissions.
4. The first branch is created.
5. The first Gym Owner receives a single-use invitation.
6. The Gym Owner sets a password and signs in using their own workspace slug.
7. The Gym Owner configures plans and invites their staff.
8. Existing members, balances, and memberships are imported through a validated
   import process.
9. The gym verifies starting totals before going live.
10. The Product Owner monitors onboarding and lifecycle events from the
    Platform Admin portal without unrestricted cross-tenant access.

### Platform Admin procedure

1. Open `http://localhost:3000/platform` in the local environment.
2. Sign in with the Platform Admin credentials configured in `.env`.
3. Select **Create gym** and enter the gym name, unique slug, first branch,
   Owner name/email, plan label, and timezone.
4. Create the gym and securely give the one-time invitation link to its Owner.
5. Ask the Owner to accept the invitation while signed out or in a private
   browser window, then sign in through the normal gym login with the new slug.
6. Open the tenant in Platform Admin to review branches and Owner readiness.
7. Use **Suspend** when access must be stopped temporarily. Active tenant
   sessions are revoked and queued notifications are cancelled.
8. Use **Reactivate** to restore access after the business decision is approved.
9. Use **Archive** only when the customer relationship is closed. Archival is
   non-destructive but blocks operational access.
10. Review **Audit history** after every onboarding or lifecycle change.

Platform Admin credentials must not be given to gym Owners. The portal exposes
tenant setup metadata and aggregate counts, not member, payment, attendance,
lead, notification, or report records.

Example future workspaces could be:

- `pulse-fitness`
- `northside-strength`
- `central-yoga-club`

Each workspace would have separate users, branches, members, invoices,
attendance, leads, notifications, and reports.

## 10. Using the Current MVP With Prospective Gym Owners

The current safe use is product demonstration and controlled pilot evaluation.

### Demonstration procedure

1. Use the Pulse Fitness demo workspace.
2. Explain that names and transactions are demonstration data.
3. Demonstrate one complete member journey:
   - Create a lead.
   - Convert the lead to a member.
   - Assign a membership.
   - Review the invoice.
   - Record a payment.
   - Issue a QR credential and check in.
   - Review notifications and reports.
4. Demonstrate staff roles and branch restrictions.
5. Clearly identify simulated WhatsApp delivery and manual payments.
6. Record the prospective customer's required integrations, reports, branches,
   import volume, and pricing expectations.

### Do not promise yet

- Self-service creation of a new gym.
- Production hosting, uptime, backups, or disaster recovery.
- Real Razorpay processing.
- Real WhatsApp sending.
- Biometric or RFID device support.
- A member mobile application.
- Automated customer subscription billing.
- Cross-tenant Platform Admin reports.

Do not enter a prospective customer's real member or payment data into the
Pulse demo workspace. Their data must wait for a separately provisioned and
secured tenant.

## 11. Recommended Next Product Increment

Step 12A Platform Admin and Tenant Provisioning is accepted. The next increment
is **Step 12B: Production
Readiness**, covering deployment, HTTPS, managed secrets, backups and restore
tests, CI/CD, monitoring, rate limiting, security review, runbooks, and an
initial validated CSV import workflow. Do not onboard a real paying gym until
those controls are implemented and accepted.

## 12. Local Development Operation

The current application runs locally and requires PostgreSQL.

From the project root, a stable Windows review session uses two terminals.

API terminal:

```powershell
.\node_modules\.bin\dotenv.cmd -e .env -- pnpm --filter @gym/api start
```

Web terminal:

```powershell
.\node_modules\.bin\dotenv.cmd -e .env -- pnpm --filter @gym/web dev
```

Open:

```text
http://localhost:3000
http://localhost:3000/platform
```

Use `Ctrl+C` in each terminal to stop the services. PostgreSQL may remain
running unless database maintenance is required.

Before a review release, run:

```powershell
pnpm test
pnpm build
```

## 13. Security and Data-Handling Rules

- Never share `.env` files or passwords.
- Never reuse the Pulse development password for another gym or production.
- Never put two independent gyms inside one tenant as separate branches.
- A branch belongs to one gym business; a tenant represents the customer data
  boundary.
- Give staff the minimum role and branch access required.
- Disable staff promptly when they leave a gym.
- Do not edit financial or attendance history directly in PostgreSQL.
- Do not create a tenant through incomplete manual database statements.
- Use test data until production hosting, backups, monitoring, and security
  review are complete.

## 14. Current Production Readiness Warning

The current application is an accepted local MVP, not a production SaaS
service. The following remain outstanding:

- Production deployment and HTTPS.
- Automated CI/CD.
- Backups and restore testing.
- Monitoring, alerting, and error tracking.
- Rate limiting and production Redis strategy.
- Secrets management and credential rotation.
- Product-owner acceptance of Platform Admin provisioning.
- Customer subscription billing.
- Data import tooling and validation.
- Privacy, retention, support, and operational policies.
- Production security review and penetration testing.

The product should not hold real customer data or be sold as production-ready
until these controls have been planned, implemented, and accepted.
