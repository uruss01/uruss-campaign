'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const db = getSupabase();
    if (!db) return;
    void db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await db.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
      if (data) router.replace('/admin');
    });
  }, [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const db = getSupabase();
    if (!db) return setError('Connect Supabase to enable administrator sign in.');
    setSubmitting(true);
    setError('');
    try {
      const { data, error: loginError } = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (loginError) throw loginError;
      const { data: administrator, error: adminError } = await db.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle();
      if (adminError || !administrator) {
        await db.auth.signOut();
        throw new Error('This account is not authorized to access the campaign CMS.');
      }
      router.replace('/admin');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally { setSubmitting(false); }
  };

  return <main className="auth-layout">
    <div className="auth-panel">
      <Link href="/" className="back-link"><ArrowLeft size={17} /> Back to live dashboard</Link>
      <Image src="/brand/uruss-logo.png" width={208} height={54} alt="URUSS" className="auth-logo" priority />
      <div className="auth-badge"><ShieldCheck size={14} /> SECURE ADMIN ACCESS</div>
      <h1>Welcome back<span>.</span></h1>
      <p className="auth-description">Sign in to update campaign numbers, manage goals, and publish updates to every screen in real time.</p>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="email">Work email</label>
        <input id="email" type="email" autoComplete="username" required placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="password">Password</label>
        <div className="password-wrap"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Your password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!isSupabaseConfigured() && <p className="form-warning">Supabase environment variables have not been configured yet. See README.md for setup.</p>}
        <button className="button button-primary auth-submit" type="submit" disabled={submitting || !isSupabaseConfigured()}>{submitting ? 'Signing in…' : 'Sign in to CMS'} <ArrowRight size={17} /></button>
        <Link href="/admin/reset-password" className="forgot-link">Forgot your password?</Link>
      </form>
      <div className="auth-bottom"><LockKeyhole size={14} /> Authorized URUSS administrators only</div>
    </div>
    <div className="auth-feature">
      <div className="feature-sticker"><span className="feature-sticker-dot" /> LIVE CONTROL CENTRE</div>
      <div className="auth-feature-content"><div className="feature-star">✳</div><p>ONE TEAM.<br /><span>ONE TARGET.</span><br />ONE MISSION.</p><div className="feature-line" /><span className="feature-footer">Q4 CAMPAIGN / 2026</span></div>
    </div>
  </main>;
}
