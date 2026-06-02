'use client';
import { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import Link from 'next/link';
import {
  formatDistanceToNow,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
} from 'date-fns';
import { Ticket, Plus, Bell } from 'lucide-react';

// MUI — already installed (@mui/material)
import {
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  TextField,
} from '@mui/material';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge, PaidBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { Ticket as TicketType, PaginatedResponse } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter =
  | ''
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'FIXED'
  | 'CLOSED';
type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

// These statuses always show all tickets regardless of the active date range
const DATE_AGNOSTIC = new Set<StatusFilter>(['OPEN', 'IN_PROGRESS', 'WAITING']);

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'Ongoing' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'FIXED', label: 'Fixed' },
  { value: 'CLOSED', label: 'Closed' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(d: Date) {
  return d.toISOString();
}

/** Strip HTML tags for safe plain-text preview snippets. */
function stripHtml(html: string): string {
  if (!html) return '';
  // Replace block-level tags with a space so words don't run together
  return html
    .replace(/<\/(p|li|h[1-6]|blockquote|div)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPresetRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: toISO(startOfDay(now)), to: toISO(endOfDay(now)) };
    case 'week':
      return {
        from: toISO(startOfWeek(now, { weekStartsOn: 1 })),
        to: toISO(endOfDay(now)),
      };
    case 'month':
      return { from: toISO(startOfMonth(now)), to: toISO(endOfDay(now)) };
    default:
      return {};
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalPage() {
  const { user } = useAuth();

  // Status filter — defaults to OPEN
  const [status, setStatus] = useState<StatusFilter>('OPEN');
  const [page, setPage] = useState(1);

  // Date range — default "today"; OPEN status always ignores date range
  const [preset, setPreset] = useState<DatePreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────

  // Unread notifications → build a Set of ticketIds that have activity
  const { data: notifData } = useQuery(
    'portal-unread-notifications',
    async () => {
      const res = await api.get('/notifications?limit=100');
      return res.data.data?.data as Array<{ ticketId: string | null; isRead: boolean }>;
    },
    { staleTime: 30_000 },
  );

  const unreadTicketIds = useMemo<Set<string>>(() => {
    if (!notifData) return new Set();
    return new Set(
      notifData
        .filter((n) => !n.isRead && n.ticketId)
        .map((n) => n.ticketId as string),
    );
  }, [notifData]);

  // Unfiltered query — used for the stats row (accurate per-status totals)
  const { data: allData } = useQuery(
    'portal-ticket-stats',
    async () => {
      const res = await api.get('/tickets?limit=100');
      return res.data.data as PaginatedResponse<TicketType>;
    },
    { staleTime: 30_000 },
  );

  // Date range — skipped for Open / Ongoing / Waiting so active tickets
  // are always visible regardless of which date preset is active.
  const dateRange = useMemo(() => {
    if (DATE_AGNOSTIC.has(status)) return {};
    if (preset === 'custom') {
      return {
        from: customFrom
          ? new Date(customFrom + 'T00:00:00').toISOString()
          : undefined,
        to: customTo
          ? new Date(customTo + 'T23:59:59').toISOString()
          : undefined,
      };
    }
    return getPresetRange(preset);
  }, [status, preset, customFrom, customTo]);

  const queryKey = [
    'portal-tickets',
    page,
    status,
    preset,
    customFrom,
    customTo,
  ];

  const { data, isLoading } = useQuery(
    queryKey,
    async () => {
      const p = new URLSearchParams({ page: String(page), limit: '15' });
      if (status) p.set('status', status);
      if (dateRange.from) p.set('from', dateRange.from);
      if (dateRange.to) p.set('to', dateRange.to);
      const res = await api.get(`/tickets?${p}`);
      return res.data.data as PaginatedResponse<TicketType>;
    },
    { keepPreviousData: true },
  );

  // ── Stat counts (from unfiltered data — accurate up to 100 tickets) ───────
  const statCounts = useMemo(() => {
    const all = allData?.data ?? [];
    return Object.fromEntries(
      STATUS_TABS.map((s) => [
        s.value,
        all.filter((t) => t.status === s.value).length,
      ]),
    ) as Record<StatusFilter, number>;
  }, [allData]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePresetChange = (_: React.MouseEvent, val: DatePreset | null) => {
    if (!val) return;
    setPreset(val);
    setPage(1);
    if (val !== 'custom') {
      setCustomFrom('');
      setCustomTo('');
    }
  };

  const handleStatusCard = (s: StatusFilter) => {
    setStatus((prev) => (prev === s ? '' : s)); // toggle: click active card → show all
    setPage(1);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hello, {user?.firstName}!
          </h1>
          <p className="text-gray-500 mt-1">Here are your support tickets.</p>
        </div>
        <Link href="/portal/new">
          <Button>
            <Plus size={16} /> New Ticket
          </Button>
        </Link>
      </div>

      {/* ── Stats row — clickable to filter ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUS_TABS.map((s) => {
          const active = status === s.value;
          return (
            <button
              key={s.value}
              onClick={() => handleStatusCard(s.value as StatusFilter)}
              className={`rounded-xl border p-4 text-center transition-all focus:outline-none ${
                active
                  ? 'border-primary-400 bg-primary-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-primary-200 hover:bg-primary-50/40'
              }`}
            >
              <p
                className={`text-2xl font-bold ${active ? 'text-primary-700' : 'text-gray-900'}`}
              >
                {statCounts[s.value as StatusFilter] ?? 0}
              </p>
              <p
                className={`text-xs mt-1 ${active ? 'text-primary-600 font-medium' : 'text-gray-500'}`}
              >
                {s.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Date preset bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
          Date range:
        </span>
        <ToggleButtonGroup
          value={preset}
          exclusive
          onChange={handlePresetChange}
          size="small"
          disabled={DATE_AGNOSTIC.has(status)}
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontSize: '0.75rem',
              fontFamily: 'inherit',
              px: 1.5,
              py: 0.5,
              borderColor: '#e5e7eb',
              color: '#6b7280',
              '&.Mui-selected': {
                backgroundColor: '#6366f1',
                color: '#fff',
                '&:hover': { backgroundColor: '#4f46e5' },
              },
              '&.Mui-disabled': { opacity: 0.4 },
            },
          }}
        >
          <ToggleButton value="today">Today</ToggleButton>
          <ToggleButton value="week">This week</ToggleButton>
          <ToggleButton value="month">This month</ToggleButton>
          <ToggleButton value="custom">Custom</ToggleButton>
        </ToggleButtonGroup>
        {DATE_AGNOSTIC.has(status) && (
          <span className="text-xs text-amber-600">
            Showing all tickets — date filter doesn't apply here
          </span>
        )}
      </div>

      {/* ── Custom date pickers ── */}
      <Collapse in={preset === 'custom'}>
        <div className="flex flex-wrap items-center gap-3 pb-1">
          <TextField
            label="From"
            type="date"
            size="small"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setPage(1);
            }}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { max: customTo || undefined },
            }}
            sx={{
              width: 175,
              '& .MuiInputBase-root': {
                fontFamily: 'inherit',
                fontSize: '0.875rem',
              },
              '& .MuiInputLabel-root': {
                fontFamily: 'inherit',
                fontSize: '0.875rem',
              },
            }}
          />
          <span className="text-gray-400 text-sm">→</span>
          <TextField
            label="To"
            type="date"
            size="small"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              setPage(1);
            }}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: customFrom || undefined },
            }}
            sx={{
              width: 175,
              '& .MuiInputBase-root': {
                fontFamily: 'inherit',
                fontSize: '0.875rem',
              },
              '& .MuiInputLabel-root': {
                fontFamily: 'inherit',
                fontSize: '0.875rem',
              },
            }}
          />
          {(customFrom || customTo) && (
            <button
              onClick={() => {
                setCustomFrom('');
                setCustomTo('');
                setPage(1);
              }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </Collapse>

      {/* ── Ticket list ── */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : !data?.data?.length ? (
        <Card>
          <EmptyState
            icon={Ticket}
            title={
              DATE_AGNOSTIC.has(status)
                ? `No ${status === 'OPEN' ? 'open' : status === 'IN_PROGRESS' ? 'ongoing' : 'waiting'} tickets`
                : 'No tickets found'
            }
            description={
              DATE_AGNOSTIC.has(status)
                ? "You're all caught up! Submit a new ticket if you need help."
                : 'Try a different status or date range.'
            }
            action={
              DATE_AGNOSTIC.has(status) ? (
                <Link href="/portal/new">
                  <Button>
                    <Plus size={16} /> Submit a ticket
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.data.map((ticket) => {
            const hasUnread = unreadTicketIds.has(ticket.id);
            return (
              <Link key={ticket.id} href={`/portal/tickets/${ticket.id}`}>
                <Card className={`hover:border-primary-200 hover:shadow-md transition-all cursor-pointer ${hasUnread ? 'border-amber-300 bg-amber-50/40' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">
                          {ticket.ticketNumber}
                        </span>
                        <PriorityBadge priority={ticket.priority} showTooltip />
                        <PaidBadge isPaid={ticket.isPaid} showTooltip />
                        {/* Unread activity flag */}
                        {hasUnread && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            New activity
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {ticket.title}
                      </h3>
                      {ticket.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {stripHtml(ticket.description)}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {formatDistanceToNow(new Date(ticket.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusBadge status={ticket.status} showTooltip />
                      {hasUnread && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <Bell size={12} className="shrink-0" />
                          <span className="text-[11px]">Unread updates</span>
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}

          {/* Pagination */}
          {data.total > 15 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-400">
                Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, data.total)}{' '}
                of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page * 15 >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
