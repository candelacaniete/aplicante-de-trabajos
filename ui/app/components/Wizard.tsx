"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Position = { title: string; daily_quota: number };

const STEPS = [
  "CV",
  "Datos personales",
  "Qué buscás",
  "Portales",
  "Extras",
  "Planilla",
  "Preguntas",
] as const;

type Gap = { id: string; field: string; question: string; context: string };

const emptyPersonal = {
  full_name: "",
  city: "",
  email: "",
  phone: "",
  linkedin: "",
  portfolio: "",
  languages: "",
  nationality: "",
  work_permit: "",
  address: "",
  postal_code: "",
  licenses: "",
};

export function Wizard() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cvText, setCvText] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [personal, setPersonal] = useState(emptyPersonal);
  const [industry, setIndustry] = useState("");
  const [positions, setPositions] = useState<Position[]>([{ title: "", daily_quota: 3 }]);
  const [location, setLocation] = useState("");
  const [modality, setModality] = useState("Híbrido");
  const [workday, setWorkday] = useState("Full-time");
  const [maxAge, setMaxAge] = useState(7);
  const [dailyCap, setDailyCap] = useState(5);
  const [excluded, setExcluded] = useState("");
  const [discard, setDiscard] = useState("pasantía no remunerada, junior sin sueldo");
  const [boards, setBoards] = useState<string[]>(["demo"]);
  const [boardExtra, setBoardExtra] = useState("");
  const [salary, setSalary] = useState("");
  const [availability, setAvailability] = useState("");
  const [educationNotes, setEducationNotes] = useState("");
  const [cvLanguage, setCvLanguage] = useState<"es" | "en">("es");
  const [sheetEnabled, setSheetEnabled] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(cvText.trim() || cvFile);
    if (step === 1) return Boolean(personal.full_name && personal.email && personal.city);
    if (step === 2) return positions.some((p) => p.title.trim());
    return true;
  }, [step, cvText, cvFile, personal, positions]);

  function toggleBoard(name: string) {
    setBoards((prev) => (prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]));
  }

  async function parseCv() {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set(
        "payload",
        JSON.stringify({
          cv_text: cvText,
          personal: {
            ...personal,
            languages: splitList(personal.languages),
            licenses: splitList(personal.licenses),
          },
          job_search: {
            industry,
            positions: positions.filter((p) => p.title.trim()),
            location,
            modality,
            workday,
            max_age_days: maxAge,
            daily_total_cap: dailyCap,
            excluded_companies: splitList(excluded),
            discard_keywords: splitList(discard),
          },
          boards: uniqueBoards(boards, boardExtra),
          extras: {
            salary_expectation: salary,
            availability,
            education_notes: educationNotes,
            cv_language: cvLanguage,
          },
          google_sheet: { enabled: sheetEnabled, url: sheetUrl },
        }),
      );
      if (cvFile) form.set("cv", cvFile);
      const res = await fetch("/api/setup/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No pude parsear el CV");
      setGaps(data.gaps ?? []);
      setStep(6);
      if (!data.gaps?.length) {
        await finalize({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function finalize(override?: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/setup/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: override ?? answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No pude armar el CV base");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Listo. Ya está armado tu CV base.</h2>
        <p className="mt-2 text-stone-600">
          Guardé <code>data/base_resume.json</code> y <code>data/config.json</code>, y generé los PDFs
          en <code>tailored_resumes/</code> si la verificación pasó.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-teal-700 px-4 py-2 text-white hover:bg-teal-800"
        >
          Ir al dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <ol className="mb-6 flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${
              i === step ? "bg-teal-700 text-white" : i < step ? "bg-teal-50 text-teal-900" : "bg-stone-100 text-stone-500"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="space-y-4">
          <p className="text-stone-600">
            Subí tu CV (PDF, Word o imagen) o, si no tenés, contalo en tus palabras. No hace falta que
            esté perfecto: después te voy a preguntar lo que falte, y no invento nada.
          </p>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
            onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
          />
          <textarea
            className="h-48 w-full rounded-lg border border-stone-300 p-3"
            placeholder="Pegá acá el texto del CV o contá tu experiencia…"
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
          />
        </section>
      )}

      {step === 1 && (
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre completo" value={personal.full_name} onChange={(v) => setPersonal({ ...personal, full_name: v })} />
          <Field label="Ciudad" value={personal.city} onChange={(v) => setPersonal({ ...personal, city: v })} />
          <Field label="Email" value={personal.email} onChange={(v) => setPersonal({ ...personal, email: v })} />
          <Field label="Teléfono" value={personal.phone} onChange={(v) => setPersonal({ ...personal, phone: v })} />
          <Field label="LinkedIn" value={personal.linkedin} onChange={(v) => setPersonal({ ...personal, linkedin: v })} />
          <Field label="Portfolio" value={personal.portfolio} onChange={(v) => setPersonal({ ...personal, portfolio: v })} />
          <Field label="Idiomas (separados por coma)" value={personal.languages} onChange={(v) => setPersonal({ ...personal, languages: v })} />
          <Field label="Nacionalidad" value={personal.nationality} onChange={(v) => setPersonal({ ...personal, nationality: v })} />
          <Field label="Permiso de trabajo" value={personal.work_permit} onChange={(v) => setPersonal({ ...personal, work_permit: v })} />
          <Field label="Dirección" value={personal.address} onChange={(v) => setPersonal({ ...personal, address: v })} />
          <Field label="Código postal" value={personal.postal_code} onChange={(v) => setPersonal({ ...personal, postal_code: v })} />
          <Field label="Licencias / matrículas" value={personal.licenses} onChange={(v) => setPersonal({ ...personal, licenses: v })} />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <Field label="Rubro" value={industry} onChange={setIndustry} />
          <div>
            <p className="mb-2 text-sm font-medium">Puestos y cupo diario de cada uno</p>
            {positions.map((p, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2"
                  placeholder="Ej. Analista de datos"
                  value={p.title}
                  onChange={(e) => {
                    const next = [...positions];
                    next[i] = { ...next[i], title: e.target.value };
                    setPositions(next);
                  }}
                />
                <input
                  type="number"
                  min={1}
                  className="w-24 rounded-lg border border-stone-300 px-3 py-2"
                  value={p.daily_quota}
                  onChange={(e) => {
                    const next = [...positions];
                    next[i] = { ...next[i], daily_quota: Number(e.target.value) };
                    setPositions(next);
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-teal-800"
              onClick={() => setPositions([...positions, { title: "", daily_quota: 3 }])}
            >
              + Agregar puesto
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ubicación" value={location} onChange={setLocation} />
            <Field label="Modalidad" value={modality} onChange={setModality} />
            <Field label="Jornada" value={workday} onChange={setWorkday} />
            <Field label="Antigüedad máxima de avisos (días)" value={String(maxAge)} onChange={(v) => setMaxAge(Number(v) || 7)} />
            <Field label="Tope diario total" value={String(dailyCap)} onChange={(v) => setDailyCap(Number(v) || 5)} />
          </div>
          <Field label="Empresas excluidas (coma)" value={excluded} onChange={setExcluded} />
          <Field label="Cosas a descartar (coma)" value={discard} onChange={setDiscard} />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <p className="text-stone-600">
            Si ya sabés qué portales usar, marcalos. Si no, no lo automatices: charlalo una vez en el
            chat (rubro y país) y después cargá la lista acá. El portal <strong>demo</strong> es un
            tablero local para probar el patrón, sin sitios reales.
          </p>
          <p className="text-sm text-amber-800">
            LinkedIn, Computrabajo e Indeed están como módulos, pero sin selectores inventados. Hasta
            que revisemos juntos la página, esos portales no postulan. LinkedIn, además, nunca aprieta
            Enviar solo.
          </p>
          {["demo", "computrabajo", "indeed", "linkedin"].map((name) => (
            <label key={name} className="flex items-center gap-2">
              <input type="checkbox" checked={boards.includes(name)} onChange={() => toggleBoard(name)} />
              {name}
            </label>
          ))}
          <Field
            label="Otros portales (coma). No se automatizan hasta tener módulo."
            value={boardExtra}
            onChange={setBoardExtra}
          />
        </section>
      )}

      {step === 4 && (
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Sueldo pretendido" value={salary} onChange={setSalary} />
          <Field label="Disponibilidad" value={availability} onChange={setAvailability} />
          <label className="sm:col-span-2 text-sm font-medium">
            Estudios (si no estaban en el CV)
            <textarea
              className="mt-1 h-24 w-full rounded-lg border border-stone-300 p-3 font-normal"
              value={educationNotes}
              onChange={(e) => setEducationNotes(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Idioma del CV
            <select
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
              value={cvLanguage}
              onChange={(e) => setCvLanguage(e.target.value as "es" | "en")}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sheetEnabled} onChange={(e) => setSheetEnabled(e.target.checked)} />
            Sincronizar con una planilla de Google
          </label>
          {sheetEnabled ? (
            <Field label="Link de la hoja" value={sheetUrl} onChange={setSheetUrl} />
          ) : (
            <p className="text-stone-600">Si no, el seguimiento queda en data/job_tracker.json.</p>
          )}
        </section>
      )}

      {step === 6 && (
        <section className="space-y-4">
          {gaps.length === 0 ? (
            <p>No encontré huecos. Armo el CV base con lo que hay, sin inventar nada.</p>
          ) : (
            <>
              <p className="text-stone-600">
                Antes de seguir, necesito estas respuestas. Si no sabés, dejalo vacío: no lo voy a
                inventar.
              </p>
              {gaps.map((g) => (
                <label key={g.id} className="block text-sm font-medium">
                  {g.question}
                  <span className="block font-normal text-stone-500">{g.context}</span>
                  <textarea
                    className="mt-1 h-20 w-full rounded-lg border border-stone-300 p-3 font-normal"
                    value={answers[g.id] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [g.id]: e.target.value })}
                  />
                </label>
              ))}
            </>
          )}
        </section>
      )}

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          className="rounded-lg border border-stone-300 px-4 py-2 disabled:opacity-40"
          disabled={step === 0 || busy}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Atrás
        </button>
        {step < 5 ? (
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40"
            disabled={!canNext || busy}
            onClick={() => setStep((s) => s + 1)}
          >
            Siguiente
          </button>
        ) : step === 5 ? (
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40"
            disabled={busy}
            onClick={parseCv}
          >
            {busy ? "Leyendo el CV…" : "Guardar y analizar"}
          </button>
        ) : (
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40"
            disabled={busy}
            onClick={() => finalize()}
          >
            {busy ? "Armando…" : "Armar CV base"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueBoards(selected: string[], extra: string): string[] {
  return Array.from(new Set([...selected, ...splitList(extra)]));
}
