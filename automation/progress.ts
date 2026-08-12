import fs from "node:fs";
import { FILES } from "../shared/paths";
import { emptyProgress, readJson, writeJson } from "../shared/store";
import type { ManualConfirmRequest, RunEvent, RunProgress } from "../shared/types";

export function emit(message: string, level: RunEvent["level"] = "info", extra?: Partial<RunEvent>): RunProgress {
  const progress = readJson<RunProgress>(FILES.runProgress(), emptyProgress());
  progress.events.push({
    ts: new Date().toISOString(),
    level,
    message,
    ...extra,
  });
  if (progress.events.length > 400) {
    progress.events = progress.events.slice(-400);
  }
  writeJson(FILES.runProgress(), progress);
  console.log(`[${level}] ${message}`);
  return progress;
}

export function setProgress(patch: Partial<RunProgress>): RunProgress {
  const progress = { ...readJson<RunProgress>(FILES.runProgress(), emptyProgress()), ...patch };
  writeJson(FILES.runProgress(), progress);
  return progress;
}

export function resetProgress(): RunProgress {
  const progress = emptyProgress();
  progress.status = "running";
  progress.startedAt = new Date().toISOString();
  writeJson(FILES.runProgress(), progress);
  return progress;
}

export async function waitForManualConfirm(
  request: ManualConfirmRequest,
  timeoutMs = 15 * 60 * 1000,
): Promise<"confirmed" | "skipped" | "timeout"> {
  writeJson(FILES.manualConfirm(), [request]);
  setProgress({ status: "paused", awaiting: request });
  emit(
    `Esperando confirmación manual para ${request.company} — ${request.title}. ${request.instruction}`,
    "warn",
  );

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    if (!fs.existsSync(FILES.manualConfirm())) continue;
    const queue = readJson<ManualConfirmRequest[]>(FILES.manualConfirm(), []);
    const item = queue.find((q) => q.applicationId === request.applicationId);
    if (item?.resolution === "confirmed") {
      writeJson(FILES.manualConfirm(), []);
      setProgress({ awaiting: null, status: "running" });
      return "confirmed";
    }
    if (item?.resolution === "skipped") {
      writeJson(FILES.manualConfirm(), []);
      setProgress({ awaiting: null, status: "running" });
      return "skipped";
    }
  }
  writeJson(FILES.manualConfirm(), []);
  setProgress({ awaiting: null, status: "running" });
  return "timeout";
}
