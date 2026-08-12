import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { ensureDirs, readJson, readProfileRaw, withStore, writeBaseResume, writeConfig } from "@shared/store";
import { dataPath } from "@shared/paths";
import { buildResumeWithAnswers } from "@shared/anthropic";
import { configFromRaw } from "@shared/config-from-raw";
import { generateAllResumes } from "@cv-generator/generate";
import type { BaseResume, GapQuestion } from "@shared/types";
import { errorJson } from "@shared/api-route";
import { sheetUrlFromEnv } from "@shared/google-auth";
import { isServerlessHost } from "@shared/runtime";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    loadEnv();
    ensureDirs();
    const body = (await request.json()) as { answers?: Record<string, string>; sheetUrl?: string };
    const sheetUrl = body.sheetUrl?.trim() || sheetUrlFromEnv();

    return await withStore(async () => {
      const raw = readProfileRaw();
      if (!raw) {
        return NextResponse.json(
          { error: "No hay perfil guardado. Completá el formulario." },
          { status: 400 },
        );
      }
      const extracted = readJson<BaseResume | null>(dataPath("extracted_preview.json"), null);
      if (!extracted) {
        return NextResponse.json({ error: "Falta el parseo del CV. Volvé a analizar." }, { status: 400 });
      }
      const gaps = readJson<GapQuestion[]>(dataPath("gaps.json"), []);
      const answers = body.answers ?? {};
      for (const gap of gaps) {
        if (!(gap.id in answers)) answers[gap.id] = "";
      }

      const resume = await buildResumeWithAnswers({ raw, extracted, answers });
      if (!resume.personal.full_name) resume.personal.full_name = raw.personal.full_name;
      if (!resume.personal.email) resume.personal.email = raw.personal.email;
      if (!resume.personal.phone) resume.personal.phone = raw.personal.phone;
      if (!resume.personal.city) resume.personal.city = raw.personal.city;

      writeBaseResume(resume);
      const config = configFromRaw(raw, resume);
      if (sheetUrl) {
        config.google_sheet = { enabled: true, url: sheetUrl };
      }
      writeConfig(config);

      if (isServerlessHost()) {
        return NextResponse.json({
          ok: true,
          hosted: true,
          resume,
          config,
          pdfs: [],
          pdfError:
            "En Vercel no se generan PDFs (hace falta Playwright). El perfil quedó en tu planilla, pestaña _agente.",
        });
      }

      try {
        const generated = await generateAllResumes(resume);
        return NextResponse.json({
          ok: true,
          hosted: false,
          resume,
          config,
          pdfs: generated.map((g) => ({
            profileId: g.profileId,
            path: g.path,
            pages: g.verify.pageCount,
          })),
        });
      } catch (err) {
        return NextResponse.json({
          ok: true,
          hosted: false,
          resume,
          config,
          pdfError: err instanceof Error ? err.message : String(err),
        });
      }
    }, sheetUrl);
  } catch (err) {
    return errorJson(err);
  }
}
