import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Logo } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/" className="auth-brand"><Logo /></Link>
        <div>
          <p className="eyebrow dark">Account recovery</p>
          <h1>Reset your password</h1>
          <p>Enter your email and Supabase will send a secure recovery link.</p>
        </div>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
