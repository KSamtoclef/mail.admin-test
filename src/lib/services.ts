import { supabase } from '@/lib/supabase';
import type {
  Campaign,
  EmailActivity,
  FailureReport,
  TransactionalLog,
  EmailTemplate,
  UserSegment,
  SuppressionRecord,
  Recipient,
  ProviderSettings,
  TestEmailRecord,
  CampaignRecipient,
  ResendDomain,
} from '@/types/database';

// ─── Dashboard Metrics (Resend-backed) ──────────────────────────────

export interface DashboardMetrics {
  totalSent: number;
  successfulDeliveries: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  failedDeliveries: number;
  bounces: number;
  spamComplaints: number;
  activeCampaigns: number;
  openTrackingEnabled: boolean;
  clickTrackingEnabled: boolean;
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await supabase.functions.invoke('resend-analytics');

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  if (!data) throw new Error('No analytics data returned');

  return {
    totalSent: data.totalSent ?? 0,
    successfulDeliveries: data.successfulDeliveries ?? 0,
    deliveryRate: data.deliveryRate ?? 0,
    openRate: data.openRate ?? 0,
    clickRate: data.clickThroughRate ?? 0,
    failedDeliveries: data.failedDeliveries ?? 0,
    bounces: data.bounces ?? 0,
    spamComplaints: data.spamComplaints ?? 0,
    activeCampaigns: data.activeCampaigns ?? 0,
    openTrackingEnabled: data.openTrackingEnabled ?? true,
    clickTrackingEnabled: data.clickTrackingEnabled ?? true,
  };
}

export interface DailyTrend {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
}

export async function fetchTrendData(days = 30): Promise<DailyTrend[]> {
  const { data, error } = await supabase.functions.invoke('resend-analytics');

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  const trends = (data?.trends ?? []) as DailyTrend[];
  return trends.slice(-Math.max(1, days));
}

// ─── Activity Log ──────────────────────────────────────────────────

export interface ActivityFilters {
  search?: string;
  status?: string;
  emailType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchActivity(filters: ActivityFilters = {}) {
  let query = supabase.from('email_activity').select('*', { count: 'exact' });

  if (filters.search) {
    query = query.or(`recipient_email.ilike.%${filters.search}%,campaign_name.ilike.%${filters.search}%`);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.emailType && filters.emailType !== 'all') {
    query = query.eq('email_type', filters.emailType);
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate + 'T23:59:59');
  }

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as EmailActivity[], total: count || 0 };
}

// ─── Failure Reports ───────────────────────────────────────────────

export async function fetchFailures(filters: ActivityFilters = {}) {
  let query = supabase.from('failure_reports').select('*', { count: 'exact' });

  if (filters.search) {
    query = query.or(`recipient_email.ilike.%${filters.search}%,campaign_name.ilike.%${filters.search}%`);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('failure_type', filters.status);
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate + 'T23:59:59');
  }

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as FailureReport[], total: count || 0 };
}

// ─── Campaigns ─────────────────────────────────────────────────────

export async function fetchCampaigns(status?: string) {
  let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as Campaign[];
}

export async function fetchCampaign(id: string) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Campaign | null;
}

