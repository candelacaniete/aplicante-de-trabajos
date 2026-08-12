import { describe, expect, it } from "vitest";
import { generateResumePdf } from "../cv-generator/generate";
import type { BaseResume } from "../shared/types";

const resume: BaseResume = {
  personal: {
    full_name: "Ana Perez",
    city: "CABA",
    email: "ana@example.com",
    phone: "+54 11 5555-1234",
    linkedin: "linkedin.com/in/ana",
    portfolio: "",
    languages: ["Espanol"],
    nationality: "Argentina",
    work_permit: "Ciudadana",
    address: "",
    postal_code: "",
    licenses: [],
  },
  experience: [
    {
      company: "Acme Salud",
      location: "CABA",
      start_date: "2021-03",
      end_date: "Actualidad",
      role_variants: {
        analista: {
          title: "Analista de datos",
          bullets: ["Tableros SQL para el equipo comercial."],
        },
      },
    },
  ],
  education: [
    {
      institution: "UBA",
      degree: "Licenciatura",
      field: "Economia",
      start_date: "2014",
      end_date: "2019",
      notes: "",
    },
  ],
  courses: [{ name: "SQL avanzado", issuer: "Coursera", year: "2023" }],
  skills: { technical: ["SQL"], tools: ["Excel"], soft: [] },
  role_profiles: [
    {
      id: "analista",
      label: "Analista",
      summary: "Analista con experiencia en SQL y reportes.",
      target_titles: ["Analista de datos"],
    },
  ],
};

describe("generador de PDF", () => {
  it("imprime el HTML y verifica el texto extraído", async () => {
    const result = await generateResumePdf(resume, resume.role_profiles[0]);
    expect(result.verify.ok).toBe(true);
    expect(result.verify.pageCount).toBeLessThanOrEqual(2);
    expect(result.path).toMatch(/Ana_Perez_Analista\.pdf$/);
  }, 60_000);
});
