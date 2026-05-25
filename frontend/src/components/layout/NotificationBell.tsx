'use client';
import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unread = data?.unreadCount ?? 0;
  const notifications = data?.data ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-primary-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 last:border-0 ${!n.isRead ? 'bg-primary-50' : ''}`}
                >
                  <p className="text-sm text-gray-800 leading-snug">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
