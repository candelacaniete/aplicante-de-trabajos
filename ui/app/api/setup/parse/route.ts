import { NextResponse } from "next/server";
import { loadEnv } from "@shared/load-env";
import { ensureDirs, writeJson, writeProfileRaw } from "@shared/store";
import { dataPath } from "@shared/paths";
import { extractUploadedText, saveUpload } from "@shared/extract-text";
import { parseCvAndProfile } from "@shared/anthropic";
import type { BaseResume, GapQuestion, ProfileRaw } from "@shared/types";

export const runtime = "nodejs";

function imageMediaType(
  mime: string,
  filename: string,
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp" || mime === "image/gif") {
    return mime;
  }
  const ext = filename.toLowerCase();
  if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) return "image/jpeg";
  if (ext.endsWith(".png")) return "image/png";
  if (ext.endsWith(".webp")) return "image/webp";
  if (ext.endsWith(".gif")) return "image/gif";
  return null;
}

export async function POST(request: Request) {
  loadEnv();
  ensureDirs();
  try {
    const form = await request.formData();
    const payloadRaw = form.get("payload");
    if (typeof payloadRaw !== "string") {
      return NextResponse.json({ error: "Falta el formulario." }, { status: 400 });
    }
    const payload = JSON.parse(payloadRaw) as Omit<ProfileRaw, "cv_text" | "cv_filename"> & {
      cv_text?: string;
    };

    let cvText = payload.cv_text?.trim() ?? "";
    let cvFilename = "";
    let image:
      | { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string }
      | undefined;

    const file = form.get("cv");
    if (file instanceof File && file.size > 0) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const saved = saveUpload(file.name, bytes);
      cvFilename = file.name;
      const extracted = await extractUploadedText(saved, file.type);
      if (extracted) cvText = `${cvText}\n\n${extracted}`.trim();
      const media = imageMediaType(file.type, file.name);
      if (media && !extracted) {
        image = { mediaType: media, data: bytes.toString("base64") };
      }
    }

    if (!cvText && !image) {
      return NextResponse.json(
        {
          error:
            "Subí un CV o escribí tu experiencia. Si el PDF no tiene texto (escaneado), pegalo o subí una imagen.",
        },
        { status: 400 },
      );
    }

    const raw: ProfileRaw = {
      ...payload,
      cv_text: cvText,
      cv_filename: cvFilename,
    };
    writeProfileRaw(raw);

    const parsed = await parseCvAndProfile(raw, image);
    writeJson(dataPath("extracted_preview.json"), parsed.extracted);
    writeJson(dataPath("gaps.json"), parsed.gaps);

    return NextResponse.json({
      gaps: parsed.gaps as GapQuestion[],
      notes: parsed.notes,
      extracted: parsed.extracted as BaseResume,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
