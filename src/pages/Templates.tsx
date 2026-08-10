import { useEffect, useState, useCallback } from 'react';
import { Plus, Mail, Copy, Trash2, Edit, Eye, Loader2 } from 'lucide-react';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Modal } from '@/components/Modal';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
} from '@/lib/services';
import { useToast } from '@/context/ToastContext';
import type { EmailTemplate } from '@/types/database';

const categories = ['all', 'newsletter', 'product_update', 'announcement', 'transactional', 'custom'];

const blankTemplate: Partial<EmailTemplate> = {
  name: '',
  category: 'custom',
  subject: '',
  html_content: '',
  plain_text: '',
  supported_tags: ['FullName', 'Country', 'Email'],
  is_draft: true,
};

export function Templates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState<EmailTemplate | null>(null);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<Partial<EmailTemplate>>(blankTemplate);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTemplates(category);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(blankTemplate);
    setShowEditor(true);
  };

  const openEdit = (template: EmailTemplate) => {
    setEditing(template);
    setForm(template);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.subject) {
      toast('Name and subject are required', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateTemplate(editing.id, form);
        toast('Template updated', 'success');
      } else {
        await createTemplate(form);
        toast('Template created', 'success');
      }
      setShowEditor(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate(id);
      toast('Template duplicated', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to duplicate', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    setDeleting(id);
    try {
      await deleteTemplate(id);
      toast('Template deleted', 'success');
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
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                category === cat
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <Loading message="Loading templates..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-6 w-6" />}
            title="No templates yet"
            description="Create reusable email templates for newsletters, announcements, and more."
            action={<button onClick={openNew} className="btn-primary"><Plus className="h-4 w-4" /> New Template</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-600">Name</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Category</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Subject</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Updated</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-100 table-row-hover">
                    <td className="px-4 py-3 text-neutral-900 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-neutral-600 capitalize">{t.category.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-neutral-600 max-w-xs truncate">{t.subject || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${t.is_draft ? 'bg-neutral-100 text-neutral-600' : 'bg-emerald-50 text-emerald-700'}`}>
                        {t.is_draft ? 'Draft' : 'Published'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(t.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setShowPreview(t)} className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded" title="Preview">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(t)} className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded" title="Edit">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDuplicate(t.id)} className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded" title="Duplicate">
                          <Copy className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" title="Delete">
                          {deleting === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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

      <Modal open={showEditor} onClose={() => setShowEditor(false)} title={editing ? 'Edit Template' : 'New Template'} size="lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Template Name</label>
              <input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category || 'custom'} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.filter((c) => c !== 'all').map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={form.subject || ''} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="label">HTML Content</label>
            <textarea className="input min-h-[200px] font-mono text-xs" value={form.html_content || ''} onChange={(e) => setForm({ ...form, html_content: e.target.value })} />
          </div>
          <div>
            <label className="label">Plain Text (optional)</label>
            <textarea className="input min-h-[100px] text-xs" value={form.plain_text || ''} onChange={(e) => setForm({ ...form, plain_text: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_draft ?? true} onChange={(e) => setForm({ ...form, is_draft: e.target.checked })} />
            <span className="text-sm text-neutral-700">Save as draft</span>
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowEditor(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showPreview} onClose={() => setShowPreview(null)} title="Template Preview" size="lg">
        {showPreview && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-neutral-200 p-3">
              <p className="text-xs text-neutral-500">Subject</p>
              <p className="text-sm font-medium text-neutral-900">{showPreview.subject}</p>
            </div>
            <div
              className="rounded-lg border border-neutral-200 p-4 text-sm"
              dangerouslySetInnerHTML={{
                __html: (showPreview.html_content || '<p>No content</p>')
                  .replaceAll('[[FullName]]', 'Jane Doe')
                  .replaceAll('[[Country]]', 'United States')
                  .replaceAll('[[Email]]', 'jane@example.com'),
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
