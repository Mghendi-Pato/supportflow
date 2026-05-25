# SupportFlow

> A modern multi-tenant client support portal SaaS for freelancers, agencies, POS developers, and SMEs.

## Project Structure

```
nubian_support/
├── docs/                        # Architecture docs, schema references
├── backend/                     # NestJS API
│   ├── prisma/                  # Prisma schema + migrations
│   └── src/
│       ├── modules/             # Feature modules (auth, tickets, clients…)
│       ├── common/              # Guards, decorators, filters, interceptors
│       ├── prisma/              # PrismaService
│       └── config/              # App configuration
└── frontend/                    # Next.js app
    └── src/
        ├── app/                 # App Router pages
        │   ├── (auth)/          # Login, register, invite flows
        │   ├── (dashboard)/     # Admin/agent workspace views
        │   └── (client-portal)/ # Client-facing portal views
        ├── components/          # Shared UI components
        ├── hooks/               # Custom React hooks
        ├── lib/                 # API client, utils
        └── types/               # TypeScript types
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT (access + refresh tokens) |
| File Storage | Cloudinary |
| Email | Resend |
| Deployment | Docker + VPS |

## Roles

| Role | Scope |
|---|---|
| Super Admin | Platform-wide (you) |
| Workspace Admin | Full control of their tenant/workspace |
| Agent | Handles tickets within a workspace |
| Client | Submits and tracks their own tickets |

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env        # Fill in your credentials
npm install
npx prisma migrate dev      # Run DB migrations
npm run start:dev           # Start NestJS dev server (port 3001)
```

### Frontend
```bash
cd frontend
cp .env.example .env.local  # Fill in your credentials
npm install
npm run dev                 # Start Next.js dev server (port 3000)
```

## Development Phases

- **Phase 1 (MVP):** Auth, tenants, clients, tickets, notifications, analytics — *current focus*
- **Phase 2:** WhatsApp, email-to-ticket, knowledge base, SLA, billing
- **Phase 3:** AI features, live chat, mobile apps, automation

---

*See `docs/` for full database schema, API contract, and architecture decisions.*
