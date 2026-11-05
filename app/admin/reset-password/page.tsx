'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const db = getSupabase();
    if (!db) return;
    const { data: { subscription } } = db.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setResetMode(true);
    });
    // Supabase processes the recovery link before this page is rendered in some browsers.
    if (typeof window !== 'undefined' && (window.location.hash.includes('type=recovery') || window.location.search.includes('code='))) setResetMode(true);
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const db = getSupabase();
    if (!db) return setError('Supabase is not configured.');
    setBusy(true); setError(''); setMessage('');
    try {
      if (resetMode) {
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        const { error: resetError } = await db.auth.updateUser({ password });
        if (resetError) throw resetError;
        setMessage('Password updated. You can return to the admin dashboard.');
      } else {
        const { error: mailError } = await db.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/admin/reset-password`,
        });
        if (mailError) throw mailError;
        setMessage('If the email belongs to an account, a password reset link has been sent.');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to complete request.'); }
    finally { setBusy(false); }
  };

  return <main className="auth-layout"><section className="auth-panel reset-panel">
    <Link href="/admin/login" className="back-link"><ArrowLeft size={17} /> Back to sign in</Link>
    <Image src="/brand/uruss-logo.png" width={208} height={54} alt="URUSS" className="auth-logo" />
    <div className="auth-badge"><KeyRound size={14} /> ACCOUNT RECOVERY</div>
    <h1>{resetMode ? 'Set a new password' : 'Reset your password'}<span>.</span></h1>
    <p className="auth-description">{resetMode ? 'Enter a new password for your URUSS administrator account.' : 'We will send a secure recovery link to your registered admin email.'}</p>
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="recovery-field">{resetMode ? 'New password' : 'Admin email'}</label>
      <input id="recovery-field" required minLength={resetMode ? 8 : undefined} type={resetMode ? 'password' : 'email'} autoComplete={resetMode ? 'new-password' : 'email'} value={resetMode ? password : email} onChange={(event) => resetMode ? setPassword(event.target.value) : setEmail(event.target.value)} />
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Processing…' : resetMode ? 'Save new password' : 'Send recovery email'}</button>
    </form>
  </section><div className="auth-feature"><div className="auth-feature-content"><div className="feature-star">✳</div><p>YOUR<br /><span>CAMPAIGN.</span><br />SECURED.</p></div></div></main>;
}
