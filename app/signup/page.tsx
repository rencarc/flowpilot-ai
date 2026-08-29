import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/ui";

export default function SignupPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/" className="auth-brand"><Logo /></Link>
        <div>
          <p className="eyebrow dark">Create workspace</p>
          <h1>Create your FlowPilot workspace</h1>
          <p>New users start as requesters. Admin and reviewer roles are assigned after workspace setup.</p>
        </div>
        <AuthForm mode="signup" />
      </section>
    </main>
  );
}
