import type { Page } from "playwright";
import type { ApplyResult, JobListing, SearchFilters, BaseResume, RoleProfile } from "../../shared/types";
import type { JobBoard } from "../types";
import { readConfig } from "../../shared/store";
import { computrabajoSearchUrl } from "../urls";
import {
  attachResume,
  clickFirst,
  fillKnownFields,
  incomplete,
  pageLooksLoggedOut,
  prepareApplicationForm,
  successResult,
  visible,
} from "../helpers";
import { assertNoCaptcha, uncheckFollowAndNewsletters } from "../browser";

/**
 * Selectores tomados de HTML vivo de ar.computrabajo.com (ago 2026):
 * article.box_offer[data-id], a.js-o-link, [offer-grid-article-company-url],
 * [data-href-offer-apply], texto "Postular", login ".js_login" / "Ingresar",
 * filtro ?pubdate=1|3|7|15|30.
 */
function baseUrl(): string {
  return readConfig().boards.computrabajo?.baseUrl || "https://ar.computrabajo.com";
}

function candidateHost(): string {
  const base = new URL(baseUrl());
  return `https://candidato.${base.host}`;
}

export const computrabajoBoard: JobBoard = {
  name: "computrabajo",
  requireManualConfirm: false,

  async checkLoggedIn(page: Page): Promise<boolean> {
    await page.goto(`${candidateHost()}/candidate/home`, { waitUntil: "domcontentloaded" });
    if (await pageLooksLoggedOut(page, /ingresar|iniciar sesi[oó]n|crear cv/i)) return false;
    if (page.url().includes("/acceso")) return false;
    const login = page.locator(".js_login").filter({ hasText: /ingresar/i });
    return !(await visible(login));
  },

  async search(page: Page, query: string, filters: SearchFilters): Promise<void> {
    const url = computrabajoSearchUrl(baseUrl(), query, filters.location, filters.max_age_days);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await assertNoCaptcha(page, "computrabajo");
    if (/remoto/i.test(filters.modality)) {
      await page.getByText("Remoto", { exact: true }).first().click({ timeout: 3000 }).catch(() => undefined);
    }
  },

  async listResults(page: Page): Promise<JobListing[]> {
    await page.locator("article.box_offer").first().waitFor({ timeout: 15000 }).catch(() => undefined);
    return page.$$eval("article.box_offer", (cards) =>
      cards.map((card) => {
        const el = card as HTMLElement;
        const link = el.querySelector("a.js-o-link") as HTMLAnchorElement | null;
        const company =
          (el.querySelector("[offer-grid-article-company-url]") as HTMLElement | null)?.innerText?.trim() ??
          "";
        const locEl = el.querySelector("p.fs16.fc_base.mt5 span, p.fs16.fc_base.mt5");
        const apply = el.querySelector("[data-href-offer-apply]") as HTMLElement | null;
        const already = Boolean(el.querySelector(".tag.postulated:not(.hide)"));
        return {
          title: link?.innerText?.trim() ?? "",
          company,
          location: locEl?.textContent?.trim() ?? "",
          url: apply?.getAttribute("data-href-offer-apply") || link?.href || "",
          snippet: already ? "ya_postulado" : el.innerText.slice(0, 400),
        };
      }),
    );
  },

  async applyToJob(
    page: Page,
    job: JobListing,
    profile: { resume: BaseResume; role: RoleProfile; resumePath: string },
  ): Promise<ApplyResult> {
    if (job.snippet === "ya_postulado") {
      return incomplete("ya postulaste en Computrabajo", "El aviso ya figura como Postulado.");
    }
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await assertNoCaptcha(page, "computrabajo");
    if (page.url().includes("/acceso")) {
      return incomplete("no hay sesión", "Computrabajo pidió login al postular.");
    }

    const posted = page.getByText(/ya te postulaste|postulación enviada|tu postulación fue/i);
    if (await visible(posted)) {
      return successResult("ya estaba postulado en Computrabajo");
    }

    const clicked = await clickFirst(page, [/^Postular$/i, /postularme/i, /enviar postulación/i]);
    if (!clicked) {
      const applyLink = page.locator("[data-href-offer-apply]").first();
      if (await visible(applyLink)) {
        const href = await applyLink.getAttribute("data-href-offer-apply");
        if (href) await page.goto(href, { waitUntil: "domcontentloaded" });
      } else {
        return incomplete("no encontré Postular", "No apareció el botón Postular. ¿Estás logueado?");
      }
    }

    if (page.url().includes("/acceso")) {
      return incomplete("no hay sesión", "Al postular redirigió al login.");
    }

    const blocked = await prepareApplicationForm(page, "computrabajo", profile.resume, profile.resumePath, job);
    if (blocked) return blocked;

    await attachResume(page, profile.resumePath);
    await fillKnownFields(page, profile.resume);
    await uncheckFollowAndNewsletters(page);

    const confirm = await clickFirst(page, [
      /enviar postulación/i,
      /confirmar postulación/i,
      /^postular$/i,
      /enviar$/i,
    ]);
    if (!confirm) {
      const submit = page.locator('button[type="submit"]').first();
      if (await visible(submit)) await submit.click();
      else return incomplete("sin botón de envío");
    }

    const ok = page.getByText(/postulación enviada|te postulaste|postulado con éxito|tu cv fue enviado/i);
    await ok.first().waitFor({ timeout: 8000 }).catch(() => undefined);
    return successResult("formulario Computrabajo");
  },
};
