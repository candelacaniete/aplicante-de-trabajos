import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { isResumeConfigured, readBaseResume } from "@shared/store";
import { generateAllResumes } from "@cv-generator/generate";
import { errorJson, localOnlyError } from "@shared/api-route";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const blocked = localOnlyError();
    if (blocked) return blocked;
    loadEnv();
    const resume = readBaseResume();
    if (!isResumeConfigured(resume)) {
      return NextResponse.json({ error: "Completá el wizard primero." }, { status: 400 });
    }
    const results = await generateAllResumes(resume);
    return NextResponse.json({
      ok: true,
      pdfs: results.map((r) => ({
        profileId: r.profileId,
        path: r.path,
        pages: r.verify.pageCount,
      })),
    });
  } catch (err) {
    return errorJson(err);
  }
}
