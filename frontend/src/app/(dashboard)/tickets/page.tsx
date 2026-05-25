'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Link from 'next/link';
import { formatDistanceToNow, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { Plus, Search, Ticket, ArrowRight } from 'lucide-react';

// MUI — @mui/material is already installed
import { ToggleButton, ToggleButtonGroup, Collapse, TextField } from '@mui/material';

import { DashboardNavbar } from '@/components/layout/DashboardNavbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge, PriorityBadge, PaidBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { AttachmentStager, type StagedFile } from '@/components/ui/AttachmentStager';
import { useAuth } from '@/hooks/useAuth';
import { useNotify, errMsg } from '@/hooks/useNotify';
import api from '@/lib/api';
import type { Ticket as TicketType, PaginatedResponse, Client } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

// ACTIVE is a frontend-only sentinel: maps to OPEN+IN_PROGRESS+WAITING with no date filter.
const STATUS_OPTIONS = [
  { value: 'ACTIVE',      label: 'Active (Open + Ongoing + Waiting)' },
  { value: '',            label: 'All Statuses' },
  { value: 'OPEN',        label: 'Open' },
  { value: 'IN_PROGRESS', label: 'Ongoing' },
  { value: 'WAITING',     label: 'Waiting' },
  { value: 'FIXED',       label: 'Fixed' },
  { value: 'CLOSED',      label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: '',         label: 'All Priorities' },
  { value: 'LOW',      label: 'Low' },
  { value: 'MEDIUM',   label: 'Medium' },
  { value: 'HIGH',     label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

function getPresetRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  switch (preset) {
    case 'today': return { from: iso(startOfDay(now)),                         to: iso(endOfDay(now)) };
    case 'week':  return { from: iso(startOfWeek(now, { weekStartsOn: 1 })),   to: iso(endOfDay(now)) };
    case 'month': return { from: iso(startOfMonth(now)),                       to: iso(endOfDay(now)) };
    case 'year':  return { from: iso(startOfYear(now)),                        to: iso(endOfDay(now)) };
    default:      return {};
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { user } = useAuth();
  const notify = useNotify();
  const qc = useQueryClient();

  // Filters — default to ACTIVE (Open + Ongoing + Waiting, no date limit)
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('ACTIVE');
  const [priority, setPriority] = useState('');
  const [page,     setPage]     = useState(1);

  // Date range — disabled for ACTIVE and OPEN (always show all, no time limit)
  const [preset,     setPreset]     = useState<DatePreset>('today');
  const [customFrom, setCustomFrom] = useState('');   // 'YYYY-MM-DD'
  const [customTo,   setCustomTo]   = useState('');   // 'YYYY-MM-DD'

  // Create ticket modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', clientId: '' });
  const [formError, setFormError] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  // ACTIVE and OPEN are always date-independent (no missing tickets over time)
  const dateRangeDisabled = status === 'ACTIVE' || status === 'OPEN';

  const dateRange = useMemo(() => {
    if (dateRangeDisabled) return {};
    if (preset === 'custom') {
      return {
        from: customFrom ? new Date(customFrom + 'T00:00:00').toISOString() : undefined,
        to:   customTo   ? new Date(customTo   + 'T23:59:59').toISOString() : undefined,
      };
    }
    return getPresetRange(preset);
  }, [dateRangeDisabled, preset, customFrom, customTo]);

  // Build query string
  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) p.set('search', search);
    if (status === 'ACTIVE') {
      p.set('statuses', 'OPEN,IN_PROGRESS,WAITING');
    } else if (status) {
      p.set('status', status);
    }
    if (priority)        p.set('priority', priority);
    if (dateRange.from)  p.set('from',     dateRange.from);
    if (dateRange.to)    p.set('to',       dateRange.to);
    return p.toString();
  }, [page, search, status, priority, dateRange]);

  const { data, isLoading } = useQuery(
    ['tickets', params],
    async () => {
      const res = await api.get(`/tickets?${params}`);
      return res.data.data as PaginatedResponse<TicketType>;
    },
    { keepPreviousData: true }
  );

  const { data: clients } = useQuery(
    'clients-list',
    async () => {
      const res = await api.get('/clients?limit=100');
      return res.data.data.data as Client[];
    },
    { enabled: showCreate }
  );

  const createMutation = useMutation(
    async () => {
      if (!form.title.trim()) { setFormError('Title is required'); return; }
      setFormError('');
      setUploadProgress(null);

      // 1 — create the ticket
      const res = await api.post('/tickets', form);
      const ticketId: string = res.data.data.id;

      // 2 — upload staged files one by one
      if (stagedFiles.length > 0) {
        setUploadProgress({ done: 0, total: stagedFiles.length });
        for (let i = 0; i < stagedFiles.length; i++) {
          const fd = new FormData();
          fd.append('file', stagedFiles[i].file);
          await api.post(`/uploads/tickets/${ticketId}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          setUploadProgress({ done: i + 1, total: stagedFiles.length });
        }
      }
    },
    {
      onSuccess: () => {
        qc.invalidateQueries('tickets');
        setShowCreate(false);
        setForm({ title: '', description: '', priority: 'MEDIUM', clientId: '' });
        setStagedFiles([]);
        setUploadProgress(null);
        setFormError('');
        notify.success('Ticket created');
      },
      onError: (err: unknown) => {
        setUploadProgress(null);
        const msg = errMsg(err, 'Failed to create ticket');
        setFormError(msg);
        notify.error(msg);
      },
    }
  );

  const isAdmin = user?.role === 'WORKSPACE_ADMIN' || user?.role === 'SUPER_ADMIN';

  const handlePresetChange = (_: React.MouseEvent, value: DatePreset | null) => {
    if (!value) return;
    setPreset(value);
    setPage(1);
    if (value !== 'custom') { setCustomFrom(''); setCustomTo(''); }
  };

  return (
    <div className="flex flex-col h-full">
        <DashboardNavbar
          title="Tickets"
          actions={
            isAdmin ? (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={16} /> New Ticket
              </Button>
            ) : null
          }
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── Filters row ── */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                placeholder="Search tickets…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Status */}
            <div className="w-44">
              <Select
                options={STATUS_OPTIONS}
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              />
            </div>

            {/* Priority */}
            <div className="w-44">
              <Select
                options={PRIORITY_OPTIONS}
                value={priority}
                onChange={(e) => { setPriority(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* ── Date range row ── */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Date range:</span>
            <ToggleButtonGroup
              value={preset}
              exclusive
              onChange={handlePresetChange}
              size="small"
              disabled={dateRangeDisabled}
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
                  '&.Mui-disabled': {
                    opacity: 0.4,
                  },
                },
              }}
            >
              <ToggleButton value="today">Today</ToggleButton>
              <ToggleButton value="week">This week</ToggleButton>
              <ToggleButton value="month">This month</ToggleButton>
              <ToggleButton value="year">This year</ToggleButton>
              <ToggleButton value="custom">Custom range</ToggleButton>
            </ToggleButtonGroup>
            {dateRangeDisabled && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                Date range ignored — all {status === 'ACTIVE' ? 'active' : 'open'} tickets are always shown
              </span>
            )}
          </div>

          {/* ── Custom date inputs ── */}
          <Collapse in={preset === 'custom'}>
            <div className="flex flex-wrap items-center gap-3 pb-1">
              <TextField
                label="From"
                type="date"
                size="small"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: customTo || undefined } }}
                sx={{
                  width: 175,
                  '& .MuiInputBase-root': { fontFamily: 'inherit', fontSize: '0.875rem' },
                  '& .MuiInputLabel-root': { fontFamily: 'inherit', fontSize: '0.875rem' },
                }}
              />
              <span className="text-gray-400 text-sm">→</span>
              <TextField
                label="To"
                type="date"
                size="small"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: customFrom || undefined } }}
                sx={{
                  width: 175,
                  '& .MuiInputBase-root': { fontFamily: 'inherit', fontSize: '0.875rem' },
                  '& .MuiInputLabel-root': { fontFamily: 'inherit', fontSize: '0.875rem' },
                }}
              />
              {(customFrom || customTo) && (
                <button
                  onClick={() => { setCustomFrom(''); setCustomTo(''); setPage(1); }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </Collapse>

          {/* ── Table ── */}
          <Card padding={false}>
            {isLoading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : !data?.data?.length ? (
              <EmptyState
                icon={Ticket}
                title="No tickets found"
                description={status === 'ACTIVE' ? 'No active tickets right now — all clear!' : status === 'OPEN' ? 'No open tickets right now.' : 'Try adjusting your filters.'}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Paid</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Assignee</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Assigned</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Created</th>
                        <th className="px-4 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.data.map((ticket) => {
                        const assigneeName = ticket.assignee
                          ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`.trim()
                          : null;

                        return (
                          <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 font-mono text-xs text-gray-400">
                              <Link href={`/tickets/${ticket.id}`} className="hover:text-primary-600">
                                {ticket.ticketNumber}
                              </Link>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                              <Link href={`/tickets/${ticket.id}`} className="hover:text-primary-600">
                                {ticket.title}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-gray-800 font-medium text-xs">{ticket.client?.companyName ?? '—'}</p>
                                {ticket.client?.contactName && (
                                  <p className="text-gray-400 text-xs">{ticket.client.contactName}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                            <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                            <td className="px-4 py-3"><PaidBadge isPaid={ticket.isPaid} /></td>
                            <td className="px-4 py-3">
                              {assigneeName ? (
                                <span className="text-gray-700 text-xs">{assigneeName}</span>
                              ) : (
                                <span className="text-gray-400 italic text-xs">Unassigned</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {ticket.assignedAt
                                ? formatDistanceToNow(new Date(ticket.assignedAt), { addSuffix: true })
                                : <span className="italic">—</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                              {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/tickets/${ticket.id}`}
                                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center justify-center"
                                title="Open ticket"
                              >
                                <ArrowRight size={15} />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.total > 20 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data.total)} of {data.total}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" disabled={page === 1}               onClick={() => setPage(p => p - 1)}>Prev</Button>
                      <Button variant="secondary" size="sm" disabled={page * 20 >= data.total}  onClick={() => setPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </main>

        {/* ── Create Ticket Modal ── */}
        <Modal
          isOpen={showCreate}
          onClose={() => {
            if (createMutation.isLoading) return; // block close while uploading
            setShowCreate(false);
            setStagedFiles([]);
            setUploadProgress(null);
            setFormError('');
          }}
          title="New Ticket"
          size="md"
        >
          <div className="space-y-4">
            <Input
              label="Title"
              placeholder="Briefly describe the issue"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <Textarea
              label="Description"
              placeholder="Provide details about the issue…"
              rows={4}
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <Select
              label="Priority"
              options={[
                { value: 'LOW',      label: 'Low' },
                { value: 'MEDIUM',   label: 'Medium' },
                { value: 'HIGH',     label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
              value={form.priority}
              onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
            />
            {clients && (
              <Select
                label="Client"
                placeholder="Select a client…"
                options={clients.map(c => ({ value: c.id, label: c.companyName ?? c.contactName }))}
                value={form.clientId}
                onChange={(e) => setForm(f => ({ ...f, clientId: e.target.value }))}
              />
            )}

            {/* Multi-file attachment stager */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Attachments
                <span className="ml-1.5 text-xs font-normal text-gray-400">(optional)</span>
              </p>
              <AttachmentStager
                files={stagedFiles}
                onChange={setStagedFiles}
                maxBytes={10 * 1024 * 1024}
              />
            </div>

            {/* Upload progress bar */}
            {uploadProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-blue-600">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    Uploading {uploadProgress.done} of {uploadProgress.total} attachment{uploadProgress.total !== 1 ? 's' : ''}…
                  </span>
                  <span>{Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {formError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{formError}</div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                disabled={createMutation.isLoading}
                onClick={() => {
                  setShowCreate(false);
                  setStagedFiles([]);
                  setUploadProgress(null);
                  setFormError('');
                }}
              >
                Cancel
              </Button>
              <Button isLoading={createMutation.isLoading} onClick={() => createMutation.mutate()}>
                {createMutation.isLoading
                  ? (uploadProgress ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…` : 'Creating…')
                  : `Create Ticket${stagedFiles.length > 0 ? ` + ${stagedFiles.length} file${stagedFiles.length !== 1 ? 's' : ''}` : ''}`
                }
              </Button>
            </div>
          </div>
        </Modal>
      </div>
  );
}
