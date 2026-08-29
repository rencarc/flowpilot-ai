import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/" className="auth-brand"><Logo /></Link>
        <div>
          <p className="eyebrow dark">Workspace access</p>
          <h1>Sign in to FlowPilot AI</h1>
          <p>Access governed intake, review queues, workflow handoffs, and audit history.</p>
        </div>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
