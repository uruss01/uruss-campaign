'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, CalendarDays, CheckCheck, Clock3, Files, Maximize2, Minimize2, Sparkles, Target, TrendingUp, Wallet } from 'lucide-react';
import AnimatedNumber from './animated-number';
import { campaignTimeLeft, dateInMalaysia, dateTimeInMalaysia, durationDays, formatNumber, readableDate, timeInMalaysia } from '@/lib/date';
import { fetchCampaignData } from '@/lib/data';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { BRIEF_CAMPAIGN, BRIEF_SNAPSHOTS, type CampaignSettings, type DailySnapshot } from '@/lib/types';

type DashboardData = { campaign: CampaignSettings; snapshots: DailySnapshot[] };
type Status = 'preview' | 'loading' | 'live' | 'error';

type MetricCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  value: number | null;
  prefix?: string;
  accent?: 'emerald' | 'yellow' | 'white';
  label?: string;
  highlight?: boolean;
};

function MetricCard({ title, description, icon, value, prefix, accent = 'white', label, highlight = false }: MetricCardProps) {
  return <article className={`metric-card metric-${accent} ${highlight ? 'metric-highlight' : ''}`}>
    <div className="metric-heading"><span className="metric-icon">{icon}</span><span className="metric-eyebrow">{label || 'Q4 CAMPAIGN'}</span></div>
    <div className="metric-copy">
      <h2>{title}</h2>
      <div className="metric-number"><AnimatedNumber value={value} prefix={prefix} /></div>
      <p>{description}</p>
    </div>
    <span className="metric-corner" aria-hidden="true"><ArrowUpRight size={18} /></span>
  </article>;
}

function Countdown({ endsOn, clock }: { endsOn: string; clock: Date | null }) {
  const left = clock ? campaignTimeLeft(endsOn, clock.getTime()) : null;
  const units = [
    { label: 'DAYS', number: left?.days },
    { label: 'HRS', number: left?.hours },
    { label: 'MIN', number: left?.minutes },
    { label: 'SEC', number: left?.seconds },
  ];
  return <div className="countdown-units" role="timer" aria-label={left ? `${left.days} days, ${left.hours} hours, ${left.minutes} minutes, ${left.seconds} seconds remaining` : 'Loading countdown'}>
    {units.map((unit, i) => <div className="count-unit" key={unit.label}>
      <span className="count-digit" key={`${unit.label}-${unit.number ?? 'loading'}`}>{unit.number === undefined ? '––' : String(unit.number).padStart(2, '0')}</span>
      <span className="count-label">{unit.label}</span>
      {i < 3 && <span className="count-separator" aria-hidden="true">:</span>}
    </div>)}
  </div>;
}

