import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { isResumeConfigured, readBaseResume, readConfig, readProgress, readTracker } from "@shared/store";
import { appliedToday, remainingForSearch, remainingTotal } from "@shared/tracker";
import { errorJson } from "@shared/api-route";

export const runtime = "nodejs";

export async function GET() {
  try {
  loadEnv();
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
    today: todayBySearch,
    remaining,
    remainingTotal: remainingTotal(tracker, config),
    incomplete,
    recent,
    progress: readProgress(),
  });
  } catch (err) {
    return errorJson(err);
  }
}
