'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'react-query';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Mail, Phone, Building2, Ticket } from 'lucide-react';
import { DashboardNavbar } from '@/components/layout/DashboardNavbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge, PriorityBadge, Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import api from '@/lib/api';
import type { Client, Ticket as TicketType } from '@/types';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery(['client', id], async () => {
    const res = await api.get(`/clients/${id}`);
    return res.data.data as Client & { recentTickets: TicketType[] };
  });

  if (isLoading) return (
    <div className="flex flex-col h-full">
      <div className="flex justify-center items-center flex-1"><Spinner size="lg" /></div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="flex flex-col h-full">
      <DashboardNavbar
        title={data.companyName ?? data.contactName}
        actions={
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={16} /> Back
          </Button>
        }
      />
      <main className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 text-xl font-bold">
                  {(data.companyName ?? data.contactName)[0]}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{data.companyName}</h1>
                  <p className="text-gray-500">{data.contactName}</p>
                </div>
              </div>
              <Badge variant={data.isActive ? 'success' : 'default'}>
                {data.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail size={16} className="text-gray-400" />
                <a href={`mailto:${data.email}`} className="hover:text-primary-600">{data.email}</a>
              </div>
              {data.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={16} className="text-gray-400" />
                  {data.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 size={16} className="text-gray-400" />
                {data.companyName}
              </div>
            </div>

            {data.notes && (
              <div className="mt-5 pt-5 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Internal Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
          </div>

          {/* Tickets */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">Recent Tickets</h2>
              <Link href={`/tickets?clientId=${id}`} className="text-sm text-primary-600 hover:underline">
                View all
              </Link>
            </div>
            <Card padding={false}>
              {!data.recentTickets?.length ? (
                <EmptyState icon={Ticket} title="No tickets yet" description="Tickets for this client will appear here." />
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.recentTickets.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tickets/${t.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-gray-400">{t.ticketNumber}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
