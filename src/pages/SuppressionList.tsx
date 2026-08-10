import { useEffect, useState, useCallback } from 'react';
import { Plus, Shield, Trash2, Loader2, Search } from 'lucide-react';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Modal } from '@/components/Modal';
import { fetchSuppression, addSuppression, removeSuppression } from '@/lib/services';
import { useToast } from '@/context/ToastContext';
import type { SuppressionRecord } from '@/types/database';

const reasons = ['all', 'unsubscribed', 'hard_bounce', 'spam_complaint', 'manual_block', 'invalid_email'];

const reasonLabels: Record<string, string> = {
  unsubscribed: 'Unsubscribed',
  hard_bounce: 'Hard Bounce',
  spam_complaint: 'Spam Complaint',
  manual_block: 'Manual Block',
  invalid_email: 'Invalid Email',
};

export function SuppressionList() {
  const { toast } = useToast();
  const [data, setData] = useState<SuppressionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState('manual_block');
  const [newNotes, setNewNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSuppression(reason, search || undefined);
      setData(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppression list');
    } finally {
      setLoading(false);
    }
  }, [reason, search]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newEmail) {
      toast('Email is required', 'warning');
      return;
    }
    setAdding(true);
    try {
      await addSuppression({ email: newEmail, reason: newReason, notes: newNotes });
      toast('Email added to suppression list', 'success');
      setShowAdd(false);
      setNewEmail('');
      setNewNotes('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this email from the suppression list?')) return;
    setRemoving(id);
    try {
      await removeSuppression(id);
      toast('Email removed from suppression list', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove', 'error');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {total} suppressed email{total !== 1 ? 's' : ''}. Emails on this list are automatically excluded from all campaigns.
        </p>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add to Suppression
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input w-auto">
            {reasons.map((r) => (
              <option key={r} value={r}>
                {r === 'all' ? 'All Reasons' : reasonLabels[r] || r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading message="Loading suppression list..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.length === 0 ? (
          <EmptyState icon={<Shield className="h-6 w-6" />} title="No suppressed emails" description="Add emails to the suppression list to prevent them from receiving campaigns." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-600">Email</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Reason</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Source</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Notes</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Date Added</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-neutral-100 table-row-hover">
                    <td className="px-4 py-3 text-neutral-900 font-medium">{row.email}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-neutral-100 text-neutral-600">{reasonLabels[row.reason] || row.reason}</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 capitalize">{row.source}</td>
                    <td className="px-4 py-3 text-neutral-600 max-w-xs truncate">{row.notes || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(row.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleRemove(row.id)} disabled={removing === row.id} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded">
                        {removing === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add to Suppression List" size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <label className="label">Reason</label>
            <select className="input" value={newReason} onChange={(e) => setNewReason(e.target.value)}>
              {reasons.filter((r) => r !== 'all').map((r) => (
                <option key={r} value={r}>{reasonLabels[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input className="input" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Reason for suppression" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAdd} disabled={adding} className="btn-primary">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
