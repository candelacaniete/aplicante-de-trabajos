import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { readProgress } from "@shared/store";
import { runAutomation } from "@automation/run";
import { errorJson, localOnlyError } from "@shared/api-route";

export const runtime = "nodejs";

let running = false;

export async function POST() {
  try {
  const blocked = localOnlyError();
  if (blocked) return blocked;
  loadEnv();
  const progress = readProgress();
  if (running || progress.status === "running") {
    return NextResponse.json({ error: "Ya hay una corrida en curso." }, { status: 409 });
  }
  running = true;
  void runAutomation()
    .catch((err) => {
      console.error(err);
    })
    .finally(() => {
      running = false;
    });
  return NextResponse.json({ ok: true });
  } catch (err) {
    running = false;
    return errorJson(err);
  }
}
