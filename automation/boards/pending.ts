import type { Page } from "playwright";
import type { ApplyResult, JobListing, SearchFilters, BaseResume, RoleProfile } from "../../shared/types";
import type { JobBoard } from "../types";
import { SelectorsPendingError } from "../types";

/**
 * Módulo plantilla para un portal real.
 * Los selectores quedan vacíos a propósito: no se inventan mirando de memoria.
 */
export function pendingBoard(
  name: string,
  options: { requireManualConfirm?: boolean } = {},
): JobBoard {
  const requireManualConfirm = options.requireManualConfirm ?? false;
  const pending = (method: string): never => {
    throw new SelectorsPendingError(name, method);
  };

  return {
    name,
    requireManualConfirm,
    async checkLoggedIn(_page: Page): Promise<boolean> {
      return pending("checkLoggedIn");
    },
    async search(_page: Page, _query: string, _filters: SearchFilters): Promise<void> {
      return pending("search");
    },
    async listResults(_page: Page): Promise<JobListing[]> {
      return pending("listResults");
    },
    async applyToJob(
      _page: Page,
      _job: JobListing,
      _profile: { resume: BaseResume; role: RoleProfile; resumePath: string },
    ): Promise<ApplyResult> {
      return pending("applyToJob");
    },
  };
}
