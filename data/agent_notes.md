# Notas del agente (equivalente al CLAUDE.md de la versión anterior)

Herramienta local de un solo usuario. La fuente de verdad son los JSON en `data/`.

## Flujo

1. Completar el wizard en `/setup` → `data/profile_raw.json`.
2. Anthropic extrae el CV y pregunta huecos. Nunca inventa un dato.
3. Con las respuestas se arma `data/base_resume.json` y `data/config.json`.
4. Generar PDFs ATS en `tailored_resumes/`.
5. Primera corrida de un portal real: loguearte a mano. El perfil de Chromium vive en `automation/browser-profile/`.
6. El orquestador (`automation/run.ts`) respeta cupos, exclusiones y la guardia anti-repetidos.

## Portales

Implementados: **computrabajo**, **linkedin**, **indeed**, **bumeran**, más **demo** (tablero local).

- Dominios por defecto: Argentina (`ar.computrabajo.com`, `ar.indeed.com`, `bumeran.com.ar`). Se cambian en `config.json` → `boards.*.baseUrl`.
- Primera corrida: logueate a mano. El perfil de Chromium guarda la sesión.
- LinkedIn: `requireManualConfirm: true`. Completa Easy Apply y se detiene antes de Enviar solicitud.
- Indeed: solo Indeed Apply. Si el aviso manda al sitio de la empresa, queda incompleto.
- Computrabajo: HTML vivo `article.box_offer`, botón Postular, `?pubdate=`.
- Bumeran: URL `/empleos-busqueda-…html` y botón Postularme. Cloudflare a veces pide que resuelvas un desafío a mano (el script se pausa en CAPTCHA).

## Guardia anti-repetidos

- Sin postulación previa → postular.
- Postulación vieja (> `duplicate_check_days_threshold` días) → postular, cualquier perfil.
- Reciente y mismo perfil → no repetir (ya está hecha).
- Reciente y perfil distinto → saltear.

Solo cuenta estado `Postulado` para los cupos diarios.

## Google Sheets

Columnas, en este orden: ID, Fecha, Empresa, Puesto, Perfil de CV, Búsqueda, Ubicación, Portal, Cómo se postuló, Link del aviso, CV enviado, Estado, Notas.
