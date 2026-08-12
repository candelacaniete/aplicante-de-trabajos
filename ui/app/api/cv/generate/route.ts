import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { isResumeConfigured, readBaseResume } from "@shared/store";
import { generateAllResumes } from "@cv-generator/generate";

export const runtime = "nodejs";

export async function POST() {
  loadEnv();
  const resume = readBaseResume();
  if (!isResumeConfigured(resume)) {
    return NextResponse.json({ error: "Completá el wizard primero." }, { status: 400 });
  }
  try {
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
