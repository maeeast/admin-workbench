# Admin Workbench

A production-like admin dashboard that demonstrates senior-level UI architecture and API design: server-side pagination/filtering/sorting, accessible interactions, strong loading/empty/error states, tests, and CI. Built with Next.js, TypeScript, Postgres, Prisma, TanStack Table, and Zod.

## Demo

- Live: _TBD_
- Demo GIF: _TBD_

![Demo GIF](./docs/demo.gif)

---

## What this project showcases

- **Production-like data UI**: server-side pagination, filtering, sorting (not “toy app” client filtering)
- **UX that holds up**: URL-persisted state, responsive layout, clear empty/error/loading states
- **Accessibility**: keyboard navigation, focus management, aria labels
- **Contracts**: validated input and consistent API responses
- **Quality**: tests that prove behavior + CI that enforces it
- **Deployment**: GitHub → Vercel + Neon Postgres

---

## Features

### Dashboard
- KPI cards (7/30 day views)
- Charts: events over time, errors by type
- Global filters (date range, environment) persisted in the URL

### Events Explorer
- Server-side pagination (`page`, `pageSize`)
- Server-side filtering (status/type/source/date range/search)
- Server-side sorting (`sort=occurredAt:desc`)
- Row details drawer with JSON payload viewer + copy

### Users & Roles (demo-grade RBAC)
- Roles: `admin`, `analyst`, `viewer`
- Admin can create/deactivate users and manage roles
- Audit log records admin actions

### Audit Log
- Paginated + filterable log of admin actions
- Useful for demonstrating “operational thinking”

---

## Tech Stack

- **Next.js (App Router)** + **React** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Postgres** (Neon for production, Docker for local)
- **Prisma** (schema + migrations + seed)
- **TanStack Table** (data table UX)
- **Recharts** (charts)
- **Zod** (API input validation)
- **iron-session** (signed-cookie sessions, demo auth)
- **Jest / RTL** (unit + component tests)
- **Playwright** (E2E tests)
- **GitHub Actions** (CI)

---

## Architecture

```mermaid
flowchart LR
  U[Browser] -->|HTTPS| N[Next.js App (Vercel)]
  N -->|Route Handlers| API[API Routes]
  API --> DB[(Postgres: Neon / Local Docker)]
  N --> UI[UI Components]
```

### Key design decisions

- **Server-side data operations**: pagination/filtering/sorting happens in the API to keep the UI scalable.
- **URL-driven state**: filters and table state are encoded in query params for shareable links.
- **Consistent API shape** for list endpoints:
  ```ts
  { data, page, pageSize, total, totalPages }
  ```
- **Demo auth with RBAC**: minimal implementation that still enforces roles server-side.

---

## Data model (high level)

- `events`: time-series operational/admin data (status/type/source/payload)
- `users`, `roles`, `user_roles`: access control
- `audit_log`: records administrative actions

See: `prisma/schema.prisma`

---

## Local development

### Prerequisites
- Node 18+ (or 20+ recommended)
- Docker Desktop

### 1) Clone + install
```bash
git clone https://github.com/<your-handle>/admin-workbench.git
cd admin-workbench
npm install
```

### 2) Start local Postgres
```bash
docker compose up -d
```

### 3) Configure environment
Create `.env.local` (use `.env.example` as a starting point):
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/admin_workbench"
SESSION_PASSWORD="change-me-to-32+chars-min"
```

### 4) Run migrations + seed
```bash
npm run db:migrate
npm run db:seed
```

### 5) Start the app
```bash
npm run dev
```

Open: http://localhost:3000

---

## Scripts

```bash
npm run dev          # run locally
npm run build        # production build
npm run start        # run production server
npm run lint         # lint
npm run typecheck    # TS checks
npm run format       # prettier

npm run test         # unit/component tests (Jest)
npm run test:e2e     # Playwright

npm run db:migrate   # prisma migrate dev
npm run db:deploy    # prisma migrate deploy
npm run db:seed      # seed sample data
npm run db:studio    # prisma studio
```

---

## Testing

### Unit + component tests
```bash
npm run test
```

### E2E tests (Playwright)
```bash
npm run test:e2e
```

Suggested E2E flows:
- Filter events to `status=error` → open details drawer → copy payload
- Change date range → KPIs and charts update

---

## Accessibility

This project aims to be keyboard-usable and screen-reader friendly:
- Visible focus states
- Table controls labeled with aria attributes
- Drawer focus trap + escape handling
- Logical heading structure and tab order

Checklist: `docs/a11y-checklist.md`

---

## CI

GitHub Actions runs on PR:
- Lint
- Typecheck
- Unit tests
- Build
- (Optional) E2E tests

Add badge once CI is set up:
```md
![CI](https://github.com/<your-handle>/admin-workbench/actions/workflows/ci.yml/badge.svg)
```

---

## Deployment

### Vercel + Neon Postgres

1. Create a Neon database and copy the connection string.
2. Create a Vercel project from this GitHub repo.
3. Add env vars in Vercel:
   - `DATABASE_URL`
   - `SESSION_PASSWORD`
4. Deploy.

---

## Roadmap / future improvements

- Saved views (named filter presets)
- CSV export (server-generated)
- Cursor-based pagination for large datasets
- Rate limiting + security headers
- Observability (structured logs and dashboards)

---

## License

MIT
