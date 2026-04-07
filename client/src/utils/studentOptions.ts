import type { StudentOptions } from "../types/schemas.ts";
import raw from "../config/student-options.yaml";

export function loadStudentOptions(): StudentOptions {
  const data = raw as { interests: string[]; grade: { min: number; max: number; default: number } };
  return {
    interests: data.interests,
    grade: data.grade,
  };
}
