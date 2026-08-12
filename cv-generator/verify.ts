import { extractText } from "unpdf";
import type { BaseResume, RoleProfile } from "../shared/types";
import { REQUIRED_SECTIONS } from "./template";

export interface VerifyResult {
  ok: boolean;
  missing: string[];
  pageCount: number;
  text: string;
}

export async function extractPdfText(pdfBytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const result = await extractText(pdfBytes, { mergePages: true });
  return { text: result.text, pageCount: result.totalPages };
}

export function verifyResumeText(
  text: string,
  resume: BaseResume,
  _profile: RoleProfile,
  pageCount: number,
): VerifyResult {
  const missing: string[] = [];
  const haystack = text.replace(/\s+/g, " ");

  const must = [
    resume.personal.full_name,
    resume.personal.email,
    resume.personal.phone,
    ...REQUIRED_SECTIONS,
    ...resume.experience.map((e) => e.company).filter(Boolean),
    ...resume.experience.flatMap((e) => [e.start_date, e.end_date].filter(Boolean)),
  ];

  for (const item of must) {
    if (item && !haystack.includes(item)) {
      missing.push(item);
    }
  }

  if (pageCount > 2) {
    missing.push(`PDF tiene ${pageCount} páginas (máximo 2)`);
  }

  return { ok: missing.length === 0, missing, pageCount, text };
}
