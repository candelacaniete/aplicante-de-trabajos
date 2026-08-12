import type { Page } from "playwright";
import type { ApplyResult, JobListing, SearchFilters, BaseResume, RoleProfile } from "../../shared/types";
import type { JobBoard } from "../types";
import { readConfig } from "../../shared/store";
import { bumeranSearchUrl } from "../urls";
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
 * Búsqueda: /empleos-busqueda-{query}.html (confirmado en bumeran.com.ar).
 * Postulación: botón "Postularme" / "Postulación rápida" (FAQ oficial + listados vivos).
 */
function baseUrl(): string {
  return readConfig().boards.bumeran?.baseUrl || "https://www.bumeran.com.ar";
}

export const bumeranBoard: JobBoard = {
  name: "bumeran",
  requireManualConfirm: false,

  async checkLoggedIn(page: Page): Promise<boolean> {
    await page.goto(`${baseUrl()}/postulantes/curriculum`, { waitUntil: "domcontentloaded" });
    if (/\/login|\/ingresar|\/signin/.test(page.url())) return false;
    return !(await pageLooksLoggedOut(page, /iniciar sesi[oó]n|ingres[aá]|crear cuenta|registrate/i));
  },

  async search(page: Page, query: string, filters: SearchFilters): Promise<void> {
    await page.goto(bumeranSearchUrl(baseUrl(), query, filters.location), {
      waitUntil: "domcontentloaded",
    });
    await assertNoCaptcha(page, "bumeran");
  },

  async listResults(page: Page): Promise<JobListing[]> {
    await page
      .locator('a[href*="/empleos/"]')
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => undefined);

    return page.$$eval('a[href*="/empleos/"]', (anchors) => {
      const jobs: JobListing[] = [];
      const seen = new Set<string>();
      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        if (!/\/empleos\/.+\d/.test(href) && !/\/empleos\/[^/]+-\d+/.test(href)) continue;
        if (/preguntas-frecuentes|login|curriculum|empresas/.test(href)) continue;
        const url = href.split("?")[0];
        if (seen.has(url)) continue;
        seen.add(url);
        const card = (a.closest("article, li, div") as HTMLElement | null) ?? (a as HTMLElement);
        const heading = card.querySelector("h2, h3, a")?.textContent?.trim() || a.textContent?.trim() || "";
        if (heading.length < 3) continue;
        const company =
          card.querySelector('[class*="company"], h3, h4')?.textContent?.trim() ||
          "";
        jobs.push({
          title: heading.split("\n")[0].trim(),
          company,
          location: "",
          url,
          snippet: card.innerText.slice(0, 400),
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
    await assertNoCaptcha(page, "bumeran");
    if (/\/login|\/ingresar/.test(page.url())) {
      return incomplete("no hay sesión", "Bumeran pidió login.");
    }

    const already = page.getByText(/ya te postulaste|ya estás postulad|postulación enviada/i);
    if (await visible(already)) return successResult("ya estaba postulado en Bumeran");

    const clicked = await clickFirst(page, [
      /postularme/i,
      /postulación rápida/i,
      /^postular$/i,
    ]);
    if (!clicked) return incomplete("no encontré Postularme");

    await page.waitForTimeout(1200);
    if (/\/login|\/ingresar/.test(page.url())) {
      return incomplete("no hay sesión", "Al postular redirigió al login.");
    }

    const blocked = await prepareApplicationForm(page, "bumeran", profile.resume, profile.resumePath, job);
    if (blocked) return blocked;

    const confirm = await clickFirst(page, [
      /confirmar postulación/i,
      /enviar postulación/i,
      /postularme/i,
      /^enviar$/i,
    ]);
    if (!confirm) {
      const submit = page.locator('button[type="submit"]').first();
      if (await visible(submit)) await submit.click();
    }

    await already.first().waitFor({ timeout: 8000 }).catch(() => undefined);
    return successResult("formulario Bumeran");
  },
};
