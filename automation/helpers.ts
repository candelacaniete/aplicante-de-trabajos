import type { Locator, Page } from "playwright";
import type { ApplyResult, BaseResume, PersonalInfo } from "../shared/types";
import { isSensitiveFieldLabel } from "../shared/policy";
import { PolicyViolation } from "./types";
import { assertNoCaptcha, looksLikeAccountCreation, uncheckFollowAndNewsletters } from "./browser";
import { readConfig } from "../shared/store";
import { writeCoverLetter } from "../shared/anthropic";

export async function visible(locator: Locator): Promise<boolean> {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
}

export async function clickFirst(page: Page, names: Array<string | RegExp>, timeout = 4000): Promise<boolean> {
  for (const name of names) {
    const btn = page.getByRole("button", { name }).first();
    if (await visible(btn)) {
      await btn.click({ timeout });
      return true;
    }
    const link = page.getByRole("link", { name }).first();
    if (await visible(link)) {
      await link.click({ timeout });
      return true;
    }
    const text = page.getByText(name, { exact: false }).first();
    if (await visible(text)) {
      await text.click({ timeout }).catch(() => undefined);
      if (await visible(text)) {
        await text.click({ force: true, timeout }).catch(() => undefined);
      }
      return true;
    }
  }
  return false;
}

export function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function yearsFromResume(resume: BaseResume): number | null {
  const years = resume.experience
    .map((e) => Number.parseInt(e.start_date, 10))
    .filter((n) => Number.isFinite(n) && n > 1970 && n < 2100);
  if (years.length === 0) return null;
  return Math.max(0, new Date().getFullYear() - Math.min(...years));
}

function valueForLabel(
  label: string,
  resume: BaseResume,
  extras: { salary: string; availability: string },
): string | null {
  const blob = label.toLowerCase();
  const p = resume.personal;
  const { first, last } = splitName(p.full_name);

  if (isSensitiveFieldLabel(label)) {
    throw new PolicyViolation(`El formulario pide un dato sensible (${label.trim()}).`);
  }
  if (/e-?mail|correo electr/.test(blob)) return p.email;
  if (/tel[eé]fono|phone|m[oó]vil|celular|whatsapp/.test(blob) && !/compa[nñ]/.test(blob)) return p.phone;
  if (/nombre completo|full name|your name/.test(blob)) return p.full_name;
  if (/apellido|last name|surname|family name/.test(blob)) return last;
  if (/^(nombre|first name|given name)\b/.test(blob) || /primer nombre/.test(blob)) return first;
  if (/ciudad|city|localidad/.test(blob)) return p.city;
  if (/direcci[oó]n|address|calle/.test(blob) && !/email/.test(blob)) return p.address;
  if (/c[oó]digo postal|postal code|zip/.test(blob)) return p.postal_code;
  if (/linkedin/.test(blob)) return p.linkedin;
  if (/portfolio|sitio web|website|github|web personal/.test(blob)) return p.portfolio;
  if (/nacionalidad|nationality/.test(blob)) return p.nationality;
  if (/permiso de trabajo|work permit|autorizad[oa] a trabajar|legally authorized/.test(blob)) {
    return p.work_permit;
  }
  if (/disponibilidad|availability|when can you start|aviso previo/.test(blob)) return extras.availability;
  if (/pretensi[oó]n|salary|sueldo pretend|expectativa salarial|compensaci[oó]n/.test(blob)) {
    return extras.salary;
  }
  if (/a[nñ]os de experiencia|years of experience|years'? experience/.test(blob)) {
    const y = yearsFromResume(resume);
    return y === null ? "" : String(y);
  }
  return null;
}

