import { useEffect, useState, useCallback } from 'react';
import { FlaskConical, Send, Loader2, Eye } from 'lucide-react';
import { Loading, ErrorState, EmptyState } from '@/components/States';
import { Modal } from '@/components/Modal';
import { fetchTemplates, fetchCampaigns, fetchTestEmails, createTestEmailRecord, updateTestEmailRecord } from '@/lib/services';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import type { EmailTemplate, Campaign, TestEmailRecord } from '@/types/database';

export function TestEnvironment() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [testEmails, setTestEmails] = useState<TestEmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [sourceType, setSourceType] = useState<'template' | 'campaign'>('template');
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c, te] = await Promise.all([
        fetchTemplates(),
        fetchCampaigns(),
        fetchTestEmails(),
      ]);
      setTemplates(t);
      setCampaigns(c);
      setTestEmails(te);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test environment');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getSelectedContent = (): { subject: string; html: string; senderName: string; senderEmail: string } | null => {
    if (sourceType === 'template') {
      const template = templates.find((t) => t.id === selectedSource);
      if (!template) return null;
      return {
        subject: template.subject,
        html: template.html_content,
        senderName: 'Test Sender',
        senderEmail: '',
      };
    } else {
      const campaign = campaigns.find((c) => c.id === selectedSource);
      if (!campaign) return null;
      return {
        subject: campaign.subject,
        html: campaign.html_content,
        senderName: campaign.sender_name,
        senderEmail: campaign.sender_email,
      };
    }
  };

  const handleSendTest = async () => {
    if (!testRecipient) {
      toast('Enter a test recipient email', 'warning');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testRecipient)) {
      toast('Enter a valid email address', 'warning');
      return;
    }
    if (!selectedSource) {
      toast('Select a template or campaign', 'warning');
      return;
    }
    const content = getSelectedContent();
    if (!content) {
      toast('Selected content not found', 'warning');
      return;
    }
    if (!content.subject?.trim()) {
      toast('Email subject is required', 'warning');
      return;
    }
    if (!content.html?.trim()) {
      toast('Email content is required', 'warning');
      return;
    }

    setSending(true);
    try {
      const record = await createTestEmailRecord({
        test_recipient_email: testRecipient,
        template_id: sourceType === 'template' ? selectedSource : null,
        campaign_id: sourceType === 'campaign' ? selectedSource : null,
        subject: content.subject,
        status: 'sending',
      });

      try {
        const { data, error: funcError } = await supabase.functions.invoke('send-test-email', {
          body: {
            to: testRecipient,
            subject: content.subject,
            html: content.html,
            senderName: content.senderName,
            senderEmail: content.senderEmail,
            testRecordId: record.id,
          },
        });

        // Edge functions return non-2xx on failure — supabase-js surfaces that
        // as funcError with a generic "Internal Server Error" message. The actual
        // error from Resend lives in the response body (data.error). Check both.
        const realError = data?.error || (funcError && funcError.message !== 'Internal Server Error' ? funcError.message : null);
        if (realError) throw new Error(realError);

        toast('Test email sent', 'success');
      } catch (sendErr) {
        let message = sendErr instanceof Error ? sendErr.message : 'Failed to send test';
        if (message === 'Internal Server Error') {
          message = 'The email service returned an error. Check that DEFAULT_FROM_EMAIL and RESEND_API_KEY secrets are configured.';
        }
        await updateTestEmailRecord(record.id, {
          status: 'failed',
          error_info: message,
        }).catch(() => {});
        toast(message, 'error');
      }
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create test record';
      toast(message, 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loading message="Loading test environment..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const previewContent = getSelectedContent();

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
            <FlaskConical className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Sandbox Test Environment</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Send test emails to verify your templates and campaigns before sending to your full audience. Test emails are logged separately and do not affect production campaigns.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Test Recipient Email</label>
            <input className="input" type="email" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} placeholder="test@example.com" />
          </div>

          <div>
            <label className="label">Source Type</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="sourceType" value="template" checked={sourceType === 'template'} onChange={() => { setSourceType('template'); setSelectedSource(''); }} />
                <span className="text-sm text-neutral-700">Template</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="sourceType" value="campaign" checked={sourceType === 'campaign'} onChange={() => { setSourceType('campaign'); setSelectedSource(''); }} />
                <span className="text-sm text-neutral-700">Campaign Draft</span>
              </label>
            </div>
          </div>

          <div>
            <label className="label">Select {sourceType === 'template' ? 'Template' : 'Campaign'}</label>
            <select className="input" value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
              <option value="">Select a {sourceType}...</option>
              {sourceType === 'template'
                ? templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))
                : campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(true)} disabled={!selectedSource} className="btn-secondary">
              <Eye className="h-4 w-4" /> Preview
            </button>
            <button onClick={handleSendTest} disabled={sending || !testRecipient || !selectedSource} className="btn-primary">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test Email
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">Test Email History</h3>
        </div>
        {testEmails.length === 0 ? (
          <EmptyState icon={<Send className="h-6 w-6" />} title="No test emails sent" description="Your test email history will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                  <th className="px-4 py-3 font-medium text-neutral-600">Recipient</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Subject</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Result</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {testEmails.map((te) => (
                  <tr key={te.id} className="border-b border-neutral-100 table-row-hover">
                    <td className="px-4 py-3 text-neutral-900 font-medium">{te.test_recipient_email}</td>
                    <td className="px-4 py-3 text-neutral-600">{te.subject || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${te.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : te.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        {te.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 max-w-xs truncate">{te.result || te.error_info || '—'}</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(te.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Test Email Preview" size="lg">
        {previewContent ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-neutral-200 p-3">
              <p className="text-xs text-neutral-500">Subject</p>
              <p className="text-sm font-medium text-neutral-900">{previewContent.subject || '(no subject)'}</p>
            </div>
            <div
              className="rounded-lg border border-neutral-200 p-4 text-sm"
              dangerouslySetInnerHTML={{
                __html: (previewContent.html || '<p>No content</p>')
                  .replaceAll('[[FullName]]', 'Test User')
                  .replaceAll('[[Country]]', 'United States')
                  .replaceAll('[[Email]]', 'test@example.com'),
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Select a template or campaign to preview.</p>
        )}
      </Modal>
    </div>
  );
}
