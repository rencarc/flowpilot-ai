import { cache } from "react";
import { getCurrentUserContext } from "@/lib/cases";
import type { WorkflowTemplateProposalRecord, WorkflowTemplateRecord } from "@/lib/supabase/types";

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
