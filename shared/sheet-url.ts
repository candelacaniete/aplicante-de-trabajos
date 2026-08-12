/** Extrae el ID de una hoja de Google a partir del link de compartir o de edición. */
export function sheetIdFromUrl(url: string): string | null {
  const m = url.trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m?.[1] ?? null;
}

export function requireSheetId(url: string): string {
  const id = sheetIdFromUrl(url);
  if (!id) {
    throw new Error(
      "El link de Google Sheets no parece válido. Pegá el link completo de la hoja (docs.google.com/spreadsheets/d/...).",
    );
  }
  return id;
}
