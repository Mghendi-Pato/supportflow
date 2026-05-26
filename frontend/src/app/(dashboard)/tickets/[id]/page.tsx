'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowLeft, DollarSign, CheckCircle2, ShieldCheck, Clock, Download,
} from 'lucide-react';
import { DashboardNavbar } from '@/components/layout/DashboardNavbar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { AttachmentPreview, downloadAllAsZip } from '@/components/ui/AttachmentPreview';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import dynamic from 'next/dynamic';

// Loaded browser-only: ChatPanel uses WebSocket subscriptions and Apollo hooks
// that must not execute during Next.js SSR.
const ChatPanel = dynamic(
  () => import('@/components/chat/ChatPanel').then((m) => ({ default: m.ChatPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-10">
        <Spinner size="sm" />
      </div>
    ),
  },
);
import { useAuth } from '@/hooks/useAuth';
import { useNotify, errMsg } from '@/hooks/useNotify';
import api from '@/lib/api';
import type { Ticket, User as UserType } from '@/types';

const STATUS_OPTIONS = [
  { value: 'OPEN',        label: 'Open' },
  { value: 'IN_PROGRESS', label: 'Ongoing' },
  { value: 'WAITING',     label: 'Waiting' },
  { value: 'FIXED',       label: 'Fixed' },
  { value: 'CLOSED',      label: 'Closed' },
];
const PRIORITY_OPTIONS = [
  { value: 'LOW',      label: 'Low' },
  { value: 'MEDIUM',   label: 'Medium' },
  { value: 'HIGH',     label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

interface BillingRequest {
  id: string;
  amount: string;
  currency: string;
  description: string;
  status: 'AWAITING_APPROVAL' | 'PENDING' | 'ACCEPTED' | 'DECLINED';
  requestedBy: { firstName: string; lastName: string };
  createdAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  declineReason?: string;
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const notify = useNotify();
  const qc = useQueryClient();

  // Close-ticket confirmation
  const [pendingStatus,   setPendingStatus]   = useState<string | null>(null);
  // Assignee — hold change locally until "Save" is clicked
  const [pendingAssignee, setPendingAssignee] = useState<string | undefined>(undefined);

  // Billing request modal
  const [showBilling, setShowBilling]   = useState(false);
  const [billingForm, setBillingForm]   = useState({ amount: '', currency: 'KES', description: '' });
  const [billingError, setBillingError] = useState('');

  // Send Request active only when amount is a valid positive number and description is filled
  const billingValid =
    billingForm.description.trim().length > 0 &&
    /^\d+(\.\d+)?$/.test(billingForm.amount.trim()) &&
    parseFloat(billingForm.amount) > 0;

  const { data: ticket, isLoading } = useQuery<Ticket>(
    ['ticket', id],
    async () => { const res = await api.get(`/tickets/${id}`); return res.data.data; }
  );

  const { data: billingRequests } = useQuery<BillingRequest[]>(
    ['billing', id],
    async () => { const res = await api.get(`/billing-requests?ticketId=${id}`); return res.data.data; },
    { enabled: !!id }
  );

  const { data: members } = useQuery<UserType[]>(
    'workspace-members',
    async () => { const res = await api.get('/users/workspace-members'); return res.data.data; }
  );

  // Sync pendingAssignee when ticket data arrives or changes
  useEffect(() => {
    if (ticket) setPendingAssignee(ticket.assignedTo ?? '');
  }, [ticket?.assignedTo]); // eslint-disable-line

  const changeStatus = useMutation(
    async (status: string) => {
      await api.patch(`/tickets/${id}/status`, { status });
      return status; // pass through so onSuccess can read it
    },
    {
      onSuccess: (status) => {
        qc.invalidateQueries(['ticket', id]);
        qc.invalidateQueries('tickets');
        notify.success(`Status changed to ${status.replace('_', ' ').toLowerCase()}`);
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to update status')),
    }
  );

  const changePriority = useMutation(
    async (priority: string) => {
      await api.patch(`/tickets/${id}`, { priority });
      return priority;
    },
    {
      onSuccess: (priority) => {
        qc.invalidateQueries(['ticket', id]);
        qc.invalidateQueries('tickets');
        notify.success(`Priority set to ${priority.toLowerCase()}`);
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to update priority')),
    }
  );

  const assignTicket = useMutation(
    async (assignedTo: string | null) => { await api.patch(`/tickets/${id}/assign`, { assignedTo }); },
    {
      onSuccess: () => {
        qc.invalidateQueries(['ticket', id]);
        qc.invalidateQueries('tickets');
        notify.success('Assignee updated');
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to assign ticket')),
    }
  );

  const approveBillingRequest = useMutation(
    async (billingId: string) => { await api.patch(`/billing-requests/${billingId}/approve`); },
    {
      onSuccess: () => {
        qc.invalidateQueries(['billing', id]);
        notify.success('Billing request approved and sent to client');
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to approve billing request')),
    }
  );

  const createBillingRequest = useMutation(
    async () => {
      if (!billingForm.amount || !billingForm.description) { setBillingError('Amount and description are required'); return; }
      await api.post('/billing-requests', {
        ticketId: id,
        amount: parseFloat(billingForm.amount),
        currency: billingForm.currency,
        description: billingForm.description,
      });
      setShowBilling(false);
      setBillingForm({ amount: '', currency: 'KES', description: '' });
      setBillingError('');
    },
    {
      onSuccess: () => {
        qc.invalidateQueries(['billing', id]);
        notify.success('Payment request submitted');
      },
      onError: (err: unknown) => {
        const msg = errMsg(err, 'Failed to send billing request');
        setBillingError(msg);
        notify.error(msg);
      },
    }
  );

  const isAdmin = user?.role === 'WORKSPACE_ADMIN' || user?.role === 'SUPER_ADMIN';
  const isStaff = isAdmin || user?.role === 'AGENT';

  if (isLoading) return <div className="flex flex-col h-full"><div className="flex justify-center items-center flex-1"><Spinner size="lg" /></div></div>;
  if (!ticket) return null;

  return (
    <div className="flex flex-col h-full">
      <DashboardNavbar
        title={ticket.ticketNumber}
        actions={<Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft size={16} /> Back</Button>}
      />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Main ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Ticket info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="text-xs text-gray-400">
                  Opened {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                </span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-3">{ticket.title}</h1>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Billing request cards */}
            {billingRequests && billingRequests.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800 text-sm">Payment Requests</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {billingRequests.map((b) => {
                    const isAwaiting = b.status === 'AWAITING_APPROVAL';
                    const borderColor = isAwaiting ? 'border-amber-400' : 'border-blue-400';
                    const bgColor     = isAwaiting ? 'bg-amber-50'      : 'bg-blue-50';
                    return (
                      <div key={b.id} className={`px-6 py-4 ${bgColor} border-l-4 ${borderColor}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center ${isAwaiting ? 'bg-amber-200' : 'bg-blue-200'}`}>
                            {isAwaiting
                              ? <Clock size={13} className="text-amber-700" />
                              : <DollarSign size={13} className="text-blue-700" />
                            }
                          </div>
                          <span className={`text-sm font-semibold ${isAwaiting ? 'text-amber-800' : 'text-blue-800'}`}>
                            {isAwaiting ? 'Billing Request — Awaiting Approval' : 'Billing Request'}
                          </span>
                          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                            b.status === 'ACCEPTED'          ? 'bg-green-100 text-green-700' :
                            b.status === 'DECLINED'          ? 'bg-red-100 text-red-700'   :
                            b.status === 'AWAITING_APPROVAL' ? 'bg-amber-100 text-amber-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {b.status === 'AWAITING_APPROVAL' ? 'Needs Approval' : b.status}
                          </span>
                        </div>
                        <div className="ml-9">
                          <p className="text-sm font-bold text-gray-900">{b.currency} {Number(b.amount).toLocaleString()}</p>
                          <p className="text-sm text-gray-600 mt-0.5">{b.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Submitted by {b.requestedBy?.firstName} {b.requestedBy?.lastName} · {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                          </p>
                          {b.status === 'ACCEPTED' && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                              <CheckCircle2 size={11} /> Accepted {b.acceptedAt ? format(new Date(b.acceptedAt), 'MMM d, yyyy') : ''}
                            </p>
                          )}
                          {b.status === 'DECLINED' && b.declineReason && (
                            <p className="text-xs text-red-600 mt-1">Reason: {b.declineReason}</p>
                          )}
                          {/* Approve button — admin only, only for AWAITING_APPROVAL */}
                          {isAwaiting && isAdmin && (
                            <div className="mt-3">
                              <button
                                onClick={() => approveBillingRequest.mutate(b.id)}
                                disabled={approveBillingRequest.isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                              >
                                <ShieldCheck size={13} />
                                {approveBillingRequest.isLoading ? 'Approving…' : 'Approve & Send to Client'}
                              </button>
                            </div>
                          )}
                          {isAwaiting && !isAdmin && (
                            <p className="text-xs text-amber-700 mt-2 italic">
                              Waiting for an admin to approve before the client is notified.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Real-time chat panel ── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '480px' }}>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Conversation</h2>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <ChatPanel
                  ticketId={id}
                  isClient={false}
                  onRequestPayment={isStaff ? () => setShowBilling(true) : undefined}
                />
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            {isStaff && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Manage</h3>
                <Select
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={ticket.status}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === 'CLOSED') {
                      setPendingStatus('CLOSED');
                    } else {
                      changeStatus.mutate(next);
                    }
                  }}
                />
                <Select label="Priority" options={PRIORITY_OPTIONS} value={ticket.priority} onChange={(e) => changePriority.mutate(e.target.value)} />

                {/* Assignee — admin only; agents cannot change assignment */}
                {isAdmin && (
                  <div className="space-y-2">
                    <Select
                      label="Assignee"
                      placeholder="Unassigned"
                      options={members?.map(m => ({ value: m.id, label: `${m.firstName} ${m.lastName}` })) ?? []}
                      value={pendingAssignee ?? ticket.assignedTo ?? ''}
                      onChange={(e) => setPendingAssignee(e.target.value)}
                    />
                    {pendingAssignee !== undefined && pendingAssignee !== (ticket.assignedTo ?? '') && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          isLoading={assignTicket.isLoading}
                          onClick={() => assignTicket.mutate(pendingAssignee || null)}
                        >
                          Save assignee
                        </Button>
                        <button
                          onClick={() => setPendingAssignee(ticket.assignedTo ?? '')}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Details */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Client</span><span className="font-medium text-gray-800">{ticket.client?.companyName ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Contact</span><span className="font-medium text-gray-800">{ticket.client?.contactName ?? '—'}</span></div>
                {ticket.closedAt && <div className="flex justify-between"><span className="text-gray-500">Closed</span><span className="font-medium text-gray-800">{format(new Date(ticket.closedAt), 'MMM d, yyyy')}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-medium text-gray-800">{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span></div>
              </div>
            </div>

            {/* Attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Attachments
                    <span className="ml-1.5 text-xs font-normal text-gray-400">({ticket.attachments.length})</span>
                  </h3>
                  {ticket.attachments.length > 1 && (
                    <button
                      onClick={() => downloadAllAsZip(ticket.attachments!, `${ticket.ticketNumber}-attachments.zip`)}
                      className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                    >
                      <Download size={13} /> Download all
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  {ticket.attachments.map((a) => (
                    <AttachmentPreview key={a.id} attachment={a} size="sm" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Close ticket confirmation */}
      <ConfirmDialog
        isOpen={pendingStatus === 'CLOSED'}
        variant="warning"
        title="Close this ticket?"
        description="The ticket will be marked as closed. The client will be notified. You can reopen it later if needed."
        confirmLabel="Close ticket"
        isLoading={changeStatus.isLoading}
        onConfirm={() => {
          changeStatus.mutate('CLOSED', { onSuccess: () => { setPendingStatus(null); } });
        }}
        onCancel={() => setPendingStatus(null)}
      />

      {/* Billing Request Modal */}
      <Modal isOpen={showBilling} onClose={() => { setShowBilling(false); setBillingError(''); }} title="Request Payment from Client" size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input label="Amount" type="number" min="0" step="0.01" placeholder="e.g. 5000"
                value={billingForm.amount} onChange={e => setBillingForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <Select label="Currency"
              options={[{ value: 'KES', label: 'KES' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]}
              value={billingForm.currency}
              onChange={e => setBillingForm(f => ({ ...f, currency: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <Textarea placeholder="Describe what this charge is for…" rows={3}
              value={billingForm.description}
              onChange={e => setBillingForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {billingError && <p className="text-sm text-red-600">{billingError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowBilling(false); setBillingError(''); }}>Cancel</Button>
            <Button
              isLoading={createBillingRequest.isLoading}
              disabled={!billingValid || createBillingRequest.isLoading}
              onClick={() => createBillingRequest.mutate()}
            >
              <DollarSign size={14} /> Send Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
