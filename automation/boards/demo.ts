import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Page } from "playwright";
import { demoBoardDir } from "../../shared/paths";
import type { ApplyResult, JobListing, SearchFilters, BaseResume, RoleProfile } from "../../shared/types";
import type { JobBoard } from "../types";
import { PolicyViolation } from "../types";
import { assertNoCaptcha, rejectSensitiveFields, uncheckFollowAndNewsletters } from "../browser";

function fileUrl(name: string, query = ""): string {
  const url = pathToFileURL(path.join(demoBoardDir(), name)).href;
  return query ? `${url}?${query}` : url;
}

export const demoBoard: JobBoard = {
  name: "demo",
  requireManualConfirm: false,

  async checkLoggedIn(_page: Page): Promise<boolean> {
    return true;
  },

  async search(page: Page, query: string, _filters: SearchFilters): Promise<void> {
    await page.goto(fileUrl("search.html", `q=${encodeURIComponent(query)}`));
  },

  async listResults(page: Page): Promise<JobListing[]> {
    return page.$$eval(".job", (cards) =>
      cards.map((card) => {
        const el = card as HTMLElement;
        const title = el.querySelector("h2")?.textContent?.trim() ?? "";
        const company = el.querySelector(".company")?.textContent?.trim() ?? "";
        const location = el.querySelector(".location")?.textContent?.trim() ?? "";
        const snippet = el.querySelector(".snippet")?.textContent?.trim() ?? "";
        const href = (el.querySelector(".apply-link") as HTMLAnchorElement | null)?.href ?? "";
        const years = Number(el.dataset.years || "0");
        return {
          title,
          company,
          location,
          url: href,
          snippet,
          requiredYears: Number.isFinite(years) ? years : undefined,
        };
      }),
    );
  },

  async applyToJob(
    page: Page,
    job: JobListing,
    profile: { resume: BaseResume; role: RoleProfile; resumePath: string },
  ): Promise<ApplyResult> {
    await page.goto(job.url);
    await assertNoCaptcha(page, "demo");

    try {
      await rejectSensitiveFields(page);
    } catch (err) {
      if (err instanceof PolicyViolation) {
        return { status: "incomplete", notes: err.message, reason: err.message };
      }
      throw err;
    }

    const personal = profile.resume.personal;
    const name = page.locator('input[name="name"]');
    const email = page.locator('input[name="email"]');
    const phone = page.locator('input[name="phone"]');

    if ((await name.count()) && !personal.full_name) {
      return { status: "incomplete", notes: "Falta el nombre en el perfil", reason: "Falta nombre" };
    }
    if ((await email.count()) && !personal.email) {
      return { status: "incomplete", notes: "Falta el email en el perfil", reason: "Falta email" };
    }
    if ((await phone.count()) && !personal.phone) {
      return { status: "incomplete", notes: "Falta el teléfono en el perfil", reason: "Falta teléfono" };
    }

    if (await name.count()) await name.fill(personal.full_name);
    if (await email.count()) await email.fill(personal.email);
    if (await phone.count()) await phone.fill(personal.phone);

    const file = page.locator('input[name="resume"]');
    if ((await file.count()) > 0) {
      await file.setInputFiles(profile.resumePath);
    }

    await uncheckFollowAndNewsletters(page);

    if (this.requireManualConfirm) {
      return {
        status: "awaiting_manual_confirm",
        howApplied: "formulario demo (confirmación manual)",
        notes: "Completé el formulario. Apretá Enviar vos.",
      };
    }

    const submit = page.locator("#submit, button[type=submit]");
    if ((await submit.count()) === 0) {
      return { status: "incomplete", notes: "No encontré el botón de envío", reason: "sin botón" };
    }
    await submit.click();
    return {
      status: "applied",
      howApplied: "formulario demo",
      notes: "",
    };
  },
};
