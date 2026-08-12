import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { readJson, writeJson } from "@shared/store";
import { FILES } from "@shared/paths";
import type { ManualConfirmRequest } from "@shared/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  loadEnv();
  const body = (await request.json()) as { resolution?: "confirmed" | "skipped" };
  if (body.resolution !== "confirmed" && body.resolution !== "skipped") {
    return NextResponse.json({ error: "resolution debe ser confirmed o skipped" }, { status: 400 });
  }
  const queue = readJson<ManualConfirmRequest[]>(FILES.manualConfirm(), []);
  if (queue.length === 0) {
    return NextResponse.json({ error: "No hay nada esperando confirmación." }, { status: 404 });
  }
  queue[0].resolution = body.resolution;
  writeJson(FILES.manualConfirm(), queue);
  return NextResponse.json({ ok: true });
}
