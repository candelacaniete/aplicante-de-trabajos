import type { BaseResume, RoleProfile } from "../shared/types";
import { SECTION_TITLES } from "../shared/types";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function contactLine(resume: BaseResume): string {
  const p = resume.personal;
  const parts = [
    p.city,
    p.email,
    p.phone,
    p.linkedin,
    p.portfolio,
  ].filter((x) => x && x.trim());
  return parts.map(esc).join(" · ");
}

function bullets(items: string[]): string {
  if (items.length === 0) return "";
  return `<ul>${items.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
}

export function renderResumeHtml(resume: BaseResume, profile: RoleProfile): string {
  const p = resume.personal;
  const experienceHtml = resume.experience
    .map((job) => {
      const variant = job.role_variants[profile.id] ?? job.role_variants.default;
      const title = variant?.title || Object.values(job.role_variants)[0]?.title || "";
      const items = variant?.bullets ?? Object.values(job.role_variants)[0]?.bullets ?? [];
      const dates = [job.start_date, job.end_date].filter(Boolean).join(" – ");
      const loc = job.location ? ` · ${esc(job.location)}` : "";
      return `<article class="job">
        <p class="job-head"><strong>${esc(title)}</strong> — ${esc(job.company)}${loc}</p>
        <p class="dates">${esc(dates)}</p>
        ${bullets(items)}
      </article>`;
    })
    .join("\n");

  const educationHtml = resume.education
    .map((ed) => {
      const dates = [ed.start_date, ed.end_date].filter(Boolean).join(" – ");
      const line = [ed.degree, ed.field].filter(Boolean).join(", ");
      return `<p><strong>${esc(line || ed.institution)}</strong> — ${esc(ed.institution)}${dates ? ` · ${esc(dates)}` : ""}${ed.notes ? `. ${esc(ed.notes)}` : ""}</p>`;
    })
    .join("\n");

  const coursesHtml = resume.courses
    .map((c) => {
      const bits = [c.name, c.issuer, c.year].filter(Boolean);
      return `<p>${esc(bits.join(" — "))}</p>`;
    })
    .join("\n");

  const skills = [
    ...resume.skills.technical,
    ...resume.skills.tools,
    ...resume.skills.soft,
  ].filter(Boolean);

  const languages = p.languages.length ? `<p>Idiomas: ${esc(p.languages.join(", "))}</p>` : "";
  const licenses = p.licenses.length ? `<p>Licencias: ${esc(p.licenses.join(", "))}</p>` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(p.full_name)} — ${esc(profile.label)}</title>
  <style>
    @page { size: A4; margin: 16mm 18mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.35;
      color: #111;
      margin: 0;
      padding: 0;
      max-width: 100%;
    }
    h1 {
      font-size: 16pt;
      font-weight: 700;
      margin: 0 0 4pt 0;
      letter-spacing: 0.02em;
    }
    .contact {
      font-size: 10pt;
      margin: 0 0 14pt 0;
    }
    h2 {
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border-bottom: 1px solid #222;
      margin: 12pt 0 6pt 0;
      padding-bottom: 2pt;
    }
    p { margin: 0 0 4pt 0; }
    ul {
      margin: 0 0 8pt 18pt;
      padding: 0;
    }
    li { margin: 0 0 2pt 0; }
    .job { margin-bottom: 8pt; }
    .job-head { margin-bottom: 0; }
    .dates { font-size: 10pt; margin: 0 0 2pt 0; }
    .summary { margin-bottom: 4pt; }
  </style>
</head>
<body>
  <h1>${esc(p.full_name)}</h1>
  <p class="contact">${contactLine(resume)}</p>

  <h2>RESUMEN</h2>
  <p class="summary">${esc(profile.summary)}</p>

  <h2>EXPERIENCIA LABORAL</h2>
  ${experienceHtml || "<p></p>"}

  <h2>EDUCACIÓN</h2>
  ${educationHtml || "<p></p>"}

  <h2>CURSOS Y CERTIFICACIONES</h2>
  ${coursesHtml || "<p></p>"}

  <h2>HABILIDADES</h2>
  <p>${esc(skills.join(" · "))}</p>
  ${languages}
  ${licenses}
</body>
</html>`;
}

export const REQUIRED_SECTIONS = SECTION_TITLES;
