# SupportFlow – Database Schema Reference

**Version:** MVP 1.0  
**Database:** PostgreSQL  
**ORM:** Prisma  
**Multi-tenancy strategy:** Shared database + `tenant_id` on every scoped table  

---

## Architecture Overview

Every piece of data that belongs to a workspace is scoped by a `tenant_id`. This means all queries for workspace-level data **must** include a `WHERE tenant_id = :currentTenantId` clause. In NestJS, this is enforced via a tenant guard that extracts the tenant from the JWT and injects it into every service call.

There are **11 tables** in the MVP schema:

| Table | Purpose |
|---|---|
| `users` | All authenticated users (super admins, workspace staff, clients) |
| `tenants` | Workspaces/organizations — one per freelancer or agency |
| `tenant_members` | Links workspace admins and agents to a tenant |
| `clients` | Client entities belonging to a tenant, with optional login |
| `tenant_ticket_sequences` | Per-tenant counter for generating `SUP-1042`-style ticket IDs |
| `tickets` | Core support tickets |
| `ticket_comments` | Public replies and internal-only notes on tickets |
| `ticket_attachments` | Files uploaded to tickets or comments (via Cloudinary) |
| `ticket_activity_logs` | Immutable audit trail of every action on a ticket |
| `notifications` | In-app + email notification records |
| `tenant_invitations` | Secure invite tokens for onboarding agents and clients |

---

## Entity Relationships

```
tenants
  ├── tenant_members         (workspace_admin, agent — m:n with users)
  ├── clients                (1:many — clients belong to one tenant)
  │     └── users            (1:1 optional — client's login account)
  ├── tickets                (1:many — all tickets belong to one tenant)
  │     ├── ticket_comments  (1:many — public replies + internal notes)
  │     ├── ticket_attachments (1:many — files on ticket or comment)
  │     ├── ticket_activity_logs (1:many — immutable audit trail)
  │     └── notifications    (1:many — per-event notification records)
  ├── tenant_invitations     (1:many — invite tokens for staff and clients)
  └── tenant_ticket_sequences (1:1 — ticket ID counter per tenant)
```

---

## Table Definitions

### `users`

All authenticated users on the platform. Role is derived from context, not a single column.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | VARCHAR | Unique across the platform |
| `password_hash` | TEXT | Bcrypt hash |
| `first_name` | VARCHAR | |
| `last_name` | VARCHAR | |
| `avatar_url` | TEXT | Optional Cloudinary URL |
| `platform_role` | ENUM | `SUPER_ADMIN` or `MEMBER` |
| `is_active` | BOOLEAN | False = account suspended |
| `email_verified_at` | TIMESTAMP | Null = not yet verified |
| `last_login_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | **Soft delete** |

**Role resolution:**
- `platform_role = SUPER_ADMIN` → platform owner
- `tenant_members.role = WORKSPACE_ADMIN` → workspace admin
- `tenant_members.role = AGENT` → support agent
- Has a `clients` record linked via `user_id` → client

---

### `tenants`

One record per workspace.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | VARCHAR | Display name e.g. "Acme Agency" |
| `slug` | VARCHAR | Unique e.g. `acme-agency` |
| `plan` | ENUM | `FREE`, `PRO`, `AGENCY` |
| `is_active` | BOOLEAN | False = suspended |
| `logo_url` | TEXT | Optional |
| `settings` | JSONB | Workspace config |
| `owner_id` | UUID | FK → `users.id` |
| `created_at` / `updated_at` / `deleted_at` | TIMESTAMP | |

---

### `tenant_members`

Links workspace admins and agents to a tenant.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK → `tenants.id` |
| `user_id` | UUID | FK → `users.id` |
| `role` | ENUM | `WORKSPACE_ADMIN` or `AGENT` |
| `invited_by` | UUID | FK → `users.id` |
| `invited_at` / `joined_at` | TIMESTAMP | |
| `is_active` | BOOLEAN | |

**Unique:** `(tenant_id, user_id)`

---

### `clients`

Client entities. `user_id` is null until they accept their invite and set a password.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK → `tenants.id` |
| `user_id` | UUID | FK → `users.id` (nullable) |
| `company_name` | VARCHAR | Optional |
| `contact_name` | VARCHAR | |
| `email` | VARCHAR | Unique per tenant |
| `phone` | VARCHAR | Optional |
| `notes` | TEXT | Internal — **never shown to client** |
| `is_active` | BOOLEAN | |
| `invited_at` / `onboarded_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | Soft delete |

**Unique:** `(tenant_id, email)`

---

### `tenant_ticket_sequences`

Per-tenant atomic counter for `SUP-1042` style IDs.

| Column | Type | Notes |
|---|---|---|
| `tenant_id` | UUID | PK + FK → `tenants.id` |
| `prefix` | VARCHAR | Default `SUP` |
| `current_value` | INTEGER | Atomically incremented |

