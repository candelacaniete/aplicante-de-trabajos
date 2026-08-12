import type { JobBoard } from "../types";
import { demoBoard } from "./demo";
import { linkedinBoard } from "./linkedin";
import { computrabajoBoard } from "./computrabajo";
import { indeedBoard } from "./indeed";
import { readConfig } from "../../shared/store";

const registry: Record<string, JobBoard> = {
  demo: demoBoard,
  linkedin: linkedinBoard,
  computrabajo: computrabajoBoard,
  indeed: indeedBoard,
};

export function getBoard(name: string): JobBoard {
  const board = registry[name];
  if (!board) {
    throw new Error(
      `No hay módulo para el portal "${name}". Portales conocidos: ${Object.keys(registry).join(", ")}.`,
    );
  }
  const cfg = readConfig().boards[name];
  if (cfg) {
    board.requireManualConfirm = cfg.requireManualConfirm;
  }
  return board;
}

export function listBoardNames(): string[] {
  return Object.keys(registry);
}
