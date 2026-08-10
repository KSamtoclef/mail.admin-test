import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle, XCircle, Eye, MousePointerClick, AlertTriangle, Users } from 'lucide-react';
import { Loading, ErrorState, EmptyState } from '@/components/States';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination } from '@/components/Pagination';
import { fetchCampaign, fetchCampaignRecipients } from '@/lib/services';
import type { Campaign, CampaignRecipient } from '@/types/database';

const PAGE_SIZE = 20;

export function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await fetchCampaign(id!);
      if (!c) {
        setError('Campaign not found');
        return;
      }
      setCampaign(c);
      const { data, total } = await fetchCampaignRecipients(id!, page, PAGE_SIZE);
      setRecipients(data);
      setRecipientTotal(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading message="Loading campaign report..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!campaign) return null;

  const totalPages = Math.ceil(recipientTotal / PAGE_SIZE);
  const deliveryRate = campaign.sent_count > 0 ? (campaign.delivered_count / campaign.sent_count) * 100 : 0;
  const openRate = campaign.delivered_count > 0 ? (campaign.opened_count / campaign.delivered_count) * 100 : 0;
  const clickRate = campaign.delivered_count > 0 ? (campaign.clicked_count / campaign.delivered_count) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/sent')} className="btn-ghost px-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{campaign.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={campaign.status} />
            <span className="text-sm text-neutral-500">
              {campaign.started_at ? new Date(campaign.started_at).toLocaleString() : 'Not started'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Recipients" value={campaign.total_recipients} icon={<Users className="h-5 w-5" />} accent="blue" />
        <StatCard label="Successfully Sent" value={campaign.sent_count} icon={<Mail className="h-5 w-5" />} accent="blue" />
        <StatCard label="Delivery Rate" value={`${deliveryRate.toFixed(1)}%`} icon={<CheckCircle className="h-5 w-5" />} accent="green" />
        <StatCard label="Failed" value={campaign.failed_count} icon={<XCircle className="h-5 w-5" />} accent="red" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Delivered" value={campaign.delivered_count} icon={<CheckCircle className="h-5 w-5" />} accent="green" />
        <StatCard label="Opened" value={campaign.opened_count} icon={<Eye className="h-5 w-5" />} accent="blue" />
        <StatCard label="Clicked" value={campaign.clicked_count} icon={<MousePointerClick className="h-5 w-5" />} accent="blue" />
        <StatCard label="Bounced" value={campaign.bounced_count} icon={<AlertTriangle className="h-5 w-5" />} accent="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Open Rate" value={`${openRate.toFixed(1)}%`} accent="blue" />
        <StatCard label="Click-Through Rate" value={`${clickRate.toFixed(1)}%`} accent="blue" />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">Campaign Details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-neutral-500">Subject</p>
            <p className="text-sm text-neutral-900">{campaign.subject || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Sender</p>
            <p className="text-sm text-neutral-900">{campaign.sender_name} &lt;{campaign.sender_email}&gt;</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Audience</p>
            <p className="text-sm text-neutral-900 capitalize">{campaign.audience_type.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Suppressed</p>
            <p className="text-sm text-neutral-900">{campaign.suppressed_count} excluded</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">Recipient Results ({recipientTotal})</h3>
        </div>
        {recipients.length === 0 ? (
          <EmptyState title="No recipient data" description="Recipient results will appear here once the campaign starts sending." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                    <th className="px-4 py-3 font-medium text-neutral-600">Email</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Sent</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Delivered</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Opened</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Clicked</th>
                    <th className="px-4 py-3 font-medium text-neutral-600">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id} className="border-b border-neutral-100 table-row-hover">
                      <td className="px-4 py-3 text-neutral-900 font-medium">{r.email}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{r.delivered_at ? new Date(r.delivered_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{r.opened_at ? new Date(r.opened_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-neutral-500 text-xs">{r.clicked_at ? new Date(r.clicked_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-red-500 text-xs max-w-xs truncate" title={r.error_info || ''}>{r.error_info || '—'}</td>
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
