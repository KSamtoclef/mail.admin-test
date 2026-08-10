// Database row types — mirror the Supabase schema.

export interface AdminProfile {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  avatar_url: string | null;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export interface Recipient {
  id: string;
  email: string;
  full_name: string | null;
  country: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserSegment {
  id: string;
  name: string;
  description: string;
  rules: SegmentRule[];
  estimated_count: number;
  created_at: string;
  updated_at: string;
}

export interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

export interface SuppressionRecord {
  id: string;
  email: string;
  reason: string;
  source: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  html_content: string;
  plain_text: string;
  supported_tags: string[];
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'failed';

export type AudienceType = 'all_users' | 'segment' | 'saved_audience' | 'd1_contacts';

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  reply_to_email: string;
  html_content: string;
  plain_text: string;
  audience_type: AudienceType;
  segment_ids: string[];
  batch_size: number;
  d1_contact_count: number;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  suppressed_count: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  complained_count: number;
  contact_count: number | null;
  created_at: string;
  updated_at: string;
}

export type CampaignRecipientStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'suppressed'
  | 'skipped';

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  email: string;
  status: CampaignRecipientStatus;
  provider_message_id: string | null;
  personalization: Record<string, string>;
  error_info: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailActivity {
  id: string;
  recipient_email: string;
  campaign_name: string | null;
  email_type: string;
  status: string;
  provider_message_id: string | null;
  error_info: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryEvent {
  id: string;
  campaign_recipient_id: string | null;
  event_type: string;
  provider_message_id: string | null;
  raw_data: Record<string, unknown>;
  created_at: string;
}

export interface FailureReport {
  id: string;
  recipient_email: string;
  failure_type: string;
  reason: string;
  campaign_id: string | null;
  campaign_name: string | null;
  provider_response: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionalLog {
  id: string;
  recipient_email: string;
  email_type: string;
  subject: string;
  status: string;
  provider_message_id: string | null;
  error_details: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderSettings {
  id: string;
  provider_name: string;
  is_active: boolean;
  is_connected: boolean;
  sender_name: string;
  sender_email: string;
  reply_to_email: string;
  connect_id: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DomainAuthRecord {
  id: string;
  domain: string;
  record_type: string;
  host: string;
  required_value: string;
  verification_status: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestEmailRecord {
  id: string;
  test_recipient_email: string;
  template_id: string | null;
  campaign_id: string | null;
  subject: string;
  status: string;
  result: string;
  error_info: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Resend Domain Types ──────────────────────────────────────────

export interface ResendDomainRecord {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value?: string;
  priority?: number;
}

export interface ResendDomain {
  id: string;
  name: string;
  status: string;
  created_at?: string;
  region?: string;
  open_tracking?: boolean;
  click_tracking?: boolean;
  tracking_subdomain?: string;
  capabilities?: {
    sending: string;
    receiving: string;
  };
  records?: ResendDomainRecord[];
}

// ─── Resend Analytics Types ────────────────────────────────────────

export interface ResendAnalytics {
  totalSent: number;
  successfulDeliveries: number;
  deliveryRate: number;
  openRate: number;
  clickThroughRate: number;
  failedDeliveries: number;
  bounces: number;
  spamComplaints: number;
  openTrackingEnabled: boolean;
  clickTrackingEnabled: boolean;
  activeCampaigns: number;
  trends: { date: string; sent: number; delivered: number; opened: number }[];
}
