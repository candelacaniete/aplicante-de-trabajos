import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isServerlessHost } from "./runtime";

function looksLikeRoot(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "data")) &&
    (fs.existsSync(path.join(dir, "cv-generator")) ||
      fs.existsSync(path.join(dir, "automation")) ||
      fs.existsSync(path.join(dir, "application_policy.md")) ||
      fs.existsSync(path.join(dir, "data", "application_policy.md")))
  );
}

export function getRootDir(): string {
  if (process.env.AGENTE_ROOT) return process.env.AGENTE_ROOT;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (looksLikeRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd().endsWith(`${path.sep}ui`)
    ? path.resolve(process.cwd(), "..")
    : process.cwd();
}

export function dataPath(...parts: string[]): string {
  return path.join(getRootDir(), "data", ...parts);
}

export function uploadsDir(): string {
  if (isServerlessHost()) return path.join(os.tmpdir(), "agente-uploads");
  return dataPath("uploads");
}

export function tailoredResumesDir(): string {
  return path.join(getRootDir(), "tailored_resumes");
}

export function browserProfileDir(): string {
  return path.join(getRootDir(), "automation", "browser-profile");
}

export function demoBoardDir(): string {
  return path.join(getRootDir(), "automation", "fixtures", "demo-board");
}

export const FILES = {
  profileRaw: () => dataPath("profile_raw.json"),
  baseResume: () => dataPath("base_resume.json"),
  config: () => dataPath("config.json"),
  tracker: () => dataPath("job_tracker.json"),
  runProgress: () => dataPath("run_progress.json"),
  manualConfirm: () => dataPath("manual_confirm_queue.json"),
  policy: () => dataPath("application_policy.md"),
  notes: () => dataPath("agent_notes.md"),
};
