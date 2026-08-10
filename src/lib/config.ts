// Centralized service configuration for the Cloudflare Worker integration.
// Change these values in one place to point to the production Worker route later.

export const WORKER_CONFIG = {
  // The Worker endpoint is kept server-side only (edge function secret).
  // The browser talks to the contacts-proxy edge function, never to the Worker directly.
  proxyFunction: 'contacts-proxy',

  // Personalization fields supported by the D1 contacts data.
  requestedFields: ['FullName', 'Username', 'Country', 'Email'] as const,

  // Aggressive batching: the Worker handles up to 5,000 emails per batch.
  batchSize: 5000,

  // Per-request timeout in milliseconds.
  requestTimeoutMs: 30000,
} as const;

export type WorkerRequestedField = (typeof WORKER_CONFIG.requestedFields)[number];

export interface WorkerBatchResponse {
  success: boolean;
  data?: {
    FullName?: string;
    Username?: string;
    Country?: string;
    Email?: string;
  };
  error?: string;
}

export interface D1Contact {
  id: number;
  user_id: string | null;
  session_id: string | null;
  email: string;
  full_name: string | null;
  username: string | null;
  country: string | null;
}

export interface ContactCountResponse {
  total: number;
}

export interface ContactRetrieveResponse {
  contacts: D1Contact[];
}

export interface ContactImportResponse {
  imported: number;
  skipped: number;
  error?: string;
}
