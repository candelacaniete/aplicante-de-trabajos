import { chromium, type BrowserContext, type Page } from "playwright";
import { browserProfileDir } from "../shared/paths";
import { CAPTCHA_SELECTORS, CAPTCHA_TEXT, isSensitiveFieldLabel } from "../shared/policy";
import { CaptchaPause, PolicyViolation } from "./types";

export async function launchPersistentBrowser(headless: boolean): Promise<BrowserContext> {
  if (headless) {
    console.warn(
      "AVISO: headless=true solo debería usarse en tests. Las postulaciones reales van en modo visible.",
    );
  }
  return chromium.launchPersistentContext(browserProfileDir(), {
    headless,
    viewport: { width: 1280, height: 900 },
    locale: "es-AR",
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  for (const sel of CAPTCHA_SELECTORS) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
      return true;
    }
  }
  const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  return CAPTCHA_TEXT.some((t) => body.includes(t));
}

export async function assertNoCaptcha(page: Page, board: string): Promise<void> {
  if (await detectCaptcha(page)) {
    throw new CaptchaPause(board);
  }
}

export async function uncheckFollowAndNewsletters(page: Page): Promise<number> {
  const boxes = page.locator('input[type="checkbox"]');
  const count = await boxes.count();
  let unchecked = 0;
  for (let i = 0; i < count; i++) {
    const box = boxes.nth(i);
    const checked = await box.isChecked().catch(() => false);
    if (!checked) continue;
    const id = await box.getAttribute("id");
    let label = "";
    if (id) {
      label = await page.locator(`label[for="${id}"]`).innerText().catch(() => "");
    }
    if (!label) {
      label = await box.evaluate((el) => el.closest("label")?.innerText ?? el.getAttribute("name") ?? "");
    }
    const blob = label.toLowerCase();
    const hits = [
      "seguir",
      "follow",
      "novedades",
      "newsletter",
      "alert",
      "avisos",
      "notific",
      "keep me",
      "updates",
    ];
    if (hits.some((h) => blob.includes(h))) {
      await box.uncheck({ force: true }).catch(async () => {
        await box.click({ force: true });
      });
      unchecked += 1;
    }
  }
  return unchecked;
}

export async function collectLabeledFields(page: Page): Promise<Array<{ label: string; name: string }>> {
  return page.evaluate(() => {
    const fields = Array.from(
      document.querySelectorAll("input, textarea, select"),
    ) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
    return fields.map((el) => {
      const id = el.getAttribute("id");
      let label = "";
      if (id) {
        label = document.querySelector(`label[for="${id}"]`)?.textContent ?? "";
      }
      if (!label) label = el.closest("label")?.textContent ?? "";
      if (!label) label = el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.getAttribute("placeholder") ?? "";
      return { label: label.trim(), name: el.getAttribute("name") ?? "" };
    });
  });
}

export async function rejectSensitiveFields(page: Page): Promise<void> {
  const fields = await collectLabeledFields(page);
  const hit = fields.find((f) => isSensitiveFieldLabel(`${f.label} ${f.name}`));
  if (hit) {
    throw new PolicyViolation(
      `El formulario pide un dato sensible (${hit.label || hit.name}). No se carga DNI/CUIL/CUIT/pasaporte ni datos bancarios.`,
    );
  }
}

export function looksLikeAccountCreation(text: string): boolean {
  const t = text.toLowerCase();
  return [
    "crear una cuenta",
    "create an account",
    "sign up",
    "regístrate",
    "registrate gratis",
    "acepto los términos",
    "i agree to the terms and conditions",
  ].some((s) => t.includes(s));
}
