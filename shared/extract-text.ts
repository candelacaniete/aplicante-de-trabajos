import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { dataPath } from "./paths";

export async function extractUploadedText(filePath: string, mime: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === ".txt" || mime.startsWith("text/")) {
    return buffer.toString("utf8");
  }

  if (ext === ".docx" || mime.includes("wordprocessingml")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (ext === ".pdf" || mime === "application/pdf") {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    return text.trim();
  }

  if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return "";
  }

  return buffer.toString("utf8");
}

export function saveUpload(filename: string, bytes: Buffer): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const dest = dataPath("uploads", `${Date.now()}_${safe}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bytes);
  return dest;
}
