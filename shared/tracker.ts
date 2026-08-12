import type {
  AppConfig,
  ApplicationStatus,
  JobListing,
  SearchConfig,
  TrackerEntry,
  JobTracker,
} from "./types";
import { companyIsExcluded, textHasDiscardKeyword, normalizeCompany } from "./policy";

const POSTULADO: ApplicationStatus = "Postulado";

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function jobKey(board: string, job: Pick<JobListing, "url" | "company" | "title">): string {
  const url = job.url?.trim();
  if (url) return `${board}::${url.split("?")[0]}`;
  return `${board}::${normalizeCompany(job.company)}::${job.title.trim().toLowerCase()}`;
}

export function isPostulado(status: string): boolean {
  return status === POSTULADO;
}

export function appliedToday(
  tracker: JobTracker,
  now = new Date(),
): TrackerEntry[] {
  const day = todayISO(now);
  return tracker.applications.filter(
    (a) => isPostulado(a.status) && a.date.slice(0, 10) === day,
  );
}

export function remainingForSearch(
  tracker: JobTracker,
  search: SearchConfig,
  now = new Date(),
): number {
  const count = appliedToday(tracker, now).filter((a) => a.search === search.id).length;
  return Math.max(0, search.daily_quota - count);
}

export function remainingTotal(
  tracker: JobTracker,
  config: AppConfig,
  now = new Date(),
): number {
  const count = appliedToday(tracker, now).length;
  return Math.max(0, config.daily_total_cap - count);
}

export type DuplicateDecision =
  | { action: "apply"; reason: string }
  | { action: "skip"; reason: string };

/**
 * Guardia anti-repetidos:
 * - sin postulación previa → postular
 * - postulación vieja (> threshold días) → postular (cualquier perfil)
 * - reciente y mismo perfil → ya está hecha, no repetir
 * - reciente y perfil distinto → saltear
 */
export function duplicateDecision(
  tracker: JobTracker,
  job: JobListing,
  board: string,
  profileId: string,
  thresholdDays: number,
  now = new Date(),
): DuplicateDecision {
  const key = jobKey(board, job);
  const previous = tracker.applications
    .filter((a) => a.job_key === key && (isPostulado(a.status) || a.status.startsWith("Incompleto")))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (previous.length === 0) {
    return { action: "apply", reason: "sin postulación previa" };
  }

  const last = previous[0];
  const lastDate = new Date(last.date);
  const ageDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays > thresholdDays) {
    return { action: "apply", reason: `postulación vieja (${ageDays} días)` };
  }

  if (last.cv_profile === profileId) {
    return { action: "skip", reason: "postulación reciente con el mismo perfil" };
  }

  return { action: "skip", reason: "postulación reciente con un perfil distinto" };
}

export type CandidateDecision =
  | { action: "apply" }
  | { action: "skip"; reason: string };

export function evaluateCandidate(
  job: JobListing,
  config: AppConfig,
  tracker: JobTracker,
  board: string,
  profileId: string,
  now = new Date(),
): CandidateDecision {
  if (companyIsExcluded(job.company, config.excluded_companies)) {
    return { action: "skip", reason: `empresa excluida: ${job.company}` };
  }

  const blob = [job.title, job.company, job.snippet ?? "", job.location].join(" ");
  if (textHasDiscardKeyword(blob, config.discard_keywords)) {
    return { action: "skip", reason: "palabra descartada en el aviso" };
  }

  if (typeof job.requiredYears === "number" && job.requiredYears >= 8) {
    return { action: "skip", reason: `pide ${job.requiredYears} años de experiencia` };
  }

  const dup = duplicateDecision(
    tracker,
    job,
    board,
    profileId,
    config.duplicate_check_days_threshold,
    now,
  );
  if (dup.action === "skip") {
    return { action: "skip", reason: dup.reason };
  }

  return { action: "apply" };
}

export function nextApplicationId(tracker: JobTracker, now = new Date()): string {
  const prefix = todayISO(now).replaceAll("-", "");
  const sameDay = tracker.applications.filter((a) => a.id.startsWith(prefix));
  const seq = String(sameDay.length + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
}

export function trackerRow(entry: TrackerEntry): string[] {
  return [
    entry.id,
    entry.date.slice(0, 10),
    entry.company,
    entry.title,
    entry.cv_profile,
    entry.search,
    entry.location,
    entry.board,
    entry.how_applied,
    entry.job_url,
    entry.resume_file,
    entry.status,
    entry.notes,
  ];
}
