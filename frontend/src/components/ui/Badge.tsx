import { clsx } from 'clsx';
import type { TicketStatus, TicketPriority } from '@/types';
import { Tooltip } from './Tooltip';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
  tooltip?: string;
}

const variants = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  tooltip,
}: BadgeProps) {
  const badge = (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        tooltip && 'cursor-default',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variants[variant],
      )}
    >
      {children}
    </span>
  );

  if (tooltip) {
    return <Tooltip text={tooltip}>{badge}</Tooltip>;
  }
  return badge;
}

// ── Status ────────────────────────────────────────────────────────────────────

const statusConfig: Record<
  TicketStatus,
  {
    label: string;
    variant: BadgeProps['variant'];
    tooltip: string;
  }
> = {
  OPEN: {
    label: 'Open',
    variant: 'info',
    tooltip: 'Ticket is open and awaiting action',
  },
  IN_PROGRESS: {
    label: 'Ongoing',
    variant: 'warning',
    tooltip: 'Your ticket is being actively worked on',
  },
  WAITING: {
    label: 'Waiting',
    variant: 'purple',
    tooltip: 'Waiting for more information or a response',
  },
  FIXED: {
    label: 'Fixed',
    variant: 'success',
    tooltip: 'The issue has been resolved',
  },
  CLOSED: {
    label: 'Closed',
    variant: 'default',
    tooltip: 'This ticket is closed',
  },
};

export function StatusBadge({
  status,
  showTooltip = false,
}: {
  status: TicketStatus;
  showTooltip?: boolean;
}) {
  const cfg = statusConfig[status];
  return (
    <Badge
      variant={cfg.variant}
      tooltip={showTooltip ? cfg.tooltip : undefined}
    >
      {cfg.label}
    </Badge>
  );
}

// ── Priority ──────────────────────────────────────────────────────────────────

const priorityConfig: Record<
  TicketPriority,
  {
    label: string;
    variant: BadgeProps['variant'];
    tooltip: string;
  }
> = {
  LOW: {
    label: 'Low',
    variant: 'default',
    tooltip: 'Low priority — no immediate urgency',
  },
  MEDIUM: {
    label: 'Medium',
    variant: 'info',
    tooltip: 'Medium priority — moderate impact on operations',
  },
  HIGH: {
    label: 'High',
    variant: 'warning',
    tooltip: 'High priority — significant impact, needs prompt attention',
  },
  CRITICAL: {
    label: 'Critical',
    variant: 'danger',
    tooltip: 'Critical — business operations are blocked',
  },
};

export function PriorityBadge({
  priority,
  showTooltip = false,
}: {
  priority: TicketPriority;
  showTooltip?: boolean;
}) {
  const cfg = priorityConfig[priority];
  return (
    <Badge
      variant={cfg.variant}
      tooltip={showTooltip ? cfg.tooltip : undefined}
    >
      {cfg.label}
    </Badge>
  );
}

// ── Paid ──────────────────────────────────────────────────────────────────────

export function PaidBadge({
  isPaid,
  showTooltip = false,
}: {
  isPaid: boolean;
  showTooltip?: boolean;
}) {
  return isPaid ? (
    <Badge
      variant="success"
      tooltip={
        showTooltip ? 'A payment has been made for this ticket' : undefined
      }
    >
      {' '}
      Paid
    </Badge>
  ) : (
    <Badge
      variant="default"
      tooltip={
        showTooltip
          ? 'No payment has been requested for this ticket'
          : undefined
      }
    >
      Free
    </Badge>
  );
}
