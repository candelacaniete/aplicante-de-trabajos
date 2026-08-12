/** Mensaje cuando el servidor devolvió un cuerpo vacío (típico de Vercel / crash). */
export function messageForEmptyApiResponse(status: number): string {
  if (status === 413) {
    return "El CV es demasiado grande. Subí un PDF más liviano o pegá el texto en el primer paso.";
  }
  if (status === 504 || status === 524 || status === 408) {
    return "Se agotó el tiempo. Esta app tiene que correr en tu PC (npm run dev), no en Vercel.";
  }
  if (status >= 500 || status === 0) {
    return "El servidor no devolvió datos. En Vercel cargá ANTHROPIC_API_KEY, GOOGLE_SERVICE_ACCOUNT_JSON y GOOGLE_SHEET_URL (y Redeploy). O corré npm run dev en tu computadora.";
  }
  return "El servidor no devolvió datos. Probá de nuevo o corré npm run dev en tu computadora.";
}

export function messageForNonJsonApiResponse(status: number, snippet: string): string {
  const preview = snippet.replace(/\s+/g, " ").trim().slice(0, 180);
  return `El servidor respondió ${status} pero no era JSON.${preview ? ` ${preview}` : ""}`;
}
