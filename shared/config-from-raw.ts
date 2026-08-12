import type { AppConfig, BaseResume, ProfileRaw } from "./types";
import { defaultConfig } from "./store";

function slug(value: string, fallback: string): string {
  const s = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || fallback;
}

export function configFromRaw(raw: ProfileRaw, resume: BaseResume): AppConfig {
  const config = defaultConfig();
  config.industry = raw.job_search.industry;
  config.daily_total_cap = raw.job_search.daily_total_cap || 5;
  config.excluded_companies = raw.job_search.excluded_companies;
  config.discard_keywords = raw.job_search.discard_keywords;
  config.salary_expectation = raw.extras.salary_expectation;
  config.availability = raw.extras.availability;
  config.cv_language = raw.extras.cv_language;
  config.google_sheet = raw.google_sheet;

  const boards = raw.boards.length ? raw.boards : ["demo"];
  for (const name of Object.keys(config.boards)) {
    config.boards[name].enabled = boards.includes(name);
  }
  for (const name of boards) {
    if (!config.boards[name]) {
      config.boards[name] = {
        enabled: true,
        requireManualConfirm: name === "linkedin",
        selectorsReviewed: name === "demo",
      };
    }
  }

  config.searches = raw.job_search.positions
    .filter((p) => p.title.trim())
    .map((p, i) => {
      const profile =
        resume.role_profiles.find(
          (rp) =>
            rp.target_titles.some((t) => t.toLowerCase() === p.title.toLowerCase()) ||
            rp.label.toLowerCase() === p.title.toLowerCase(),
        ) ?? resume.role_profiles[i];
      return {
        id: slug(p.title, `s${i + 1}`),
        query: p.title.trim(),
        role_profile: profile?.id ?? slug(p.title, `perfil_${i + 1}`),
        daily_quota: p.daily_quota || 3,
        boards,
        location: raw.job_search.location,
        modality: raw.job_search.modality,
        workday: raw.job_search.workday,
        max_age_days: raw.job_search.max_age_days || 7,
      };
    });

  return config;
}
