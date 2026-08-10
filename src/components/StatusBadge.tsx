interface BadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Campaign statuses
  draft: { label: 'Draft', className: 'bg-neutral-100 text-neutral-600' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-50 text-blue-700' },
  sending: { label: 'Sending', className: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700' },

  // Recipient / activity statuses
  pending: { label: 'Pending', className: 'bg-neutral-100 text-neutral-600' },
  sent: { label: 'Sent', className: 'bg-blue-50 text-blue-700' },
  delivered: { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700' },
  opened: { label: 'Opened', className: 'bg-primary-50 text-primary-700' },
  clicked: { label: 'Clicked', className: 'bg-primary-50 text-primary-700' },
  bounced: { label: 'Bounced', className: 'bg-red-50 text-red-700' },
  complained: { label: 'Complained', className: 'bg-red-50 text-red-700' },
  suppressed: { label: 'Suppressed', className: 'bg-neutral-100 text-neutral-500' },
  skipped: { label: 'Skipped', className: 'bg-neutral-100 text-neutral-500' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700' },

  // Failure types
  hard_bounce: { label: 'Hard Bounce', className: 'bg-red-50 text-red-700' },
  soft_bounce: { label: 'Soft Bounce', className: 'bg-amber-50 text-amber-700' },
  spam_complaint: { label: 'Spam Complaint', className: 'bg-red-50 text-red-700' },

  // Suppression reasons
  unsubscribed: { label: 'Unsubscribed', className: 'bg-neutral-100 text-neutral-600' },
  manual_block: { label: 'Manual Block', className: 'bg-neutral-100 text-neutral-600' },
  invalid_email: { label: 'Invalid Email', className: 'bg-red-50 text-red-700' },

  // Domain auth
  verified: { label: 'Verified', className: 'bg-emerald-50 text-emerald-700' },
  'not_configured': { label: 'Not Configured', className: 'bg-neutral-100 text-neutral-500' },
  not_configured_: { label: 'Not Configured', className: 'bg-neutral-100 text-neutral-500' },

  // Provider
  connected: { label: 'Connected', className: 'bg-emerald-50 text-emerald-700' },
  disconnected: { label: 'Disconnected', className: 'bg-neutral-100 text-neutral-500' },

  // Test
  test: { label: 'Test', className: 'bg-amber-50 text-amber-700' },
};

export function StatusBadge({ status }: BadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-neutral-100 text-neutral-600' };
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}
