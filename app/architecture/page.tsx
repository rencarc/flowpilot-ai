import Link from "next/link";
import { Logo, Panel, Tag } from "@/components/ui";
import { failureStates } from "@/lib/mock-data";

const layers = [
  {
    title: "Intake Layer",
    note: "Capture messy internal requests and turn them into normalized cases.",
    items: ["Employee request", "Raw intake form", "Structured output schema"]
  },
  {
    title: "Governance Layer",
    note: "Ground AI output in policy, risk rules, missing-info detection, and review gates.",
    items: ["Policy retrieval / pgvector", "Risk engine", "Missing info checks", "Human review"]
  },
  {
    title: "Handoff Layer",
    note: "Only approved cases can produce backend workflow runs and connector payloads.",
    items: ["Approved template match", "Payload preview", "Backend connector service", "Execution attempts"]
  },
  {
    title: "Audit Layer",
    note: "Every AI result, rule match, approval, handoff, retry, and failure is traceable.",
    items: ["Audit logs", "AI trace summary", "Run status", "Failure handling"]
  }
];

const aiCan = ["Structure messy requests", "Classify risk", "Detect missing fields", "Retrieve policy evidence", "Recommend templates", "Draft proposals"];
const aiCannot = ["Approve high-risk work", "Execute unapproved workflows", "Bypass reviewer approval", "Call production connectors from the browser", "Store connector secrets", "Silently ignore validation errors"];
const before = ["Email/chat intake", "Missing fields found late", "Unclear ownership", "Manual triage", "Inconsistent risk calls", "Weak audit trail"];
const after = ["Structured cases", "Missing info detected upfront", "Policy evidence attached", "Reviewer queue", "Backend-only handoff", "Tracked audit history"];
const boundarySteps = ["AI proposes", "System validates", "Reviewer approves", "Backend executes", "Audit logs everything"];

export default function ArchitecturePage() {
  return (
    <main className="public-page">
      <header className="public-nav">
        <Link href="/" className="no-underline"><Logo /></Link>
        <nav><Link href="/">Home</Link><Link href="/login">Sign in</Link></nav>
      </header>

      <section className="public-content">
        <div className="page-header-stack">
          <div className="page-header">
            <div>
              <h1>Architecture</h1>
              <p>Public overview of the governed AI intake, policy review, and safe workflow handoff model.</p>
            </div>
          </div>
        </div>

        <section className="architecture-hero">
          <div>
            <p className="eyebrow dark">Governed AI workflow layer</p>
            <h2>AI reasoning is separated from production execution.</h2>
            <p>
              FlowPilot AI structures and classifies requests, retrieves policy context, and proposes actions.
              Risky, incomplete, or unsupported work is blocked until deterministic validation and human approval pass.
            </p>
          </div>
          <div className="architecture-principle">
            <Tag tone="approved">Core boundary</Tag>
            <strong>No unapproved execution</strong>
            <span>Approved backend workflow runs are the only path to connector calls.</span>
          </div>
        </section>

        <div className="boundary-strip">
          {boundarySteps.map((step) => <span key={step}>{step}</span>)}
        </div>

        <Panel title="End-to-end system flow" tag={<Tag tone="approved">Approval boundary visible</Tag>}>
          <div className="system-map" aria-label="FlowPilot AI architecture map">
            <div className="map-node source"><span>01</span><strong>Employee Request</strong><small>Email, chat, form, or ops intake</small></div>
            <div className="map-connector" />
            <div className="map-node ai"><span>02</span><strong>AI Intake API</strong><small>Structured JSON output and confidence</small></div>
            <div className="map-connector" />
            <div className="map-node policy"><span>03</span><strong>Policy Retrieval</strong><small>RAG, citations, policy evidence</small></div>
            <div className="map-connector" />
            <div className="map-node risk"><span>04</span><strong>Risk Engine</strong><small>Missing information and risk gates</small></div>
            <div className="approval-gate"><div><span>Decision Gate</span><strong>Needs info / Human review / Approved</strong></div></div>
            <div className="post-gate-row">
              <div className="map-node review"><span>05A</span><strong>Human Review</strong><small>Approve, reject, request changes</small></div>
              <div className="map-node blocked"><span>05B</span><strong>Blocked State</strong><small>No handoff until required data exists</small></div>
              <div className="map-node handoff"><span>06</span><strong>Backend Handoff</strong><small>Approved template, idempotency, connector POST</small></div>
              <div className="map-node audit"><span>07</span><strong>Audit + Observability</strong><small>Trace AI, review, execution, retry, failure</small></div>
            </div>
          </div>
        </Panel>

        <div className="architecture-layers">
          {layers.map((layer) => (
            <article className="layer-card" key={layer.title}>
              <h3>{layer.title}</h3>
              <p>{layer.note}</p>
              <div className="pill-list">{layer.items.map((item) => <Tag key={item}>{item}</Tag>)}</div>
            </article>
          ))}
        </div>

        <div className="grid-2">
          <Panel title="AI safety boundary">
            <div className="safety-grid">
              <div><h3>AI can</h3><ul className="clean-list">{aiCan.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><h3>AI cannot</h3><ul className="clean-list cannot-list">{aiCannot.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          </Panel>
          <Panel title="Before / After">
            <div className="compare-table">
              <div><strong>Before FlowPilot</strong>{before.map((item) => <span key={item}>{item}</span>)}</div>
              <div><strong>After FlowPilot</strong>{after.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
          </Panel>
        </div>

        <Panel title="Safe failure handling" tag={<Tag tone="review">Designed to block safely</Tag>}>
          <div className="failure-grid">
            {failureStates.map((state) => <article className="failure-row" key={state.name}><h3>{state.name}</h3><p>{state.handling}</p></article>)}
          </div>
        </Panel>

        <Panel title="Interview talk track">
          <div className="talk-track">
            <p><strong>Chinese:</strong> 这个架构的核心是把 AI 推理和生产执行分开。AI 可以结构化请求、检索政策、判断风险并提出建议，但高风险、信息不完整或缺少政策依据的请求必须进入审核或阻塞状态。只有通过审批的 workflow run，才能由后端 connector 执行。</p>
            <p><strong>English:</strong> The key architectural decision is to separate AI reasoning from workflow execution. The AI can structure, classify, retrieve policy evidence, and propose actions, but risky or incomplete requests must pass validation and human review before any backend connector can execute a workflow.</p>
          </div>
        </Panel>
      </section>
    </main>
  );
}
