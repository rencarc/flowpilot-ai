"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setStatus("Check your email for the password reset link.");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        <span>Email</span>
        <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
      </label>
      <button className="primary-btn auth-submit" type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send reset link"}
      </button>
      {error ? <p className="auth-message error">{error}</p> : null}
      {status ? <p className="auth-message">{status}</p> : null}
      <p className="auth-switch">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
