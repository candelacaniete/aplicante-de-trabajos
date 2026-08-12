import "dotenv/config";
import { pathToFileURL } from "node:url";
import type { BrowserContext } from "playwright";
import {
  readBaseResume,
  readConfig,
  readTracker,
  writeTracker,
  ensureDirs,
  isResumeConfigured,
} from "../shared/store";
import type { AppConfig, BaseResume, JobListing, SearchConfig, TrackerEntry } from "../shared/types";
import {
  evaluateCandidate,
  jobKey,
  nextApplicationId,
  remainingForSearch,
  remainingTotal,
} from "../shared/tracker";
import { appendTrackerRow } from "../shared/google-sheets";
import { tailoredResumesDir } from "../shared/paths";
import { generateResumePdf, resumePdfName } from "../cv-generator/generate";
import { launchPersistentBrowser } from "./browser";
import { humanPause } from "./delays";
import { emit, resetProgress, setProgress, waitForManualConfirm } from "./progress";
import { getBoard } from "./boards";
import { CaptchaPause, PolicyViolation, SelectorsPendingError } from "./types";
import fs from "node:fs";
import path from "node:path";

function resumePathFor(resume: BaseResume, profileId: string): string {
  const profile = resume.role_profiles.find((p) => p.id === profileId);
  if (!profile) {
    throw new Error(`No existe el perfil de CV "${profileId}" en base_resume.json`);
  }
  return path.join(tailoredResumesDir(), resumePdfName(resume, profile));
}

async function ensureResumeFile(resume: BaseResume, profileId: string): Promise<string> {
  const file = resumePathFor(resume, profileId);
  if (fs.existsSync(file)) return file;
  const profile = resume.role_profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error(`Perfil ${profileId} no encontrado`);
  emit(`No había PDF para ${profile.label}, lo genero ahora.`);
  const result = await generateResumePdf(resume, profile);
  return result.path;
}

async function record(entry: TrackerEntry, config: AppConfig): Promise<void> {
  const tracker = readTracker();
  tracker.applications.push(entry);
  writeTracker(tracker);
  if (config.google_sheet.enabled && config.google_sheet.url) {
    try {
      await appendTrackerRow(config.google_sheet.url, entry);
    } catch (err) {
      emit(`No pude escribir en Google Sheets: ${(err as Error).message}`, "warn");
    }
  }
}

function makeEntry(input: {
  trackerId: string;
  job: JobListing;
  search: SearchConfig;
  board: string;
  profileId: string;
  resumeFile: string;
  status: TrackerEntry["status"];
  notes: string;
  howApplied: string;
}): TrackerEntry {
  return {
    id: input.trackerId,
    date: new Date().toISOString(),
    company: input.job.company,
    title: input.job.title,
    cv_profile: input.profileId,
    search: input.search.id,
    location: input.job.location || input.search.location,
    board: input.board,
    how_applied: input.howApplied,
    job_url: input.job.url,
    resume_file: input.resumeFile,
    status: input.status,
    notes: input.notes,
    job_key: jobKey(input.board, input.job),
  };
}

