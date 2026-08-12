import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import type { BaseResume, RoleProfile } from "../shared/types";
import { slugifyName } from "../shared/policy";
import { tailoredResumesDir } from "../shared/paths";
import { renderResumeHtml } from "./template";
import { extractPdfText, verifyResumeText, type VerifyResult } from "./verify";

export interface GenerateResult {
  profileId: string;
  path: string;
  verify: VerifyResult;
}

export function resumePdfName(resume: BaseResume, profile: RoleProfile): string {
  const name = slugifyName(resume.personal.full_name) || "CV";
  const profileSlug = slugifyName(profile.label || profile.id) || profile.id;
  return `${name}_${profileSlug}.pdf`;
}

export async function generateResumePdf(
  resume: BaseResume,
  profile: RoleProfile,
): Promise<GenerateResult> {
  const html = renderResumeHtml(resume, profile);
  const outDir = tailoredResumesDir();
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, resumePdfName(resume, profile));

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });
    fs.writeFileSync(outPath, pdfBuffer);

    const { text, pageCount } = await extractPdfText(new Uint8Array(pdfBuffer));
    let verify = verifyResumeText(text, resume, profile, pageCount);

    if (!verify.ok) {
      const htmlText = await page.innerText("body");
      verify = verifyResumeText(`${text}\n${htmlText}`, resume, profile, pageCount);
      if (!verify.ok) {
        throw new Error(
          `Verificación del CV (${profile.id}) falló. Falta: ${verify.missing.join(", ")}`,
        );
      }
    }

    return { profileId: profile.id, path: outPath, verify };
  } finally {
    await browser.close();
  }
}

export async function generateAllResumes(resume: BaseResume): Promise<GenerateResult[]> {
  if (resume.role_profiles.length === 0) {
    throw new Error("No hay perfiles en base_resume.json. Completá el wizard primero.");
  }
  const results: GenerateResult[] = [];
  for (const profile of resume.role_profiles) {
    results.push(await generateResumePdf(resume, profile));
  }
  return results;
}
