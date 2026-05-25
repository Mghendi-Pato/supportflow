'use client';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Ticket, CheckCircle2, Clock, TrendingUp, Users, ArrowRight,
} from 'lucide-react';
import { DashboardNavbar } from '@/components/layout/DashboardNavbar';
import { Card } from '@/components/ui/Card';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import api from '@/lib/api';
import type { DashboardAnalytics } from '@/types';

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardAnalytics>('dashboard', async () => {
    const res = await api.get('/analytics/dashboard');
    return res.data.data;
  });

  return (
    <div className="flex flex-col h-full">
      <DashboardNavbar title="Dashboard" />
      <main className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
        ) : data ? (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard icon={Ticket}       label="Total Tickets"   value={data.summary.totalTickets}    color="bg-primary-500" />
              <StatCard icon={Clock}        label="Open"            value={data.summary.openTickets}     color="bg-blue-500" />
              <StatCard icon={CheckCircle2} label="Closed"          value={data.summary.closedTickets}   color="bg-green-500" />
              <StatCard
                icon={TrendingUp}
                label="Avg Resolution"
                value={
                  data.summary.avgResolutionHours != null && data.summary.avgResolutionHours >= 0
                    ? `${data.summary.avgResolutionHours.toFixed(1)}h`
                    : '—'
                }
                color="bg-orange-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* By Status */}
              <Card>
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Tickets by Status</h2>
                <div className="space-y-3">
                  {data.byStatus.map((s) => {
                    const pct = data.summary.totalTickets > 0
                      ? Math.round((s.count / data.summary.totalTickets) * 100)
                      : 0;
                    return (
                      <div key={s.status}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{s.label}</span>
                          <span>{s.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Top Clients */}
              <Card>
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Users size={14} /> Top Clients
                </h2>
                <div className="space-y-3">
                  {data.byClient.slice(0, 5).map((c) => (
                    <div key={c.clientId} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.companyName}</p>
                        <p className="text-xs text-gray-400">{c.contactName}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-600">{c.ticketCount}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Recent Tickets */}
              <Card padding={false}>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">Recent Tickets</h2>
                  <Link href="/tickets" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.recentTickets.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tickets/${t.id}`}
                      className="flex items-start gap-3 px-6 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-gray-400">{t.ticketNumber}</p>
                        <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <StatusBadge status={t.status} />
                    </Link>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
