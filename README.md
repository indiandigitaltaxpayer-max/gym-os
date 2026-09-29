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
