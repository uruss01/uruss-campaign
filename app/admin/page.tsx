'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity, ArrowLeft, ArrowRight, CalendarCheck2, Check, CircleAlert, Clock3, ExternalLink,
  Files, History, LayoutDashboard, LogOut, Menu, RefreshCw, Save, Settings2, ShieldCheck,
  Sparkles, Target, TrendingUp, Wallet, X,
} from 'lucide-react';
import { fetchCampaignData } from '@/lib/data';
import { dateInMalaysia, dateTimeInMalaysia, formatMoney, formatNumber, readableDate } from '@/lib/date';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AuditEvent, CampaignSettings, DailySnapshot } from '@/lib/types';

type AdminTab = 'overview' | 'daily' | 'campaign' | 'history';
type CampaignForm = {
  title: string;
  period_label: string;
  campaign_tagline: string;
  target_collection: string;
  number_of_files: string;
  starts_on: string;
  ends_on: string;
};

function toCampaignForm(item: CampaignSettings): CampaignForm {
  return {
    title: item.title,
    period_label: item.period_label,
    campaign_tagline: item.campaign_tagline,
    target_collection: String(item.target_collection),
    number_of_files: String(item.number_of_files),
    starts_on: item.starts_on,
    ends_on: item.ends_on,
  };
}

function AdminStat({ icon, title, value, detail }: { icon: ReactNode; title: string; value: string; detail: string }) {
  return <div className="admin-stat"><div className="admin-stat-top"><span>{title}</span><span className="admin-stat-icon">{icon}</span></div><strong>{value}</strong><p>{detail}</p></div>;
}

