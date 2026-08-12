# Agente de empleo (local)

App de un solo usuario para cargar tu perfil, generar CVs ATS por puesto y postular con un navegador visible. La fuente de verdad son archivos JSON en `data/`. No hay base de datos ni deploy.

## Qué hay acá

| Carpeta | Para qué |
| --- | --- |
| `app/` | Next.js: wizard de carga y dashboard |
| `cv-generator/` | HTML ATS → PDF con Playwright + verificación de texto |
| `automation/` | Orquestador y un módulo por portal |
| `data/` | `base_resume.json`, `config.json`, `job_tracker.json`, política |
| `tailored_resumes/` | PDFs generados |
| `automation/browser-profile/` | Perfil persistente de Chromium (sesiones logueadas) |

## Arranque

```bash
cp .env.example .env   # pegá ANTHROPIC_API_KEY
npm install
npx playwright install chromium
npm run dev            # http://localhost:3000
```

Esta herramienta está pensada para correr **en tu compu**, no en la nube: Playwright abre el navegador visible y los JSON viven en disco.

1. En **Cargar datos** completá el wizard (reemplaza la Parte 1 manual).
2. Anthropic parsea el CV y te muestra huecos. Si no sabés algo, dejalo vacío: **no se inventa**.
3. Se arman `data/base_resume.json`, `data/config.json` y los PDFs.
4. En el dashboard, **Iniciar corrida**. El navegador se abre visible.

También:

```bash
npm run generate-cv    # regenerar PDFs
npm run apply          # corrida desde la terminal
npm test
```

## Si igual querés deployar la UI en Vercel

Next.js está en la **raíz del repo**. En Vercel dejá **Root Directory vacío** (no pongas `ui`).

| Campo | Valor |
| --- | --- |
| **Root Directory** | vacío / `.` |
| **Framework Preset** | Next.js |
| **Node.js Version** | `22.x` |
| Next.js version | no la completes; es **16.3.0** |

Environment variables: `ANTHROPIC_API_KEY`.

La corrida de postulaciones **no funciona en Vercel**. Eso seguí corriendolo en local.

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

## Google Sheets (opcional)

Columnas: ID, Fecha, Empresa, Puesto, Perfil de CV, Búsqueda, Ubicación, Portal, Cómo se postuló, Link del aviso, CV enviado, Estado, Notas.

Hace falta una cuenta de servicio con acceso a la hoja (`GOOGLE_APPLICATION_CREDENTIALS` o `GOOGLE_SERVICE_ACCOUNT_JSON`).

## Advertencia

Varios portales (LinkedIn en particular) prohíben automatización en sus términos. Corré siempre visible, con delays random y topes bajos (3–5) las primeras semanas. Si un portal cambia el HTML seguido o te limita la cuenta, ese lo hacés a mano: el generador de CVs y el tracker siguen sirviendo.
