import { useEffect, useState, useCallback } from 'react';
import { Search, Filter } from 'lucide-react';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination } from '@/components/Pagination';
import { fetchActivity, type ActivityFilters } from '@/lib/services';
import type { EmailActivity } from '@/types/database';

const PAGE_SIZE = 20;

export function ActivityLog() {
  const [data, setData] = useState<EmailActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [emailType, setEmailType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ActivityFilters = {
        search: search || undefined,
        status,
        emailType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        pageSize: PAGE_SIZE,
      };
      const result = await fetchActivity(filters);
      setData(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [search, status, emailType, startDate, endDate, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by recipient or campaign..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input w-auto">
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="bounced">Bounced</option>
              <option value="failed">Failed</option>
            </select>
            <select value={emailType} onChange={(e) => { setEmailType(e.target.value); setPage(1); }} className="input w-auto">
              <option value="all">All Types</option>
              <option value="broadcast">Broadcast</option>
              <option value="transactional">Transactional</option>
              <option value="test">Test</option>
            </select>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="input w-auto" />
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="input w-auto" />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading message="Loading activity..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.length === 0 ? (
          <EmptyState icon={<Filter className="h-6 w-6" />} title="No activity found" description="Try adjusting your filters or check back after sending campaigns." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                    <th className="px-4 py-3 font-medium text-neutral-600">Recipient</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Campaign</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Type</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Sent</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Delivered</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Opened</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Clicked</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Message ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 table-row-hover">
                      <td className="px-4 py-3 text-neutral-900 font-medium">{row.recipient_email}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.campaign_name || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600 capitalize">{row.email_type}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{row.sent_at ? new Date(row.sent_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{row.delivered_at ? new Date(row.delivered_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{row.opened_at ? new Date(row.opened_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{row.clicked_at ? new Date(row.clicked_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-neutral-400 text-xs font-mono">{row.provider_message_id ? row.provider_message_id.slice(0, 12) + '...' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
