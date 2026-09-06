"use client";

import Link from "next/link";
import { useState } from "react";
import { createCaseAction } from "@/app/actions";

type RequestSuggestion = {
  title: string;
  department: string;
  priority: string;
  details: string;
};

const departments = ["HR", "Finance", "IT", "Legal", "Operations", "Procurement", "Security"];
const priorities = ["Low", "Medium", "High", "Urgent"];

export function NewRequestForm({ defaultDueAt, suggestions }: { defaultDueAt: string; suggestions: RequestSuggestion[] }) {
  const [title, setTitle] = useState("Payroll admin access request");
  const [department, setDepartment] = useState("HR");
  const [priority, setPriority] = useState("High");
  const [details, setDetails] = useState(suggestions[0]?.details ?? "");

  function applySuggestion(suggestion: RequestSuggestion) {
    setTitle(suggestion.title);
    setDepartment(suggestion.department);
    setPriority(suggestion.priority);
    setDetails(suggestion.details);
  }

  return (
    <div className="create-layout">
      <form className="auth-form" action={createCaseAction}>
        <label><span>Title</span><input className="input" name="title" value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label>
          <span>Department</span>
          <select className="input" name="department" value={department} onChange={(event) => setDepartment(event.target.value)}>
            {departments.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select className="input" name="priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
            {priorities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Case due date</span>
          <input className="input" lang="en" name="due_at" type="datetime-local" defaultValue={defaultDueAt} />
          <small className="field-help">Target time for review or completion. Used for SLA and urgency.</small>
        </label>
        <label>
          <span>Request details</span>
          <textarea className="textarea" name="raw_request" value={details} onChange={(event) => setDetails(event.target.value)} required />
        </label>
        <div className="split-actions"><button className="primary-btn" type="submit">Create case</button><Link className="secondary-btn" href="/cases">Cancel</Link></div>
      </form>

      <div className="suggestion-stack">
        <h3>Suggested examples</h3>
        {suggestions.map((suggestion) => (
          <button className="example-btn" type="button" key={suggestion.title} onClick={() => applySuggestion(suggestion)}>
            <strong>{suggestion.title}</strong>
            <span>{suggestion.department} / {suggestion.priority}</span>
            <small>{suggestion.details}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
