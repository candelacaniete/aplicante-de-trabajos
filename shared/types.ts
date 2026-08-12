export type ApplicationStatus =
  | "Postulado"
  | "Incompleto - esperando confirmación manual"
  | `Incompleto - ${string}`
  | "Descartado"
  | "Pausado - CAPTCHA"
  | "Pausado - login"
  | "Pausado - términos";

export interface PersonalInfo {
  full_name: string;
  city: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  languages: string[];
  nationality: string;
  work_permit: string;
  address: string;
  postal_code: string;
  licenses: string[];
}

export interface RoleVariant {
  title: string;
  bullets: string[];
}

export interface ExperienceItem {
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  /** Variantes de título y viñetas por id de perfil. */
  role_variants: Record<string, RoleVariant>;
}

export interface EducationItem {
  institution: string;
  degree: string;
  field: string;
  start_date: string;
  end_date: string;
  notes: string;
}

export interface CourseItem {
  name: string;
  issuer: string;
  year: string;
}

export interface Skills {
  technical: string[];
  tools: string[];
  soft: string[];
}

export interface RoleProfile {
  id: string;
  label: string;
  summary: string;
  target_titles: string[];
}

export interface BaseResume {
  personal: PersonalInfo;
  experience: ExperienceItem[];
  education: EducationItem[];
  courses: CourseItem[];
  skills: Skills;
  role_profiles: RoleProfile[];
}

export interface SearchConfig {
  id: string;
  query: string;
  role_profile: string;
  daily_quota: number;
  boards: string[];
  location: string;
  modality: string;
  workday: string;
  max_age_days: number;
}

export interface BoardConfig {
  enabled: boolean;
  requireManualConfirm: boolean;
  /** true si los selectores se basaron en HTML vivo o locators por rol/texto. */
  selectorsReviewed: boolean;
  baseUrl?: string;
}

export interface AppConfig {
  searches: SearchConfig[];
  daily_total_cap: number;
  excluded_companies: string[];
  discard_keywords: string[];
  duplicate_check_days_threshold: number;
  salary_expectation: string;
  availability: string;
  cv_language: "es" | "en";
  industry: string;
  google_sheet: {
    enabled: boolean;
    url: string;
  };
  boards: Record<string, BoardConfig>;
  delays: {
    min_ms: number;
    max_ms: number;
  };
  /** La postulación automática nunca corre headless en uso real. */
  headless: false;
}

export interface TrackerEntry {
  id: string;
  date: string;
  company: string;
  title: string;
  cv_profile: string;
  search: string;
  location: string;
  board: string;
  how_applied: string;
  job_url: string;
  resume_file: string;
  status: ApplicationStatus;
  notes: string;
  job_key: string;
}

export interface JobTracker {
  applications: TrackerEntry[];
}

export interface GapQuestion {
  id: string;
  field: string;
  question: string;
  context: string;
}

export interface ProfileRaw {
  cv_text: string;
  cv_filename: string;
  personal: PersonalInfo;
  job_search: {
    industry: string;
    positions: Array<{ title: string; daily_quota: number }>;
    location: string;
    modality: string;
    workday: string;
    max_age_days: number;
    daily_total_cap: number;
    excluded_companies: string[];
    discard_keywords: string[];
  };
  boards: string[];
  extras: {
    salary_expectation: string;
    availability: string;
    education_notes: string;
    cv_language: "es" | "en";
  };
  google_sheet: {
    enabled: boolean;
    url: string;
  };
}

export interface SearchFilters {
  query: string;
  location: string;
  modality: string;
  workday: string;
  max_age_days: number;
}

export interface JobListing {
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt?: string;
  snippet?: string;
  requiredYears?: number;
}

export type ApplyStatus =
  | "applied"
  | "awaiting_manual_confirm"
  | "incomplete"
  | "skipped"
  | "paused";

export interface ApplyResult {
  status: ApplyStatus;
  howApplied?: string;
  notes: string;
  reason?: string;
}

export interface RunEvent {
  ts: string;
  level: "info" | "warn" | "error";
  message: string;
  job?: Pick<JobListing, "title" | "company" | "url">;
}

export interface ManualConfirmRequest {
  applicationId: string;
  board: string;
  title: string;
  company: string;
  url: string;
  instruction: string;
  createdAt: string;
  resolution?: "confirmed" | "skipped";
}

export interface RunProgress {
  status: "idle" | "running" | "paused" | "done" | "error";
  startedAt: string | null;
  finishedAt: string | null;
  events: RunEvent[];
  currentJob: JobListing | null;
  awaiting: ManualConfirmRequest | null;
  error?: string;
}

export const TRACKER_COLUMNS = [
  "ID",
  "Fecha",
  "Empresa",
  "Puesto",
  "Perfil de CV",
  "Búsqueda",
  "Ubicación",
  "Portal",
  "Cómo se postuló",
  "Link del aviso",
  "CV enviado",
  "Estado",
  "Notas",
] as const;

export const SECTION_TITLES = [
  "RESUMEN",
  "EXPERIENCIA LABORAL",
  "EDUCACIÓN",
  "CURSOS Y CERTIFICACIONES",
  "HABILIDADES",
] as const;
