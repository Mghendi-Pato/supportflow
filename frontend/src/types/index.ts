// ============================================================
// SupportFlow – Shared TypeScript Types
// ============================================================

// --- Auth ---

export interface JwtPayload {
  sub: string;        // user id
  email: string;
  platformRole: 'SUPER_ADMIN' | 'MEMBER';
  tenantId: string | null;
  role: UserRole;     // resolved role within tenant context
}

export type UserRole = 'SUPER_ADMIN' | 'WORKSPACE_ADMIN' | 'AGENT' | 'CLIENT';

// --- Users ---

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  platformRole: 'SUPER_ADMIN' | 'MEMBER';
  isActive: boolean;
  createdAt: string;
}

// --- Tenants ---

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'AGENCY';
  isActive: boolean;
  logoUrl: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
}

// --- Clients ---

export interface Client {
  id: string;
  tenantId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  invitedAt: string | null;
  onboardedAt: string | null;
  createdAt: string;
}

// --- Tickets ---

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'FIXED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TicketAttachment {
  id: string;
  ticketId: string;
  commentId: string | null;
  fileName: string;
  fileUrl: string;   // backend field name
  url?: string;      // legacy alias kept for safety
  fileSizeBytes: number;
  mimeType: string;
  createdAt: string;
}

export type CommentType = 'PUBLIC' | 'INTERNAL';

export interface TicketComment {
  id: string;
  ticketId: string;
  authorUserId: string;
  author: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  content: string;
  commentType: CommentType;
  attachments: TicketAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  tenantId: string;
  ticketNumber: string;   // e.g. "SUP-1042"
  clientId: string;
  client: Pick<Client, 'id' | 'contactName' | 'companyName'>;
  assignedTo: string | null;
  assignee: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  isPaid: boolean;
  createdByType: 'client' | 'agent';
  assignedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Included on detail view
  comments?: TicketComment[];
  attachments?: TicketAttachment[];
}

// --- Activity Logs ---

export type ActivityAction =
  | 'TICKET_CREATED'
  | 'TICKET_CLOSED'
  | 'TICKET_REOPENED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'COMMENT_ADDED'
  | 'INTERNAL_NOTE_ADDED'
  | 'ATTACHMENT_ADDED'
  | 'CLIENT_INVITED';

export interface TicketActivityLog {
  id: string;
  ticketId: string;
  actorUserId: string;
  actor: Pick<User, 'id' | 'firstName' | 'lastName'>;
  action: ActivityAction;
  fromValue: string | null;
  toValue: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// --- Notifications ---

export type NotificationType =
  | 'TICKET_CREATED'
  | 'TICKET_ASSIGNED'
  | 'NEW_COMMENT'
  | 'STATUS_CHANGED'
  | 'TICKET_CLOSED'
  | 'CLIENT_INVITED';

export interface Notification {
  id: string;
  ticketId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// --- Analytics ---

export interface DashboardSummary {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  avgResolutionHours: number | null;
}

export interface DashboardAnalytics {
  summary: DashboardSummary;
  byStatus: { status: TicketStatus; count: number; label: string }[];
  byClient: {
    clientId: string;
    contactName: string;
    companyName: string;
    ticketCount: number;
  }[];
  recentTickets: Ticket[];
}

// --- API Responses ---

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}
