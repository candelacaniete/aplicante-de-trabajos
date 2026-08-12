import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { isResumeConfigured, readBaseResume, readConfig, readProgress, readTracker, withStore } from "@shared/store";
import { appliedToday, remainingForSearch, remainingTotal } from "@shared/tracker";
import { errorJson } from "@shared/api-route";
import { sheetUrlFromEnv, vercelEnvHelp, hasGoogleCredentials } from "@shared/google-auth";
import { isServerlessHost } from "@shared/runtime";

export const runtime = "nodejs";

export async function GET() {
  try {
    loadEnv();
    const hosted = isServerlessHost();
    const sheetUrl = sheetUrlFromEnv();
    if (hosted && (!sheetUrl || !hasGoogleCredentials())) {
      return NextResponse.json({
        configured: false,
        hosted: true,
        setupError: vercelEnvHelp(
          [
            !hasGoogleCredentials() ? "GOOGLE_SERVICE_ACCOUNT_JSON" : "",
            !sheetUrl ? "GOOGLE_SHEET_URL" : "",
          ].filter(Boolean),
        ),
        today: {},
        remaining: {},
        remainingTotal: 0,
        incomplete: [],
        recent: [],
        progress: readProgress(),
      });
    }

    return await withStore(async () => {
      const resume = readBaseResume();
      const config = readConfig();
      const tracker = readTracker();
      const today = appliedToday(tracker);
      const todayBySearch: Record<string, number> = {};
      const remaining: Record<string, number> = {};
      for (const search of config.searches) {
        todayBySearch[search.id] = today.filter((a) => a.search === search.id).length;
        remaining[search.id] = remainingForSearch(tracker, search);
      }
      const incomplete = tracker.applications.filter(
        (a) => a.status.startsWith("Incompleto") || a.status.startsWith("Pausado"),
      );
      const recent = [...tracker.applications].reverse().slice(0, 30);

      return NextResponse.json({
        configured: isResumeConfigured(resume),
        hosted,
        today: todayBySearch,
        remaining,
        remainingTotal: remainingTotal(tracker, config),
        incomplete,
        recent,
        progress: readProgress(),
      });
    }, sheetUrl);
  } catch (err) {
    return errorJson(err);
  }
}
