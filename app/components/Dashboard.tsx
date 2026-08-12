"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RunProgress, TrackerEntry } from "@shared/types";
import { readApiJson } from "@/app/lib/read-api-json";

interface DashboardPayload {
  configured: boolean;
  today: Record<string, number>;
  remaining: Record<string, number>;
  remainingTotal: number;
  incomplete: TrackerEntry[];
  recent: TrackerEntry[];
  progress: RunProgress;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/tracker");
        const json = await readApiJson<DashboardPayload & { error?: string }>(res);
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "No pude leer el tracker");
        setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    const id = window.setInterval(() => {
      void tick();
    }, 1500);
    const t = window.setTimeout(() => {
      void tick();
    }, 0);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(t);
    };
  }, []);

  async function startRun() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/run", { method: "POST" });
      const json = await readApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "No pude iniciar la corrida");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(resolution: "confirmed" | "skipped") {
    await fetch("/api/run/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
  }

  if (!data) {
    return <p className="text-stone-600">{error || "Cargando…"}</p>;
  }

  if (!data.configured) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <p>Todavía no cargaste tus datos.</p>
        <Link href="/setup" className="mt-3 inline-block text-teal-800 underline">
          Ir al formulario
        </Link>
      </div>
    );
  }

  const running = data.progress.status === "running" || data.progress.status === "paused";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={startRun}
          disabled={busy || data.progress.status === "running"}
          className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-40"
        >
          {data.progress.status === "running" ? "Corrida en curso…" : "Iniciar corrida"}
        </button>
        <span className="text-sm text-stone-600">
          Tope restante hoy: {data.remainingTotal}. El navegador se abre visible, nunca en segundo plano.
        </span>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {data.progress.awaiting ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium">Esperando que aprietes Enviar</p>
          <p className="text-sm text-stone-700">
            {data.progress.awaiting.company} — {data.progress.awaiting.title}
          </p>
          <p className="mt-1 text-sm">{data.progress.awaiting.instruction}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-white"
              onClick={() => confirm("confirmed")}
            >
              Ya envié
            </button>
            <button
              type="button"
              className="rounded-lg border border-stone-300 px-3 py-1.5"
              onClick={() => confirm("skipped")}
            >
              Saltear
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <Card title="Hoy por búsqueda">
          {Object.keys(data.today).length === 0 ? (
            <p className="text-sm text-stone-600">Todavía no postulaste hoy.</p>
          ) : (
            <ul className="text-sm">
              {Object.entries(data.today).map(([search, n]) => (
                <li key={search}>
                  {search}: {n} postuladas · quedan {data.remaining[search] ?? 0}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Incompletas pendientes">
          {data.incomplete.length === 0 ? (
            <p className="text-sm text-stone-600">Nada trabado.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.incomplete.map((a) => (
                <li key={a.id}>
                  <strong>{a.company}</strong> — {a.title}
                  <div className="text-stone-600">{a.status}</div>
                  {a.notes ? <div className="text-stone-500">{a.notes}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card title="Progreso en vivo">
        <p className="mb-2 text-xs uppercase tracking-wide text-stone-500">
          Estado: {data.progress.status}
          {running && data.progress.currentJob
            ? ` · ${data.progress.currentJob.company} — ${data.progress.currentJob.title}`
            : ""}
        </p>
        <div className="max-h-72 overflow-auto rounded-lg bg-stone-50 p-3 font-mono text-xs leading-5">
          {(data.progress.events ?? []).slice(-80).map((e, i) => (
            <div key={`${e.ts}-${i}`} className={e.level === "error" ? "text-red-700" : e.level === "warn" ? "text-amber-800" : ""}>
              {e.ts.slice(11, 19)} {e.message}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Últimas postulaciones">
        {data.recent.length === 0 ? (
          <p className="text-sm text-stone-600">El tracker está vacío.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="py-2 pr-3">Puesto</th>
                  <th className="py-2 pr-3">Portal</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((a) => (
                  <tr key={a.id} className="border-b border-stone-100">
                    <td className="py-2 pr-3 whitespace-nowrap">{a.date.slice(0, 10)}</td>
                    <td className="py-2 pr-3">{a.company}</td>
                    <td className="py-2 pr-3">{a.title}</td>
                    <td className="py-2 pr-3">{a.board}</td>
                    <td className="py-2 pr-3">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-800">{title}</h2>
      {children}
    </section>
  );
}