export async function createCampaign(campaign: Partial<Campaign>) {
  const { data, error } = await supabase
    .from('campaigns')
    .insert(campaign)
    .select()
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function updateCampaign(id: string, updates: Partial<Campaign>) {
  const { data, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCampaignRecipients(campaignId: string, page = 1, pageSize = 20) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from('campaign_recipients')
    .select('*', { count: 'exact' })
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data as CampaignRecipient[], total: count || 0 };
}

// ─── Transactional Logs ────────────────────────────────────────────

export async function fetchTransactionalLogs(filters: ActivityFilters = {}) {
  let query = supabase.from('transactional_logs').select('*', { count: 'exact' });

  if (filters.search) {
    query = query.or(`recipient_email.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.emailType && filters.emailType !== 'all') {
    query = query.eq('email_type', filters.emailType);
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate + 'T23:59:59');
  }

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as TransactionalLog[], total: count || 0 };
}

// ─── Templates ─────────────────────────────────────────────────────

export async function fetchTemplates(category?: string) {
  let query = supabase.from('email_templates').select('*').order('updated_at', { ascending: false });
  if (category && category !== 'all') {
    query = query.eq('category', category);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as EmailTemplate[];
}

export async function fetchTemplate(id: string) {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as EmailTemplate | null;
}

export async function createTemplate(template: Partial<EmailTemplate>) {
  const { data, error } = await supabase
    .from('email_templates')
    .insert(template)
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function updateTemplate(id: string, updates: Partial<EmailTemplate>) {
  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as EmailTemplate;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from('email_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateTemplate(id: string) {
  const template = await fetchTemplate(id);
  if (!template) throw new Error('Template not found');
  const { name, category, subject, html_content, plain_text, supported_tags } = template;
  return createTemplate({
    name: `${name} (Copy)`,
    category,
    subject,
    html_content,
    plain_text,
    supported_tags,
    is_draft: true,
  });
}

// ─── Segments ──────────────────────────────────────────────────────

export async function fetchSegments() {
  const { data, error } = await supabase
    .from('user_segments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as UserSegment[];
}

export async function createSegment(segment: Partial<UserSegment>) {
  const { data, error } = await supabase
    .from('user_segments')
    .insert(segment)
    .select()
    .single();
  if (error) throw error;
  return data as UserSegment;
}

export async function updateSegment(id: string, updates: Partial<UserSegment>) {
  const { data, error } = await supabase
    .from('user_segments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as UserSegment;
}

export async function deleteSegment(id: string) {
  const { error } = await supabase.from('user_segments').delete().eq('id', id);
  if (error) throw error;
}

// ─── Suppression List ───────────────────────────────────────────────

export async function fetchSuppression(reason?: string, search?: string) {
  let query = supabase.from('suppression_list').select('*', { count: 'exact' });
  if (reason && reason !== 'all') {
    query = query.eq('reason', reason);
  }
  if (search) {
    query = query.ilike('email', `%${search}%`);
  }
  const { data, error, count } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return { data: data as SuppressionRecord[], total: count || 0 };
}

export async function addSuppression(record: { email: string; reason: string; source?: string; notes?: string }) {
  const { data, error } = await supabase
    .from('suppression_list')
    .insert({ ...record, email: record.email.trim().toLowerCase(), source: record.source || 'manual' })
    .select()
    .single();
  if (error) throw error;
  return data as SuppressionRecord;
}

export async function removeSuppression(id: string) {
  const { error } = await supabase.from('suppression_list').delete().eq('id', id);
  if (error) throw error;
}

export async function isSuppressed(email: string) {
  const { data } = await supabase
    .from('suppression_list')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  return !!data;
}

// ─── Recipients ────────────────────────────────────────────────────

export async function fetchRecipientsCount() {
  const { count } = await supabase
    .from('recipients')
    .select('*', { count: 'exact', head: true });
  return count || 0;
}

export async function fetchRecipients(page = 1, pageSize = 50, search?: string) {
  let query = supabase.from('recipients').select('*', { count: 'exact' });
  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,country.ilike.%${search}%`);
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order('created_at', { ascending: false }).range(from, to);
  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as Recipient[], total: count || 0 };
}

export async function fetchRecipientEmails(audienceType: string, segmentIds: string[]) {
  const query = supabase.from('recipients').select('email').eq('status', 'active');
  if (audienceType === 'segment' && segmentIds.length > 0) {
    // For segments, we need to resolve segment rules. For now, fetch all active
    // and let the edge function apply segment filtering.
    // A full implementation would evaluate segment rules here.
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => r.email);
}

// ─── Provider Settings ──────────────────────────────────────────────

export async function fetchProviderSettings() {
  const { data, error } = await supabase
    .from('provider_settings')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as ProviderSettings[];
}

export async function updateProviderSettings(id: string, updates: Partial<ProviderSettings>) {
  const { data, error } = await supabase
    .from('provider_settings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ProviderSettings;
}

// ─── Domain Auth (Resend-backed) ────────────────────────────────────

export async function fetchResendDomains(): Promise<ResendDomain[]> {
  const { data, error } = await supabase.functions.invoke('resend-domains', {
    body: { action: 'list' },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return (data?.domains ?? []) as ResendDomain[];
}

export async function verifyResendDomain(domainId: string): Promise<ResendDomain> {
  const { data, error } = await supabase.functions.invoke('resend-domains', {
    body: { action: 'verify', domainId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.domain as ResendDomain;
}

export async function createResendDomain(name: string, region = 'us-east-1'): Promise<ResendDomain> {
  const { data, error } = await supabase.functions.invoke('resend-domains', {
    body: { action: 'create', name, region },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.domain as ResendDomain;
}

export async function deleteResendDomain(domainId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('resend-domains', {
    body: { action: 'delete', domainId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

// ─── Test Emails ────────────────────────────────────────────────────

export async function fetchTestEmails() {
  const { data, error } = await supabase
    .from('test_email_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as TestEmailRecord[];
}

export async function createTestEmailRecord(record: Partial<TestEmailRecord>) {
  const { data, error } = await supabase
    .from('test_email_records')
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data as TestEmailRecord;
}

export async function updateTestEmailRecord(id: string, updates: Partial<TestEmailRecord>) {
  const { data, error } = await supabase
    .from('test_email_records')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as TestEmailRecord;
}
