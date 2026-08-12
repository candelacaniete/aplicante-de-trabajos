import { NextResponse } from "next/server";
import { isServerlessHost } from "./runtime";

export { isServerlessHost };

export function localOnlyError(): NextResponse | null {
  if (!isServerlessHost()) return null;
  return NextResponse.json(
    {
      error:
        "Las postulaciones automáticas abren un navegador en tu computadora y no corren en Vercel. El perfil sí: usá /setup. La corrida: npm run apply en tu PC.",
    },
    { status: 400 },
  );
}

export function errorJson(err: unknown, status = 500): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status });
}
