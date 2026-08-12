import { describe, expect, it } from "vitest";
import {
  duplicateDecision,
  evaluateCandidate,
  jobKey,
  remainingForSearch,
  remainingTotal,
  appliedToday,
  nextApplicationId,
} from "../shared/tracker";
import { companyIsExcluded, isSensitiveFieldLabel, textHasDiscardKeyword } from "../shared/policy";
import type { AppConfig, JobListing, JobTracker, SearchConfig, TrackerEntry } from "../shared/types";
import { defaultConfig } from "../shared/store";
import { verifyResumeText } from "../cv-generator/verify";
import { renderResumeHtml } from "../cv-generator/template";
import type { BaseResume } from "../shared/types";

function listing(over: Partial<JobListing> = {}): JobListing {
  return {
    title: "Analista de datos",
    company: "Acme Salud",
    location: "CABA",
    url: "https://example.com/jobs/1",
    snippet: "SQL y Python",
    ...over,
  };
}

function entry(over: Partial<TrackerEntry> = {}): TrackerEntry {
  const job = listing();
  return {
    id: "20260812-001",
    date: "2026-08-12T10:00:00.000Z",
    company: job.company,
    title: job.title,
    cv_profile: "analista_de_datos",
    search: "analista_de_datos",
    location: "CABA",
    board: "demo",
    how_applied: "formulario demo",
    job_url: job.url,
    resume_file: "cv.pdf",
    status: "Postulado",
    notes: "",
    job_key: jobKey("demo", job),
    ...over,
  };
}

describe("policy", () => {
  it("detecta empresas excluidas con normalización", () => {
    expect(companyIsExcluded("Empresa Excluida S.A.", ["empresa excluida sa"])).toBe(true);
    expect(companyIsExcluded("Acme", ["otra"])).toBe(false);
  });

  it("detecta palabras a descartar", () => {
    expect(textHasDiscardKeyword("Pasantía no remunerada", ["pasantía no remunerada"])).toBe(true);
  });

  it("nunca deja pasar DNI/CUIL/datos bancarios", () => {
    expect(isSensitiveFieldLabel("DNI")).toBe(true);
    expect(isSensitiveFieldLabel("Número de CUIL")).toBe(true);
    expect(isSensitiveFieldLabel("CBU")).toBe(true);
    expect(isSensitiveFieldLabel("Email")).toBe(false);
  });
});

describe("tracker quotas", () => {
  const search: SearchConfig = {
    id: "analista_de_datos",
    query: "Analista de datos",
    role_profile: "analista_de_datos",
    daily_quota: 2,
    boards: ["demo"],
    location: "CABA",
    modality: "Híbrido",
    workday: "Full-time",
    max_age_days: 7,
  };

  it("cuenta solo Postulado para el cupo del día", () => {
    const tracker: JobTracker = {
      applications: [
        entry({ status: "Postulado", date: "2026-08-12T11:00:00.000Z" }),
        entry({
          id: "20260812-002",
          status: "Incompleto - falta teléfono",
          date: "2026-08-12T12:00:00.000Z",
          job_url: "https://example.com/jobs/2",
          job_key: "demo::https://example.com/jobs/2",
        }),
      ],
    };
    const now = new Date("2026-08-12T18:00:00.000Z");
    expect(appliedToday(tracker, now)).toHaveLength(1);
    expect(remainingForSearch(tracker, search, now)).toBe(1);
  });

  it("respeta el tope diario total", () => {
    const config: AppConfig = { ...defaultConfig(), daily_total_cap: 1 };
    const tracker: JobTracker = {
      applications: [entry({ date: "2026-08-12T11:00:00.000Z" })],
    };
    expect(remainingTotal(tracker, config, new Date("2026-08-12T18:00:00.000Z"))).toBe(0);
  });

  it("genera IDs correlativos del día", () => {
    const tracker: JobTracker = { applications: [entry()] };
    expect(nextApplicationId(tracker, new Date("2026-08-12T18:00:00.000Z"))).toBe("20260812-002");
  });
});

