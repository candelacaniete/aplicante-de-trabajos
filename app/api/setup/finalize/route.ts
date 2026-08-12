import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { ensureDirs, readJson, readProfileRaw, writeBaseResume, writeConfig } from "@shared/store";
import { dataPath } from "@shared/paths";
import { buildResumeWithAnswers } from "@shared/anthropic";
import { configFromRaw } from "@shared/config-from-raw";
import { generateAllResumes } from "@cv-generator/generate";
import type { BaseResume, GapQuestion } from "@shared/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  loadEnv();
  ensureDirs();
  try {
    const body = (await request.json()) as { answers?: Record<string, string> };
    const raw = readProfileRaw();
    if (!raw) {
      return NextResponse.json({ error: "No hay profile_raw.json. Completá el formulario." }, { status: 400 });
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
    writeConfig(config);

    try {
      const generated = await generateAllResumes(resume);
      return NextResponse.json({
        ok: true,
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
        resume,
        config,
        pdfError: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
