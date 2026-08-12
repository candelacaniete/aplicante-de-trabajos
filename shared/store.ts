import fs from "node:fs";
import path from "node:path";
import { FILES, dataPath, tailoredResumesDir, browserProfileDir } from "./paths";
import type {
  AppConfig,
  BaseResume,
  JobTracker,
  ManualConfirmRequest,
  ProfileRaw,
  RunProgress,
} from "./types";

export function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.trim()) return fallback;
  return JSON.parse(raw) as T;
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
      linkedin: { enabled: false, requireManualConfirm: true, selectorsReviewed: false },
      computrabajo: { enabled: false, requireManualConfirm: false, selectorsReviewed: false },
      indeed: { enabled: false, requireManualConfirm: false, selectorsReviewed: false },
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
  if (!fs.existsSync(FILES.profileRaw())) return null;
  return readJson<ProfileRaw | null>(FILES.profileRaw(), null);
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
  fs.mkdirSync(dataPath(), { recursive: true });
  fs.mkdirSync(dataPath("uploads"), { recursive: true });
  fs.mkdirSync(tailoredResumesDir(), { recursive: true });
  fs.mkdirSync(browserProfileDir(), { recursive: true });
}

export function isResumeConfigured(resume: BaseResume): boolean {
  return Boolean(resume.personal.full_name && resume.personal.email);
}
