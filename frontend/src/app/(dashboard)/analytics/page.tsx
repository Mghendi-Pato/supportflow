'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { TrendingUp, Users, Award } from 'lucide-react';
import { DashboardNavbar } from '@/components/layout/DashboardNavbar';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

const DAYS_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [days, setDays] = useState('30');
  const isAdmin = user?.role === 'WORKSPACE_ADMIN' || user?.role === 'SUPER_ADMIN';

  const { data: trend, isLoading: trendLoading } = useQuery(
    ['trend', days],
    async () => {
      const res = await api.get(`/analytics/trend?days=${days}`);
      return res.data.data as { date: string; created: number; closed: number }[];
    }
  );

  const { data: workload, isLoading: workloadLoading } = useQuery(
    'agent-workload',
    async () => {
      const res = await api.get('/analytics/agent-workload');
      return res.data.data as {
        agent: { id: string; firstName: string; lastName: string; avatarUrl?: string };
        total: number;
        byStatus: Record<string, number>;
      }[];
    },
    { enabled: isAdmin }
  );

  // Find max for normalization
  const maxVal = Math.max(...(trend?.flatMap(d => [d.created, d.closed]) ?? [1]), 1);

  return (
    <div className="flex flex-col h-full">
      <DashboardNavbar title="Analytics" />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Trend chart */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-600" /> Ticket Trend
            </h2>
            <div className="w-40">
              <Select
                options={DAYS_OPTIONS}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          </div>

          {trendLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : trend && trend.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 h-40 min-w-max pb-4 px-2">
                {trend.map((d) => {
                  const createdH = Math.max((d.created / maxVal) * 128, 4);
                  const closedH  = Math.max((d.closed  / maxVal) * 128, 4);
                  return (
                    <div key={d.date} className="flex items-end gap-0.5 group relative" title={`${d.date}: ${d.created} created, ${d.closed} closed`}>
                      <div className="w-3 bg-primary-400 rounded-t transition-all" style={{ height: createdH }} />
                      <div className="w-3 bg-green-400 rounded-t transition-all" style={{ height: closedH }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-primary-400 inline-block" /> Created</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-400 inline-block" /> Closed</span>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">No trend data available</div>
          )}
        </Card>

        {/* Agent Workload (admin only) */}
        {isAdmin && (
          <Card>
            <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-5">
              <Award size={16} className="text-primary-600" /> Agent Workload
            </h2>
            {workloadLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : workload && workload.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent</th>
                      <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Open</th>
                      <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ongoing</th>
                      <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Waiting</th>
                      <th className="pb-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {workload.map((w) => (
                      <tr key={w.agent.id} className="hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900">
                          {w.agent.firstName} {w.agent.lastName}
                        </td>
                        <td className="py-3 text-gray-600">{w.byStatus['OPEN'] ?? 0}</td>
                        <td className="py-3 text-gray-600">{w.byStatus['IN_PROGRESS'] ?? 0}</td>
                        <td className="py-3 text-gray-600">{w.byStatus['WAITING'] ?? 0}</td>
                        <td className="py-3 font-semibold text-gray-900">{w.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-400">No workload data available</div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
