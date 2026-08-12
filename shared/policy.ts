/**
 * Límites duros — innegociables. Van en código, no en una instrucción salteable.
 */

export const SENSITIVE_FIELD_PATTERNS: RegExp[] = [
  /\bdni\b/i,
  /\bcuil\b/i,
  /\bcuit\b/i,
  /\bpasaporte\b/i,
  /\bpassport\b/i,
  /\bssn\b/i,
  /seguridad social/i,
  /social security/i,
  /\bcbu\b/i,
  /\bcvu\b/i,
  /cuenta bancaria/i,
  /bank account/i,
  /routing number/i,
  /tarjeta de cr[eé]dito/i,
  /credit card/i,
  /n[uú]mero de tarjeta/i,
  /datos bancarios/i,
];

export const CAPTCHA_SELECTORS = [
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha"]',
  ".g-recaptcha",
  ".h-captcha",
  "#cf-challenge",
  ".cf-turnstile",
  '[data-callback*="captcha"]',
];

export const CAPTCHA_TEXT = [
  "verificar que no eres un robot",
  "verify you are human",
  "i'm not a robot",
  "no soy un robot",
  "complete the captcha",
  "completar el captcha",
];

export const TOS_TEXT = [
  "acepto los términos",
  "acepto terminos",
  "i agree to the terms",
  "create an account",
  "crear una cuenta",
  "registrate",
  "regístrate",
  "sign up",
];

export const FOLLOW_COMPANY_TEXT = [
  "seguir a la empresa",
  "follow the company",
  "follow this company",
  "recibir novedades",
  "recibir avisos",
  "email alerts",
  "job alerts",
  "newsletter",
  "keep me updated",
  "notificarme",
];

export function isSensitiveFieldLabel(label: string): boolean {
  const text = label.trim();
  if (!text) return false;
  return SENSITIVE_FIELD_PATTERNS.some((re) => re.test(text));
}

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(s a|sa|srl|llc|inc|ltd|spa|sas)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function companyIsExcluded(company: string, excluded: string[]): boolean {
  const target = normalizeCompany(company);
  if (!target) return false;
  return excluded.some((item) => {
    const needle = normalizeCompany(item);
    return needle.length > 0 && (target === needle || target.includes(needle) || needle.includes(target));
  });
}

export function textHasDiscardKeyword(text: string, keywords: string[]): boolean {
  const haystack = text.toLowerCase();
  return keywords.some((kw) => kw.trim() && haystack.includes(kw.trim().toLowerCase()));
}

export function slugifyName(fullName: string): string {
  return fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}
