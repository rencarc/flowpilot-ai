import { cache } from "react";
import { getCurrentUserContext } from "@/lib/cases";
import type { CaseRecord, WorkflowTemplateProposalRecord, WorkflowTemplateRecord } from "@/lib/supabase/types";

const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "that", "this", "before", "after", "request", "needs", "need", "into", "onto", "to", "of", "in", "on", "a", "an", "is", "are"]);

function keywordsFor(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .match(/[a-z0-9]{3,}/g)
        ?.filter((word) => !STOP_WORDS.has(word)) ?? []
    )
  );
}

export function recommendWorkflowTemplate(item: CaseRecord, templates: WorkflowTemplateRecord[]) {
  const query = keywordsFor(`${item.title} ${item.raw_request} ${item.department ?? ""} ${item.category ?? ""} ${item.priority ?? ""}`);

  if (query.length === 0 || templates.length === 0) {
    return null;
  }

  const candidates = templates
    .filter((template) => template.lifecycle_status === "approved" || template.lifecycle_status === "active")
    .map((template) => {
      const searchable = `${template.name} ${template.description ?? ""} ${template.category} ${template.trigger_condition} ${template.required_fields.join(" ")} ${template.risk_level}`;
      const words = new Set(keywordsFor(searchable));
      const keywordScore = query.reduce((total, word) => total + (words.has(word) ? 1 : 0), 0);
      const riskScore = item.risk_level && item.risk_level === template.risk_level ? 2 : 0;
      const categoryScore = item.category && template.category.toLowerCase().includes(item.category.toLowerCase()) ? 2 : 0;
      const score = keywordScore + riskScore + categoryScore;

      return { template, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

export const getVisibleWorkflowTemplates = cache(async () => {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile || profile.role === "requester") {
    return [];
  }

  const { data, error } = await supabase
    .from("workflow_templates")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<WorkflowTemplateRecord[]>();

  if (error) {
    console.error("Failed to load workflow templates", error);
    return [];
  }

  return data;
});

export const getVisibleWorkflowTemplateProposals = cache(async () => {
  const { supabase, user, profile } = await getCurrentUserContext();

  if (!user || !profile || profile.role === "requester") {
    return [];
  }

  const { data, error } = await supabase
    .from("workflow_template_proposals")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<WorkflowTemplateProposalRecord[]>();

  if (error) {
    console.error("Failed to load workflow template proposals", error);
    return [];
  }

  return data;
});
