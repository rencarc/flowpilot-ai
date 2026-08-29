"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("My FlowPilot Workspace");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    const supabase = createClient();
    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: fullName,
              workspace_name: workspaceName
            }
          }
        })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (isSignup && !result.data.session) {
      setStatus("Check your email to confirm the account, then sign in.");
      return;
    }

    router.refresh();
    router.push("/dashboard");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {isSignup ? (
        <>
          <label>
            <span>Full name</span>
            <input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Zhen Xu" />
          </label>
          <label>
            <span>Workspace name</span>
            <input className="input" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Acme Internal Ops" />
          </label>
        </>
      ) : null}
      <label>
        <span>Email</span>
        <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
      </label>
      <label>
        <span>Password</span>
        <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
      </label>
      <button className="primary-btn auth-submit" type="submit" disabled={loading}>
        {loading ? "Working..." : isSignup ? "Create account" : "Sign in"}
      </button>
      {error ? <p className="auth-message error">{error}</p> : null}
      {status ? <p className="auth-message">{status}</p> : null}
      <p className="auth-switch">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create one"}</Link>
      </p>
      {!isSignup ? (
        <p className="auth-switch">
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      ) : null}
    </form>
  );
}
