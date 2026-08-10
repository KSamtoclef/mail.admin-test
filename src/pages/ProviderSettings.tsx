import { useEffect, useState, useCallback } from 'react';
import { Settings, Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { Loading, ErrorState } from '@/components/States';
import { fetchProviderSettings, updateProviderSettings } from '@/lib/services';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import type { ProviderSettings as ProviderSettingsType } from '@/types/database';

export function ProviderSettings() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<ProviderSettingsType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, { sender_name: string; sender_email: string; reply_to_email: string; connect_id: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProviderSettings();
      setProviders(data);
      const form: Record<string, typeof editForm[string]> = {};
      data.forEach((p) => {
        form[p.id] = {
          sender_name: p.sender_name,
          sender_email: p.sender_email,
          reply_to_email: p.reply_to_email,
          connect_id: p.connect_id,
        };
      });
      setEditForm(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load provider settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (provider: ProviderSettingsType) => {
    const form = editForm[provider.id];
    if (!form) return;
    setSaving(provider.id);
    try {
      await updateProviderSettings(provider.id, {
        sender_name: form.sender_name,
        sender_email: form.sender_email,
        reply_to_email: form.reply_to_email,
        connect_id: form.connect_id,
        is_connected: !!form.sender_email && !!form.connect_id,
      });
      toast('Provider settings saved', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleTestConnection = async (provider: ProviderSettingsType) => {
    setTesting(true);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('test-provider', {
        body: { providerId: provider.id },
      });
      if (funcError) throw new Error(funcError.message);
      if (data?.error) throw new Error(data.error);
      toast('Connection test successful', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Connection test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Loading message="Loading provider settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100">
            <Mail className="h-5 w-5 text-neutral-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Email Delivery Providers</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Configure your email delivery provider. The Resend API key is stored securely as an edge function secret and never exposed to the browser.
            </p>
          </div>
        </div>
      </div>

      {providers.map((provider) => {
        const form = editForm[provider.id] || { sender_name: '', sender_email: '', reply_to_email: '', connect_id: '' };
        return (
          <div key={provider.id} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
                  <Settings className="h-4 w-4 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 capitalize">{provider.provider_name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {provider.is_connected ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">Connected</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-neutral-400" />
                        <span className="text-xs text-neutral-500 font-medium">Not configured</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleTestConnection(provider)}
                disabled={testing}
                className="btn-secondary text-sm"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Test Connection
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Sender Name</label>
                <input
                  className="input"
                  value={form.sender_name}
                  onChange={(e) => setEditForm({ ...editForm, [provider.id]: { ...form, sender_name: e.target.value } })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="label">Sender Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.sender_email}
                  onChange={(e) => setEditForm({ ...editForm, [provider.id]: { ...form, sender_email: e.target.value } })}
                  placeholder="from@example.com"
                />
              </div>
              <div>
                <label className="label">Reply-To Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.reply_to_email}
                  onChange={(e) => setEditForm({ ...editForm, [provider.id]: { ...form, reply_to_email: e.target.value } })}
                  placeholder="reply@example.com"
                />
              </div>
              <div>
                <label className="label">Connect ID</label>
                <input
                  className="input"
                  value={form.connect_id}
                  onChange={(e) => setEditForm({ ...editForm, [provider.id]: { ...form, connect_id: e.target.value } })}
                  placeholder="CONNECT_ID_PLACEHOLDER"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => handleSave(provider)} disabled={saving === provider.id} className="btn-primary">
                {saving === provider.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        );
      })}

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-2">API Key Security</h3>
        <p className="text-sm text-neutral-500">
          The Resend API key is stored as an edge function secret and is never accessible from the browser. All email sending happens server-side through Supabase Edge Functions.
        </p>
        <p className="text-sm text-neutral-500 mt-2">
          To configure the API key, set the <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded font-mono">RESEND_API_KEY</code> secret on your Supabase project.
        </p>
      </div>
    </div>
  );
}
