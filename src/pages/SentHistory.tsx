import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchCampaigns } from '@/lib/services';
import type { Campaign } from '@/types/database';

export function SentHistory() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchCampaigns();
      const sent = all.filter((c) => c.status === 'completed' || c.status === 'failed' || c.status === 'sending');
      setCampaigns(sent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sent history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="card overflow-hidden">
      {loading ? (
        <Loading message="Loading sent history..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : campaigns.length === 0 ? (
        <EmptyState icon={<Send className="h-6 w-6" />} title="No sent campaigns" description="Completed and in-progress campaigns will appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th className="px-4 py-3 font-medium text-neutral-600">Campaign</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Audience</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Recipients</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Delivered</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Failed</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Open Rate</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Click Rate</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Sent Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const openRate = c.delivered_count > 0 ? (c.opened_count / c.delivered_count) * 100 : 0;
                const clickRate = c.delivered_count > 0 ? (c.clicked_count / c.delivered_count) * 100 : 0;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-neutral-100 table-row-hover cursor-pointer"
                    onClick={() => navigate(`/sent/${c.id}`)}
                  >
                    <td className="px-4 py-3 text-neutral-900 font-medium">{c.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-neutral-600 capitalize">{c.audience_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.total_recipients || 0}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.delivered_count || 0}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.failed_count || 0}</td>
                    <td className="px-4 py-3 text-neutral-600">{openRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-neutral-600">{clickRate.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{c.started_at ? new Date(c.started_at).toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
