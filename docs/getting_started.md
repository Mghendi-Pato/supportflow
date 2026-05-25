# SupportFlow — Getting Started (Local Development)

## Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL)
- A Cloudinary account (free tier works)
- A Resend account (free tier works — 3,000 emails/month)

---

## Step 1 — Start PostgreSQL

```bash
# From the project root
docker-compose -f docker-compose.dev.yml up -d

# PostgreSQL will be available at localhost:5432
# Adminer (DB UI) at http://localhost:8080
#   Server: postgres | User: postgres | Password: postgres | DB: supportflow_db
```

---

## Step 2 — Configure Backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supportflow_db

JWT_ACCESS_SECRET=<generate-a-random-32-char-string>
JWT_REFRESH_SECRET=<generate-a-different-random-32-char-string>

CLOUDINARY_CLOUD_NAME=<your-cloudinary-cloud-name>
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>

RESEND_API_KEY=re_<your-resend-key>
RESEND_FROM_EMAIL=support@yourdomain.com

FRONTEND_URL=http://localhost:3000
```

**Generate JWT secrets quickly:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 3 — Install & Migrate

```bash
cd backend
npm install

# Create database tables from Prisma schema
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed with demo data
npm run db:seed
```

After seeding, you'll have these test accounts:

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@supportflow.app | Admin@1234! |
| Workspace Admin | owner@demoagency.com | Owner@1234! |
| Agent | agent@demoagency.com | Agent@1234! |
| Client | client@acmepos.com | Client@1234! |

---

## Step 4 — Start Backend

```bash
npm run start:dev
# API: http://localhost:3001/api/v1
# Swagger: http://localhost:3001/api/docs
```

---

## Step 5 — Configure Frontend

```bash
cd ../frontend
cp .env.example .env.local
```

`.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=SupportFlow
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm install
npm run dev
# Frontend: http://localhost:3000
```

---

## Useful Commands

```bash
# Backend
npm run start:dev       # Start with hot reload
npm run db:studio       # Open Prisma Studio (visual DB browser)
npm run db:seed         # Re-seed demo data
npm run db:reset        # Reset DB and re-run all migrations
npx prisma migrate dev  # Create new migration after schema change

# Docker
docker-compose -f docker-compose.dev.yml up -d    # Start dev DB
docker-compose -f docker-compose.dev.yml down     # Stop dev DB
docker-compose up --build                          # Full production stack
```

---

## API Quick Test

```bash
# 1. Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demoagency.com","password":"Owner@1234!"}'

# 2. Use the returned accessToken in subsequent requests
TOKEN="<paste-accessToken-here>"

# 3. Get dashboard
curl http://localhost:3001/api/v1/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"

# 4. List tickets
curl http://localhost:3001/api/v1/tickets \
  -H "Authorization: Bearer $TOKEN"
```

---

## Project Structure

```
nubian_support/
├── docs/                        ← Architecture docs
│   ├── database_schema.md
│   ├── api_reference.md
│   └── getting_started.md      ← you are here
├── backend/                     ← NestJS API
│   ├── prisma/
│   │   ├── schema.prisma        ← Database schema (source of truth)
│   │   └── seed.ts              ← Demo data seed
│   └── src/
│       ├── main.ts              ← App bootstrap
│       ├── app.module.ts        ← Root module
│       ├── prisma/              ← PrismaService (global)
│       ├── common/
│       │   ├── guards/          ← JwtAuthGuard, RolesGuard, TenantGuard
│       │   ├── decorators/      ← @Public(), @Roles(), @CurrentUser()
│       │   ├── filters/         ← Global HTTP exception filter
│       │   └── interceptors/    ← Global response wrapper
│       └── modules/
│           ├── auth/            ← Register, login, refresh, invite
│           ├── tenants/         ← Workspace management
│           ├── users/           ← Profile + super admin controls
│           ├── clients/         ← Client CRUD + portal invites
│           ├── tickets/         ← Full ticket lifecycle
│           ├── notifications/   ← In-app + email notifications
│           ├── uploads/         ← Cloudinary file management
│           └── analytics/       ← Dashboard metrics
└── frontend/                    ← Next.js (App Router)
    └── src/
        ├── app/
        │   ├── (auth)/          ← /login, /register, /invite
        │   ├── (dashboard)/     ← Admin/agent views
        │   └── (client-portal)/ ← Client portal views
        ├── components/          ← Shared UI
        ├── hooks/               ← Custom React hooks
        ├── lib/api.ts           ← Axios client + interceptors
        └── types/index.ts       ← All TypeScript types
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ | Secret for signing access tokens (15m expiry) |
| `JWT_REFRESH_SECRET` | ✅ | Secret for signing refresh tokens (7d expiry) |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `RESEND_API_KEY` | ✅ | Resend API key (`re_...`) |
| `RESEND_FROM_EMAIL` | ✅ | Sender email address |
| `RESEND_FROM_NAME` | ⬜ | Sender display name (default: SupportFlow) |
| `FRONTEND_URL` | ✅ | Frontend URL for CORS + invite links |
| `PORT` | ⬜ | API port (default: 3001) |
| `NODE_ENV` | ⬜ | `development` or `production` |
