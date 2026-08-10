import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Megaphone, Loader2 } from 'lucide-react';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchCampaigns, deleteCampaign } from '@/lib/services';
import { useToast } from '@/context/ToastContext';
import type { Campaign } from '@/types/database';

const statusTabs = ['all', 'draft', 'scheduled', 'sending', 'completed', 'failed'] as const;

export function Broadcasts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCampaigns(activeTab);
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load broadcasts');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this broadcast? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteCampaign(id);
      toast('Broadcast deleted', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 border-b border-neutral-200">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab === 'all' ? 'All' : tab}
            </button>
          ))}
        </div>
        <button onClick={() => navigate('/campaigns/broadcasts/new')} className="btn-primary">
          <Plus className="h-4 w-4" />
          New Broadcast
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading message="Loading broadcasts..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title="No broadcasts yet"
            description="Create your first broadcast to start sending emails to your audience."
            action={<button onClick={() => navigate('/campaigns/broadcasts/new')} className="btn-primary"><Plus className="h-4 w-4" /> New Broadcast</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-600">Name</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Subject</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Recipients</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Sent</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Failed</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Open Rate</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Created</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const openRate = c.delivered_count > 0 ? (c.opened_count / c.delivered_count) * 100 : 0;
                  return (
                    <tr key={c.id} className="border-b border-neutral-100 table-row-hover">
                      <td className="px-4 py-3 text-neutral-900 font-medium cursor-pointer" onClick={() => navigate(`/sent/${c.id}`)}>{c.name}</td>
                      <td className="px-4 py-3 text-neutral-600 max-w-xs truncate">{c.subject || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-neutral-600">{c.total_recipients || '—'}</td>
                      <td className="px-4 py-3 text-neutral-600">{c.sent_count || 0}</td>
                      <td className="px-4 py-3 text-neutral-600">{c.failed_count || 0}</td>
                      <td className="px-4 py-3 text-neutral-600">{openRate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => navigate(`/campaigns/broadcasts/${c.id}`)} className="text-primary-600 hover:text-primary-700 text-xs font-medium">Edit</button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deleting === c.id}
                            className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-40"
                          >
                            {deleting === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
