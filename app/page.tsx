import Link from "next/link";
import { Logo } from "@/components/ui";

export default function HomePage() {
  const steps = ["Raw request", "AI structure", "Review required", "Audit logged"];
  return (
    <section className="home-page">
      <div className="home-bg" />
      <div className="home-overlay" />
      <header className="home-nav">
        <Logo />
        <nav><Link href="/dashboard">Platform</Link><Link href="/workflows">Workflows</Link><Link href="/architecture">Architecture</Link><Link href="/login">Sign in</Link></nav>
      </header>
      <div className="home-content">
        <p className="eyebrow">AI intake, risk control, workflow handoff</p>
        <h1>Turn unclear requests into safe, auditable workflows.</h1>
        <p className="home-sub">FlowPilot AI structures messy employee and operations requests, checks policy rules, detects missing information, and routes approved handoffs to the right workflow template.</p>
        <div className="split-actions"><Link className="primary-btn" href="/dashboard">Enter demo workspace</Link><Link className="glass-btn" href="/new-request">Watch workflow</Link></div>
      </div>
      <div className="hero-flow">
        {steps.map((step, index) => <div className="flow-step" key={step}><span>0{index + 1}</span><strong>{step}</strong><small>{["Noisy internal ask", "Fields + risk level", "Human gate if needed", "Trace every decision"][index]}</small></div>)}
      </div>
    </section>
  );
}
