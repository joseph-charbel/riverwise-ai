import type { StudentConfig } from "../types/schemas.ts";

export async function invokePrompt(
  prompt: string,
  hotspotId: string,
  studentConfig: StudentConfig,
): Promise<string> {
  const res = await fetch("/api/dummy-invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      id: hotspotId,
      grade_level: studentConfig.grade_level,
      interest: studentConfig.interest,
    }),
  });
  const data: { content: string } = await res.json();
  return data.content;
}

export async function invokePromptsBatch(
  prompts: Record<string, string>,
  studentConfig: StudentConfig,
): Promise<Record<string, string>> {
  const res = await fetch("/api/dummy-invokes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompts,
      grade_level: studentConfig.grade_level,
      interest: studentConfig.interest,
    }),
  });
  const data: { results: Record<string, string> } = await res.json();
  return data.results;
}