export async function runAutomation(): Promise<void> {
  ensureDirs();
  resetProgress();
  const config = readConfig();
  const resume = readBaseResume();

  if (!isResumeConfigured(resume)) {
    const msg = "Falta completar el wizard: no hay base_resume.json con nombre y email.";
    emit(msg, "error");
    setProgress({ status: "error", error: msg, finishedAt: new Date().toISOString() });
    return;
  }

  const headless = process.env.PLAYWRIGHT_HEADLESS === "1";
  if (headless) {
    emit("PLAYWRIGHT_HEADLESS=1: el navegador va invisible (solo tests).", "warn");
  } else {
    emit("Abro el navegador en modo visible. Quedate mirando la corrida.");
  }

  let context: BrowserContext | undefined;
  try {
    context = await launchPersistentBrowser(headless);
    const page = context.pages()[0] || (await context.newPage());

    for (const search of config.searches) {
      if (remainingTotal(readTracker(), config) <= 0) {
        emit("Llegamos al tope diario total. Corto la corrida.");
        break;
      }
      const remaining = remainingForSearch(readTracker(), search);
      if (remaining <= 0) {
        emit(`Búsqueda "${search.query}" sin cupo restante. La salteo.`);
        continue;
      }
      emit(`Búsqueda "${search.query}" — cupo restante hoy: ${remaining}.`);

      const profile = resume.role_profiles.find((p) => p.id === search.role_profile);
      if (!profile) {
        emit(`La búsqueda ${search.id} apunta al perfil ${search.role_profile} que no existe.`, "error");
        continue;
      }
      const resumeFile = await ensureResumeFile(resume, profile.id);

      for (const boardName of search.boards) {
        if (remainingTotal(readTracker(), config) <= 0) break;
        if (remainingForSearch(readTracker(), search) <= 0) break;

        const boardCfg = config.boards[boardName];
        if (boardCfg && boardCfg.enabled === false) {
          emit(`Portal ${boardName} deshabilitado en config. Lo salteo.`);
          continue;
        }

        const board = getBoard(boardName);
        emit(`Portal: ${board.name}`);

        try {
          const loggedIn = await board.checkLoggedIn(page);
          if (!loggedIn) {
            emit(
              `[${board.name}] No hay sesión. Logueate a mano en el navegador (el script no crea cuentas ni acepta términos). Cuando termines, reiniciá la corrida.`,
              "warn",
            );
            setProgress({ status: "paused" });
            return;
          }

          await board.search(page, search.query, {
            query: search.query,
            location: search.location,
            modality: search.modality,
            workday: search.workday,
            max_age_days: search.max_age_days,
          });
          await humanPause(config);

          const listings = await board.listResults(page);
          emit(`${listings.length} avisos en ${board.name} para "${search.query}".`);

          for (const job of listings) {
            if (remainingTotal(readTracker(), config) <= 0) break;
            if (remainingForSearch(readTracker(), search) <= 0) break;

            setProgress({ currentJob: job });
            const decision = evaluateCandidate(job, config, readTracker(), board.name, profile.id);
            if (decision.action === "skip") {
              emit(`Salteo ${job.company} — ${job.title}: ${decision.reason}`);
              continue;
            }

            emit(`Postulo a ${job.company} — ${job.title}`, "info", {
              job: { title: job.title, company: job.company, url: job.url },
            });
            await humanPause(config);

            const trackerId = nextApplicationId(readTracker());
            let result;
            try {
              result = await board.applyToJob(page, job, {
                resume,
                role: profile,
                resumePath: resumeFile,
              });
            } catch (err) {
              if (err instanceof CaptchaPause) {
                emit(err.message, "warn");
                await record(
                  makeEntry({
                    trackerId,
                    job,
                    search,
                    board: board.name,
                    profileId: profile.id,
                    resumeFile,
                    status: "Pausado - CAPTCHA",
                    notes: err.message,
                    howApplied: "",
                  }),
                  config,
                );
                setProgress({ status: "paused" });
                return;
              }
              if (err instanceof PolicyViolation) {
                await record(
                  makeEntry({
                    trackerId,
                    job,
                    search,
                    board: board.name,
                    profileId: profile.id,
                    resumeFile,
                    status: `Incompleto - ${err.message}`,
                    notes: err.message,
                    howApplied: "",
                  }),
                  config,
                );
                emit(`Incompleto: ${err.message}`, "warn");
                continue;
              }
              if (err instanceof SelectorsPendingError) {
                emit(err.message, "error");
                setProgress({
                  status: "error",
                  error: err.message,
                  finishedAt: new Date().toISOString(),
                });
                return;
              }
              throw err;
            }

            if (result.status === "awaiting_manual_confirm") {
              const entry = makeEntry({
                trackerId,
                job,
                search,
                board: board.name,
                profileId: profile.id,
                resumeFile,
                status: "Incompleto - esperando confirmación manual",
                notes: result.notes,
                howApplied: result.howApplied ?? "formulario (sin envío final)",
              });
              await record(entry, config);
              const resolution = await waitForManualConfirm({
                applicationId: trackerId,
                board: board.name,
                title: job.title,
                company: job.company,
                url: job.url,
                instruction:
                  "Revisá el navegador, apretá Enviar vos, y en el dashboard tocá «Ya envié».",
                createdAt: new Date().toISOString(),
              });
              const tracker = readTracker();
              const stored = tracker.applications.find((a) => a.id === trackerId);
              if (stored && resolution === "confirmed") {
                stored.status = "Postulado";
                stored.notes = "Confirmación manual de envío";
                writeTracker(tracker);
                emit(`Confirmado a mano: ${job.company} — ${job.title}`);
              } else if (stored) {
                stored.status = `Incompleto - confirmación ${resolution}`;
                writeTracker(tracker);
                emit(`No se confirmó el envío (${resolution}).`, "warn");
              }
              continue;
            }

            if (result.status === "applied") {
              await record(
                makeEntry({
                  trackerId,
                  job,
                  search,
                  board: board.name,
                  profileId: profile.id,
                  resumeFile,
                  status: "Postulado",
                  notes: result.notes,
                  howApplied: result.howApplied ?? "formulario del portal",
                }),
                config,
              );
              emit(`Postulado: ${job.company} — ${job.title}`);
            } else if (result.status === "incomplete" || result.status === "paused") {
              await record(
                makeEntry({
                  trackerId,
                  job,
                  search,
                  board: board.name,
                  profileId: profile.id,
                  resumeFile,
                  status: `Incompleto - ${result.reason ?? result.notes}`,
                  notes: result.notes,
                  howApplied: result.howApplied ?? "",
                }),
                config,
              );
              emit(`Incompleto: ${result.notes}`, "warn");
            } else {
              emit(`Salteo tras applyToJob: ${result.notes}`);
            }
          }
        } catch (err) {
          if (err instanceof SelectorsPendingError) {
            emit(err.message, "error");
            setProgress({
              status: "error",
              error: err.message,
              finishedAt: new Date().toISOString(),
            });
            return;
          }
          throw err;
        }
      }
    }

    emit("Corrida terminada.");
    setProgress({ status: "done", finishedAt: new Date().toISOString(), currentJob: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit(message, "error");
    setProgress({ status: "error", error: message, finishedAt: new Date().toISOString() });
    throw err;
  } finally {
    await context?.close();
  }
}

const isDirectRun =
  Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  runAutomation().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