export async function fillKnownFields(
  page: Page,
  resume: BaseResume,
): Promise<{ filled: number; missingRequired: string[] }> {
  const config = readConfig();
  const extras = { salary: config.salary_expectation, availability: config.availability };
  const missingRequired: string[] = [];
  let filled = 0;

  const controls = page.locator("input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, select");
  const count = await controls.count();
  for (let i = 0; i < count; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const disabled = await el.isDisabled().catch(() => false);
    if (disabled) continue;

    const meta = await el.evaluate((node) => {
      const input = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const id = input.id;
      let label = "";
      if (id) label = document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent ?? "";
      if (!label) label = input.closest("label")?.textContent ?? "";
      if (!label) {
        label =
          input.getAttribute("aria-label") ??
          input.getAttribute("placeholder") ??
          input.getAttribute("name") ??
          "";
      }
      const required =
        input.hasAttribute("required") ||
        input.getAttribute("aria-required") === "true" ||
        Boolean(input.closest("[data-test-form-element]")?.textContent?.includes("*"));
      return {
        label: label.replace(/\s+/g, " ").trim(),
        name: input.getAttribute("name") ?? "",
        type: input.getAttribute("type") ?? input.tagName.toLowerCase(),
        required,
        current: "value" in input ? String(input.value ?? "") : "",
      };
    });

    const combined = `${meta.label} ${meta.name}`;
    if (isSensitiveFieldLabel(combined)) {
      throw new PolicyViolation(`El formulario pide un dato sensible (${meta.label || meta.name}).`);
    }

    if (meta.current.trim()) continue;

    let value: string | null;
    try {
      value = valueForLabel(combined, resume, extras);
    } catch (err) {
      if (err instanceof PolicyViolation) throw err;
      throw err;
    }

    if (value === null) {
      if (meta.required) missingRequired.push(meta.label || meta.name || "campo requerido");
      continue;
    }
    if (!value.trim()) {
      if (meta.required) missingRequired.push(meta.label || meta.name || "campo requerido");
      continue;
    }

    const tag = await el.evaluate((n) => n.tagName.toLowerCase());
    if (tag === "select") {
      await el.selectOption({ label: value }).catch(async () => {
        await el.selectOption({ value }).catch(() => undefined);
      });
    } else {
      await el.fill(value);
    }
    filled += 1;
  }

  return { filled, missingRequired };
}

export async function attachResume(page: Page, resumePath: string): Promise<boolean> {
  const file = page.locator('input[type="file"]').first();
  if ((await file.count()) === 0) return false;
  await file.setInputFiles(resumePath);
  return true;
}

export async function maybeFillCoverLetter(
  page: Page,
  resume: BaseResume,
  jobTitle: string,
  company: string,
  snippet: string | undefined,
  language: "es" | "en",
): Promise<void> {
  const area = page.locator("textarea").first();
  if (!(await visible(area))) return;
  const label = await area.evaluate((node) => {
    const el = node as HTMLTextAreaElement;
    return `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("name") ?? ""} ${el.placeholder ?? ""}`;
  });
  if (!/carta|cover|mensaje|message|presentaci[oó]n|additional/i.test(label) && (await area.inputValue()).trim()) {
    return;
  }
  if (!/carta|cover|mensaje|message|presentaci[oó]n|additional/i.test(label) && (await page.locator("textarea").count()) > 1) {
    return;
  }
  try {
    const profile = resume.role_profiles[0];
    if (!profile) return;
    const letter = await writeCoverLetter({
      resume,
      profile,
      jobTitle,
      company,
      snippet,
      language,
    });
    if (letter) await area.fill(letter);
  } catch {
    // Sin API key o fallo: no inventamos texto.
  }
}

export async function prepareApplicationForm(
  page: Page,
  board: string,
  resume: BaseResume,
  resumePath: string,
  job: { title: string; company: string; snippet?: string },
): Promise<ApplyResult | null> {
  await assertNoCaptcha(page, board);
  const body = await page.locator("body").innerText().catch(() => "");
  if (looksLikeAccountCreation(body) && /crear una cuenta|create an account|acepto los t[eé]rminos/i.test(body)) {
    return {
      status: "incomplete",
      notes: "El sitio pide crear cuenta o aceptar términos. Eso lo tenés que hacer vos.",
      reason: "cuenta o términos",
    };
  }

  const filled = await fillKnownFields(page, resume);
  await attachResume(page, resumePath);
  await maybeFillCoverLetter(page, resume, job.title, job.company, job.snippet, readConfig().cv_language);
  await uncheckFollowAndNewsletters(page);

  if (filled.missingRequired.length > 0) {
    return {
      status: "incomplete",
      notes: `Faltan datos que no voy a inventar: ${filled.missingRequired.join(", ")}`,
      reason: filled.missingRequired[0],
    };
  }
  return null;
}

export function successResult(howApplied: string, notes = ""): ApplyResult {
  return { status: "applied", howApplied, notes };
}

export function incomplete(reason: string, notes = reason): ApplyResult {
  return { status: "incomplete", reason, notes };
}

export async function pageLooksLoggedOut(page: Page, loginSignals: RegExp): Promise<boolean> {
  const url = page.url();
  if (/\/login|\/acceso|\/signin|\/auth|checkpoint/i.test(url)) return true;
  const body = (await page.locator("body").innerText().catch(() => "")).slice(0, 4000);
  return loginSignals.test(body);
}

export function firstName(personal: PersonalInfo): string {
  return splitName(personal.full_name).first;
}