```ts
// Always use atomic SQL — never increment in application code
await prisma.$queryRaw`
  UPDATE tenant_ticket_sequences
  SET current_value = current_value + 1
  WHERE tenant_id = ${tenantId}
  RETURNING prefix, current_value
`;
```

---

### `tickets`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK → `tenants.id` |
| `ticket_number` | VARCHAR | e.g. `SUP-1042` |
| `client_id` | UUID | FK → `clients.id` |
| `assigned_to` | UUID | FK → `users.id` (nullable) |
| `title` | VARCHAR(500) | |
| `description` | TEXT | |
| `status` | ENUM | `OPEN`, `IN_PROGRESS`, `WAITING`, `FIXED`, `CLOSED` |
| `priority` | ENUM | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `created_by_user_id` | UUID | FK → `users.id` |
| `created_by_type` | VARCHAR | `"client"` or `"agent"` |
| `closed_at` | TIMESTAMP | Set when status = CLOSED |
| `deleted_at` | TIMESTAMP | **Soft delete — never hard delete** |

**Unique:** `(tenant_id, ticket_number)`

---

### `ticket_comments`

Public replies (client sees) and internal notes (staff only) in one table.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `tenant_id` | UUID | |
| `ticket_id` | UUID | |
| `author_user_id` | UUID | |
| `content` | TEXT | |
| `comment_type` | ENUM | `PUBLIC` or `INTERNAL` |
| `deleted_at` | TIMESTAMP | Soft delete |

> When serving to a client: always filter `WHERE comment_type = 'PUBLIC'`

---

### `ticket_attachments`

Files stored in Cloudinary, linked to a ticket or comment.

| Column | Type | Notes |
|---|---|---|
| `ticket_id` | UUID | |
| `comment_id` | UUID | Nullable — null = ticket-level |
| `file_url` | TEXT | Cloudinary delivery URL |
| `public_id` | TEXT | Cloudinary ID (for deletion) |
| `file_size_bytes` | INTEGER | Max 10,485,760 (10MB) |
| `mime_type` | VARCHAR | MVP: images + PDFs only |

---

### `ticket_activity_logs`

Immutable audit trail — never updated or deleted.

| Column | Type | Notes |
|---|---|---|
| `action` | ENUM | See below |
| `from_value` | TEXT | e.g. `"OPEN"` |
| `to_value` | TEXT | e.g. `"IN_PROGRESS"` |
| `metadata` | JSONB | Extra context |

**Actions:** `TICKET_CREATED`, `TICKET_CLOSED`, `TICKET_REOPENED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `ASSIGNED`, `UNASSIGNED`, `COMMENT_ADDED`, `INTERNAL_NOTE_ADDED`, `ATTACHMENT_ADDED`, `CLIENT_INVITED`

---

### `notifications`

| Column | Type | Notes |
|---|---|---|
| `type` | ENUM | See triggers below |
| `is_read` | BOOLEAN | In-app bell state |
| `email_sent` | BOOLEAN | Whether Resend fired |
| `email_sent_at` | TIMESTAMP | |

**MVP triggers:**

| Type | Recipients |
|---|---|
| `TICKET_CREATED` | Workspace admin + assigned agent + client (confirmation) |
| `TICKET_ASSIGNED` | Assigned agent |
| `NEW_COMMENT` | All participants except comment author |
| `STATUS_CHANGED` | Client + assigned agent |
| `TICKET_CLOSED` | Client + workspace admin |
| `CLIENT_INVITED` | Invited client |

---

### `tenant_invitations`

| Column | Type | Notes |
|---|---|---|
| `token` | VARCHAR | Unique secure token (in invite link) |
| `role` | ENUM | `WORKSPACE_ADMIN`, `AGENT`, `CLIENT` |
| `expires_at` | TIMESTAMP | 7 days from creation |
| `accepted_at` | TIMESTAMP | Stamped on registration |

---

## Key Guards (NestJS)

```ts
// 1. Always scope by tenant
where: { tenantId: currentUser.tenantId, deletedAt: null }

// 2. Hide internal notes from clients
if (currentUser.role === 'CLIENT') {
  where.commentType = 'PUBLIC';
}

// 3. Soft deletes always
where: { deletedAt: null }
```

---

## MVP Analytics Queries

```sql
-- Total / Open / Closed tickets
SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND deleted_at IS NULL;
SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'OPEN' AND deleted_at IS NULL;
SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status = 'CLOSED' AND deleted_at IS NULL;

-- Average resolution time (hours)
SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600)
FROM tickets WHERE tenant_id = $1 AND closed_at IS NOT NULL AND deleted_at IS NULL;

-- By status
SELECT status, COUNT(*) FROM tickets WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY status;

-- Per client
SELECT c.contact_name, COUNT(t.id) FROM tickets t
JOIN clients c ON t.client_id = c.id
WHERE t.tenant_id = $1 AND t.deleted_at IS NULL
GROUP BY c.id ORDER BY 2 DESC;
```
