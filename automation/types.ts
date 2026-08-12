import type { Page } from "playwright";
import type {
  ApplyResult,
  JobListing,
  SearchFilters,
  BaseResume,
  RoleProfile,
} from "../shared/types";

export interface JobBoard {
  name: string;
  requireManualConfirm: boolean;
  checkLoggedIn(page: Page): Promise<boolean>;
  search(page: Page, query: string, filters: SearchFilters): Promise<void>;
  listResults(page: Page): Promise<JobListing[]>;
  applyToJob(
    page: Page,
    job: JobListing,
    profile: { resume: BaseResume; role: RoleProfile; resumePath: string },
  ): Promise<ApplyResult>;
}

export class SelectorsPendingError extends Error {
  constructor(board: string, method: string) {
    super(
      `[${board}] ${method}: los selectores de este portal todavía no se revisaron juntos contra la página real. No se inventan selectores. Hablalo en el chat y los cargamos después.`,
    );
    this.name = "SelectorsPendingError";
  }
}

export class PolicyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyViolation";
  }
}

export class CaptchaPause extends Error {
  constructor(board: string) {
    super(`[${board}] Hay un CAPTCHA. Resolvelo vos en el navegador y reanudá la corrida.`);
    this.name = "CaptchaPause";
  }
}
