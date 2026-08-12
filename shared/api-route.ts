import { NextResponse } from "next/server";

export function isServerlessHost(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function localOnlyError(): NextResponse | null {
  if (!isServerlessHost()) return null;
  return NextResponse.json(
    {
      error:
        "Esta app guarda archivos en tu computadora. El análisis del CV y la planilla no funcionan en Vercel. En tu PC: npm install && npm run dev, y abrí http://localhost:3000/setup",
    },
    { status: 400 },
  );
}

export function errorJson(err: unknown, status = 500): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status });
}
