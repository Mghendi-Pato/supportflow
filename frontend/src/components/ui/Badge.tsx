import { clsx } from 'clsx';
import type { TicketStatus, TicketPriority } from '@/types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

const variants = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger:  'bg-red-100 text-red-800',
  info:    'bg-blue-100 text-blue-800',
  purple:  'bg-purple-100 text-purple-800',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variants[variant]
      )}
    >
      {children}
    </span>
  );
}

const statusConfig: Record<TicketStatus, { label: string; variant: BadgeProps['variant'] }> = {
  OPEN:        { label: 'Open',        variant: 'info' },
  IN_PROGRESS: { label: 'Ongoing',     variant: 'warning' },
  WAITING:     { label: 'Waiting',     variant: 'purple' },
  FIXED:       { label: 'Fixed',       variant: 'success' },
  CLOSED:      { label: 'Closed',      variant: 'default' },
};

const priorityConfig: Record<TicketPriority, { label: string; variant: BadgeProps['variant'] }> = {
  LOW:      { label: 'Low',      variant: 'default' },
  MEDIUM:   { label: 'Medium',   variant: 'info' },
  HIGH:     { label: 'High',     variant: 'warning' },
  CRITICAL: { label: 'Critical', variant: 'danger' },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = statusConfig[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const cfg = priorityConfig[priority];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

/** Shows "Paid" (green) or "Free" (gray) based on the ticket.isPaid flag */
export function PaidBadge({ isPaid }: { isPaid: boolean }) {
  return isPaid
    ? <Badge variant="success">💳 Paid</Badge>
    : <Badge variant="default">Free</Badge>;
}