export default function CampaignDashboard() {
  const connected = isSupabaseConfigured();
  const [data, setData] = useState<DashboardData | null>(connected ? null : { campaign: BRIEF_CAMPAIGN, snapshots: BRIEF_SNAPSHOTS });
  const [status, setStatus] = useState<Status>(connected ? 'loading' : 'preview');
  const [error, setError] = useState('');
  const [clock, setClock] = useState<Date | null>(null);
  const [flash, setFlash] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fingerprint = useRef('');
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboardContentRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!connected) return;
    try {
      const next = await fetchCampaignData();
      const nextPrint = JSON.stringify(next);
      const isChanged = Boolean(fingerprint.current) && fingerprint.current !== nextPrint;
      fingerprint.current = nextPrint;
      setData(next);
      setStatus('live');
      setError('');
      if (isChanged) {
        setFlash(true);
        if (flashTimeout.current) clearTimeout(flashTimeout.current);
        flashTimeout.current = setTimeout(() => setFlash(false), 2600);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cannot load campaign data.');
      setStatus((previous) => previous === 'live' ? previous : 'error');
    }
  }, [connected]);

  useEffect(() => {
    setClock(new Date());
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!connected) return;
    void refresh();
    const supabase = getSupabase();
    const channel = supabase?.channel('campaign-public-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_settings' }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_snapshots' }, () => { void refresh(); })
      .subscribe();
    // Polling backs up Realtime (e.g. a TV waking up after network sleep).
    const poll = setInterval(() => { void refresh(); }, 30000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisibility);
      if (channel) void supabase?.removeChannel(channel);
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, [connected, refresh]);

  // Keep the public display inside the visible viewport, even on short TV,
  // tablet and mobile screens. All campaign content stays visible and readable.
  useEffect(() => {
    const content = dashboardContentRef.current;
    if (!content) return;
    let frame = 0;
    const fitToViewport = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const naturalHeight = content.scrollHeight;
        const scale = Math.min(1, Math.max(0.1, (viewportHeight - 2) / Math.max(1, naturalHeight)));
        content.style.setProperty('--dashboard-fit', String(scale));
      });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitToViewport);
    observer?.observe(content);
    window.addEventListener('resize', fitToViewport);
    window.visualViewport?.addEventListener('resize', fitToViewport);
    if (document.fonts) void document.fonts.ready.then(fitToViewport);
    fitToViewport();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fitToViewport);
      window.visualViewport?.removeEventListener('resize', fitToViewport);
      cancelAnimationFrame(frame);
    };
  }, [status]);

  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* Fullscreen may be restricted by browser or display mode. */ }
  };

  if (status === 'loading') return <main className="status-screen"><div className="loader-ring" /><h1>Connecting to the live campaign</h1><p>Loading the latest URUSS performance data…</p></main>;
  if (status === 'error' || !data) return <main className="status-screen"><Image src="/brand/uruss-logo.png" alt="URUSS" width={240} height={65} priority /><h1>Campaign data is unavailable</h1><p>{error || 'Campaign information could not be retrieved.'}</p><button className="button button-primary" onClick={() => void refresh()}>Try again</button><Link href="/admin/login" className="status-link">Admin sign in</Link></main>;

  const { campaign, snapshots } = data;
  const today = dateInMalaysia(clock || new Date());
  const todayRecord = snapshots.find((item) => item.report_date === today);
  const latestCollected = snapshots.find((item) => item.collection_as_of_date !== null);
  const collection = latestCollected?.collection_as_of_date ?? null;
  const disbursed = todayRecord?.disbursed_files ?? null;
  const goalProgress = collection === null || campaign.target_collection <= 0 ? null : Math.min(collection / campaign.target_collection * 100, 100);
  const lastUpdated = [campaign.updated_at, ...snapshots.map((item) => item.updated_at)]
    .filter(Boolean).sort().reverse()[0];
  const totalDays = durationDays(campaign.starts_on, campaign.ends_on);

  return <main className={`dashboard ${flash ? 'dashboard-updated' : ''}`}>
    <div className="dashboard-mesh" aria-hidden="true" />
    <div className="dashboard-glow glow-a" aria-hidden="true" />
    <div className="dashboard-glow glow-b" aria-hidden="true" />
    <div className="floating-mark floating-one" aria-hidden="true">✳</div>
    <div className="floating-mark floating-two" aria-hidden="true">✦</div>
    {flash && <div className="celebrate" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 7) % 100}%`, animationDelay: `${i * 50}ms` }} />)}</div>}
    {flash && <div className="update-announcement" role="status"><Sparkles size={18} /> New campaign numbers are live!</div>}

    <div className="dashboard-content" ref={dashboardContentRef}>
      <header className="public-header">
        <div className="brand-area">
          <Image src="/brand/uruss-logo.png" alt="URUSS" width={224} height={56} className="brand-logo" priority />
          <div className="brand-divider" />
          <span className="brand-context">CAMPAIGN<br />COMMAND CENTRE</span>
        </div>
        <div className="header-actions">
          <div className={`live-indicator ${status === 'preview' || error ? 'is-preview' : ''}`}>
            <span className="live-dot" />{status === 'preview' ? 'DESIGN PREVIEW' : error ? 'OFFLINE · RETRYING' : 'LIVE DASHBOARD'}
          </div>
          <div className="header-clock"><Clock3 size={16} /><span>{clock ? timeInMalaysia(clock) : '—'}</span><span className="timezone">MYT</span></div>
          <button className="fullscreen-button" type="button" title={fullscreen ? 'Exit fullscreen' : 'Display fullscreen on TV'} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>
        </div>
      </header>
      {error && <div className="connection-warning" role="status">Connection interrupted. Displaying the last successful report and retrying automatically.</div>}

      <section className="campaign-hero">
        <div className="campaign-title-group">
          <div className="campaign-brow"><span className="brow-line" />{campaign.period_label}<span className="brow-spark">✦</span></div>
          <h1><span className="title-uruss">URUSS</span><br /><span className="title-gradient">{campaign.title}</span></h1>
          <p className="hero-tagline">{campaign.campaign_tagline}</p>
          <div className="campaign-dates"><CalendarDays size={16} />{readableDate(campaign.starts_on)} <span className="date-dash">—</span> {readableDate(campaign.ends_on)}<span className="campaign-duration">{totalDays}-DAY MISSION</span></div>
        </div>

        <div className="countdown-panel">
          <div className="countdown-header"><span><span className="countdown-live-dot" /> THE FINAL COUNTDOWN</span><span className="countdown-decoration">✳</span></div>
          <Countdown endsOn={campaign.ends_on} clock={clock} />
          <div className="countdown-bottom"><span><TrendingUp size={16} /> Every day counts. Keep pushing.</span><span>UNTIL {readableDate(campaign.ends_on).toUpperCase()}</span></div>
        </div>
      </section>

      <div className="section-label"><span>01 / LIVE PERFORMANCE</span><span className="section-label-right">THE NUMBERS THAT MATTER <Sparkles size={15} /></span></div>

      <section className="metrics-grid" aria-label="Live campaign metrics">
        <MetricCard title="TARGET COLLECTION" icon={<Target size={24} />} label="THE BIG GOAL" value={campaign.target_collection} prefix="RM " accent="emerald" description="Our Q4 collection target." highlight />
        <MetricCard title="NUMBER OF FILES" icon={<Files size={24} />} value={campaign.number_of_files} description="Campaign file count." />
        <MetricCard title={latestCollected && latestCollected.report_date !== today ? 'COLLECTION AS OF LAST REPORT' : 'COLLECTION AS OF TODAY'} icon={<Wallet size={24} />} value={collection} prefix="RM " accent="yellow" description={latestCollected ? `Latest recorded: ${readableDate(latestCollected.report_date)}` : 'Awaiting the first collection report.'} />
        <MetricCard title="DISBURSED FILES TODAY" icon={<CheckCheck size={24} />} value={disbursed} accent="emerald" description={todayRecord?.disbursed_files !== null && todayRecord?.disbursed_files !== undefined ? `Reported for ${readableDate(today)}.` : `Awaiting the report for ${readableDate(today)}.`} />
      </section>

      <section className="progress-strip" aria-label="Collection progress">
        <div className="progress-header"><span><Target size={17} /> JOURNEY TO {formatNumber(campaign.target_collection)}</span><strong>{goalProgress === null ? 'AWAITING REPORT' : `${goalProgress.toFixed(1)}%`}</strong></div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${goalProgress || 0}%` }} /></div>
        <div className="progress-foot"><span>THE MISSION IS ON</span><span>100% TARGET</span></div>
      </section>

      <footer className="dashboard-footer"><span>© URUSS {new Date().getFullYear()} <span className="footer-separator">•</span> TRUSTED GUIDANCE, SMARTER FINANCE</span><span className="footer-right"><span className="footer-update">{status === 'preview' ? 'Supabase not connected — preview of supplied brief' : `Last recorded update: ${lastUpdated ? dateTimeInMalaysia(lastUpdated) : 'Not yet reported'}`}</span><span className="footer-separator">·</span><Link href="/admin/login" className="admin-footer-link">ADMIN</Link></span></footer>
    </div>
  </main>;
}
