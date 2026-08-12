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

El único portal con selectores reales y revisables en este repo es **demo**: un tablero HTML local para probar el patrón end-to-end.

LinkedIn, Computrabajo e Indeed están como módulos con la interfaz `JobBoard`, pero **sin selectores inventados**. Hasta que revisemos juntos la página, esos módulos fallan con `SelectorsPendingError`.

LinkedIn además tiene `requireManualConfirm: true`: completa lo que pueda y se detiene antes de Enviar.

## Guardia anti-repetidos

- Sin postulación previa → postular.
- Postulación vieja (> `duplicate_check_days_threshold` días) → postular, cualquier perfil.
- Reciente y mismo perfil → no repetir (ya está hecha).
- Reciente y perfil distinto → saltear.

Solo cuenta estado `Postulado` para los cupos diarios.

## Google Sheets

Columnas, en este orden: ID, Fecha, Empresa, Puesto, Perfil de CV, Búsqueda, Ubicación, Portal, Cómo se postuló, Link del aviso, CV enviado, Estado, Notas.
