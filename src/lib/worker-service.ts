import { supabase } from '@/lib/supabase';
import {
  WORKER_CONFIG,
  type ContactCountResponse,
  type ContactRetrieveResponse,
  type ContactImportResponse,
  type D1Contact,
} from '@/lib/config';

// Isolated Cloudflare Worker integration service.
// The browser never talks to the Worker directly — all requests go through the
// contacts-proxy Supabase edge function, which holds the WORKER_AUTH_TOKEN secret.

export interface ResolvedPersonalization {
  FullName?: string;
  Username?: string;
  Country?: string;
  Email?: string;
}

export interface WorkerResult {
  email: string;
  success: boolean;
  data?: ResolvedPersonalization;
  error?: string;
}

// ─── D1 Contact operations (via contacts-proxy edge function) ──────────

export async function fetchContactCount(): Promise<number> {
  const { data, error } = await supabase.functions.invoke(WORKER_CONFIG.proxyFunction, {
    body: { action: 'count' },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return (data as ContactCountResponse).total ?? 0;
}

export async function fetchContacts(count: number): Promise<D1Contact[]> {
  const { data, error } = await supabase.functions.invoke(WORKER_CONFIG.proxyFunction, {
    body: { action: 'retrieve', count },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return (data as ContactRetrieveResponse).contacts ?? [];
}

export async function importContactsCsv(csv: string): Promise<ContactImportResponse> {
  const { data, error } = await supabase.functions.invoke(WORKER_CONFIG.proxyFunction, {
    body: { action: 'import', csv },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as ContactImportResponse;
}

// ─── Personalization helpers ───────────────────────────────────────────

export function applyPersonalization(
  html: string,
  data: ResolvedPersonalization
): string {
  let result = html;
  if (data.FullName) result = result.replaceAll('[[FullName]]', data.FullName);
  if (data.Username) result = result.replaceAll('[[Username]]', data.Username);
  if (data.Country) result = result.replaceAll('[[Country]]', data.Country);
  if (data.Email) result = result.replaceAll('[[Email]]', data.Email);
  return result;
}

export function applyContactPersonalization(html: string, contact: D1Contact): string {
  let result = html;
  if (contact.full_name) result = result.replaceAll('[[FullName]]', contact.full_name);
  if (contact.username) result = result.replaceAll('[[Username]]', contact.username);
  if (contact.country) result = result.replaceAll('[[Country]]', contact.country);
  if (contact.email) result = result.replaceAll('[[Email]]', contact.email);
  return result;
}
