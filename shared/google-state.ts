import { requireSheetId } from "./sheet-url";
import { googleSheetsClient } from "./google-auth";

export const STATE_TAB = "_agente";
export const CHUNK_SIZE = 30_000;

export function chunkValue(key: string, value: string, size = CHUNK_SIZE): string[][] {
  if (!value) return [[key, "0", ""]];
  const rows: string[][] = [];
  for (let i = 0, n = 0; i < value.length; i += size, n += 1) {
    rows.push([key, String(n), value.slice(i, i + size)]);
  }
  return rows;
}

export function joinChunks(rows: Array<[string, string, string]>): Record<string, string> {
  const grouped = new Map<string, string[]>();
  for (const [key, chunkRaw, data] of rows) {
    if (!key) continue;
    const chunk = Number(chunkRaw);
    const index = Number.isFinite(chunk) ? chunk : 0;
    const arr = grouped.get(key) ?? [];
    arr[index] = data ?? "";
    grouped.set(key, arr);
  }
  const out: Record<string, string> = {};
  for (const [key, arr] of grouped) {
    out[key] = arr.map((part) => part ?? "").join("");
  }
  return out;
}

async function ensureStateSheet(spreadsheetId: string): Promise<void> {
  const sheets = googleSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === STATE_TAB);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: STATE_TAB } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${STATE_TAB}!A1:C1`,
    valueInputOption: "RAW",
    requestBody: { values: [["key", "chunk", "data"]] },
  });
}

export async function readStateMap(sheetUrl: string): Promise<Record<string, string>> {
  const spreadsheetId = requireSheetId(sheetUrl);
  await ensureStateSheet(spreadsheetId);
  const sheets = googleSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${STATE_TAB}!A2:C`,
  });
  const rows = (res.data.values ?? [])
    .filter((row) => row.length >= 1)
    .map((row) => [String(row[0] ?? ""), String(row[1] ?? "0"), String(row[2] ?? "")] as [string, string, string]);
  return joinChunks(rows);
}

export async function writeStateKeys(sheetUrl: string, updates: Record<string, string>): Promise<void> {
  const spreadsheetId = requireSheetId(sheetUrl);
  await ensureStateSheet(spreadsheetId);
  const sheets = googleSheetsClient();
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${STATE_TAB}!A2:C`,
  });
  const keep = (current.data.values ?? []).filter((row) => {
    const key = String(row[0] ?? "");
    return key && !(key in updates);
  });
  const nextRows: string[][] = [["key", "chunk", "data"], ...keep];
  for (const [key, value] of Object.entries(updates)) {
    nextRows.push(...chunkValue(key, value));
  }
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${STATE_TAB}!A:C`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${STATE_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: nextRows },
  });
}
