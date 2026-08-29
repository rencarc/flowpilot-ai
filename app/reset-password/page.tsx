import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { Logo } from "@/components/ui";

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/" className="auth-brand"><Logo /></Link>
        <div>
          <p className="eyebrow dark">Secure update</p>
          <h1>Choose a new password</h1>
          <p>Use the recovery email link first, then set a new password for this account.</p>
        </div>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
