export type CampaignSettings = {
  id: number;
  title: string;
  period_label: string;
  campaign_tagline: string;
  target_collection: number;
  number_of_files: number;
  starts_on: string;
  ends_on: string;
  updated_at: string;
  updated_by?: string | null;
};

export type DailySnapshot = {
  report_date: string;
  collection_as_of_date: number | null;
  disbursed_files: number | null;
  updated_at: string;
  updated_by?: string | null;
};

export type AuditEvent = {
  id: number;
  table_name: string;
  record_key: string;
  action: string;
  actor_id: string | null;
  created_at: string;
  changes: Record<string, unknown> | null;
};

// These are the actual values provided in the brief, not simulated performance data.
// Only used for a clearly labelled preview before the Supabase project is connected.
export const BRIEF_CAMPAIGN: CampaignSettings = {
  id: 1,
  title: 'Q4 CAMPAIGN 2026',
  period_label: 'NOVEMBER 2026',
  campaign_tagline: 'One team. One target. Stronger together.',
  target_collection: 4000000,
  number_of_files: 200,
  starts_on: '2026-11-05',
  ends_on: '2027-01-03',
  updated_at: '2026-11-05T00:00:00+08:00',
};

export const BRIEF_SNAPSHOTS: DailySnapshot[] = [{
  report_date: '2026-11-05',
  collection_as_of_date: null,
  disbursed_files: 22,
  updated_at: '2026-11-05T00:00:00+08:00',
}];
