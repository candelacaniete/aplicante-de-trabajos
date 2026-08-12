import { google } from "googleapis";
import type { TrackerEntry } from "./types";
import { TRACKER_COLUMNS } from "./types";
import { trackerRow } from "./tracker";
import { requireSheetId } from "./sheet-url";

export async function appendTrackerRow(sheetUrl: string, entry: TrackerEntry): Promise<void> {
  const spreadsheetId = requireSheetId(sheetUrl);

  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!inline && !keyFile) {
    throw new Error(
      "Planilla activada pero faltan credenciales (GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_SERVICE_ACCOUNT_JSON).",
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: inline ? JSON.parse(inline) : undefined,
    keyFile: inline ? undefined : keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A1:M1",
  });
  const header = meta.data.values?.[0] ?? [];
  if (header.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "A1:M1",
      valueInputOption: "RAW",
      requestBody: { values: [Array.from(TRACKER_COLUMNS)] },
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "A:M",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [trackerRow(entry)] },
  });
}
