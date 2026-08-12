import Anthropic from "@anthropic-ai/sdk";
import type { BaseResume, GapQuestion, ProfileRaw, RoleProfile } from "./types";

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";
}

export function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY. Copiá .env.example a .env y pegá tu clave de Anthropic.",
    );
  }
  return new Anthropic({ apiKey: key });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("La respuesta del modelo no trajo JSON.");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

const NEVER_INVENT = `REGLA ABSOLUTA: nunca inventes un dato. Si no está en el texto de origen, dejá el campo vacío o listalo en "gaps" como pregunta. No completes fechas, empresas, títulos, logros, herramientas ni niveles que no aparezcan explícitamente. No "inferís" años de experiencia ni cuantificás logros que no tengan números en el original.`;

export interface ParseCvResult {
  extracted: BaseResume;
  gaps: GapQuestion[];
  notes: string;
}

export async function parseCvAndProfile(
  raw: ProfileRaw,
  image?: { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string },
): Promise<ParseCvResult> {
  const client = getClient();
  const prompt = `${NEVER_INVENT}

Sos el extractor de un agente de empleo personal. A partir del CV y de los datos del formulario, devolvé SOLO un JSON con esta forma:

{
  "extracted": {
    "personal": {
      "full_name": "",
      "city": "",
      "email": "",
      "phone": "",
      "linkedin": "",
      "portfolio": "",
      "languages": [],
      "nationality": "",
      "work_permit": "",
      "address": "",
      "postal_code": "",
      "licenses": []
    },
    "experience": [
      {
        "company": "",
        "location": "",
        "start_date": "",
        "end_date": "",
        "role_variants": {
          "default": { "title": "", "bullets": [] }
        }
      }
    ],
    "education": [
      { "institution": "", "degree": "", "field": "", "start_date": "", "end_date": "", "notes": "" }
    ],
    "courses": [{ "name": "", "issuer": "", "year": "" }],
    "skills": { "technical": [], "tools": [], "soft": [] },
    "role_profiles": [
      { "id": "slug_en_snake", "label": "", "summary": "", "target_titles": [] }
    ]
  },
  "gaps": [
    { "id": "g1", "field": "experience[0].end_date", "question": "pregunta en español simple", "context": "por qué hace falta" }
  ],
  "notes": "observaciones breves, sin inventar datos"
}

Instrucciones:
- Preferí los datos del formulario para personal (email, teléfono, etc.) si están.
- Detectá huecos: fechas faltantes, logros sin cuantificar, herramientas sin nivel, periodos sin explicar, educación incompleta.
- Cada puesto buscado del formulario debe generar un role_profile. El summary solo con lo que esté en el CV; si no alcanza, gap.
- role_variants.default usa el título y viñetas tal cual el CV, sin reescribir creativamente. Otras claves de perfil las vas a armar en el paso siguiente.
- Preguntas concretas, una por hueco, en español simple.

Datos del formulario (JSON):
${JSON.stringify(raw, null, 2)}
`;

  const content: Anthropic.MessageCreateParams["messages"][0]["content"] = image
    ? [
        {
          type: "image",
          source: { type: "base64", media_type: image.mediaType, data: image.data },
        },
        { type: "text", text: prompt },
      ]
    : prompt;

  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 8000,
    messages: [{ role: "user", content }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return extractJson(text) as ParseCvResult;
}

export async function buildResumeWithAnswers(input: {
  raw: ProfileRaw;
  extracted: BaseResume;
  answers: Record<string, string>;
}): Promise<BaseResume> {
  const client = getClient();
  const positions = input.raw.job_search.positions.map((p) => p.title).filter(Boolean);
  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 12000,
    messages: [
      {
        role: "user",
        content: `${NEVER_INVENT}

Armá el base_resume.json final. Devolvé SOLO JSON con la forma de BaseResume (personal, experience, education, courses, skills, role_profiles).

Reglas:
- Incorporá las respuestas del usuario SOLO donde correspondan. Si una respuesta dice "no sé" o está vacía, no inventes: dejá el campo vacío.
- Creá un role_profile por cada puesto buscado. id en snake_case ASCII.
- En cada experience, role_variants debe tener una clave por cada role_profile.id. Las viñetas pueden reordenarse o enfatizar lo relevante al perfil, PERO cada viñeta tiene que salir de un hecho que esté en el CV o en las respuestas. Nada de logros nuevos ni métricas nuevas.
- summary de cada perfil: 3-4 líneas, solo con hechos existentes, en el idioma ${input.raw.extras.cv_language}.
- Si un perfil no tiene suficiente evidencia, summary corto y honesto, sin relleno.

Puestos buscados: ${JSON.stringify(positions)}

CV extraído:
${JSON.stringify(input.extracted, null, 2)}

Respuestas a huecos:
${JSON.stringify(input.answers, null, 2)}

Formulario original (personal y extras):
${JSON.stringify({ personal: input.raw.personal, extras: input.raw.extras }, null, 2)}
`,
      },
    ],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return extractJson(text) as BaseResume;
}

export async function writeCoverLetter(input: {
  resume: BaseResume;
  profile: RoleProfile;
  jobTitle: string;
  company: string;
  snippet?: string;
  language: "es" | "en";
}): Promise<string> {
  const client = getClient();
  const message = await client.messages.create({
    model: getModel(),
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: `${NEVER_INVENT}

Redactá una carta de presentación breve (máx. 180 palabras) en ${input.language === "es" ? "español" : "inglés"}.
Solo usá hechos del CV. Si no hay un dato, no lo menciones.
Sin adulación, sin "estoy muy emocionado", tono profesional y concreto.

Puesto: ${input.jobTitle}
Empresa: ${input.company}
Aviso (recorte): ${input.snippet ?? ""}
Perfil: ${input.profile.label}
Resumen del perfil: ${input.profile.summary}
Experiencia: ${JSON.stringify(input.resume.experience)}
`,
      },
    ],
  });
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
