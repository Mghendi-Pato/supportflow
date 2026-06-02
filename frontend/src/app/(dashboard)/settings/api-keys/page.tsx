'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Key, Plus, Trash2, Copy, Check, AlertTriangle, Clock, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { DashboardNavbar } from '@/components/layout/DashboardNavbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { useNotify, errMsg } from '@/hooks/useNotify';
import api from '@/lib/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface GeneratedKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  rawKey: string;
}

export default function ApiKeysPage() {
  const { user } = useAuth();
  const notify = useNotify();
  const qc = useQueryClient();

  const isPremium = (user?.tenant as any)?.plan === 'PREMIUM';
  const isAdmin = user?.role === 'WORKSPACE_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Generate modal state
  const [showGenerate, setShowGenerate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const nameError = nameTouched && !keyName.trim() ? 'Key name is required' : undefined;

  // Newly-created key — shown once
  const [newKey, setNewKey] = useState<GeneratedKey | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: keys, isLoading } = useQuery<ApiKey[]>(
    'api-keys',
    async () => { const res = await api.get('/api-keys'); return res.data.data; },
    { enabled: isPremium && isAdmin },
  );

  const generateKey = useMutation(
    async () => {
      setNameTouched(true);
      if (!keyName.trim()) return;
      const res = await api.post('/api-keys', { name: keyName.trim() });
      return res.data.data as GeneratedKey;
    },
    {
      onSuccess: (data) => {
        if (!data) return;
        qc.invalidateQueries('api-keys');
        setShowGenerate(false);
        setKeyName('');
        setNameTouched(false);
        setNewKey(data);
        setCopied(false);
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to generate API key')),
    },
  );

  const revokeKey = useMutation(
    async (keyId: string) => { await api.delete(`/api-keys/${keyId}`); },
    {
      onSuccess: () => {
        qc.invalidateQueries('api-keys');
        setRevokeTarget(null);
        notify.success('API key revoked');
      },
      onError: (err: unknown) => notify.error(errMsg(err, 'Failed to revoke API key')),
    },
  );

  const copyKey = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardNavbar
        title="API Keys"
        actions={
          <Link href="/settings" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft size={15} /> Back to Settings
          </Link>
        }
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* PREMIUM gate */}
          {!isPremium ? (
            <Card>
              <div className="flex flex-col items-center text-center py-6 gap-3">
                <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Key size={22} className="text-amber-600" />
                </div>
                <h2 className="font-semibold text-gray-900">API Access requires Premium</h2>
                <p className="text-sm text-gray-500 max-w-sm">
                  Generate API keys to integrate SupportFlow with your own tools and workflows. Upgrade to Premium to unlock this feature.
                </p>
                <Link href="/settings/upgrade">
                  <Button size="sm" className="mt-1">Upgrade to Premium</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <>
              {/* Header card */}
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Key size={16} className="text-primary-600" /> API Keys
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Use API keys to authenticate requests from your own integrations.
                      Keys carry admin-level scope. Treat them like passwords — never expose them in client-side code.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 w-fit">
                      <span className="font-mono">X-API-Key: sk_live_…</span>
                      <span className="text-gray-300">|</span>
                      <span className="italic">header on every request</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button size="sm" onClick={() => { setShowGenerate(true); setKeyName(''); setNameTouched(false); }}>
                      <Plus size={14} /> New Key
                    </Button>
                  )}
                </div>
              </Card>

              {/* Newly generated key — show once */}
              {newKey && (
                <div className="rounded-xl border-2 border-green-400 bg-green-50 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-green-800 font-semibold text-sm">
                    <Check size={16} className="text-green-600" />
                    Key generated — copy it now, it won't be shown again
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-800 overflow-x-auto whitespace-nowrap">
                      {newKey.rawKey}
                    </code>
                    <button
                      onClick={() => copyKey(newKey.rawKey)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <button
                    onClick={() => setNewKey(null)}
                    className="text-xs text-green-700 hover:text-green-900 underline transition-colors"
                  >
                    I've saved it — dismiss
                  </button>
                </div>
              )}

              {/* Keys list */}
              <Card padding={false}>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 text-sm">Active Keys</h3>
                  {keys && <span className="text-xs text-gray-400">{keys.length} key{keys.length !== 1 ? 's' : ''}</span>}
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-10"><Spinner /></div>
                ) : !keys?.length ? (
                  <div className="flex flex-col items-center py-10 gap-2 text-gray-400">
                    <Key size={28} strokeWidth={1.5} />
                    <p className="text-sm">No API keys yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {keys.map((k) => (
                      <div key={k.id} className="flex items-center gap-4 px-6 py-4">
                        <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Key size={15} className="text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{k.name}</p>
                          </div>
                          <p className="text-xs font-mono text-gray-400 mt-0.5">
                            {k.keyPrefix}{'·'.repeat(8)}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              Created {format(new Date(k.createdAt), 'MMM d, yyyy')}
                            </span>
                            {k.lastUsedAt && (
                              <span>
                                Last used {formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })}
                              </span>
                            )}
                            {!k.lastUsedAt && (
                              <span className="italic">Never used</span>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => setRevokeTarget({ id: k.id, name: k.name })}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Revoke key"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Security note */}
              <div className="flex items-start gap-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p>
                  API keys grant full admin access to your workspace. Revoke any key you no longer use or that may have been exposed.
                  Never commit keys to source control.
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Generate modal */}
      <Modal
        isOpen={showGenerate}
        onClose={() => { setShowGenerate(false); setKeyName(''); setNameTouched(false); }}
        title="Generate API Key"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Give this key a memorable name so you know where it's used.
          </p>
          <Input
            label="Key name"
            placeholder="e.g. Zapier integration"
            value={keyName}
            onChange={e => setKeyName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            error={nameError}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowGenerate(false); setKeyName(''); setNameTouched(false); }}>
              Cancel
            </Button>
            <Button
              isLoading={generateKey.isLoading}
              disabled={generateKey.isLoading}
              onClick={() => generateKey.mutate()}
            >
              <Key size={14} /> Generate Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* Revoke confirm */}
      <ConfirmDialog
        isOpen={!!revokeTarget}
        variant="danger"
        title="Revoke API key?"
        description={
          revokeTarget
            ? `"${revokeTarget.name}" will be permanently revoked. Any integration using this key will stop working immediately.`
            : ''
        }
        confirmLabel="Revoke key"
        isLoading={revokeKey.isLoading}
        onConfirm={() => { if (revokeTarget) revokeKey.mutate(revokeTarget.id); }}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
