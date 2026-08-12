"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readApiJson } from "@/app/lib/read-api-json";
import { sheetIdFromUrl } from "@shared/sheet-url";

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

type SetupStatus = {
  hosted: boolean;
  hasAnthropic: boolean;
  hasGoogle: boolean;
  sheetUrl: string;
  missingEnv: string[];
};

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
  const [boards, setBoards] = useState<string[]>(["computrabajo", "linkedin", "indeed", "bumeran"]);
  const [boardExtra, setBoardExtra] = useState("");
  const [salary, setSalary] = useState("");
  const [availability, setAvailability] = useState("");
  const [educationNotes, setEducationNotes] = useState("");
  const [cvLanguage, setCvLanguage] = useState<"es" | "en">("es");
  const [sheetEnabled, setSheetEnabled] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [hosted, setHosted] = useState(false);
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(cvText.trim() || cvFile);
    if (step === 1) return Boolean(personal.full_name && personal.email && personal.city);
    if (step === 2) return positions.some((p) => p.title.trim());
    if (step === 5 && (sheetEnabled || hosted)) return Boolean(sheetIdFromUrl(sheetUrl));
    return true;
  }, [step, cvText, cvFile, personal, positions, sheetEnabled, sheetUrl, hosted]);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const res = await fetch("/api/setup/status");
        const data = await readApiJson<SetupStatus & { error?: string }>(res);
        if (cancelled || !res.ok) return;
        setStatus(data);
        setHosted(data.hosted);
        if (data.hosted) setSheetEnabled(true);
        if (data.sheetUrl) setSheetUrl((prev) => prev || data.sheetUrl);
      } catch {
        /* el wizard igual se puede completar en local */
      }
    }
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

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
          google_sheet: { enabled: sheetEnabled || hosted, url: sheetUrl },
        }),
      );
      if (cvFile) form.set("cv", cvFile);
      const res = await fetch("/api/setup/parse", { method: "POST", body: form });
      const data = await readApiJson<{ error?: string; gaps?: Gap[] }>(res);
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
        body: JSON.stringify({ answers: override ?? answers, sheetUrl }),
      });
      const data = await readApiJson<{ error?: string }>(res);
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
          {hosted
            ? "El perfil quedó en tu planilla de Google (pestaña _agente). Las claves siguen en las variables de entorno de Vercel."
            : "Guardé data/base_resume.json y data/config.json, y generé los PDFs en tailored_resumes/ si la verificación pasó."}
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

      {status?.hosted && status.missingEnv.length > 0 ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          En Vercel → Settings → Environment Variables faltan:{" "}
          <strong>{status.missingEnv.join(", ")}</strong>. Marcá Production / Preview / Development y
          hacé Redeploy. El CV y el perfil se guardan en la planilla; las claves no van en localhost.
        </div>
      ) : null}

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
            Marcá los portales. La primera corrida de cada uno: logueate a mano en el navegador
            (el script no crea cuentas ni acepta términos). LinkedIn nunca aprieta Enviar: completa
            el formulario y espera a que lo hagas vos.
          </p>
          {["computrabajo", "linkedin", "indeed", "bumeran", "demo"].map((name) => (
            <label key={name} className="flex items-center gap-2">
              <input type="checkbox" checked={boards.includes(name)} onChange={() => toggleBoard(name)} />
              {name}
              {name === "demo" ? " (tablero local de prueba)" : ""}
              {name === "linkedin" ? " (envío manual)" : ""}
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
          {hosted ? (
            <>
              <p className="text-stone-700">
                En Vercel las claves van en <strong>Environment Variables</strong>, no en un archivo
                .env local:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600">
                <li>
                  <code>ANTHROPIC_API_KEY</code>
                </li>
                <li>
                  <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> (el JSON de la cuenta de servicio, en una
                  sola línea)
                </li>
                <li>
                  <code>GOOGLE_SHEET_URL</code> (el link de esta hoja)
                </li>
              </ul>
              <p className="text-sm text-stone-600">
                Compartí la hoja con el email de la cuenta de servicio (permiso Editor). El CV, tus
                datos y la config se escriben en la pestaña <code>_agente</code> de esa planilla.
              </p>
              <Field label="Link de la hoja" value={sheetUrl} onChange={setSheetUrl} />
              {sheetUrl.trim() && !sheetIdFromUrl(sheetUrl) ? (
                <p className="text-sm text-red-700">
                  Pegá el link completo de Google Sheets (docs.google.com/spreadsheets/d/...).
                </p>
              ) : null}
            </>
          ) : (
            <>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sheetEnabled}
                  onChange={(e) => setSheetEnabled(e.target.checked)}
                />
                Sincronizar con una planilla de Google
              </label>
              {sheetEnabled ? (
                <>
                  <Field label="Link de la hoja" value={sheetUrl} onChange={setSheetUrl} />
                  {sheetUrl.trim() && !sheetIdFromUrl(sheetUrl) ? (
                    <p className="text-sm text-red-700">
                      Pegá el link completo de Google Sheets (docs.google.com/spreadsheets/d/...).
                    </p>
                  ) : null}
                  <p className="text-sm text-stone-600">
                    En local podés usar .env. En Vercel usá Environment Variables:
                    ANTHROPIC_API_KEY, GOOGLE_SERVICE_ACCOUNT_JSON y GOOGLE_SHEET_URL.
                  </p>
                </>
              ) : (
                <p className="text-stone-600">Si no, el seguimiento queda en data/job_tracker.json.</p>
              )}
            </>
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
            disabled={!canNext || busy || Boolean(hosted && status && (!status.hasAnthropic || !status.hasGoogle))}
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