function Field({ title, helper, children }: { title: string; helper?: string; children: ReactNode }) {
  return <div className="admin-field"><label>{title}</label>{children}{helper && <small>{helper}</small>}</div>;
}

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [tab, setTab] = useState<AdminTab>('overview');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [campaign, setCampaign] = useState<CampaignSettings | null>(null);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [campaignForm, setCampaignForm] = useState<CampaignForm | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [collectionInput, setCollectionInput] = useState('');
  const [disbursedInput, setDisbursedInput] = useState('');
  const [savingDaily, setSavingDaily] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [accountId, setAccountId] = useState('');

  const loadAll = useCallback(async (resetForm = false) => {
    const db = getSupabase();
    if (!db) return;
    setDataLoading(true);
    try {
      const [result, audit] = await Promise.all([
        fetchCampaignData(),
        db.from('audit_logs').select('id,table_name,record_key,action,actor_id,created_at,changes').order('created_at', { ascending: false }).limit(40),
      ]);
      setCampaign(result.campaign);
      setSnapshots(result.snapshots);
      if (resetForm) setCampaignForm(toCampaignForm(result.campaign));
      if (audit.error) throw audit.error;
      setHistory((audit.data || []) as AuditEvent[]);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Cannot load the CMS data.'); }
    finally { setDataLoading(false); }
  }, []);

  useEffect(() => {
    const db = getSupabase();
    if (!db) { setChecking(false); return; }
    let active = true;
    const verify = async () => {
      try {
        const { data: { user }, error: authError } = await db.auth.getUser();
        if (authError || !user) { router.replace('/admin/login'); return; }
        const { data, error: adminError } = await db.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
        if (adminError || !data) { router.replace('/admin/login'); return; }
        if (!active) return;
        setVerified(true);
        setEmail(user.email || 'Administrator');
        setAccountId(user.id);
        setSelectedDate(dateInMalaysia());
        void loadAll(true);
      } catch { router.replace('/admin/login'); }
      finally { if (active) setChecking(false); }
    };
    void verify();
    const { data: { subscription } } = db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/admin/login');
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router, loadAll]);

  useEffect(() => {
    if (!selectedDate) return;
    const item = snapshots.find((row) => row.report_date === selectedDate);
    setCollectionInput(item?.collection_as_of_date === null || item?.collection_as_of_date === undefined ? '' : String(item.collection_as_of_date));
    setDisbursedInput(item?.disbursed_files === null || item?.disbursed_files === undefined ? '' : String(item.disbursed_files));
  }, [selectedDate, snapshots]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  const switchTab = (next: AdminTab) => { setTab(next); setMobileMenu(false); setError(''); };
  const signOut = async () => { await getSupabase()?.auth.signOut(); router.replace('/admin/login'); };

  const saveDaily = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const db = getSupabase();
    if (!db || !campaign || !accountId) return;
    setError('');
    const c = collectionInput.trim() === '' ? null : Number(collectionInput);
    const d = disbursedInput.trim() === '' ? null : Number(disbursedInput);
    if (c === null && d === null) return setError('Enter at least one metric before publishing a report.');
    if ((c !== null && (!Number.isFinite(c) || c < 0 || c > 999999999999)) || (d !== null && (!Number.isSafeInteger(d) || d < 0 || d > 999999999))) return setError('Enter valid non-negative figures. Disbursed files must be a whole number.');
    if (selectedDate < campaign.starts_on || selectedDate > campaign.ends_on) return setError('The reporting date must be within the campaign start and end dates.');
    setSavingDaily(true);
    const { error: saveError } = await db.from('daily_snapshots').upsert({
      report_date: selectedDate,
      collection_as_of_date: c,
      disbursed_files: d,
      updated_by: accountId,
    }, { onConflict: 'report_date' });
    setSavingDaily(false);
    if (saveError) return setError(saveError.message);
    setToast(`Report for ${readableDate(selectedDate)} published to the live dashboard.`);
    await loadAll();
  };

  const saveCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const db = getSupabase();
    if (!db || !campaignForm || !accountId) return;
    setError('');
    const target = Number(campaignForm.target_collection);
    const files = Number(campaignForm.number_of_files);
    if (!campaignForm.title.trim() || !campaignForm.period_label.trim()) return setError('Campaign title and period are required.');
    if (!Number.isFinite(target) || target <= 0 || target > 999999999999) return setError('Target collection must be a positive amount.');
    if (!Number.isSafeInteger(files) || files < 0 || files > 999999999) return setError('Number of files must be a non-negative whole number.');
    if (campaignForm.ends_on < campaignForm.starts_on) return setError('End date must be on or after the start date.');
    setSavingCampaign(true);
    const { error: saveError } = await db.from('campaign_settings').update({
      title: campaignForm.title.trim(),
      period_label: campaignForm.period_label.trim(),
      campaign_tagline: campaignForm.campaign_tagline.trim(),
      target_collection: target,
      number_of_files: files,
      starts_on: campaignForm.starts_on,
      ends_on: campaignForm.ends_on,
      updated_by: accountId,
    }).eq('id', 1);
    setSavingCampaign(false);
    if (saveError) return setError(saveError.message);
    setToast('Campaign settings saved. Public screens will update automatically.');
    await loadAll(true);
  };

  if (checking || (!verified && isSupabaseConfigured())) return <main className="admin-loading"><div className="loader-ring" /><p>Verifying secure admin access…</p></main>;
  if (!isSupabaseConfigured()) return <main className="admin-loading"><Image src="/brand/uruss-logo.png" width={210} height={58} alt="URUSS" /><h1>Supabase connection required</h1><p>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, run the SQL migration, and create your admin account using the README instructions.</p><Link href="/" className="button button-primary">Back to dashboard</Link></main>;

  const today = dateInMalaysia();
  const todayRecord = snapshots.find((item) => item.report_date === today);
  const latestCollection = snapshots.find((item) => item.collection_as_of_date !== null);
  const todayFiles = todayRecord?.disbursed_files ?? null;
  const percent = campaign && latestCollection?.collection_as_of_date !== null && latestCollection?.collection_as_of_date !== undefined && campaign.target_collection > 0 ? Math.min(100, latestCollection.collection_as_of_date / campaign.target_collection * 100) : null;
  const navItems: { key: AdminTab; title: string; icon: ReactNode }[] = [
    { key: 'overview', title: 'Overview', icon: <LayoutDashboard size={19} /> },
    { key: 'daily', title: 'Daily Updates', icon: <CalendarCheck2 size={19} /> },
    { key: 'campaign', title: 'Campaign Settings', icon: <Settings2 size={19} /> },
    { key: 'history', title: 'Activity History', icon: <History size={19} /> },
  ];
  const headings: Record<AdminTab, { eyebrow: string; title: string; subtitle: string }> = {
    overview: { eyebrow: 'CONTROL CENTRE', title: 'Campaign overview', subtitle: 'Your Q4 performance at a glance, updated from Supabase.' },
    daily: { eyebrow: 'DAILY REPORTING', title: 'Publish daily numbers', subtitle: 'Save a report and every connected display refreshes automatically.' },
    campaign: { eyebrow: 'CAMPAIGN CONTROL', title: 'Campaign settings', subtitle: 'Set the target, file count, dates, and public dashboard messaging.' },
    history: { eyebrow: 'AUDIT LOG', title: 'Activity history', subtitle: 'See the latest changes published to your campaign.' },
  };

  return <main className="admin-layout">
    <aside className={`admin-sidebar ${mobileMenu ? 'sidebar-visible' : ''}`}>
      <div className="sidebar-brand"><Image src="/brand/uruss-logo.png" width={172} height={47} alt="URUSS" priority /><span className="sidebar-caption">CAMPAIGN CMS</span></div>
      <div className="sidebar-division" />
      <p className="sidebar-menu-label">WORKSPACE</p>
      <nav className="sidebar-nav" aria-label="CMS navigation">{navItems.map((item) => <button type="button" className={`sidebar-nav-item ${tab === item.key ? 'active' : ''}`} key={item.key} onClick={() => switchTab(item.key)}>{item.icon}<span>{item.title}</span>{tab === item.key && <span className="nav-active-marker" />}</button>)}</nav>
      <div className="sidebar-spacer" />
      <a className="sidebar-public-link" href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={18} /> Open live dashboard <ArrowRight size={16} /></a>
      <div className="sidebar-account"><span className="sidebar-avatar">{email.slice(0, 1).toUpperCase()}</span><span className="sidebar-identity"><strong>Administrator</strong><small title={email}>{email}</small></span><button type="button" className="logout-button" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}><LogOut size={18} /></button></div>
    </aside>
    {mobileMenu && <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}

    <div className="admin-main">
      <header className="admin-topbar"><button type="button" className="mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={23} /></button><div className="topbar-breadcrumb">URUSS <span>/</span> CAMPAIGN CMS <span>/</span> <strong>{navItems.find((item) => item.key === tab)?.title}</strong></div><div className="topbar-right"><span className="admin-live-tag"><span /> LIVE CONNECTED</span><button className="icon-button" type="button" title="Refresh data" aria-label="Refresh campaign data" disabled={dataLoading} onClick={() => void loadAll()}><RefreshCw size={18} className={dataLoading ? 'spin-icon' : ''} /></button></div></header>
      <div className="admin-content">
        <div className="admin-page-heading"><div><p className="admin-kicker"><span className="kicker-dash" />{headings[tab].eyebrow}</p><h1>{headings[tab].title}<span>.</span></h1><p className="admin-page-subtitle">{headings[tab].subtitle}</p></div><div className="heading-date"><Clock3 size={16} /> {readableDate(today)} <span>MYT</span></div></div>
        {error && <div className="admin-error" role="alert"><CircleAlert size={19} /><span>{error}</span><button type="button" title="Dismiss" onClick={() => setError('')}><X size={17} /></button></div>}
        {toast && <div className="admin-toast" role="status"><Check size={19} />{toast}<button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}

        {tab === 'overview' && <>
          <div className="overview-banner"><div><span className="banner-eyebrow"><Sparkles size={16} /> THE MISSION IS ON</span><h2>{campaign?.title || 'URUSS CAMPAIGN'}</h2><p>{campaign?.campaign_tagline || ''}</p><div className="banner-pill">{campaign?.period_label || 'CAMPAIGN'}</div></div><div className="banner-graphic" aria-hidden="true">✳<span>Q4</span></div></div>
          <div className="admin-stat-grid">
            <AdminStat icon={<Target size={20} />} title="Target collection" value={campaign ? formatMoney(campaign.target_collection) : '—'} detail="Campaign-wide target" />
            <AdminStat icon={<Files size={20} />} title="Number of files" value={campaign ? formatNumber(campaign.number_of_files) : '—'} detail="Current campaign file count" />
            <AdminStat icon={<Wallet size={20} />} title="Latest collection" value={latestCollection?.collection_as_of_date === null || latestCollection?.collection_as_of_date === undefined ? 'Not reported' : formatMoney(latestCollection.collection_as_of_date)} detail={latestCollection ? `As of ${readableDate(latestCollection.report_date)}` : 'Awaiting a collection report'} />
            <AdminStat icon={<Check size={20} />} title="Disbursed today" value={todayFiles === null ? 'Not reported' : formatNumber(todayFiles)} detail={`Reporting date ${readableDate(today)}`} />
          </div>
          <div className="admin-overview-grid">
            <section className="admin-surface"><div className="surface-header"><div><h2>Collection progress</h2><p>How close are we to our target?</p></div><TrendingUp size={21} /></div><div className="overview-percent">{percent === null ? '—' : `${percent.toFixed(1)}%`}<span>OF COLLECTION TARGET</span></div><div className="admin-progress"><span style={{ width: `${percent ?? 0}%` }} /></div><div className="progress-stat-row"><span>{latestCollection?.collection_as_of_date === null || latestCollection?.collection_as_of_date === undefined ? 'Awaiting collection report' : formatMoney(latestCollection.collection_as_of_date)}</span><span>{campaign ? formatMoney(campaign.target_collection) : '—'}</span></div></section>
            <section className="admin-surface quick-actions"><div className="surface-header"><div><h2>Quick actions</h2><p>Keep the campaign moving.</p></div><Activity size={21} /></div><button className="quick-action" type="button" onClick={() => { setSelectedDate(today); switchTab('daily'); }}><span className="quick-action-icon"><CalendarCheck2 size={21} /></span><span><strong>Update today&apos;s report</strong><small>Enter the latest collection &amp; disbursement figures</small></span><ArrowRight size={19} /></button><button className="quick-action" type="button" onClick={() => switchTab('campaign')}><span className="quick-action-icon"><Settings2 size={21} /></span><span><strong>Manage campaign settings</strong><small>Edit targets, file count, title and countdown</small></span><ArrowRight size={19} /></button><a className="quick-action" href="/" target="_blank" rel="noopener noreferrer"><span className="quick-action-icon"><ExternalLink size={21} /></span><span><strong>View public display</strong><small>Open the TV-ready live dashboard</small></span><ArrowRight size={19} /></a></section>
          </div>
          <section className="admin-surface recent-reports"><div className="surface-header"><div><h2>Recent daily reports</h2><p>Click a day to view or edit its figures.</p></div><button type="button" className="text-button" onClick={() => switchTab('daily')}>Add report <ArrowRight size={15} /></button></div>{snapshots.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>REPORT DATE</th><th>COLLECTION AS OF DATE</th><th>DISBURSED FILES</th><th>LAST EDITED</th><th /></tr></thead><tbody>{snapshots.slice(0, 6).map((row) => <tr key={row.report_date}><td><strong>{readableDate(row.report_date)}</strong></td><td>{row.collection_as_of_date === null ? 'Not reported' : formatMoney(row.collection_as_of_date)}</td><td>{row.disbursed_files === null ? 'Not reported' : formatNumber(row.disbursed_files)}</td><td>{dateTimeInMalaysia(row.updated_at)}</td><td><button type="button" className="table-edit" onClick={() => { setSelectedDate(row.report_date); switchTab('daily'); }}>Edit <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div> : <p className="empty-admin">No reports have been published yet.</p>}</section>
        </>}

        {tab === 'daily' && <div className="edit-grid"><section className="admin-surface form-surface"><div className="surface-header"><div><h2>Daily performance report</h2><p>One record per day. Saving the same date updates that record.</p></div><span className="surface-icon"><CalendarCheck2 size={21} /></span></div><form onSubmit={saveDaily} className="admin-edit-form"><Field title="Reporting date" helper="Dates use Malaysia time (UTC+08:00). Choose an earlier date to correct a previous report."><input type="date" required value={selectedDate} min={campaign?.starts_on} max={campaign?.ends_on} onChange={(event) => setSelectedDate(event.target.value)} /></Field><Field title="Total collection as of this date (RM)" helper="Cumulative collection as of the selected date. Leave blank if not yet reported."><div className="prefix-input"><span>RM</span><input type="number" inputMode="decimal" step="0.01" min="0" max="999999999999" placeholder="Enter recorded collection" value={collectionInput} onChange={(event) => setCollectionInput(event.target.value)} /></div></Field><Field title="Disbursed files on this day" helper="Daily figure, not a cumulative total. It is not carried forward to the next day."><input type="number" inputMode="numeric" step="1" min="0" max="999999999" placeholder="Enter daily file count" value={disbursedInput} onChange={(event) => setDisbursedInput(event.target.value)} /></Field><div className="form-notice"><ShieldCheck size={18} /> Only authorized administrators can publish or edit figures.</div><button className="button button-primary form-save" type="submit" disabled={savingDaily || !selectedDate}><Save size={18} />{savingDaily ? 'Publishing…' : 'Publish daily report'}<ArrowRight size={18} /></button></form></section>
          <aside className="form-help-column"><section className="admin-surface helpful-panel"><div className="helpful-icon"><Sparkles size={24} /></div><h3>Instantly on every screen.</h3><p>Once published, your updated numbers appear automatically on the public dashboard, complete with a smooth count-up animation and an update celebration.</p><span className="helpful-meta"><span className="online-dot" /> SUPABASE REALTIME ENABLED</span></section><section className="admin-surface report-summary"><h3>Selected report preview</h3><div><span>Reporting date</span><strong>{selectedDate ? readableDate(selectedDate) : '—'}</strong></div><div><span>Collection as of date</span><strong>{collectionInput.trim() === '' ? 'Not reported' : formatMoney(Number(collectionInput) || 0)}</strong></div><div><span>Disbursed files</span><strong>{disbursedInput.trim() === '' ? 'Not reported' : formatNumber(Number(disbursedInput) || 0)}</strong></div></section></aside>
        </div>}

        {tab === 'campaign' && campaignForm && <div className="edit-grid"><section className="admin-surface form-surface"><div className="surface-header"><div><h2>Campaign identity &amp; goals</h2><p>Changes are shown on the public campaign display.</p></div><span className="surface-icon"><Settings2 size={21} /></span></div><form onSubmit={saveCampaign} className="admin-edit-form">
          <div className="two-fields"><Field title="Campaign title"><input required maxLength={90} value={campaignForm.title} onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })} /></Field><Field title="Period label"><input required maxLength={50} value={campaignForm.period_label} onChange={(e) => setCampaignForm({ ...campaignForm, period_label: e.target.value })} /></Field></div>
          <Field title="Campaign tagline" helper="Short motivational message on the public dashboard."><input maxLength={140} value={campaignForm.campaign_tagline} onChange={(e) => setCampaignForm({ ...campaignForm, campaign_tagline: e.target.value })} /></Field>
          <div className="two-fields"><Field title="Target collection (RM)"><div className="prefix-input"><span>RM</span><input required type="number" min="1" max="999999999999" step="0.01" value={campaignForm.target_collection} onChange={(e) => setCampaignForm({ ...campaignForm, target_collection: e.target.value })} /></div></Field><Field title="Number of files"><input required type="number" min="0" max="999999999" step="1" value={campaignForm.number_of_files} onChange={(e) => setCampaignForm({ ...campaignForm, number_of_files: e.target.value })} /></Field></div>
          <div className="two-fields"><Field title="Campaign start date"><input required type="date" value={campaignForm.starts_on} onChange={(e) => setCampaignForm({ ...campaignForm, starts_on: e.target.value })} /></Field><Field title="Campaign end date" helper="The countdown stops at 11:59:59 PM MYT on this date."><input required type="date" min={campaignForm.starts_on} value={campaignForm.ends_on} onChange={(e) => setCampaignForm({ ...campaignForm, ends_on: e.target.value })} /></Field></div>
          <button className="button button-primary form-save" disabled={savingCampaign} type="submit"><Save size={18} />{savingCampaign ? 'Saving changes…' : 'Save campaign settings'}<ArrowRight size={18} /></button>
        </form></section><aside className="form-help-column"><section className="admin-surface helpful-panel"><div className="helpful-icon"><Target size={24} /></div><h3>Keep your goal in sight.</h3><p>Adjusting the goal, file count, or campaign dates automatically refreshes the public display. The countdown uses Malaysian time on every device.</p></section><section className="admin-surface report-summary"><h3>Campaign summary</h3><div><span>Campaign</span><strong>{campaignForm.title || '—'}</strong></div><div><span>Target</span><strong>{formatMoney(Number(campaignForm.target_collection) || 0)}</strong></div><div><span>Files</span><strong>{formatNumber(Number(campaignForm.number_of_files) || 0)}</strong></div><div><span>Ends</span><strong>{campaignForm.ends_on ? readableDate(campaignForm.ends_on) : '—'}</strong></div></section></aside></div>}

        {tab === 'history' && <section className="admin-surface history-surface"><div className="surface-header"><div><h2>Recent changes</h2><p>Recorded by database triggers after each successful save.</p></div><span className="surface-icon"><History size={21} /></span></div>{history.length ? <div className="history-list">{history.map((item) => <div key={item.id} className="history-item"><div className="history-icon">{item.table_name === 'daily_snapshots' ? <CalendarCheck2 size={20} /> : <Settings2 size={20} />}</div><div className="history-body"><strong>{item.table_name === 'daily_snapshots' ? 'Daily report' : 'Campaign settings'} {item.action === 'INSERT' ? 'created' : item.action === 'UPDATE' ? 'updated' : item.action.toLowerCase()}</strong><p>{item.table_name === 'daily_snapshots' ? `Report date: ${readableDate(item.record_key)}` : 'Campaign configuration changed'}</p></div><time>{dateTimeInMalaysia(item.created_at)}</time></div>)}</div> : <p className="empty-admin">No updates logged yet. Published edits will appear here.</p>}</section>}

        <footer className="admin-footer"><span>© URUSS 2026 · Campaign Management System</span><Link href="/" target="_blank">Public dashboard <ExternalLink size={14} /></Link></footer>
      </div>
    </div>
  </main>;
}
