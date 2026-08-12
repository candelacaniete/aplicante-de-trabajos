import type { Page } from "playwright";
import type { ApplyResult, JobListing, SearchFilters, BaseResume, RoleProfile } from "../../shared/types";
import type { JobBoard } from "../types";
import { readConfig } from "../../shared/store";
import { indeedSearchUrl } from "../urls";
import {
  clickFirst,
  incomplete,
  pageLooksLoggedOut,
  prepareApplicationForm,
  successResult,
  visible,
} from "../helpers";
import { assertNoCaptcha } from "../browser";

/**
 * Búsqueda por URL estable (q, l, fromage). Listado: data-jk / mosaic JSON.
 * Apply: solo Indeed Apply (Postularme / Apply now), no sitios externos.
 */
function baseUrl(): string {
  return readConfig().boards.indeed?.baseUrl || "https://ar.indeed.com";
}

export const indeedBoard: JobBoard = {
  name: "indeed",
  requireManualConfirm: false,

  async checkLoggedIn(page: Page): Promise<boolean> {
    await page.goto(`${baseUrl()}/`, { waitUntil: "domcontentloaded" });
    if (await pageLooksLoggedOut(page, /iniciar sesi[oó]n|sign in|create account|crear cuenta/i)) {
      const account = page.locator("#AccountMenu, [data-gnav-element-name='AccountMenu'], a[href*='account']");
      if (await visible(account)) return true;
      return false;
    }
    return true;
  },

  async search(page: Page, query: string, filters: SearchFilters): Promise<void> {
    await page.goto(indeedSearchUrl(baseUrl(), query, filters.location, filters.max_age_days), {
      waitUntil: "domcontentloaded",
    });
    await assertNoCaptcha(page, "indeed");
  },

  async listResults(page: Page): Promise<JobListing[]> {
    const fromJson = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const match = html.match(/window\.mosaic\.providerData\["mosaic-provider-jobcards"\]=(\{.+?\});/);
      if (!match) return [] as JobListing[];
      try {
        const data = JSON.parse(match[1]) as {
          metaData?: { mosaicProviderJobCardsModel?: { results?: Array<Record<string, unknown>> } };
        };
        const results = data.metaData?.mosaicProviderJobCardsModel?.results ?? [];
        return results.map((job) => {
          const jk = String(job.jobkey ?? "");
          const salary = (job.salarySnippet as { text?: string } | undefined)?.text ?? "";
          return {
            title: String(job.title ?? job.displayTitle ?? ""),
            company: String(job.company ?? job.truncatedCompany ?? ""),
            location: String(job.formattedLocation ?? job.jobLocationCity ?? ""),
            url: jk ? `${location.origin}/viewjob?jk=${jk}` : String(job.viewJobLink ?? ""),
            snippet: `${job.snippet ?? ""} ${salary}`.trim(),
            requiredYears: undefined,
          };
        });
      } catch {
        return [];
      }
    });
    if (fromJson.length > 0) return fromJson;

    await page.locator("[data-jk], a[data-jk], h2.jobTitle a").first().waitFor({ timeout: 12000 }).catch(() => undefined);
    return page.$$eval("[data-jk]", (nodes) => {
      const seen = new Set<string>();
      const jobs: JobListing[] = [];
      for (const node of nodes) {
        const el = node as HTMLElement;
        const jk = el.getAttribute("data-jk") || "";
        if (!jk || seen.has(jk)) continue;
        seen.add(jk);
        const title =
          (el.querySelector("h2.jobTitle, a.jcs-JobTitle, span[title]") as HTMLElement | null)?.innerText?.trim() ||
          el.getAttribute("aria-label") ||
          "";
        const company =
          (el.querySelector('[data-testid="company-name"], .companyName') as HTMLElement | null)?.innerText?.trim() ??
          "";
        const location =
          (el.querySelector('[data-testid="text-location"], .companyLocation') as HTMLElement | null)?.innerText?.trim() ??
          "";
        jobs.push({
          title,
          company,
          location,
          url: `${window.location.origin}/viewjob?jk=${jk}`,
          snippet: el.innerText.slice(0, 400),
        });
      }
      return jobs;
    });
  },

  async applyToJob(
    page: Page,
    job: JobListing,
    profile: { resume: BaseResume; role: RoleProfile; resumePath: string },
  ): Promise<ApplyResult> {
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await assertNoCaptcha(page, "indeed");

    const apply = page.locator("#indeedApplyButton, button[id*='indeedApply'], [data-indeed-apply-widget]").first();
    const named = page.getByRole("button", { name: /postularme|postular ahora|apply now|indeed apply/i }).first();
    if (!(await visible(apply)) && !(await visible(named))) {
      const external = page.getByRole("link", { name: /postular en el sitio|apply on company|empresa/i });
      if (await visible(external)) {
        return incomplete("postulación externa", "Indeed manda al sitio de la empresa. Eso no lo automatizo.");
      }
      return incomplete("sin Indeed Apply", "Este aviso no tiene postulación en Indeed.");
    }
    if (await visible(named)) await named.click();
    else await apply.click();

    await page.waitForTimeout(1500);
    if (/\/account\/login|auth\.indeed/.test(page.url())) {
      return incomplete("no hay sesión", "Indeed pidió login.");
    }

    for (let step = 0; step < 8; step++) {
      await assertNoCaptcha(page, "indeed");
      const blocked = await prepareApplicationForm(page, "indeed", profile.resume, profile.resumePath, job);
      if (blocked) return blocked;

      const done = page.getByText(/aplicación enviada|application submitted|postulación enviada|ya te postulaste/i);
      if (await visible(done)) return successResult("Indeed Apply");

      const submitted = await clickFirst(page, [
        /enviar postulación/i,
        /submit application/i,
        /postularme ahora/i,
        /^enviar$/i,
      ]);
      if (submitted) {
        await done.first().waitFor({ timeout: 8000 }).catch(() => undefined);
        return successResult("Indeed Apply");
      }
      const next = await clickFirst(page, [/continuar/i, /continue/i, /siguiente/i, /next/i]);
      if (!next) break;
      await page.waitForTimeout(800);
    }
    return incomplete("formulario Indeed incompleto", "No pude terminar el flujo de Indeed Apply sin inventar datos.");
  },
};
