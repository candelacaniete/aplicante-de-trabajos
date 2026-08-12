import type { Page } from "playwright";
import type { ApplyResult, JobListing, SearchFilters, BaseResume, RoleProfile } from "../../shared/types";
import type { JobBoard } from "../types";
import { linkedinSearchUrl } from "../urls";
import {
  attachResume,
  clickFirst,
  fillKnownFields,
  incomplete,
  pageLooksLoggedOut,
  successResult,
  visible,
} from "../helpers";
import { assertNoCaptcha, uncheckFollowAndNewsletters } from "../browser";

/**
 * Listado público (ago 2026): ul.jobs-search__results-list, .job-search-card,
 * a.base-card__full-link, h3.base-search-card__title, h4.base-search-card__subtitle.
 * Filtro Easy Apply: f_AL=true ("Solicitud sencilla").
 *
 * NUNCA aprieta Enviar solicitud / Submit application. Default requireManualConfirm=true.
 */
const SUBMIT_NAMES = [/enviar solicitud/i, /submit application/i, /^submit$/i, /enviar postulaci[oó]n/i];

export const linkedinBoard: JobBoard = {
  name: "linkedin",
  requireManualConfirm: true,

  async checkLoggedIn(page: Page): Promise<boolean> {
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
    if (/\/login|\/checkpoint|\/authwall/.test(page.url())) return false;
    if (await pageLooksLoggedOut(page, /iniciar sesi[oó]n|sign in|unirse ahora|join now/i)) {
      const me = page.locator(".global-nav__me, img.global-nav__me-photo, [data-control-name='identity_welcome_message']");
      return visible(me);
    }
    const nav = page.locator(".global-nav, img.global-nav__me-photo");
    return (await nav.count()) > 0;
  },

  async search(page: Page, query: string, filters: SearchFilters): Promise<void> {
    const location = filters.location || "Argentina";
    await page.goto(linkedinSearchUrl(query, location, filters.max_age_days), {
      waitUntil: "domcontentloaded",
    });
    await assertNoCaptcha(page, "linkedin");
  },

  async listResults(page: Page): Promise<JobListing[]> {
    await page
      .locator(".job-search-card, .job-card-container, .jobs-search-results-list li")
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => undefined);

    const loggedIn = await page.$$eval(
      ".job-card-container, li.jobs-search-results__list-item, .jobs-search-results-list li",
      (cards) =>
        cards.map((card) => {
          const el = card as HTMLElement;
          const link = el.querySelector("a[href*='/jobs/view/'], a.job-card-list__title--link, a.job-card-container__link") as
            | HTMLAnchorElement
            | null;
          const title =
            (el.querySelector(".job-card-list__title, .artdeco-entity-lockup__title") as HTMLElement | null)?.innerText?.trim() ||
            link?.innerText?.trim() ||
            "";
          const company =
            (el.querySelector(".job-card-container__primary-description, .artdeco-entity-lockup__subtitle") as HTMLElement | null)
              ?.innerText?.trim() ?? "";
          const location =
            (el.querySelector(".job-card-container__metadata-item") as HTMLElement | null)?.innerText?.trim() ?? "";
          return {
            title,
            company,
            location,
            url: link?.href?.split("?")[0] ?? "",
            snippet: el.innerText.slice(0, 400),
          };
        }),
    );
    const usable = loggedIn.filter((j) => j.url && j.title);
    if (usable.length > 0) return usable;

    return page.$$eval(".job-search-card, .base-search-card", (cards) =>
      cards.map((card) => {
        const el = card as HTMLElement;
        const link = el.querySelector("a.base-card__full-link, a[href*='/jobs/view/']") as HTMLAnchorElement | null;
        return {
          title: (el.querySelector(".base-search-card__title") as HTMLElement | null)?.innerText?.trim() ?? "",
          company: (el.querySelector(".base-search-card__subtitle") as HTMLElement | null)?.innerText?.trim() ?? "",
          location: (el.querySelector(".job-search-card__location") as HTMLElement | null)?.innerText?.trim() ?? "",
          url: link?.href?.split("?")[0] ?? "",
          snippet: el.innerText.slice(0, 400),
        };
      }),
    );
  },

  async applyToJob(
    page: Page,
    job: JobListing,
    profile: { resume: BaseResume; role: RoleProfile; resumePath: string },
  ): Promise<ApplyResult> {
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await assertNoCaptcha(page, "linkedin");

    const easy = page.getByRole("button", { name: /solicitud sencilla|easy apply/i }).first();
    const easyCss = page.locator("button.jobs-apply-button").first();
    if (!(await visible(easy)) && !(await visible(easyCss))) {
      return incomplete(
        "no es Solicitud sencilla",
        "Este aviso no tiene Easy Apply. LinkedIn externo no se automatiza.",
      );
    }
    if (await visible(easy)) await easy.click();
    else await easyCss.click();

    await page.locator(".jobs-easy-apply-modal, [role='dialog']").first().waitFor({ timeout: 8000 }).catch(() => undefined);

    for (let step = 0; step < 10; step++) {
      await assertNoCaptcha(page, "linkedin");
      const dialog = page.locator(".jobs-easy-apply-modal, [role='dialog']").first();
      const scope = (await dialog.count()) > 0 ? dialog : page;

      const filled = await fillKnownFields(page, profile.resume);
      await attachResume(page, profile.resumePath);
      await uncheckFollowAndNewsletters(page);

      if (filled.missingRequired.length > 0) {
        return incomplete(
          filled.missingRequired[0],
          `Faltan datos que no voy a inventar: ${filled.missingRequired.join(", ")}`,
        );
      }

      const submit = scope.getByRole("button", { name: SUBMIT_NAMES[0] }).or(
        page.getByRole("button", { name: /enviar solicitud|submit application/i }),
      );
      if (await visible(submit)) {
        if (this.requireManualConfirm) {
          return {
            status: "awaiting_manual_confirm",
            howApplied: "LinkedIn Easy Apply (sin envío final)",
            notes: "Formulario completo. Apretá Enviar solicitud vos en el navegador.",
          };
        }
        await submit.click();
        return successResult("LinkedIn Easy Apply");
      }

      const next = await clickFirst(page, [/siguiente/i, /^next$/i, /continuar/i, /^continue$/i, /revisar/i, /^review$/i]);
      if (!next) {
        return {
          status: "awaiting_manual_confirm",
          howApplied: "LinkedIn Easy Apply (sin envío final)",
          notes: "Llegué lo más lejos posible sin apretar Enviar. Completá o enviá vos.",
        };
      }
      await page.waitForTimeout(700);
    }

    return {
      status: "awaiting_manual_confirm",
      howApplied: "LinkedIn Easy Apply (sin envío final)",
      notes: "Demasiados pasos. Revisá el modal y enviá vos.",
    };
  },
};
