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
        <nav><a href="#workflow">How it works</a><Link href="/architecture">Architecture</Link><Link href="/login">Sign in</Link></nav>
      </header>
      <div className="home-hero-grid">
        <div className="home-content">
          <p className="eyebrow">AI intake, risk control, workflow handoff</p>
          <h1>Turn unclear requests into safe, auditable workflows.</h1>
          <p className="home-sub">FlowPilot AI turns messy internal requests into structured cases, checks policy evidence, routes sensitive actions to human review, and logs every workflow handoff.</p>
          <div className="split-actions"><Link className="primary-btn" href="/login">Sign in to workspace</Link><Link className="glass-btn" href="/architecture">View architecture</Link></div>
        </div>
      </div>
      <div className="hero-flow" id="workflow">
        {steps.map((step, index) => <div className="flow-step" key={step.title}><span>0{index + 1}</span><strong>{step.title}</strong><small>{step.note}</small></div>)}
      </div>
    </section>
  );
}
