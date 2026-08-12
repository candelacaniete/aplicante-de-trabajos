import { google, type sheets_v4 } from "googleapis";

export function hasGoogleCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );
}

export function sheetUrlFromEnv(): string {
  return process.env.GOOGLE_SHEET_URL?.trim() || "";
}

export function parseServiceAccountCredentials(): Record<string, unknown> | undefined {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!inline) return undefined;
  try {
    return JSON.parse(inline) as Record<string, unknown>;
  } catch {
    try {
      const decoded = Buffer.from(inline, "base64").toString("utf8");
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido. En Vercel pegá el JSON de la cuenta de servicio en una sola línea.",
      );
    }
  }
}

export function missingVercelEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY?.trim()) missing.push("ANTHROPIC_API_KEY");
  if (!hasGoogleCredentials()) missing.push("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!sheetUrlFromEnv()) missing.push("GOOGLE_SHEET_URL");
  return missing;
}

export function vercelEnvHelp(missing: string[] = missingVercelEnv()): string {
  if (!missing.length) return "";
  return `En Vercel → Settings → Environment Variables agregá: ${missing.join(", ")}. Marcá Production, Preview y Development. Después Redeploy.`;
}

export function googleSheetsClient(): sheets_v4.Sheets {
  if (!hasGoogleCredentials()) {
    throw new Error(vercelEnvHelp(["GOOGLE_SERVICE_ACCOUNT_JSON"]));
  }
  const credentials = parseServiceAccountCredentials();
  const keyFile = credentials ? undefined : process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const auth = new google.auth.GoogleAuth({
    credentials,
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}
