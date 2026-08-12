# Agente de empleo

App de un solo usuario para cargar tu perfil, generar CVs ATS por puesto y postular con un navegador visible.

En **tu PC** la fuente de verdad son archivos JSON en `data/`. En **Vercel** las claves van en Environment Variables y el perfil se guarda en tu planilla de Google (pestaña `_agente`).

## Qué hay acá

| Carpeta | Para qué |
| --- | --- |
| `app/` | Next.js: wizard de carga y dashboard |
| `cv-generator/` | HTML ATS → PDF con Playwright + verificación de texto |
| `automation/` | Orquestador y un módulo por portal |
| `data/` | `base_resume.json`, `config.json`, `job_tracker.json`, política (local) |
| `tailored_resumes/` | PDFs generados (local) |
| `automation/browser-profile/` | Perfil persistente de Chromium (sesiones logueadas) |

## Arranque local

```bash
cp .env.example .env   # pegá ANTHROPIC_API_KEY
npm install
npx playwright install chromium
npm run dev            # http://localhost:3000
```

1. En **Cargar datos** completá el wizard.
2. Anthropic parsea el CV y te muestra huecos. Si no sabés algo, dejalo vacío: **no se inventa**.
3. Se arman `data/base_resume.json`, `data/config.json` y los PDFs.
4. En el dashboard, **Iniciar corrida**. El navegador se abre visible.

También:

```bash
npm run generate-cv    # regenerar PDFs
npm run apply          # corrida desde la terminal
npm test
```

## Deploy en Vercel (wizard + perfil)

Next.js está en la **raíz del repo**. En Vercel dejá **Root Directory vacío** (no pongas `ui`).

| Campo | Valor |
| --- | --- |
| **Root Directory** | vacío / `.` |
| **Framework Preset** | Next.js |
| **Node.js Version** | `22.x` |
| Next.js version | no la completes; es **16.3.0** |

En **Settings → Environment Variables** (Production, Preview y Development):

| Variable | Qué pegar |
| --- | --- |
| `ANTHROPIC_API_KEY` | tu clave de Anthropic |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | el JSON de la cuenta de servicio, **en una sola línea** |
| `GOOGLE_SHEET_URL` | el link de la hoja (`https://docs.google.com/spreadsheets/d/...`) |

Después **Redeploy**.

1. En Google Cloud creá una cuenta de servicio, descargá el JSON y habilita la API de Google Sheets.
2. Compartí la hoja con el email de esa cuenta (permiso **Editor**).
3. Completá el wizard en la URL de Vercel. El CV y la config se escriben en la pestaña `_agente` de la planilla.

Las env vars no se pueden escribir desde la app: por eso el perfil vive en la planilla y las **claves** en Vercel.

La corrida de postulaciones **no funciona en Vercel** (hace falta un navegador visible). Eso: `npm run apply` en tu PC.

## Portales

Computrabajo, LinkedIn, Indeed y Bumeran (Argentina por defecto). El portal **demo** sigue ahí para probar el patrón sin sitios reales.

La primera corrida de cada portal: logueate a mano. LinkedIn nunca aprieta Enviar (confirmación en el dashboard). Indeed solo usa Indeed Apply, no el sitio de la empresa.

Dominios en `data/config.json` → `boards.*.baseUrl` si no estás en Argentina.

## Límites duros (en código)

- Nunca inventar datos en un formulario.
- Nunca resolver un CAPTCHA.
- Nunca cargar DNI/CUIL/CUIT/pasaporte ni datos bancarios.
- Nunca crear cuentas ni aceptar términos.
- Nunca postular a algo excluido o para lo que no calificás.
- Postulación siempre headed (`headless: false`). `PLAYWRIGHT_HEADLESS=1` solo para tests.

## Google Sheets

Columnas de postulaciones (primera hoja): ID, Fecha, Empresa, Puesto, Perfil de CV, Búsqueda, Ubicación, Portal, Cómo se postuló, Link del aviso, CV enviado, Estado, Notas.

En Vercel, la pestaña `_agente` guarda el CV parseado, `config` y el tracker. No la edites a mano.

## Advertencia

Varios portales (LinkedIn en particular) prohíben automatización en sus términos. Corré siempre visible, con delays random y topes bajos (3–5) las primeras semanas. Si un portal cambia el HTML seguido o te limita la cuenta, ese lo hacés a mano: el generador de CVs y el tracker siguen sirviendo.
