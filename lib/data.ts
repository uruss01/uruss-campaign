import type { CampaignSettings, DailySnapshot } from './types';
import { getSupabase } from './supabase';

export async function fetchCampaignData(): Promise<{ campaign: CampaignSettings; snapshots: DailySnapshot[] }> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured. Add the environment variables to connect your database.');
  const [campaignResponse, snapshotsResponse] = await Promise.all([
    supabase.from('campaign_settings').select('*').eq('id', 1).single(),
    supabase.from('daily_snapshots').select('*').order('report_date', { ascending: false }).limit(366),
  ]);
  if (campaignResponse.error) throw new Error(campaignResponse.error.message);
  if (snapshotsResponse.error) throw new Error(snapshotsResponse.error.message);
  return {
    campaign: campaignResponse.data as CampaignSettings,
    snapshots: (snapshotsResponse.data || []) as DailySnapshot[],
  };
}
