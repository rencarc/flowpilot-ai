import { cache } from "react";
import { getCurrentUserContext } from "@/lib/cases";
import type { CaseRecord } from "@/lib/supabase/types";

export interface PolicyRecord {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  source_type: string;
  source_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PolicyChunkRecord {
  id: string;
  policy_id: string;
  workspace_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  policies?: { title: string; source_url: string | null } | Array<{ title: string; source_url: string | null }> | null;
}

export interface PolicyCitation {
  policy_id: string;
  policy_title: string;
  source_url: string | null;
  chunk_id: string;
  excerpt: string;
  score: number;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "before",
  "after",
  "needs",
  "need",
  "request",
  "access",
  "temporary",
  "please",
  "because",
  "into",
  "onto",
  "to",
  "of",
  "in",
  "on",
  "a",
  "an",
  "is",
  "are"
]);

export function splitPolicyContent(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs;
  }

  return normalized.match(/[\s\S]{1,900}(?:\s+|$)/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
}

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

function policyTitle(policy: PolicyChunkRecord["policies"]) {
  if (Array.isArray(policy)) {
    return policy[0]?.title ?? "Untitled policy";
  }

  return policy?.title ?? "Untitled policy";
}

function policySource(policy: PolicyChunkRecord["policies"]) {
  if (Array.isArray(policy)) {
    return policy[0]?.source_url ?? null;
  }

  return policy?.source_url ?? null;
}

export const getVisiblePolicies = cache(async () => {
  const { supabase, user } = await getCurrentUserContext();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<PolicyRecord[]>();

  if (error) {
    console.error("Failed to load policies", error);
    return [];
  }

  return data;
});

export const getVisiblePolicyChunks = cache(async () => {
  const { supabase, user } = await getCurrentUserContext();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("policy_chunks")
    .select("id, policy_id, workspace_id, chunk_index, content, metadata, created_at, policies(title, source_url)")
    .order("created_at", { ascending: false })
    .returns<PolicyChunkRecord[]>();

  if (error) {
    console.error("Failed to load policy chunks", error);
    return [];
  }

  return data;
});

export async function retrievePolicyCitations(item: CaseRecord, limit = 3): Promise<PolicyCitation[]> {
  const chunks = await getVisiblePolicyChunks();
  const query = keywordsFor(`${item.title} ${item.raw_request} ${item.department ?? ""} ${item.category ?? ""}`);

  if (query.length === 0 || chunks.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => {
      const contentWords = new Set(keywordsFor(`${policyTitle(chunk.policies)} ${chunk.content}`));
      const score = query.reduce((total, word) => total + (contentWords.has(word) ? 1 : 0), 0);

      return {
        policy_id: chunk.policy_id,
        policy_title: policyTitle(chunk.policies),
        source_url: policySource(chunk.policies),
        chunk_id: chunk.id,
        excerpt: chunk.content.slice(0, 260),
        score
      };
    })
    .filter((citation) => citation.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
