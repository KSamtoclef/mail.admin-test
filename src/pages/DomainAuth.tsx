import { useEffect, useState, useCallback } from 'react';
import { Plus, Globe, Trash2, Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Modal } from '@/components/Modal';
import {
  fetchResendDomains,
  verifyResendDomain,
  createResendDomain,
  deleteResendDomain,
} from '@/lib/services';
import { useToast } from '@/context/ToastContext';
import type { ResendDomain, ResendDomainRecord } from '@/types/database';

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  verified: { label: 'Verified', icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50' },
  pending: { label: 'Pending', icon: Clock, className: 'text-amber-600 bg-amber-50' },
  not_started: { label: 'Not Started', icon: Clock, className: 'text-neutral-500 bg-neutral-100' },
  failed: { label: 'Failed', icon: XCircle, className: 'text-red-600 bg-red-50' },
  temporary_failure: { label: 'Temporary Failure', icon: XCircle, className: 'text-amber-600 bg-amber-50' },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.not_started;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function RecordRow({ record }: { record: ResendDomainRecord }) {
  const isVerified = record.status === 'verified';
  return (
    <div className="flex items-start gap-3 py-3 border-t border-neutral-100 first:border-t-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-neutral-900">{record.type}</span>
          {isVerified ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          )}
        </div>
        <div className="space-y-1 text-xs text-neutral-500">
          <p><span className="font-medium text-neutral-600">Name:</span> <span className="font-mono break-all">{record.name || record.record}</span></p>
          {record.value && (
            <p><span className="font-medium text-neutral-600">Value:</span> <span className="font-mono break-all">{record.value}</span></p>
          )}
          <p><span className="font-medium text-neutral-600">TTL:</span> {record.ttl || 'Auto'}</p>
        </div>
      </div>
    </div>
  );
}

export function DomainAuth() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<ResendDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newRegion, setNewRegion] = useState('us-east-1');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchResendDomains();
      setDomains(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddDomain = async () => {
    if (!newDomain) {
      toast('Domain name is required', 'warning');
      return;
    }
    setAdding(true);
    try {
      await createResendDomain(newDomain, newRegion);
      toast('Domain created. Add the DNS records to verify it.', 'success');
      setShowAdd(false);
      setNewDomain('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add domain', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (domainId: string) => {
    setVerifying(domainId);
    try {
      const updated = await verifyResendDomain(domainId);
      if (updated.status === 'verified') {
        toast('Domain verified successfully!', 'success');
      } else {
        toast(`Verification status: ${updated.status}. DNS records may still be propagating.`, 'info');
      }
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to verify domain', 'error');
    } finally {
      setVerifying(null);
    }
  };

  const handleDelete = async (domain: ResendDomain) => {
    if (!confirm(`Delete domain ${domain.name}? This cannot be undone.`)) return;
    setDeleting(domain.id);
    try {
      await deleteResendDomain(domain.id);
      toast('Domain deleted', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete domain', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">Manage your sending domains and DNS authentication records via Resend.</p>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add Domain
        </button>
      </div>

      {loading ? (
        <Loading message="Loading domains..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : domains.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Globe className="h-6 w-6" />}
            title="No domains configured"
            description="Add a sending domain to get SPF, DKIM, and DMARC DNS records for authentication."
            action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="h-4 w-4" /> Add Domain</button>}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {domains.map((domain) => (
            <div key={domain.id} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-neutral-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">{domain.name}</h3>
                    {domain.region && (
                      <p className="text-xs text-neutral-400">Region: {domain.region}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={domain.status} />
                  <button
                    onClick={() => handleVerify(domain.id)}
                    disabled={verifying === domain.id}
                    className="btn-ghost text-xs px-2.5 py-1.5"
                  >
                    {verifying === domain.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Verify
                  </button>
                  <button
                    onClick={() => handleDelete(domain)}
                    disabled={deleting === domain.id}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    {deleting === domain.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {domain.records && domain.records.length > 0 ? (
                <div className="rounded-lg border border-neutral-200 px-4">
                  {domain.records.map((record, idx) => (
                    <RecordRow key={`${record.record}-${idx}`} record={record} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">No DNS records available. Click verify to check status.</p>
              )}

              {domain.open_tracking !== undefined && (
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${domain.open_tracking ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                    Open Tracking: {domain.open_tracking ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${domain.click_tracking ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                    Click Tracking: {domain.click_tracking ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Domain" size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Domain Name</label>
            <input className="input" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" />
          </div>
          <div>
            <label className="label">Region</label>
            <select className="input" value={newRegion} onChange={(e) => setNewRegion(e.target.value)}>
              <option value="us-east-1">US East (us-east-1)</option>
              <option value="eu-west-1">EU West (eu-west-1)</option>
              <option value="sa-east-1">SA East (sa-east-1)</option>
              <option value="ap-northeast-1">AP Northeast (ap-northeast-1)</option>
            </select>
          </div>
          <p className="text-sm text-neutral-500">
            Resend will generate SPF, DKIM, and DMARC DNS records. Add them to your DNS provider, then click Verify.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAddDomain} disabled={adding} className="btn-primary">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Domain
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
