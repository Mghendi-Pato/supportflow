'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import Link from 'next/link';
import {
  Plus,
  Search,
  Users,
  Send,
  RefreshCw,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  UserX,
} from 'lucide-react';
import { DashboardNavbar } from '@/components/layout/DashboardNavbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useAuth } from '@/hooks/useAuth';
import { useNotify, errMsg } from '@/hooks/useNotify';
import api from '@/lib/api';
import { clientInviteStatus } from '@/types';
import type { Client, PaginatedResponse } from '@/types';

const EMPTY_FORM = {
  contactName: '',
  email: '',
  companyName: '',
  phone: '',
  notes: '',
};

export default function ClientsPage() {
  const { user } = useAuth();
  const notify = useNotify();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Create / Edit modal
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  // Invite modal
  const [inviteClientId, setInviteClientId] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  // ── Real-time validation ─────────────────────────────────────────────────────
  type FormField = 'contactName' | 'email' | 'companyName';
  const [touched, setTouched] = useState<Partial<Record<FormField, boolean>>>(
    {},
  );
  const touch = (f: FormField) => setTouched((t) => ({ ...t, [f]: true }));
  const touchAll = () =>
    setTouched({ contactName: true, email: true, companyName: true });

  const EMAIL_RE_INLINE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function getInlineErrors(f: typeof EMPTY_FORM) {
    return {
      contactName: !f.contactName.trim()
        ? 'Contact name is required'
        : undefined,
      email: !f.email.trim()
        ? 'Email is required'
        : !EMAIL_RE_INLINE.test(f.email.trim())
          ? 'Enter a valid email address'
          : undefined,
      companyName: !f.companyName.trim()
        ? 'Company name is required'
        : undefined,
    };
  }
  const inlineErrors = getInlineErrors(form);
  const fieldErr = (f: FormField) => (touched[f] ? inlineErrors[f] : undefined);

  // Helpers to open create / edit modals
  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError('');
    setTouched({});
    setShowCreate(true);
  }
  function openEdit(c: Client) {
    setForm({
      contactName: c.contactName,
      email: c.email,
      companyName: c.companyName,
      phone: c.phone ?? '',
      notes: c.notes ?? '',
    });
    setFormError('');
    setTouched({});
    setEditTarget(c);
  }
  function closeModal() {
    setShowCreate(false);
    setEditTarget(null);
    setFormError('');
    setTouched({});
  }

  // ── Edit modal guards ────────────────────────────────────────────────────────
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // All required fields filled + email format valid
  const editFormValid =
    form.contactName.trim().length > 0 &&
    form.companyName.trim().length > 0 &&
    form.email.trim().length > 0 &&
    EMAIL_RE.test(form.email.trim());

  // At least one field differs from the original client record
  const editFormDirty = editTarget
    ? form.contactName.trim() !== (editTarget.contactName ?? '') ||
      form.email.trim() !== (editTarget.email ?? '') ||
      form.companyName.trim() !== (editTarget.companyName ?? '') ||
      form.phone !== (editTarget.phone ?? '') ||
      form.notes !== (editTarget.notes ?? '')
    : false;

  const canSaveEdit = editFormValid && editFormDirty;

  // Create modal: just needs valid required fields (no dirty check — form starts empty)
  const canCreateClient =
    form.contactName.trim().length > 0 &&
    form.companyName.trim().length > 0 &&
    form.email.trim().length > 0 &&
    EMAIL_RE.test(form.email.trim());

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.set('search', search);

  const { data, isLoading } = useQuery(
    ['clients', page, search],
    async () => {
      const res = await api.get(`/clients?${params}`);
      return res.data.data as PaginatedResponse<Client>;
    },
    { keepPreviousData: true },
  );

  const createMutation = useMutation(
    async () => {
      touchAll();
      if (
        !form.contactName.trim() ||
        !form.email.trim() ||
        !form.companyName.trim() ||
        !EMAIL_RE_INLINE.test(form.email.trim())
      ) {
        return; // inline errors now visible
      }
      await api.post('/clients', form);
    },
    {
      onSuccess: () => {
        qc.invalidateQueries('clients');
        closeModal();
        setForm(EMPTY_FORM);
        notify.success('Client created');
      },
      onError: (err: unknown) => {
        const msg = errMsg(err, 'Failed to create client');
        setFormError(msg);
        notify.error(msg);
      },
    },
  );

  const editMutation = useMutation(
    async () => {
      if (!editTarget) return;
      touchAll();
      if (
        !form.contactName.trim() ||
        !form.email.trim() ||
        !form.companyName.trim() ||
        !EMAIL_RE_INLINE.test(form.email.trim())
      ) {
        return; // inline errors now visible
      }
      await api.patch(`/clients/${editTarget.id}`, form);
    },
    {
      onSuccess: () => {
        // Invalidate list and detail page
        qc.invalidateQueries('clients');
        if (editTarget) qc.invalidateQueries(['client', editTarget.id]);
        closeModal();
        setForm(EMPTY_FORM);
        notify.success('Client updated');
      },
      onError: (err: unknown) => {
        const msg = errMsg(err, 'Failed to update client');
        setFormError(msg);
        notify.error(msg);
      },
    },
  );

  const [deleteError, setDeleteError] = useState('');
  const deleteMutation = useMutation(
    async (clientId: string) => {
      await api.delete(`/clients/${clientId}`);
    },
    {
      onSuccess: (_, clientId) => {
        qc.invalidateQueries('clients');
        qc.invalidateQueries(['client', clientId]);
        setDeleteTarget(null);
        setDeleteError('');
        notify.success('Client deleted');
      },
      onError: (err: unknown) => {
        const msg = errMsg(err, 'Failed to delete client');
        setDeleteError(msg);
        notify.error(msg);
      },
    },
  );

  const inviteMutation = useMutation(
    async (clientId: string) => {
      await api.post(`/clients/${clientId}/invite`);
    },
    {
      onSuccess: () => {
        setInviteClientId(null);
        qc.invalidateQueries('clients');
        notify.success('Invitation sent');
      },
      onError: (err: unknown) =>
        notify.error(errMsg(err, 'Failed to send invitation')),
    },
  );

  const isAdmin =
    user?.role === 'WORKSPACE_ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="flex flex-col h-full">
      <DashboardNavbar
        title="Clients"
        actions={
          isAdmin && (
            <Button size="sm" onClick={openCreate}>
              <Plus size={16} /> New Client
            </Button>
          )
        }
      />
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Card padding={false}>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : !data?.data?.length ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Add your first client to get started."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Company
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Portal Access
                      </th>
                      {isAdmin && (
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.data.map((client) => (
                      <tr
                        key={client.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-3">
                          <Link
                            href={`/clients/${client.id}`}
                            className="font-medium text-gray-900 hover:text-primary-600"
                          >
                            {client.contactName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {client.companyName}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <a
                            href={`mailto:${client.email}`}
                            className="hover:text-primary-600"
                          >
                            {client.email}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {client.phone ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const status = clientInviteStatus(client);
                            if (status === 'accepted')
                              return (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                                  <CheckCircle2 size={11} /> Accepted
                                </span>
                              );
                            if (status === 'invited')
                              return (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                                  <Clock size={11} /> Invited
                                </span>
                              );
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-0.5">
                                <UserX size={11} /> Not invited
                              </span>
                            );
                          })()}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {clientInviteStatus(client) === 'accepted' ? (
                                <span className="px-2 py-1 text-xs text-gray-400 select-none">
                                  Has access
                                </span>
                              ) : clientInviteStatus(client) === 'invited' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setInviteClientId(client.id)}
                                  title="Resend portal invite"
                                >
                                  <RefreshCw size={14} /> Resend
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setInviteClientId(client.id)}
                                  title="Send portal invite"
                                >
                                  <Send size={14} /> Invite
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(client)}
                                title="Edit client"
                              >
                                <Pencil size={14} /> Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(client)}
                                title="Delete client"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 size={14} /> Delete
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.total > 20 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Showing {(page - 1) * 20 + 1}–
                    {Math.min(page * 20, data.total)} of {data.total}
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
                      disabled={page * 20 >= data.total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </main>

      {/* Create / Edit Client Modal — same form, different title + action */}
      <Modal
        isOpen={showCreate || !!editTarget}
        onClose={closeModal}
        title={editTarget ? `Edit — ${editTarget.companyName}` : 'New Client'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Contact name"
            placeholder="James Doe"
            value={form.contactName}
            onChange={(e) =>
              setForm((f) => ({ ...f, contactName: e.target.value }))
            }
            onBlur={() => touch('contactName')}
            error={fieldErr('contactName')}
          />
          <Input
            label="Email"
            type="email"
            placeholder="james@company.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            onBlur={() => touch('email')}
            error={fieldErr('email')}
          />
          <Input
            label="Company name"
            placeholder="Acme POS Solutions"
            value={form.companyName}
            onChange={(e) =>
              setForm((f) => ({ ...f, companyName: e.target.value }))
            }
            onBlur={() => touch('companyName')}
            error={fieldErr('companyName')}
          />
          <PhoneInput
            label="Phone"
            value={form.phone}
            onChange={(phone) => setForm((f) => ({ ...f, phone }))}
            placeholder="712 345 678"
          />
          <Textarea
            label="Internal notes"
            placeholder="Visible to staff only…"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          {formError && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            {editTarget ? (
              <Button
                isLoading={editMutation.isLoading}
                disabled={!canSaveEdit || editMutation.isLoading}
                onClick={() => editMutation.mutate()}
              >
                Save Changes
              </Button>
            ) : (
              <Button
                isLoading={createMutation.isLoading}
                disabled={!canCreateClient || createMutation.isLoading}
                onClick={() => createMutation.mutate()}
              >
                Create Client
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Client Confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        title={`Delete ${deleteTarget?.companyName ?? 'client'}?`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will permanently remove the client. Their existing tickets will
            remain but become unlinked.{' '}
            <strong>This action cannot be undone.</strong>
          </p>
          {deleteError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isLoading}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              <Trash2 size={14} /> Delete client
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Confirm Modal */}
      {(() => {
        const inviteClient = data?.data?.find((c) => c.id === inviteClientId);
        const isResend = inviteClient
          ? clientInviteStatus(inviteClient) === 'invited'
          : false;
        return (
          <Modal
            isOpen={!!inviteClientId}
            onClose={() => setInviteClientId(null)}
            title={
              isResend ? 'Resend Portal Invitation' : 'Send Portal Invitation'
            }
            size="sm"
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {isResend
                  ? 'The previous invitation will be cancelled and a fresh one sent to the client.'
                  : 'This will send an email invite so the client can create their portal account and track their tickets.'}
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setInviteClientId(null)}
                >
                  Cancel
                </Button>
                <Button
                  isLoading={inviteMutation.isLoading}
                  onClick={() =>
                    inviteClientId && inviteMutation.mutate(inviteClientId)
                  }
                >
                  {isResend ? (
                    <>
                      <RefreshCw size={14} /> Resend Invite
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Send Invite
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
