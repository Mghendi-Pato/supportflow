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
import { Users, Trash2, Send, Plus, UserCog } from 'lucide-react';
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

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'AGENT' });
  const [inviteError, setInviteError] = useState('');

  const [removeMemberTarget, setRemoveMemberTarget] = useState<{ userId: string; name: string } | null>(null);
  const [revokeInviteTarget, setRevokeInviteTarget] = useState<{ id: string; email: string } | null>(null);

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
      if (pwForm.newPassword !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
      if (pwForm.newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return; }
      await api.patch('/users/me/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
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
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Profile */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
              <UserCog size={16} /> My Profile
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="First name" value={profileForm.firstName} onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))} />
                <Input label="Last name" value={profileForm.lastName} onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <Input label="Email" value={user?.email ?? ''} disabled />
              <Button size="sm" isLoading={updateProfile.isLoading} onClick={() => updateProfile.mutate()}>
                Save changes
              </Button>
            </div>
          </Card>

          {/* Password */}
          <Card>
            <h2 className="font-semibold text-gray-800 mb-5">Change Password</h2>
            <div className="space-y-4">
              <Input label="Current password" type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
              <Input label="New password" type="password" placeholder="Min. 8 characters" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
              <Input label="Confirm new password" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
              {pwError && <p className="text-sm text-red-600">{pwError}</p>}
              <Button size="sm" isLoading={changePassword.isLoading} onClick={() => changePassword.mutate()}>
                Update password
              </Button>
            </div>
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
                    <div key={m.id} className="flex items-center justify-between px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold">
                          {m.user.firstName?.[0] ?? '?'}{m.user.lastName?.[0] ?? ''}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.user.firstName} {m.user.lastName}</p>
                          <p className="text-xs text-gray-500">{m.user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
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

      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member" size="sm">
        <div className="space-y-4">
          <Input label="Email address" type="email" placeholder="agent@agency.com" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
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
            <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button isLoading={inviteMember.isLoading} onClick={() => inviteMember.mutate()}>
              <Send size={14} /> Send Invite
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
