'use client';
import { useState, useRef, useEffect } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';
import type { Notification } from '@/types';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data } = useQuery(
    'notifications',
    async () => {
      const res = await api.get('/notifications?limit=10');
      return res.data.data as { data: Notification[]; unreadCount: number };
    },
    { refetchInterval: 30_000 }
  );

  const markAll = useMutation(
    () => api.patch('/notifications/read-all'),
    { onSuccess: () => qc.invalidateQueries('notifications') }
  );

  const markOne = useMutation(
    (id: string) => api.patch('/notifications/read', { notificationIds: [id] }),
    { onSuccess: () => qc.invalidateQueries('notifications') }
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const unread        = data?.unreadCount ?? 0;
  const notifications = data?.data ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile full-screen overlay */}
          <div className="sm:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />

          <div className={`
            z-50 bg-white shadow-xl border border-gray-200 overflow-hidden
            /* Mobile: fixed bottom sheet */
            fixed bottom-0 left-0 right-0 rounded-t-2xl
            /* Desktop: positioned dropdown */
            sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:rounded-xl sm:fixed-none
          `}>
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button
                    onClick={() => markAll.mutate()}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="sm:hidden p-1 rounded-lg text-gray-400 hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No notifications</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`group relative flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${
                      !n.isRead ? 'bg-primary-50 hover:bg-primary-100/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                      !n.isRead ? 'bg-primary-500' : 'bg-transparent'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markOne.mutate(n.id); }}
                        disabled={markOne.isLoading}
                        title="Mark as read"
                        className="flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-primary-600 hover:bg-primary-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <Check size={13} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
