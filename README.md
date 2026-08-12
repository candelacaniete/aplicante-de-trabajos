# Agente de empleo (local)

App de un solo usuario para cargar tu perfil, generar CVs ATS por puesto y postular con un navegador visible. La fuente de verdad son archivos JSON en `data/`. No hay base de datos ni deploy.

## Qué hay acá

| Carpeta | Para qué |
| --- | --- |
| `ui/` | Next.js: wizard de carga y dashboard |
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

## Portales

El único portal con selectores reales en este repo es **demo**: un tablero HTML local para probar el patrón (cupos, exclusiones, DNI bloqueado, destildar “seguir a la empresa”).

LinkedIn, Computrabajo e Indeed tienen la interfaz `JobBoard` pero **sin selectores inventados**. Hasta que revisemos juntos la página, tiran `SelectorsPendingError`.

LinkedIn además tiene `requireManualConfirm: true`: nunca aprieta Enviar. Completa lo que pueda y espera a que vos lo hagas. En el dashboard aparece “Ya envié”.

Elegí el primer portal real en el chat (Computrabajo, Indeed, Bumeran, etc.) y lo armamos mirando la página, no de memoria.

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
