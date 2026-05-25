# SupportFlow — API Reference

**Base URL:** `http://localhost:3001/api/v1`  
**Auth:** All endpoints require `Authorization: Bearer <accessToken>` unless marked `[PUBLIC]`.  
**Swagger UI:** `http://localhost:3001/api/docs` (dev/staging only)

---

## Auth — `/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | PUBLIC | Create workspace + owner account |
| POST | `/auth/login` | PUBLIC | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | PUBLIC | Rotate access token with refresh token |
| POST | `/auth/logout` | Bearer | Revoke refresh token |
| POST | `/auth/invite/accept` | PUBLIC | Accept invite, create account |
| GET | `/auth/me` | Bearer | Current user profile + role + tenant |

### Register
```json
POST /auth/register
{
  "firstName": "Patrick",
  "lastName": "Mwamburi",
  "email": "patrick@agency.com",
  "password": "SecurePass123!",
  "workspaceName": "Demo Agency",
  "workspaceSlug": "demo-agency"
}
```

### Login
```json
POST /auth/login
{ "email": "patrick@agency.com", "password": "SecurePass123!" }
```
Response: `{ accessToken, refreshToken, user, tenant }`

### Accept Invite
```json
POST /auth/invite/accept
{ "token": "<invite-token>", "firstName": "Sarah", "lastName": "Otieno", "password": "..." }
```

---

## Workspace — `/workspace`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/workspace` | Admin, Agent | Get workspace details |
| PATCH | `/workspace` | Admin | Update name, logo, settings |
| GET | `/workspace/members` | Admin, Agent | List all staff members |
| POST | `/workspace/members/invite` | Admin | Invite agent or admin |
| DELETE | `/workspace/members/:userId` | Admin | Remove a member |
| GET | `/workspace/invitations` | Admin | List pending invitations |
| DELETE | `/workspace/invitations/:id` | Admin | Revoke a pending invitation |

### Invite Member
```json
POST /workspace/members/invite
{ "email": "agent@agency.com", "role": "AGENT" }
// role: "AGENT" | "WORKSPACE_ADMIN"
```

---

## Clients — `/clients`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/clients` | Admin | Create client |
| GET | `/clients` | Admin, Agent | List clients (paginated + search) |
| GET | `/clients/:id` | Admin, Agent, Client | Get client profile + recent tickets |
| PATCH | `/clients/:id` | Admin | Update client details |
| DELETE | `/clients/:id` | Admin | Soft-delete (blocked if open tickets) |
| POST | `/clients/:id/invite` | Admin | Send portal invitation email |
| POST | `/clients/:id/invite/resend` | Admin | Resend / refresh expired invite |

### Create Client
```json
POST /clients
{
  "contactName": "James Kariuki",
  "email": "james@acmepos.com",
  "companyName": "Acme POS Solutions",
  "phone": "+254712345678",
  "notes": "Internal notes — not shown to client"
}
```

### List Clients (Query Params)
```
GET /clients?page=1&limit=20&search=acme&isActive=true
```

---

## Tickets — `/tickets`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/tickets` | Admin, Agent, **Client** | Create ticket |
| GET | `/tickets` | All | List tickets (clients see own only) |
| GET | `/tickets/:id` | All | Get ticket (UUID or `SUP-1042`) |
| PATCH | `/tickets/:id` | Admin, Agent | Update title / description / priority |
| PATCH | `/tickets/:id/status` | Admin, Agent | Change status (fires notifications) |
| PATCH | `/tickets/:id/assign` | Admin, Agent | Assign / unassign agent |
| DELETE | `/tickets/:id` | Admin | Soft-delete |
| POST | `/tickets/:id/comments` | All | Add reply or internal note |
| PATCH | `/tickets/:id/comments/:cId` | Author, Admin | Edit comment |
| DELETE | `/tickets/:id/comments/:cId` | Author, Admin | Delete comment |
| GET | `/tickets/:id/activity` | All | Full audit trail |

### Create Ticket (Agent on behalf of client)
```json
POST /tickets
{
  "title": "Receipt printer not responding",
  "description": "After v2.1.4 update, printer times out...",
  "clientId": "uuid-of-client",
  "priority": "HIGH",
  "assignedTo": "uuid-of-agent"
}
// clientId required for agents; omit for clients (auto-resolved)
```

### Create Ticket (Client)
```json
POST /tickets
{
  "title": "Cannot log in to manager portal",
  "description": "Getting invalid credentials error since yesterday...",
  "priority": "MEDIUM"
}
```

