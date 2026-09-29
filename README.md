# Gym Growth OS

Multi-tenant SaaS for gym operations, member retention, and revenue growth.

## First milestone

The initial vertical slice supports tenant and branch setup, membership plans,
member enrollment, payments, check-ins, and an operational dashboard.

## Local setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL. Docker is optional; Redis is not required for the local
   MVP because notifications can use the PostgreSQL-backed queue.
3. Install dependencies with `pnpm install`.
4. Run `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:seed`.
5. Start both applications with `pnpm dev`.

Web: `http://localhost:3000`  
Platform Admin: `http://localhost:3000/platform`
API: `http://localhost:4000/v1`  
API documentation: `http://localhost:4000/docs`

See [`outputs/agent.md`](outputs/agent.md) for the product and delivery brief.
See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for implementation progress,
verification evidence, acceptance checklists, and the next review checkpoint.

## Render staging deployment

The repository includes a staging-only Render Blueprint in `render.yaml`. It
creates separate web and API services plus a Render Postgres database in the
Singapore region. The Blueprint is intentionally configured with
`autoDeploy: false` so every staging deployment is reviewed in Render first.

1. In Render, select **New > Blueprint** and choose this repository and the
   `step-12a-platform-admin` branch.
2. Review the three staging resources and enter values when Render requests
   `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD`. These create the
   first Platform Administrator only; no demo tenant or gym Owner is seeded.
3. Apply the Blueprint, then wait for the database, API, and web deploys to
   complete. Open `/v1/health` on the API URL before opening the web URL.
4. Update `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL` only if Render assigns names
   different from the names declared in the Blueprint; save and redeploy both
   affected services after changing them.

The free staging database is temporary: it expires after 30 days and does not
provide backups. Do not use it for real customer data or production service.
Production resources, backups, monitoring, and paid pre-deploy migrations are
part of the later Step 12B production release.
