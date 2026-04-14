import type { StudentConfig } from "../types/schemas.ts";

export interface InvokeBatchItem {
  id: string;
  prompt: string;
  target_mechanic: string;
}

export async function invokePrompt(
  prompt: string,
  hotspotId: string,
  studentConfig: StudentConfig,
  targetMechanic: string = "",
): Promise<string> {
  const res = await fetch("/api/dummy-invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      id: hotspotId,
      grade_level: studentConfig.grade_level,
      interest: studentConfig.interest,
      target_mechanic: targetMechanic,
    }),
  });
  const data: { content: string } = await res.json();
  return data.content;
}

export async function invokePromptsBatch(
  items: InvokeBatchItem[],
  studentConfig: StudentConfig,
): Promise<Record<string, string>> {
  const res = await fetch("/api/dummy-invokes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items,
      grade_level: studentConfig.grade_level,
      interest: studentConfig.interest,
    }),
  });
  const data: { results: Record<string, string> } = await res.json();
  return data.results;
}
