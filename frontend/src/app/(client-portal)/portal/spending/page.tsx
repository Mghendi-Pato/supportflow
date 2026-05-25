'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import { ArrowLeft, DollarSign, Receipt, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Input } from '@/components/ui/Input';
import api from '@/lib/api';

interface BillingRequest {
  id: string;
  amount: string;
  currency: string;
  description: string;
  status: 'ACCEPTED';
  acceptedAt: string;
  ticket: { id: string; ticketNumber: string; title: string };
  requestedBy: { firstName: string; lastName: string };
}

interface SpendingData {
  requests: BillingRequest[];
  totals: Record<string, number>;
  count: number;
}

// Get first/last day of current month as default range
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

export default function SpendingPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to,   setTo]   = useState(today());
  const [applied, setApplied] = useState({ from: firstOfMonth(), to: today() });

  const { data, isLoading } = useQuery<SpendingData>(
    ['spending', applied.from, applied.to],
    async () => {
      const res = await api.get(`/billing-requests/spending?from=${applied.from}&to=${applied.to}T23:59:59`);
      return res.data.data;
    }
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/portal" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Spending Summary</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your support charges across any date range</p>
        </div>
      </div>

      {/* Date range filter */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Input label="To" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <Button onClick={() => setApplied({ from, to })}>Apply</Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : !data ? null : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Object.entries(data.totals).length === 0 ? (
              <div className="col-span-3 text-center text-sm text-gray-400 py-4">No charges in this period</div>
            ) : (
              Object.entries(data.totals).map(([currency, total]) => (
                <Card key={currency}>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                      <TrendingUp size={18} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total ({currency})</p>
                      <p className="text-xl font-bold text-gray-900">
                        {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            )}
            <Card>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Receipt size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Transactions</p>
                  <p className="text-xl font-bold text-gray-900">{data.count}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Itemised list */}
          {data.requests.length > 0 && (
            <Card padding={false}>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Charge History</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {data.requests.map((r) => (
                  <div key={r.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <DollarSign size={14} className="text-green-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.description}</p>
                        <Link
                          href={`/portal/tickets/${r.ticket.id}`}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          {r.ticket.ticketNumber} — {r.ticket.title}
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">
                          By {r.requestedBy.firstName} {r.requestedBy.lastName} · Accepted {format(new Date(r.acceptedAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {r.currency} {Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.requests.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Receipt size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No approved charges in this period</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
