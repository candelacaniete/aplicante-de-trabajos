import { describe, expect, it } from "vitest";
import {
  bumeranSearchUrl,
  computrabajoSearchUrl,
  indeedSearchUrl,
  linkedinSearchUrl,
  pubdateParam,
  slugPath,
} from "../automation/urls";
import { splitName, yearsFromResume } from "../automation/helpers";
import type { BaseResume } from "../shared/types";
import { emptyResume } from "../shared/store";

describe("URLs de portales", () => {
  it("arma Computrabajo con slug, ubicación y pubdate", () => {
    expect(slugPath("Analista de datos")).toBe("analista-de-datos");
    expect(pubdateParam(7)).toBe(7);
    expect(
      computrabajoSearchUrl("https://ar.computrabajo.com", "Analista de datos", "Buenos Aires", 7),
    ).toBe("https://ar.computrabajo.com/trabajo-de-analista-de-datos-en-buenos-aires?pubdate=7");
  });

  it("arma Indeed con q, l y fromage", () => {
    const url = indeedSearchUrl("https://ar.indeed.com", "Analista", "CABA", 3);
    expect(url).toContain("https://ar.indeed.com/jobs?");
    expect(url).toContain("q=Analista");
    expect(url).toContain("l=CABA");
    expect(url).toContain("fromage=3");
  });

  it("arma Bumeran con el patrón empleos-busqueda", () => {
    expect(bumeranSearchUrl("https://www.bumeran.com.ar", "analista", "")).toBe(
      "https://www.bumeran.com.ar/empleos-busqueda-analista.html",
    );
  });

  it("arma LinkedIn con Easy Apply y recencia", () => {
    const url = linkedinSearchUrl("analista", "Argentina", 1);
    expect(url).toContain("https://www.linkedin.com/jobs/search/?");
    expect(url).toContain("keywords=analista");
    expect(url).toContain("f_AL=true");
    expect(url).toContain("f_TPR=r86400");
  });
});

describe("helpers de formulario", () => {
  it("parte el nombre sin inventar", () => {
    expect(splitName("Ana Pérez")).toEqual({ first: "Ana", last: "Pérez" });
  });

  it("calcula años solo si hay fechas en el CV", () => {
    const resume: BaseResume = emptyResume();
    expect(yearsFromResume(resume)).toBeNull();
    resume.experience.push({
      company: "Acme",
      location: "",
      start_date: "2020-03",
      end_date: "Actualidad",
      role_variants: {},
    });
    expect(yearsFromResume(resume)).toBe(new Date().getFullYear() - 2020);
  });
});
