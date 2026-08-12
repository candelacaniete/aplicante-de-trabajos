import type { AppConfig } from "../shared/types";

export function randomDelayMs(config: AppConfig): number {
  const min = config.delays.min_ms;
  const max = Math.max(min, config.delays.max_ms);
  return min + Math.floor(Math.random() * (max - min + 1));
}

export async function humanPause(config: AppConfig): Promise<void> {
  const ms = randomDelayMs(config);
  await new Promise((r) => setTimeout(r, ms));
}