### Change Status
```json
PATCH /tickets/:id/status
{
  "status": "IN_PROGRESS",
  "note": "Reproduced — working on fix"  // optional internal note
}
// status: OPEN | IN_PROGRESS | WAITING | FIXED | CLOSED
```

### Add Comment / Internal Note
```json
POST /tickets/:id/comments
{
  "content": "We have identified the root cause.",
  "commentType": "PUBLIC"   // PUBLIC | INTERNAL (clients cannot use INTERNAL)
}
```

### List Tickets (Query Params)
```
GET /tickets?page=1&limit=20&status=OPEN&priority=HIGH&clientId=uuid&search=SUP-10
```

---

## Uploads — `/uploads`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/uploads/tickets/:ticketId` | All | Upload attachment (multipart) |
| GET | `/uploads/tickets/:ticketId` | All | List ticket attachments |
| DELETE | `/uploads/attachments/:id` | Uploader, Admin | Delete attachment |
| POST | `/uploads/avatar` | All | Upload profile avatar |
| POST | `/uploads/logo` | Admin | Upload workspace logo |

**File limits:** Max 10MB per ticket attachment. Images (JPEG, PNG, GIF, WebP) + PDF only.  
**Avatar/Logo:** Max 2MB. JPEG, PNG, WebP (logo also accepts SVG).

```bash
# Example: upload attachment with curl
curl -X POST http://localhost:3001/api/v1/uploads/tickets/<ticketId> \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/screenshot.png"

# Optional: attach to a specific comment
curl -X POST ".../uploads/tickets/<ticketId>?commentId=<commentId>" ...
```

---

## Notifications — `/notifications`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/notifications` | All | Paginated list + unread count |
| PATCH | `/notifications/read` | All | Mark specific notifications as read |
| PATCH | `/notifications/read-all` | All | Mark all as read |

### Response shape
```json
{
  "data": [...],
  "total": 42,
  "unreadCount": 5,
  "page": 1,
  "limit": 20
}
```

---

## Analytics — `/analytics`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/analytics/dashboard` | All | Summary + status chart + per-client + recent tickets |
| GET | `/analytics/trend?days=30` | Admin, Agent | Daily created vs closed trend |
| GET | `/analytics/agent-workload` | Admin | Per-agent ticket counts by status |

### Dashboard Response
```json
{
  "summary": {
    "totalTickets": 42,
    "openTickets": 18,
    "closedTickets": 20,
    "avgResolutionHours": 14.5
  },
  "byStatus": [
    { "status": "OPEN", "count": 18, "label": "Open" },
    { "status": "IN_PROGRESS", "count": 4, "label": "Ongoing" },
    ...
  ],
  "byClient": [
    { "clientId": "...", "contactName": "James Kariuki", "companyName": "Acme POS", "ticketCount": 28 }
  ],
  "recentTickets": [...]
}
```

---

## Users — `/users`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/users/me` | All | Own profile |
| PATCH | `/users/me` | All | Update name |
| PATCH | `/users/me/password` | All | Change password (revokes sessions) |
| GET | `/users/workspace-members` | Admin, Agent | Members list (for assignment dropdowns) |
| GET | `/users` | **Super Admin** | All platform users |
| DELETE | `/users/:id` | **Super Admin** | Deactivate a user |
| GET | `/users/tenants` | **Super Admin** | All workspaces |
| PATCH | `/users/tenants/:id/suspend` | **Super Admin** | Suspend workspace |
| PATCH | `/users/tenants/:id/reinstate` | **Super Admin** | Reinstate workspace |

---

## Response Envelope

All successful responses are wrapped:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-05-24T10:30:00.000Z"
}
```

All errors return:
```json
{
  "statusCode": 400,
  "message": "A client with this email already exists in your workspace",
  "error": "Bad Request",
  "timestamp": "2026-05-24T10:30:00.000Z",
  "path": "/api/v1/clients"
}
```

---

## Ticket Statuses & Transitions

```
OPEN → IN_PROGRESS → WAITING → FIXED → CLOSED
         ↑___________________________|  (can reopen from CLOSED → OPEN)
```

## Ticket Priorities
`LOW` · `MEDIUM` · `HIGH` · `CRITICAL`

## Notification Types
`TICKET_CREATED` · `TICKET_ASSIGNED` · `NEW_COMMENT` · `STATUS_CHANGED` · `TICKET_CLOSED` · `CLIENT_INVITED`
