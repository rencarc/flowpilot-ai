import Link from "next/link";
import { Logo } from "@/components/ui";

export default function HomePage() {
  const steps = [
    { title: "Raw request", note: "Natural language intake" },
    { title: "Structured case", note: "Category, risk, missing fields" },
    { title: "Human gate", note: "Review high-risk actions" },
    { title: "Audit trail", note: "Trace every decision" }
  ];

  return (
    <section className="home-page">
      <div className="home-bg" />
      <div className="home-overlay" />
      <div className="home-data-overlay" />
      <header className="home-nav">
        <Logo />
        <nav><Link href="/dashboard">Platform</Link><Link href="/workflows">Workflows</Link><Link href="/architecture">Architecture</Link><Link href="/login">Sign in</Link></nav>
      </header>
      <div className="home-hero-grid">
        <div className="home-content">
          <p className="eyebrow">AI intake, risk control, workflow handoff</p>
          <h1>Turn unclear requests into safe, auditable workflows.</h1>
          <p className="home-sub">FlowPilot AI turns messy internal requests into structured cases, checks policy evidence, routes sensitive actions to human review, and logs every workflow handoff.</p>
          <div className="split-actions"><Link className="primary-btn" href="/dashboard">Enter demo workspace</Link><Link className="glass-btn" href="/new-request">View workflow</Link></div>
        </div>
        <aside className="hero-preview" aria-label="FlowPilot AI case preview">
          <div className="preview-top"><span>Case preview</span><strong>Review required</strong></div>
          <h2>Vendor bank detail change</h2>
          <p>Unclear finance request normalized into a controlled workflow handoff.</p>
          <div className="preview-grid">
            <span>Risk</span><strong>High</strong>
            <span>Policy match</span><strong>Manual verification</strong>
            <span>Missing info</span><strong>Approver evidence</strong>
            <span>Audit</span><strong>4 events logged</strong>
          </div>
          <div className="preview-line"><i /></div>
        </aside>
      </div>
      <div className="hero-flow">
        {steps.map((step, index) => <div className="flow-step" key={step.title}><span>0{index + 1}</span><strong>{step.title}</strong><small>{step.note}</small></div>)}
      </div>
    </section>
  );
}
