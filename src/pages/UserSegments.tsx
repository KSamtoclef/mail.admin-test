import { useEffect, useState, useCallback } from 'react';
import { Plus, Users, Trash2, Edit, Loader2 } from 'lucide-react';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Modal } from '@/components/Modal';
import { fetchSegments, createSegment, updateSegment, deleteSegment } from '@/lib/services';
import { useToast } from '@/context/ToastContext';
import type { UserSegment, SegmentRule } from '@/types/database';

const filterFields = [
  { value: 'country', label: 'Country' },
  { value: 'status', label: 'Status' },
  { value: 'created_at', label: 'Created Date' },
];

const operators = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
];

const blankForm: Partial<UserSegment> = {
  name: '',
  description: '',
  rules: [],
  estimated_count: 0,
};

export function UserSegments() {
  const { toast } = useToast();
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<UserSegment | null>(null);
  const [form, setForm] = useState<Partial<UserSegment>>(blankForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSegments();
      setSegments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(blankForm);
    setShowEditor(true);
  };

  const openEdit = (segment: UserSegment) => {
    setEditing(segment);
    setForm(segment);
    setShowEditor(true);
  };

  const addRule = () => {
    const rules = [...(form.rules || []), { field: 'country', operator: 'equals', value: '' }];
    setForm({ ...form, rules });
  };

  const updateRule = (index: number, key: keyof SegmentRule, value: string) => {
    const rules = [...(form.rules || [])];
    rules[index] = { ...rules[index], [key]: value };
    setForm({ ...form, rules });
  };

  const removeRule = (index: number) => {
    const rules = (form.rules || []).filter((_, i) => i !== index);
    setForm({ ...form, rules });
  };

  const handleSave = async () => {
    if (!form.name) {
      toast('Segment name is required', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, rules: form.rules || [] };
      if (editing) {
        await updateSegment(editing.id, payload);
        toast('Segment updated', 'success');
      } else {
        await createSegment(payload);
        toast('Segment created', 'success');
      }
      setShowEditor(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save segment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this segment?')) return;
    setDeleting(id);
    try {
      await deleteSegment(id);
      toast('Segment deleted', 'success');
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
        <p className="text-sm text-neutral-500">Create audience segments with filter rules to target specific recipient groups.</p>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Segment
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading message="Loading segments..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : segments.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No segments yet"
            description="Create segments to group recipients by country, status, or other attributes."
            action={<button onClick={openNew} className="btn-primary"><Plus className="h-4 w-4" /> New Segment</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-600">Name</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Description</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Rules</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Est. Count</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Created</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100 table-row-hover">
                    <td className="px-4 py-3 text-neutral-900 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-neutral-600 max-w-xs truncate">{s.description || '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{(s.rules || []).length} rule(s)</td>
                    <td className="px-4 py-3 text-neutral-600">{s.estimated_count || 0}</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded" title="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} disabled={deleting === s.id} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" title="Delete">
                          {deleting === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showEditor} onClose={() => setShowEditor(false)} title={editing ? 'Edit Segment' : 'New Segment'} size="lg">
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Segment Name</label>
            <input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. US Active Users" />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Filter Rules</label>
              <button onClick={addRule} className="btn-ghost text-sm px-2 py-1">
                <Plus className="h-3 w-3" /> Add Rule
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {(form.rules || []).map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className="input flex-1" value={rule.field} onChange={(e) => updateRule(i, 'field', e.target.value)}>
                    {filterFields.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <select className="input flex-1" value={rule.operator} onChange={(e) => updateRule(i, 'operator', e.target.value)}>
                    {operators.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input className="input flex-1" value={rule.value} onChange={(e) => updateRule(i, 'value', e.target.value)} placeholder="Value" />
                  <button onClick={() => removeRule(i)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {(form.rules || []).length === 0 && (
                <p className="text-sm text-neutral-400 py-4 text-center">No rules added. Add a rule to filter recipients.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowEditor(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