describe("anti-repetidos", () => {
  const now = new Date("2026-08-12T18:00:00.000Z");

  it("deja pasar si no hubo postulación previa", () => {
    const d = duplicateDecision({ applications: [] }, listing(), "demo", "analista_de_datos", 30, now);
    expect(d.action).toBe("apply");
  });

  it("deja pasar postulaciones viejas con cualquier perfil", () => {
    const d = duplicateDecision(
      { applications: [entry({ date: "2026-01-01T10:00:00.000Z", cv_profile: "otro" })] },
      listing(),
      "demo",
      "analista_de_datos",
      30,
      now,
    );
    expect(d.action).toBe("apply");
  });

  it("no repite si es reciente y el mismo perfil", () => {
    const d = duplicateDecision(
      { applications: [entry({ date: "2026-08-10T10:00:00.000Z" })] },
      listing(),
      "demo",
      "analista_de_datos",
      30,
      now,
    );
    expect(d.action).toBe("skip");
  });

  it("saltea si es reciente y el perfil es distinto", () => {
    const d = duplicateDecision(
      { applications: [entry({ date: "2026-08-10T10:00:00.000Z", cv_profile: "otro_perfil" })] },
      listing(),
      "demo",
      "analista_de_datos",
      30,
      now,
    );
    expect(d.action).toBe("skip");
    expect(d.reason).toMatch(/perfil distinto/);
  });

  it("descarta empresa excluida, keyword y experiencia excesiva", () => {
    const config = defaultConfig();
    config.excluded_companies = ["Empresa Excluida SA"];
    config.discard_keywords = ["pasante sin sueldo"];
    const tracker: JobTracker = { applications: [] };

    const excluded = evaluateCandidate(
      listing({ company: "Empresa Excluida SA" }),
      config,
      tracker,
      "demo",
      "p",
    );
    expect(excluded).toEqual(expect.objectContaining({ action: "skip", reason: expect.stringMatching(/excluida/) }));

    const keyword = evaluateCandidate(
      listing({ title: "Pasante sin sueldo", snippet: "pasante sin sueldo" }),
      config,
      tracker,
      "demo",
      "p",
    );
    expect(keyword).toEqual(expect.objectContaining({ action: "skip", reason: expect.stringMatching(/descartada/) }));

    const senior = evaluateCandidate(listing({ requiredYears: 12 }), config, tracker, "demo", "p");
    expect(senior).toEqual(expect.objectContaining({ action: "skip", reason: expect.stringMatching(/años/) }));
  });
});

const sampleResume: BaseResume = {
  personal: {
    full_name: "Ana Pérez",
    city: "CABA",
    email: "ana@example.com",
    phone: "+54 11 5555-1234",
    linkedin: "linkedin.com/in/ana",
    portfolio: "",
    languages: ["Español", "Inglés"],
    nationality: "Argentina",
    work_permit: "Ciudadana",
    address: "Calle Falsa 123",
    postal_code: "1000",
    licenses: [],
  },
  experience: [
    {
      company: "Acme Salud",
      location: "CABA",
      start_date: "2021-03",
      end_date: "Actualidad",
      role_variants: {
        analista_de_datos: {
          title: "Analista de datos",
          bullets: ["Armé tableros de SQL para el equipo comercial."],
        },
      },
    },
  ],
  education: [
    {
      institution: "UBA",
      degree: "Licenciatura",
      field: "Economía",
      start_date: "2014",
      end_date: "2019",
      notes: "",
    },
  ],
  courses: [{ name: "SQL avanzado", issuer: "Coursera", year: "2023" }],
  skills: { technical: ["SQL", "Python"], tools: ["Excel"], soft: ["Comunicación"] },
  role_profiles: [
    {
      id: "analista_de_datos",
      label: "Analista de datos",
      summary: "Analista con experiencia en SQL y reportes para equipos de negocio.",
      target_titles: ["Analista de datos"],
    },
  ],
};

describe("CV template ATS", () => {
  it("incluye contacto en el cuerpo y las secciones en mayúscula", () => {
    const html = renderResumeHtml(sampleResume, sampleResume.role_profiles[0]);
    expect(html).toContain("Ana Pérez");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("+54 11 5555-1234");
    expect(html).toContain("RESUMEN");
    expect(html).toContain("EXPERIENCIA LABORAL");
    expect(html).toContain("EDUCACIÓN");
    expect(html).toContain("CURSOS Y CERTIFICACIONES");
    expect(html).toContain("HABILIDADES");
    expect(html).toContain("Acme Salud");
    expect(html).toContain("2021-03");
    expect(html).not.toMatch(/<table/i);
    expect(html.toLowerCase()).not.toContain("<img");
  });

  it("la verificación exige nombre, email, teléfono, secciones, empresas y fechas", () => {
    const html = renderResumeHtml(sampleResume, sampleResume.role_profiles[0]);
    const text = html.replace(/<[^>]+>/g, " ");
    const result = verifyResumeText(text, sampleResume, sampleResume.role_profiles[0], 1);
    expect(result.ok).toBe(true);
  });

  it("falla si falta el email en el texto extraído", () => {
    const result = verifyResumeText("Ana Pérez RESUMEN EXPERIENCIA LABORAL", sampleResume, sampleResume.role_profiles[0], 1);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("ana@example.com");
  });
});
