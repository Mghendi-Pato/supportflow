'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowLeft, User, DollarSign,
  Check, ThumbsDown, CheckCircle2, Download,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { AttachmentPreview, downloadAllAsZip } from '@/components/ui/AttachmentPreview';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import dynamic from 'next/dynamic';

// Browser-only: WebSocket subscriptions must not run during SSR.
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
import { useNotify, errMsg } from '@/hooks/useNotify';
import api from '@/lib/api';
import type { Ticket } from '@/types';

interface BillingRequest {
  id: string;
  amount: string;
  currency: string;
  description: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  requestedBy: { firstName: string; lastName: string };
  createdAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  declineReason?: string;
}

export default function PortalTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const notify = useNotify();
  const qc = useQueryClient();

  // Decline modal
  const [declineTarget, setDeclineTarget] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [acceptTarget, setAcceptTarget]   = useState<{ id: string; amount: string; currency: string } | null>(null);

  const { data: ticket, isLoading } = useQuery<Ticket>(
    ['portal-ticket', id],
    async () => { const res = await api.get(`/tickets/${id}`); return res.data.data; }
  );

  const { data: billingRequests } = useQuery<BillingRequest[]>(
    ['billing', id],
    async () => { const res = await api.get(`/billing-requests?ticketId=${id}`); return res.data.data; },
    { enabled: !!id }
  );

  const respondBilling = useMutation(
    async ({ requestId, accept, reason }: { requestId: string; accept: boolean; reason?: string }) => {
      await api.patch(`/billing-requests/${requestId}/respond`, { accept, declineReason: reason });
      return accept; // bubble up so onSuccess can show the right message
    },
    {
      onSuccess: (accepted) => {
        qc.invalidateQueries(['billing', id]);
        qc.invalidateQueries(['portal-ticket', id]);
        setDeclineTarget(null);
        setDeclineReason('');
        setAcceptTarget(null);
        notify.success(accepted ? 'Payment accepted' : 'Payment request declined');
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to respond to payment request')),
    }
  );

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!ticket) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/portal" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <span className="text-sm font-mono text-gray-400">{ticket.ticketNumber}</span>
          <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
        </div>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        <span className="text-sm text-gray-400">
          Opened {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
        </span>
        {ticket.assignee && (
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <User size={14} />
            Assigned to {ticket.assignee.firstName} {ticket.assignee.lastName}
          </span>
        )}
      </div>

      {/* Description */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-500 mb-3">Issue Description</h2>
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
      </Card>

      {/* Payment requests */}
      {billingRequests && billingRequests.length > 0 && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">Payment Requests</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {billingRequests.map((b) => (
              <div key={b.id} className="px-6 py-5 bg-blue-50 border-l-4 border-blue-400">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <DollarSign size={15} className="text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm font-semibold text-blue-900">Payment Request</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        b.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                        b.status === 'DECLINED' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{b.status}</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {b.currency} {Number(b.amount).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">{b.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Requested by {b.requestedBy?.firstName} {b.requestedBy?.lastName} · {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                    </p>
                    {b.status === 'ACCEPTED' && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Approved {b.acceptedAt ? format(new Date(b.acceptedAt), 'MMM d, yyyy') : ''}
                      </p>
                    )}
                    {b.status === 'DECLINED' && b.declineReason && (
                      <p className="text-xs text-red-600 mt-1">Declined: {b.declineReason}</p>
                    )}
                    {b.status === 'PENDING' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setAcceptTarget({ id: b.id, amount: b.amount, currency: b.currency })}
                          disabled={respondBilling.isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Check size={12} /> Accept &amp; Pay
                        </button>
                        <button
                          onClick={() => setDeclineTarget(b.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 text-xs font-medium rounded-lg border border-red-200 transition-colors"
                        >
                          <ThumbsDown size={12} /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Real-time chat panel ── */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Conversation</h2>
        </div>
        <div style={{ minHeight: 'clamp(280px, 50vw, 400px)' }} className="flex flex-col">
          {ticket.status !== 'CLOSED' ? (
            <ChatPanel ticketId={id} isClient={true} />
          ) : (
            <>
              <ChatPanel ticketId={id} isClient={true} />
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl text-center">
                <p className="text-sm text-gray-500">
                  This ticket is closed.{' '}
                  <Link href="/portal/new" className="text-primary-600 hover:underline">Open a new ticket</Link>
                  {' '}if you need further assistance.
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Attachments */}
      {ticket.attachments && ticket.attachments.length > 0 && (
        <Card padding={false}>
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
          <div className="p-4 flex flex-wrap gap-2">
            {ticket.attachments.map((a) => (
              <AttachmentPreview key={a.id} attachment={a} size="sm" />
            ))}
          </div>
        </Card>
      )}

      {/* Accept payment confirmation */}
      <ConfirmDialog
        isOpen={!!acceptTarget}
        variant="default"
        title="Confirm payment?"
        description={
          acceptTarget
            ? `You are approving a charge of ${acceptTarget.currency} ${Number(acceptTarget.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}. This will be recorded on your account.`
            : ''
        }
        confirmLabel="Yes, accept & pay"
        isLoading={respondBilling.isLoading}
        onConfirm={() => {
          if (acceptTarget) {
            respondBilling.mutate(
              { requestId: acceptTarget.id, accept: true },
              { onSuccess: () => setAcceptTarget(null) }
            );
          }
        }}
        onCancel={() => setAcceptTarget(null)}
      />

      {/* Decline modal */}
      <Modal isOpen={!!declineTarget} onClose={() => { setDeclineTarget(null); setDeclineReason(''); }} title="Decline Payment Request" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Please let us know why you're declining this payment request.</p>
          <Textarea placeholder="Reason for declining…" rows={3} value={declineReason} onChange={e => setDeclineReason(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setDeclineTarget(null); setDeclineReason(''); }}>Cancel</Button>
            <Button variant="danger" isLoading={respondBilling.isLoading}
              onClick={() => declineTarget && respondBilling.mutate({ requestId: declineTarget, accept: false, reason: declineReason })}>
              Decline Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
