import { useEffect, useState, useCallback } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Pagination } from '@/components/Pagination';
import { fetchFailures, type ActivityFilters } from '@/lib/services';
import type { FailureReport as FailureReportType } from '@/types/database';

const failureTypeLabels: Record<string, string> = {
  hard_bounce: 'Hard Bounce',
  soft_bounce: 'Soft Bounce',
  spam_complaint: 'Spam Complaint',
  failed: 'Failed Delivery',
  rejected: 'Rejected',
};

const PAGE_SIZE = 20;

export function FailureReport() {
  const [data, setData] = useState<FailureReportType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [failureType, setFailureType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ActivityFilters = {
        search: search || undefined,
        status: failureType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        pageSize: PAGE_SIZE,
      };
      const result = await fetchFailures(filters);
      setData(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load failure reports');
    } finally {
      setLoading(false);
    }
  }, [search, failureType, startDate, endDate, page]);

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
            <select value={failureType} onChange={(e) => { setFailureType(e.target.value); setPage(1); }} className="input w-auto">
              <option value="all">All Failure Types</option>
              <option value="hard_bounce">Hard Bounce</option>
              <option value="soft_bounce">Soft Bounce</option>
              <option value="spam_complaint">Spam Complaint</option>
              <option value="failed">Failed Delivery</option>
              <option value="rejected">Rejected</option>
            </select>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="input w-auto" />
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="input w-auto" />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading message="Loading failures..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.length === 0 ? (
          <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="No failures found" description="No delivery failures match your current filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                    <th className="px-4 py-3 font-medium text-neutral-600">Recipient</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Failure Type</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Reason</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Campaign</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Date</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Provider Response</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id} className="border-b border-neutral-100 table-row-hover">
                      <td className="px-4 py-3 text-neutral-900 font-medium">{row.recipient_email}</td>
                      <td className="px-4 py-3">
                        <span className="badge bg-red-50 text-red-700">{failureTypeLabels[row.failure_type] || row.failure_type}</span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 max-w-xs truncate" title={row.reason}>{row.reason || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{row.campaign_name || '—'}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs max-w-xs truncate font-mono" title={row.provider_response}>{row.provider_response || '—'}</td>
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
