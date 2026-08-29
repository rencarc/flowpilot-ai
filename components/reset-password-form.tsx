"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function prepareRecoverySession() {
      const supabase = createClient();
      const queryParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = queryParams.get("code");
      const callbackError = queryParams.get("error_description") ?? queryParams.get("error");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (callbackError) {
        setError(callbackError);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }

        window.history.replaceState(null, "", window.location.pathname);
      } else if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        window.history.replaceState(null, "", window.location.pathname);
      }

      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (data.session) {
        setSessionReady(true);
        setStatus("Password reset session ready.");
      }
    }

    prepareRecoverySession();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      setLoading(false);
      setError("Open this page from the password reset email link, then set a new password.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setStatus("Password updated. Redirecting to sign in...");
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        <span>New password</span>
        <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
      </label>
      <label>
        <span>Confirm password</span>
        <input className="input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required />
      </label>
      <button className="primary-btn auth-submit" type="submit" disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </button>
      {!sessionReady ? <p className="auth-message">Waiting for a valid password reset session from Supabase.</p> : null}
      {error ? <p className="auth-message error">{error}</p> : null}
      {status ? <p className="auth-message">{status}</p> : null}
    </form>
  );
}
