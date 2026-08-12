import type { TrackerEntry } from "./types";
import { TRACKER_COLUMNS } from "./types";
import { trackerRow } from "./tracker";
import { requireSheetId } from "./sheet-url";
import { googleSheetsClient, hasGoogleCredentials } from "./google-auth";

export async function appendTrackerRow(sheetUrl: string, entry: TrackerEntry): Promise<void> {
  const spreadsheetId = requireSheetId(sheetUrl);
  if (!hasGoogleCredentials()) {
    throw new Error(
      "Planilla activada pero faltan credenciales (GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS).",
    );
  }

  const sheets = googleSheetsClient();
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
