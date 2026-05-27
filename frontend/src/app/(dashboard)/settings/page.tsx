'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '@/hooks/useAuth';
import { useNotify, errMsg } from '@/hooks/useNotify';
import { DashboardNavbar } from '@/components/layout/DashboardNavbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users, Trash2, Send, Plus, UserCog, Bell } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import api from '@/lib/api';

interface Member {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
    lastLoginAt?: string | null;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const notify = useNotify();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'WORKSPACE_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '' });
  useEffect(() => {
    if (user) setProfileForm({ firstName: user.firstName ?? '', lastName: user.lastName ?? '' });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // True only when the user has actually changed a field
  const profileDirty =
    profileForm.firstName.trim() !== (user?.firstName ?? '') ||
    profileForm.lastName.trim()  !== (user?.lastName  ?? '');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwTouched, setPwTouched] = useState<Partial<Record<'currentPassword'|'newPassword'|'confirm', boolean>>>({});
  const touchPw = (f: 'currentPassword'|'newPassword'|'confirm') =>
    setPwTouched(t => ({ ...t, [f]: true }));

  // Inline password field errors — shown after the field is touched
  const pwFieldErrors = {
    currentPassword: !pwForm.currentPassword ? 'Current password is required' : undefined,
    newPassword:     !pwForm.newPassword ? 'New password is required'
                   : pwForm.newPassword.length < 8 ? 'Must be at least 8 characters'
                   : undefined,
    confirm:         !pwForm.confirm ? 'Please confirm your password'
                   : pwForm.confirm !== pwForm.newPassword ? 'Passwords do not match'
                   : undefined,
  };
  const pwErr = (f: 'currentPassword'|'newPassword'|'confirm') =>
    pwTouched[f] ? pwFieldErrors[f] : undefined;

  // Show confirm mismatch live once confirm has been touched, even if newPassword changes
  const confirmMismatchLive =
    pwTouched.confirm && pwForm.confirm.length > 0 && pwForm.confirm !== pwForm.newPassword;

  // Password button active only when all three fields have content
  const pwReady =
    pwForm.currentPassword.length > 0 &&
    pwForm.newPassword.length     > 0 &&
    pwForm.confirm.length         > 0;

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'AGENT' });
  const [inviteError, setInviteError] = useState('');

  // Invite form inline validation
  const EMAIL_RE_SETTINGS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const [inviteTouched, setInviteTouched] = useState(false);
  const inviteEmailError = inviteTouched && !EMAIL_RE_SETTINGS.test(inviteForm.email.trim())
    ? 'Enter a valid email address' : undefined;

  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ userId: string; name: string } | null>(null);
  const [revokeInviteTarget, setRevokeInviteTarget] = useState<{ id: string; email: string } | null>(null);

  // ── Notification preferences ──────────────────────────────
  interface NotifPrefs {
    emailNewTicket: boolean;
    emailStatusChanged: boolean;
    emailAssigned: boolean;
    emailNewMessage: boolean;
    emailNewAttachment: boolean;
    emailBillingRequest: boolean;
    emailPaymentUpdate: boolean;
    emailTicketClosed: boolean;
  }
  const { data: notifPrefs, isLoading: prefsLoading } = useQuery<NotifPrefs>(
    'notification-prefs',
    async () => { const res = await api.get('/users/me/notification-prefs'); return res.data.data; },
  );
  const updatePrefs = useMutation(
    async (patch: Partial<NotifPrefs>) => {
      const res = await api.patch('/users/me/notification-prefs', patch);
      return res.data.data;
    },
    {
      onSuccess: () => qc.invalidateQueries('notification-prefs'),
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to update notification preferences')),
    }
  );

  const { data: members, isLoading: membersLoading } = useQuery<Member[]>('workspace-members-settings', async () => {
    const res = await api.get('/workspace/members');
    return res.data.data;
  });

  const { data: invitations } = useQuery<Invitation[]>('invitations', async () => {
    const res = await api.get('/workspace/invitations');
    return res.data.data;
  }, { enabled: isAdmin });

  const updateProfile = useMutation(
    async () => { await api.patch('/users/me', profileForm); },
    {
      onSuccess: async () => {
        await refreshUser();
        notify.success('Profile updated');
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to update profile')),
    }
  );

  const changePassword = useMutation(
    async () => {
      // Touch all fields to surface any remaining errors
      setPwTouched({ currentPassword: true, newPassword: true, confirm: true });
      if (pwForm.newPassword !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
      if (pwForm.newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return; }
      await api.patch('/users/me/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      setPwTouched({});
      setPwError('');
    },
    {
      onSuccess: () => notify.success('Password changed successfully'),
      onError: (err: unknown) => {
        const msg = errMsg(err, 'Failed to change password');
        setPwError(msg);
        notify.error(msg);
      },
    }
  );

  const inviteMember = useMutation(
    async () => {
      if (!inviteForm.email) { setInviteError('Email is required'); return; }
      await api.post('/workspace/members/invite', inviteForm);
    },
    {
      onSuccess: () => {
        qc.invalidateQueries('invitations');
        setShowInvite(false);
        setInviteForm({ email: '', role: 'AGENT' });
        setInviteError('');
        notify.success('Invitation sent');
      },
      onError: (err: unknown) => {
        const msg = errMsg(err, 'Failed to send invite');
        setInviteError(msg);
        notify.error(msg);
      },
    }
  );

  const removeMember = useMutation(
    async (userId: string) => { await api.delete(`/workspace/members/${userId}`); },
    {
      onSuccess: () => {
        qc.invalidateQueries('workspace-members-settings');
        qc.invalidateQueries('workspace-members');
        setRemoveMemberTarget(null);
        notify.success('Member removed');
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to remove member')),
    }
  );

  const updateRole = useMutation(
    async ({ userId, role }: { userId: string; role: string }) => {
      await api.patch(`/workspace/members/${userId}/role`, { role });
    },
    {
      onSuccess: () => {
        qc.invalidateQueries('workspace-members-settings');
        qc.invalidateQueries('workspace-members');
        notify.success('Role updated');
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to update role')),
    }
  );

  const revokeInvite = useMutation(
    async (inviteId: string) => { await api.delete(`/workspace/invitations/${inviteId}`); },
    {
      onSuccess: () => {
        qc.invalidateQueries('invitations');
        setRevokeInviteTarget(null);
        notify.success('Invitation revoked');
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to revoke invitation')),
    }
  );

  return (
    <div className="flex flex-col h-full">
      <DashboardNavbar title="Settings" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Profile */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
              <UserCog size={16} /> My Profile
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First name"
                  value={profileForm.firstName}
                  onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                  autoComplete="given-name"
                />
                <Input
                  label="Last name"
                  value={profileForm.lastName}
                  onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                  autoComplete="family-name"
                />
              </div>

              {/* Email — read-only, future feature */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <div className="relative">
                  <input
                    readOnly
                    value={user?.email ?? ''}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed select-none focus:outline-none"
                    tabIndex={-1}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                    locked
                  </span>
                </div>
                <p className="text-xs text-gray-400">Email changes are not yet available.</p>
              </div>

              <Button
                size="sm"
                isLoading={updateProfile.isLoading}
                disabled={!profileDirty || updateProfile.isLoading}
                onClick={() => updateProfile.mutate()}
              >
                Save changes
              </Button>
            </div>
          </Card>

          {/* Password */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-5">Change Password</h2>
            <div className="space-y-4">
              <Input
                label="Current password"
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                onBlur={() => touchPw('currentPassword')}
                error={pwErr('currentPassword')}
              />
              <Input
                label="New password"
                type="password"
                placeholder="Min. 8 characters"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                onBlur={() => touchPw('newPassword')}
                error={pwErr('newPassword')}
              />
              <Input
                label="Confirm new password"
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                onBlur={() => touchPw('confirm')}
                error={confirmMismatchLive ? 'Passwords do not match' : pwErr('confirm')}
              />
              {pwError && <p className="text-sm text-red-600">{pwError}</p>}
              <Button
                size="sm"
                isLoading={changePassword.isLoading}
                disabled={!pwReady || changePassword.isLoading}
                onClick={() => changePassword.mutate()}
              >
                Update password
              </Button>
            </div>
          </Card>

          {/* Notification email preferences */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Bell size={16} /> Email Notifications
            </h2>
            <p className="text-xs text-gray-400 mb-5">
              In-app notifications are always sent. Toggle which events also send you an email.
            </p>
            {prefsLoading ? (
              <div className="flex justify-center py-4"><Spinner size="sm" /></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {([
                  { key: 'emailNewTicket',      label: 'New ticket created',            desc: 'When a new ticket is opened' },
                  { key: 'emailStatusChanged',  label: 'Ticket status changed',         desc: 'When a ticket moves to a new status' },
                  { key: 'emailAssigned',       label: 'Ticket assigned to you',        desc: 'When a ticket is assigned to your account' },
                  { key: 'emailNewMessage',     label: 'New message or reply',          desc: 'When someone replies in a ticket conversation' },
                  { key: 'emailNewAttachment',  label: 'New attachment uploaded',       desc: 'When a file is attached to a ticket' },
                  { key: 'emailBillingRequest', label: 'Payment request',               desc: 'When a billing request is created or needs approval' },
                  { key: 'emailPaymentUpdate',  label: 'Payment accepted / declined',   desc: 'When a client responds to a payment request' },
                  { key: 'emailTicketClosed',   label: 'Ticket closed',                 desc: 'When a ticket is closed or resolved' },
                ] as { key: keyof NotifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => {
                  const checked = notifPrefs ? notifPrefs[key] : true;
                  return (
                    <div key={key} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={checked}
                        disabled={updatePrefs.isLoading}
                        onClick={() => updatePrefs.mutate({ [key]: !checked })}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-50 ${
                          checked ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Team Members (admin only) */}
          {isAdmin && (
            <Card padding={false}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Users size={16} /> Team Members
                </h2>
                <Button size="sm" onClick={() => setShowInvite(true)}>
                  <Plus size={16} /> Invite Member
                </Button>
              </div>

              {membersLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : !members?.length ? (
                <EmptyState icon={Users} title="No members yet" />
              ) : (
                <div className="divide-y divide-gray-50">
                  {members.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold">
                          {m.user.firstName?.[0] ?? '?'}{m.user.lastName?.[0] ?? ''}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.user.firstName} {m.user.lastName}</p>
                          <p className="text-xs text-gray-500">{m.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {m.userId === user?.id ? (
                          <Badge variant="info">{m.role?.replace('_', ' ')}</Badge>
                        ) : (
                          <Select
                            options={[
                              { value: 'AGENT', label: 'Agent' },
                              { value: 'WORKSPACE_ADMIN', label: 'Workspace Admin' },
                            ]}
                            value={m.role}
                            onChange={(e) => updateRole.mutate({ userId: m.userId, role: e.target.value })}
                            className="w-44"
                          />
                        )}
                        {m.userId !== user?.id && (
                          <button
                            onClick={() => setRemoveMemberTarget({ userId: m.userId, name: `${m.user.firstName} ${m.user.lastName}` })}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {invitations && invitations.length > 0 && (
                <div className="border-t border-gray-100">
                  <p className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending Invitations</p>
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between px-6 py-3 border-t border-gray-50">
                      <div>
                        <p className="text-sm text-gray-700">{inv.email}</p>
                        <p className="text-xs text-gray-400">{inv.role}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setRevokeInviteTarget({ id: inv.id, email: inv.email })}>
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </main>

      <ConfirmDialog
        isOpen={!!removeMemberTarget}
        variant="danger"
        title="Remove team member?"
        description={removeMemberTarget ? `${removeMemberTarget.name} will lose access to this workspace immediately.` : ''}
        confirmLabel="Remove"
        isLoading={removeMember.isLoading}
        onConfirm={() => {
          if (removeMemberTarget) removeMember.mutate(removeMemberTarget.userId);
        }}
        onCancel={() => setRemoveMemberTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!revokeInviteTarget}
        variant="danger"
        title="Revoke invitation?"
        description={revokeInviteTarget ? `The invitation sent to ${revokeInviteTarget.email} will be cancelled.` : ''}
        confirmLabel="Revoke"
        isLoading={revokeInvite.isLoading}
        onConfirm={() => {
          if (revokeInviteTarget) revokeInvite.mutate(revokeInviteTarget.id);
        }}
        onCancel={() => setRevokeInviteTarget(null)}
      />

      <Modal isOpen={showInvite} onClose={() => { setShowInvite(false); setInviteTouched(false); setInviteError(''); }} title="Invite Team Member" size="sm">
        <div className="space-y-4">
          <Input
              label="Email address"
              type="email"
              placeholder="agent@agency.com"
              value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              onBlur={() => setInviteTouched(true)}
              error={inviteEmailError}
            />
          <Select
            label="Role"
            options={[
              { value: 'AGENT', label: 'Agent' },
              { value: 'WORKSPACE_ADMIN', label: 'Workspace Admin' },
            ]}
            value={inviteForm.role}
            onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
          />
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowInvite(false); setInviteTouched(false); setInviteError(''); }}>Cancel</Button>
            <Button isLoading={inviteMember.isLoading} onClick={() => inviteMember.mutate()}>
              <Send size={14} /> Send Invite
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
