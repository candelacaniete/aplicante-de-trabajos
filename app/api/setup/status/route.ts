import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { hasGoogleCredentials, missingVercelEnv, sheetUrlFromEnv } from "@shared/google-auth";
import { isServerlessHost } from "@shared/runtime";

export const runtime = "nodejs";

export async function GET() {
  loadEnv();
  const hosted = isServerlessHost();
  const missing = hosted ? missingVercelEnv() : [];
  return NextResponse.json({
    hosted,
    hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    hasGoogle: hasGoogleCredentials(),
    sheetUrl: sheetUrlFromEnv(),
    missingEnv: missing,
  });
}
