import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Send, Eye, Tag, Loader2, Users, Calendar, Upload, Database } from 'lucide-react';
import { Loading, ErrorState } from '@/components/States';
import { Modal } from '@/components/Modal';
import {
  fetchCampaign,
  createCampaign,
  updateCampaign,
  fetchSegments,
  fetchRecipientsCount,
} from '@/lib/services';
import { fetchContactCount, importContactsCsv } from '@/lib/worker-service';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import type { Campaign, UserSegment, AudienceType } from '@/types/database';

const personalizationTags = ['[[FullName]]', '[[Username]]', '[[Country]]', '[[Email]]'];

export function BroadcastComposer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === undefined || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [recipientCount, setRecipientCount] = useState(0);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactCount, setContactCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Partial<Campaign>>({
    name: '',
    subject: '',
    sender_name: '',
    sender_email: '',
    reply_to_email: '',
    html_content: '',
    plain_text: '',
    audience_type: 'all_users' as AudienceType,
    segment_ids: [],
    batch_size: 100,
    d1_contact_count: 0,
    status: 'draft',
  });

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError(null);
    try {
      const campaign = await fetchCampaign(id!);
      if (!campaign) {
        setError('Campaign not found');
        return;
      }
      setForm(campaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
    fetchSegments().then(setSegments).catch(() => {});
    fetchRecipientsCount().then(setRecipientCount).catch(() => {});
    loadContactCount();
  }, [load]);

  const loadContactCount = useCallback(async () => {
    setContactsLoading(true);
    try {
      const total = await fetchContactCount();
      setContactCount(total);
    } catch {
      // Worker not configured yet — leave at 0
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const result = await importContactsCsv(text);
      toast(`Imported ${result.imported} contacts, skipped ${result.skipped}`, 'success');
      await loadContactCount();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'CSV import failed', 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const update = (field: keyof Campaign, value: string | string[] | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (status: 'draft' | 'scheduled' = 'draft') => {
    if (!form.name || !form.subject || !form.sender_email) {
      toast('Name, subject, and sender email are required', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, status };
      if (isNew) {
        const created = await createCampaign(payload);
        toast('Broadcast saved', 'success');
        navigate(`/campaigns/broadcasts/${created.id}`);
      } else {
        await updateCampaign(id!, payload);
        toast('Broadcast updated', 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!confirm('Send this broadcast now? This will process all eligible recipients.')) return;
    setSending(true);
    try {
      if (isNew) {
        const created = await createCampaign({ ...form, status: 'sending' });
        await triggerSend(created.id);
      } else {
        await updateCampaign(id!, { status: 'sending' });
        await triggerSend(id!);
      }
      toast('Broadcast sending started', 'success');
      navigate('/campaigns/broadcasts');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  };

  const triggerSend = async (campaignId: string) => {
    const { data: funcData, error: funcError } = await supabase.functions.invoke('send-campaign', {
      body: { campaignId, contactCount: form.d1_contact_count || 0 },
    });
    if (funcError) throw new Error(funcError.message);
    if (funcData?.error) throw new Error(funcData.error);
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast('Enter a test email address', 'warning');
      return;
    }
    setSendingTest(true);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('send-test-email', {
        body: {
          to: testEmail,
          subject: form.subject,
          html: form.html_content,
          senderName: form.sender_name,
          senderEmail: form.sender_email,
        },
      });
      if (funcError) throw new Error(funcError.message);
      if (data?.error) throw new Error(data.error);
      toast('Test email sent', 'success');
      setShowTestModal(false);
      setTestEmail('');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send test', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const insertTag = (tag: string) => {
    update('html_content', (form.html_content || '') + tag);
  };

  if (loading) return <Loading message="Loading broadcast..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/campaigns/broadcasts')} className="btn-ghost px-2">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-semibold text-neutral-900">
            {isNew ? 'New Broadcast' : 'Edit Broadcast'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTestModal(true)} className="btn-secondary">
            <Send className="h-4 w-4" /> Test
          </button>
          <button onClick={() => setShowPreview(true)} className="btn-secondary">
            <Eye className="h-4 w-4" /> Preview
          </button>
          <button onClick={() => handleSave('draft')} disabled={saving} className="btn-secondary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button onClick={handleSend} disabled={sending} className="btn-primary">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Campaign Details</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Internal Campaign Name</label>
                <input className="input" value={form.name || ''} onChange={(e) => update('name', e.target.value)} placeholder="e.g. August Newsletter" />
              </div>
              <div>
                <label className="label">Subject Line</label>
                <input className="input" value={form.subject || ''} onChange={(e) => update('subject', e.target.value)} placeholder="Email subject" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Sender Name</label>
                  <input className="input" value={form.sender_name || ''} onChange={(e) => update('sender_name', e.target.value)} placeholder="John Doe" />
                </div>
                <div>
                  <label className="label">Sender Email</label>
                  <input className="input" type="email" value={form.sender_email || ''} onChange={(e) => update('sender_email', e.target.value)} placeholder="from@example.com" />
                </div>
              </div>
              <div>
                <label className="label">Reply-To Email</label>
                <input className="input" type="email" value={form.reply_to_email || ''} onChange={(e) => update('reply_to_email', e.target.value)} placeholder="reply@example.com" />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900">Email Content</h3>
              <div className="flex items-center gap-1">
                {personalizationTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => insertTag(tag)}
                    className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition-colors"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="input min-h-[300px] font-mono text-xs"
              value={form.html_content || ''}
              onChange={(e) => update('html_content', e.target.value)}
              placeholder="Enter HTML email content. Use [[FullName]], [[Country]], [[Email]] for personalization."
            />
            <p className="mt-2 text-xs text-neutral-500">
              Insert personalization tags by clicking the buttons above. Tags are resolved from D1 contact data at send time.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" /> Audience
            </h3>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="audience"
                  value="all_users"
                  checked={form.audience_type === 'all_users'}
                  onChange={() => update('audience_type', 'all_users')}
                />
                <span className="text-sm text-neutral-700">All Users ({recipientCount})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="audience"
                  value="segment"
                  checked={form.audience_type === 'segment'}
                  onChange={() => update('audience_type', 'segment')}
                />
                <span className="text-sm text-neutral-700">User Segment</span>
              </label>
              {form.audience_type === 'segment' && (
                <select
                  className="input mt-1"
                  value={(form.segment_ids || [])[0] || ''}
                  onChange={(e) => update('segment_ids', e.target.value ? [e.target.value] : [])}
                >
                  <option value="">Select a segment</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.estimated_count})
                    </option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="audience"
                  value="saved_audience"
                  checked={form.audience_type === 'saved_audience'}
                  onChange={() => update('audience_type', 'saved_audience')}
                />
                <span className="text-sm text-neutral-700">Saved Audience</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="audience"
                  value="d1_contacts"
                  checked={form.audience_type === 'd1_contacts'}
                  onChange={() => update('audience_type', 'd1_contacts')}
                />
                <span className="text-sm text-neutral-700 flex items-center gap-1">
                  <Database className="h-3.5 w-3.5" />
                  D1 Contacts
                </span>
              </label>
              {form.audience_type === 'd1_contacts' && (
                <div className="ml-6 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-neutral-500">Available in D1</span>
                      <span className="text-sm font-semibold text-neutral-900">
                        {contactsLoading ? 'Loading…' : contactCount.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                      className="btn-secondary text-xs"
                    >
                      {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      Upload CSV
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <label className="label">How many contacts to send to</label>
                    <input
                      type="number"
                      className="input"
                      value={form.d1_contact_count || 0}
                      onChange={(e) => update('d1_contact_count', parseInt(e.target.value) || 0)}
                      min={0}
                      max={contactCount}
                      placeholder="0 = all available"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      {contactCount.toLocaleString()} contacts available. Enter 0 to send to all.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Schedule
            </h3>
            <div>
              <label className="label">Schedule for later (optional)</label>
              <input
                type="datetime-local"
                className="input"
                value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ''}
                onChange={(e) => update('scheduled_at', e.target.value ? new Date(e.target.value).toISOString() : '')}
              />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Batch Settings</h3>
            <div>
              <label className="label">Batch Size</label>
              <input
                type="number"
                className="input"
                value={form.batch_size || 100}
                onChange={(e) => update('batch_size', parseInt(e.target.value) || 100)}
                min={1}
                max={5000}
              />
              <p className="mt-2 text-xs text-neutral-500">
                Number of emails per batch. Max 5,000 per batch.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Email Preview" size="lg">
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Subject</p>
            <p className="text-sm font-medium text-neutral-900">{form.subject || '(no subject)'}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 overflow-hidden">
            <div className="bg-neutral-50 px-3 py-2 border-b border-neutral-200">
              <p className="text-xs text-neutral-500">From: {form.sender_name || ''} &lt;{form.sender_email || ''}&gt;</p>
            </div>
            <div
              className="p-4 text-sm"
              dangerouslySetInnerHTML={{
                __html: (form.html_content || '<p>No content yet</p>')
                  .replaceAll('[[FullName]]', 'Jane Doe')
                  .replaceAll('[[Username]]', 'jane')
                  .replaceAll('[[Country]]', 'United States')
                  .replaceAll('[[Email]]', 'jane@example.com'),
              }}
            />
          </div>
        </div>
      </Modal>

      <Modal open={showTestModal} onClose={() => setShowTestModal(false)} title="Send Test Email" size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Test Recipient Email</label>
            <input
              className="input"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
            />
          </div>
          <button onClick={handleSendTest} disabled={sendingTest} className="btn-primary w-full">
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Test
          </button>
        </div>
      </Modal>
    </div>
  );
}
