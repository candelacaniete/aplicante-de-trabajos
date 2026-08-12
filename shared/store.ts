import fs from "node:fs";
import path from "node:path";
import { FILES, dataPath, tailoredResumesDir, browserProfileDir, uploadsDir } from "./paths";
import type {
  AppConfig,
  BaseResume,
  JobTracker,
  ManualConfirmRequest,
  ProfileRaw,
  RunProgress,
} from "./types";
import { isServerlessHost } from "./runtime";
import { hasGoogleCredentials, sheetUrlFromEnv, vercelEnvHelp } from "./google-auth";
import { readStateMap, writeStateKeys } from "./google-state";

const memory = new Map<string, string>();
const dirty = new Set<string>();
let persistUrl = "";

const STATE_FILES: Record<string, string> = {
  "profile_raw.json": "profile_raw",
  "extracted_preview.json": "extracted_preview",
  "gaps.json": "gaps",
  "base_resume.json": "base_resume",
  "config.json": "config",
  "job_tracker.json": "job_tracker",
  "run_progress.json": "run_progress",
  "manual_confirm_queue.json": "manual_confirm",
};

function stateKeyFromFile(file: string): string | null {
  return STATE_FILES[path.basename(file)] ?? null;
}

function fileFromStateKey(key: string): string {
  const match = Object.entries(STATE_FILES).find(([, value]) => value === key);
  return dataPath(match?.[0] ?? `${key}.json`);
}

export function readJson<T>(file: string, fallback: T): T {
  if (memory.has(file)) {
    const raw = memory.get(file)!;
    if (!raw.trim()) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  if (isServerlessHost()) return fallback;
  if (!fs.existsSync(file)) return fallback;
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.trim()) return fallback;
  return JSON.parse(raw) as T;
}

export function writeJson(file: string, value: unknown): void {
  const raw = `${JSON.stringify(value, null, 2)}\n`;
  memory.set(file, raw);
  dirty.add(file);
  if (isServerlessHost()) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, raw, "utf8");
}

export async function hydrateStore(sheetUrl?: string): Promise<void> {
  memory.clear();
  dirty.clear();
  persistUrl = (sheetUrl ?? "").trim() || sheetUrlFromEnv();
  if (!isServerlessHost()) return;
  if (!persistUrl || !hasGoogleCredentials()) return;
  const map = await readStateMap(persistUrl);
  for (const [key, json] of Object.entries(map)) {
    memory.set(fileFromStateKey(key), json);
  }
}

export async function persistStore(): Promise<void> {
  if (!isServerlessHost() || dirty.size === 0) return;
  const url = persistUrl || sheetUrlFromEnv();
  if (!url || !hasGoogleCredentials()) {
    throw new Error(
      vercelEnvHelp(
        [
          !hasGoogleCredentials() ? "GOOGLE_SERVICE_ACCOUNT_JSON" : "",
          !url ? "GOOGLE_SHEET_URL" : "",
        ].filter(Boolean),
      ),
    );
  }
  const updates: Record<string, string> = {};
  for (const file of dirty) {
    const key = stateKeyFromFile(file);
    if (key) updates[key] = memory.get(file) ?? "";
  }
  if (Object.keys(updates).length === 0) {
    dirty.clear();
    return;
  }
  await writeStateKeys(url, updates);
  dirty.clear();
}

export async function withStore<T>(fn: () => Promise<T>, sheetUrl?: string): Promise<T> {
  await hydrateStore(sheetUrl);
  try {
    const result = await fn();
    await persistStore();
    return result;
  } catch (err) {
    try {
      await persistStore();
    } catch (persistErr) {
      console.error(persistErr);
    }
    throw err;
  }
}

export function emptyPersonal() {
  return {
    full_name: "",
    city: "",
    email: "",
    phone: "",
    linkedin: "",
    portfolio: "",
    languages: [] as string[],
    nationality: "",
    work_permit: "",
    address: "",
    postal_code: "",
    licenses: [] as string[],
  };
}

export function emptyResume(): BaseResume {
  return {
    personal: emptyPersonal(),
    experience: [],
    education: [],
    courses: [],
    skills: { technical: [], tools: [], soft: [] },
    role_profiles: [],
  };
}

export function defaultConfig(): AppConfig {
  return {
    searches: [],
    daily_total_cap: 5,
    excluded_companies: [],
    discard_keywords: [],
    duplicate_check_days_threshold: 30,
    salary_expectation: "",
    availability: "",
    cv_language: "es",
    industry: "",
    google_sheet: { enabled: false, url: "" },
    boards: {
      demo: { enabled: true, requireManualConfirm: false, selectorsReviewed: true },
      linkedin: { enabled: false, requireManualConfirm: true, selectorsReviewed: true },
      computrabajo: {
        enabled: false,
        requireManualConfirm: false,
        selectorsReviewed: true,
        baseUrl: "https://ar.computrabajo.com",
      },
      indeed: {
        enabled: false,
        requireManualConfirm: false,
        selectorsReviewed: true,
        baseUrl: "https://ar.indeed.com",
      },
      bumeran: {
        enabled: false,
        requireManualConfirm: false,
        selectorsReviewed: true,
        baseUrl: "https://www.bumeran.com.ar",
      },
    },
    delays: { min_ms: 800, max_ms: 2500 },
    headless: false,
  };
}

export function emptyTracker(): JobTracker {
  return { applications: [] };
}

export function emptyProgress(): RunProgress {
  return {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    events: [],
    currentJob: null,
    awaiting: null,
  };
}

export function readBaseResume(): BaseResume {
  return readJson(FILES.baseResume(), emptyResume());
}

export function writeBaseResume(resume: BaseResume): void {
  writeJson(FILES.baseResume(), resume);
}

export function readConfig(): AppConfig {
  return { ...defaultConfig(), ...readJson(FILES.config(), defaultConfig()) };
}

export function writeConfig(config: AppConfig): void {
  writeJson(FILES.config(), config);
}

export function readTracker(): JobTracker {
  return readJson(FILES.tracker(), emptyTracker());
}

export function writeTracker(tracker: JobTracker): void {
  writeJson(FILES.tracker(), tracker);
}

export function readProfileRaw(): ProfileRaw | null {
  const file = FILES.profileRaw();
  if (memory.has(file)) {
    const raw = memory.get(file)!;
    if (!raw.trim()) return null;
    try {
      return JSON.parse(raw) as ProfileRaw;
    } catch {
      return null;
    }
  }
  if (isServerlessHost()) return null;
  if (!fs.existsSync(file)) return null;
  return readJson<ProfileRaw | null>(file, null);
}

export function writeProfileRaw(raw: ProfileRaw): void {
  writeJson(FILES.profileRaw(), raw);
}

export function readProgress(): RunProgress {
  return readJson(FILES.runProgress(), emptyProgress());
}

export function writeProgress(progress: RunProgress): void {
  writeJson(FILES.runProgress(), progress);
}

export function readManualQueue(): ManualConfirmRequest[] {
  return readJson(FILES.manualConfirm(), []);
}

export function writeManualQueue(queue: ManualConfirmRequest[]): void {
  writeJson(FILES.manualConfirm(), queue);
}

export function ensureDirs(): void {
  const dirs = isServerlessHost()
    ? [uploadsDir()]
    : [dataPath(), dataPath("uploads"), tailoredResumesDir(), browserProfileDir()];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function isResumeConfigured(resume: BaseResume): boolean {
  return Boolean(resume.personal.full_name && resume.personal.email);
}
