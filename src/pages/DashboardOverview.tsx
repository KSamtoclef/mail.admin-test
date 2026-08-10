import { useEffect, useState } from 'react';
import { Mail, CheckCircle, Percent, Eye, MousePointerClick, XCircle, AlertTriangle, Megaphone, Info } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { Loading, ErrorState } from '@/components/States';
import { fetchDashboardMetrics, fetchTrendData, type DashboardMetrics, type DailyTrend } from '@/lib/services';

export function DashboardOverview() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, t] = await Promise.all([fetchDashboardMetrics(), fetchTrendData(30)]);
      setMetrics(m);
      setTrends(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading message="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!metrics) return null;

  const maxSent = Math.max(...trends.map((t) => t.sent), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Emails Sent" value={metrics.totalSent.toLocaleString()} icon={<Mail className="h-5 w-5" />} accent="blue" />
        <StatCard label="Successful Deliveries" value={metrics.successfulDeliveries.toLocaleString()} icon={<CheckCircle className="h-5 w-5" />} accent="green" />
        <StatCard label="Delivery Rate" value={`${metrics.deliveryRate.toFixed(1)}%`} icon={<Percent className="h-5 w-5" />} accent="blue" />
        <StatCard label="Open Rate" value={`${metrics.openRate.toFixed(1)}%`} icon={<Eye className="h-5 w-5" />} accent="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Click-Through Rate" value={`${metrics.clickRate.toFixed(1)}%`} icon={<MousePointerClick className="h-5 w-5" />} accent="blue" />
        <StatCard label="Failed Deliveries" value={metrics.failedDeliveries.toLocaleString()} icon={<XCircle className="h-5 w-5" />} accent="red" />
        <StatCard label="Bounces" value={metrics.bounces.toLocaleString()} icon={<AlertTriangle className="h-5 w-5" />} accent="amber" />
        <StatCard label="Spam Complaints" value={metrics.spamComplaints.toLocaleString()} icon={<AlertTriangle className="h-5 w-5" />} accent="red" />
      </div>

      {(!metrics.openTrackingEnabled || !metrics.clickTrackingEnabled) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Tracking is partially disabled</p>
            <p className="mt-0.5">
              {!metrics.openTrackingEnabled && 'Open tracking is disabled. '}
              {!metrics.clickTrackingEnabled && 'Click tracking is disabled. '}
              Enable them on your verified domain in Resend to see accurate open and click rates.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-neutral-900">Sending Volume (30 days)</h2>
            <span className="text-sm text-neutral-500">{metrics.activeCampaigns} active campaigns</span>
          </div>
          {trends.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-neutral-400">
              No sending activity yet
            </div>
          ) : (
            <div className="flex items-end gap-1 h-48">
              {trends.map((t) => (
                <div key={t.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex flex-col justify-end h-full gap-0.5">
                    <div
                      className="w-full rounded-t bg-primary-200 group-hover:bg-primary-300 transition-colors"
                      style={{ height: `${(t.opened / maxSent) * 100}%`, minHeight: t.opened > 0 ? '4px' : '0' }}
                      title={`Opened: ${t.opened}`}
                    />
                    <div
                      className="w-full rounded-t bg-primary-400 group-hover:bg-primary-500 transition-colors"
                      style={{ height: `${(t.delivered / maxSent) * 100}%`, minHeight: t.delivered > 0 ? '4px' : '0' }}
                      title={`Delivered: ${t.delivered}`}
                    />
                    <div
                      className="w-full rounded-t bg-primary-600 group-hover:bg-primary-700 transition-colors"
                      style={{ height: `${(t.sent / maxSent) * 100}%`, minHeight: t.sent > 0 ? '4px' : '0' }}
                      title={`Sent: ${t.sent}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary-600" /> Sent</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary-400" /> Delivered</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary-200" /> Opened</span>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-base font-semibold text-neutral-900 mb-4">Quick Stats</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
                  <Megaphone className="h-4 w-4 text-primary-600" />
                </div>
                <span className="text-sm text-neutral-600">Active Campaigns</span>
              </div>
              <span className="text-sm font-semibold text-neutral-900">{metrics.activeCampaigns}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-sm text-neutral-600">Delivery Rate</span>
              </div>
              <span className="text-sm font-semibold text-neutral-900">{metrics.deliveryRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
                  <Eye className="h-4 w-4 text-primary-600" />
                </div>
                <span className="text-sm text-neutral-600">Open Rate</span>
              </div>
              <span className="text-sm font-semibold text-neutral-900">{metrics.openRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-sm text-neutral-600">Failure Rate</span>
              </div>
              <span className="text-sm font-semibold text-neutral-900">
                {metrics.totalSent > 0 ? ((metrics.failedDeliveries / metrics.totalSent) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
