export function slugPath(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pubdateParam(maxAgeDays: number): number {
  if (maxAgeDays <= 1) return 1;
  if (maxAgeDays <= 3) return 3;
  if (maxAgeDays <= 7) return 7;
  if (maxAgeDays <= 15) return 15;
  return 30;
}

export function linkedinTimeFilter(maxAgeDays: number): string {
  if (maxAgeDays <= 1) return "r86400";
  if (maxAgeDays <= 7) return "r604800";
  return "r2592000";
}

export function computrabajoSearchUrl(
  baseUrl: string,
  query: string,
  location: string,
  maxAgeDays: number,
): string {
  const q = slugPath(query) || "empleo";
  const loc = slugPath(location);
  const path = loc ? `/trabajo-de-${q}-en-${loc}` : `/trabajo-de-${q}`;
  return `${baseUrl.replace(/\/$/, "")}${path}?pubdate=${pubdateParam(maxAgeDays)}`;
}

export function indeedSearchUrl(
  baseUrl: string,
  query: string,
  location: string,
  maxAgeDays: number,
): string {
  const params = new URLSearchParams();
  params.set("q", query);
  if (location) params.set("l", location);
  params.set("fromage", String(Math.min(Math.max(maxAgeDays, 1), 30)));
  params.set("sort", "date");
  return `${baseUrl.replace(/\/$/, "")}/jobs?${params.toString()}`;
}

export function bumeranSearchUrl(baseUrl: string, query: string, location: string): string {
  const q = slugPath(query) || "empleo";
  const loc = slugPath(location);
  const path = loc
    ? `/empleos-busqueda-${q}-en-${loc}.html`
    : `/empleos-busqueda-${q}.html`;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function linkedinSearchUrl(query: string, location: string, maxAgeDays: number): string {
  const params = new URLSearchParams();
  params.set("keywords", query);
  if (location) params.set("location", location);
  params.set("f_AL", "true");
  params.set("f_TPR", linkedinTimeFilter(maxAgeDays));
  params.set("sortBy", "DD");
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}
