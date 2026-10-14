# Integración del validador de tutelas en TuTelaGanas

Este proyecto es el código de Lovable ("Tutela Clara" / TuTelaGanas) con el **validador de tutelas en salud** ya integrado. Fundamentación jurídica: [docs/validador/](docs/validador/README.md).

## Qué se agregó

| Pieza | Archivo(s) | Qué hace |
|---|---|---|
| Motor de validación | `src/lib/validador/` | 26 reglas basadas en CP art. 86, Decreto 2591/1991, Ley 1751/2015 y jurisprudencia (T-760/08, SU-508/20, SU-124/18, SU-961/99, SU-055/15, SU-522/19…). TypeScript puro, sin secretos: corre en el navegador o en el servidor. |
| Extracción con IA (opcional) | `src/lib/validador/extraccion/gemini.server.ts` (Gemini con respaldo entre modelos), `anonimizar.ts`, `ia.server.ts` (Claude), `esquema.ts`, `servidor.server.ts`; web: `src/lib/revision-ia.functions.ts` + `src/lib/clerk-verificar.server.ts` | La IA solo **extrae** los datos de textos desordenados a un esquema JSON fijo; las reglas siguen siendo determinísticas. Proveedor principal: **Gemini** (capa gratuita, del modelo más nuevo al más viejo). En la web es opcional y requiere sesión de Clerk verificada en el servidor y la casilla de autorización. Alternativa: Claude. Solo servidor. Si la IA falla, se usa la heurística. |
| Revisión en la web | `src/components/revision-web.tsx`, `src/routes/revision.tsx`, `src/styles.css` | En `/revision`, debajo del botón de WhatsApp: el usuario pega su tutela y ve qué cumple, qué falta y el fundamento. Corre en el navegador: el texto no sale del dispositivo. Se apaga con `REVISION_WEB_HABILITADA = false` en `src/lib/revision-access.ts`. |
| Bot de WhatsApp | `src/routes/api/whatsapp.ts`, `src/lib/whatsapp/bot.server.ts`, `src/lib/whatsapp/almacen-supabase.server.ts` | Webhook de la WhatsApp Cloud API. Pide autorización de datos sensibles (Ley 1581), recibe la tutela (en uno o varios mensajes), responde "REVISAR" con el reporte, borra el texto y guarda solo un resumen sin datos personales. Comandos: AYUDA, NUEVA, BORRAR. |
| Base de datos | `supabase/migrations/20261009120000_bot_whatsapp_tutelas.sql` | Tablas `conversaciones`, `consentimientos`, `revisiones`, `mensajes_procesados` con RLS (solo el servidor accede). |
| Política de datos | `src/routes/politica-de-datos.tsx` | Nueva sección "Cómo se hace la revisión" y encargados (Clerk, Meta, Lovable Cloud y, si se activa, Anthropic). |
| Pruebas | `src/test/validador.test.ts`, `whatsapp-bot.test.ts`, `gemini.test.ts`, `clerk-verificar.test.ts`, `revision-web.test.tsx`, `src/test/fixtures/` | 32 pruebas nuevas (36 en total) con tutelas ficticias. |
| Usabilidad (Nielsen) | `docs/usabilidad/evaluacion-heuristica-nielsen.md`, `revision-web.tsx`, `auth-screen.tsx`, `__root.tsx`, `error-page.ts`, `index.tsx` | Evaluación con las 10 heurísticas y correcciones: lenguaje claro, estado visible, deshacer, errores en español con salida, ayuda contextual. |
| Dependencia | `package.json`, `bun.lock` | `@anthropic-ai/sdk@^0.130.0` (solo se carga en el servidor). |

No se modificó: la landing, Clerk, el registro, `__root.tsx`, ni los archivos autogenerados de Supabase.

## Verificado antes de entregar

- `npx tsc --noEmit` ✅ · `npx vitest run` ✅ 36/36 · `npx vite build` ✅ (destino Cloudflare).
- El código del bot y de la IA **no** aparece en el bundle del navegador.
- Servidor local: `/api/whatsapp` responde el *challenge* de Meta (200), rechaza token incorrecto (403) y POST sin firma (401).
- Revisión web probada en el navegador (escritorio y móvil 375 px).
- ✅ Gemini probado con la API real sobre las 3 tutelas ficticias de `src/test/fixtures/`, incluido el respaldo entre modelos (≈2 s cuando el modelo responde; si los más nuevos están saturados, la primera revisión puede tardar hasta ~40 s y las siguientes vuelven a ~2 s gracias al enfriamiento).
- ⚠️ No probado contra servicios reales: WhatsApp Cloud API, Supabase de producción ni la API de Claude (no había credenciales).

## Cómo subirlo a Lovable

Lovable sincroniza en dos sentidos con GitHub. El plan actual muestra el editor de código como **solo lectura**, así que la vía es GitHub:

1. En Lovable: **Connect to GitHub** → crea el repositorio del proyecto.
2. Clona ese repositorio y copia encima el contenido de esta carpeta (sin `node_modules/`).
3. Revisa el diff, haz commit y push a la rama conectada (normalmente `main`). Lovable mostrará los cambios.
4. No reescribas historia ya publicada (sin force push): lo pide `AGENTS.md`.

## Puesta en marcha del bot

1. **Base de datos:** aplica `supabase/migrations/20261009120000_bot_whatsapp_tutelas.sql` en Lovable Cloud (pídeselo al chat de Lovable: "aplica esta migración", o ejecútalo en el editor SQL de Cloud). Lovable regenerará `src/integrations/supabase/types.ts`.
2. **Meta / WhatsApp Cloud API:** crea una app Business en developers.facebook.com, agrega WhatsApp, registra el número (+57 310 690 7908 si se migra a la plataforma Business; deja de funcionar en la app normal de WhatsApp) y crea un token permanente de System User.
3. **Secretos en Lovable Cloud** (nunca con prefijo `VITE_`):

   | Variable | Obligatoria | Uso |
   |---|---|---|
   | `WHATSAPP_TOKEN` | Sí | Token permanente de Meta |
   | `WHATSAPP_PHONE_NUMBER_ID` | Sí | ID del número en Meta |
   | `WHATSAPP_VERIFY_TOKEN` | Sí | Texto que tú inventas y pegas en Meta al registrar el webhook |
   | `WHATSAPP_APP_SECRET` | Sí | App Secret (valida la firma de cada mensaje) |
   | `WHATSAPP_MENSAJE_COSTO` | No | Si existe, el bot lo envía antes de pedir la tutela (la FAQ promete informar el costo) |
   | `GEMINI_API_KEY` | No | Activa el análisis con IA (Google Gemini, capa gratuita o de pago) en el bot y en la web |
| `GEMINI_MODELOS` | No | Lista fija de modelos separados por coma. Si no se pone, se descubren con la API y se ordenan del más nuevo al más viejo |
| `ANTHROPIC_API_KEY` | No | Alternativa: extracción con Claude |
| `IA_PROVEEDOR` | No | Forzar `gemini`, `anthropic` o `ninguno` |
| `IA_ANALISIS` | No | `no` desactiva solo el análisis jurídico complementario (deja la extracción con IA). Útil si el canal tiene un tiempo de espera corto (Twilio: 15 s) |
| `CLERK_PUBLISHABLE_KEY` | Sí (ya existe) | También se usa en el servidor para verificar la sesión antes del análisis con IA en la web |

**Respaldo entre modelos de Gemini.** El sistema pide a Google la lista de modelos disponibles para la clave y los ordena del más nuevo al más viejo (hoy: 3.8 Flash → 3.7 → 3.6 → 3.5 Flash → 3.5 Flash-Lite → 3.1 Flash-Lite → 2.5 Flash → 2.5 Flash-Lite → 2.5 Pro). Si un modelo está caído, saturado (429/503), no responde en 10 s, no existe para la clave o devuelve una respuesta inválida, pasa al siguiente; un modelo que falló se salta durante 2 minutos para que las siguientes revisiones sean rápidas. Solo se detiene si la clave es inválida. Si ninguno responde, se entrega la revisión heurística (el usuario nunca se queda sin respuesta). Probado con la API real el 9-oct-2026: 3.8 Flash respondió "alta demanda" (503), 3.7 no respondió a tiempo y 3.6 entregó el resultado.

**Dos pasos con IA.** (1) *Extracción*: la IA lleva los hechos de la tutela al esquema fijo y las reglas deciden dictamen y puntaje. (2) *Análisis jurídico complementario* (`src/lib/validador/analisis/juridico.ts`): la IA recibe la tutela anonimizada, el catálogo de fuentes (Constitución, Decreto 2591, Ley 1751, jurisprudencia) y el estado de cada regla, y escribe hasta 6 observaciones sobre el fondo del caso (coherencia, urgencia, sujetos de especial protección, precedentes). Solo puede citar fuentes del catálogo: el esquema lo limita y `normalizarAnalisis` descarta cualquier otra. No cambia el dictamen; si falla, la revisión sale sin observaciones. Prueba real el 14-oct-2026 (con Gemini saturado): 37 s en total, respondió 3.5 Flash-Lite.

> ⚠️ **Capa gratuita de Gemini y datos de salud.** Según los términos de Google, en la capa gratuita el contenido puede usarse para mejorar sus productos y ser leído por revisores humanos, y Google pide no enviar información sensible o personal. Medidas implementadas: (1) **anonimización** antes de enviar: nombre, cédula, teléfono, correo y dirección se reemplazan por marcadores ([NOMBRE], [DOCUMENTO]…) y se restauran localmente; (2) **autorización expresa e informada**: el bot y la web explican exactamente esto y solo usan Gemini si la persona acepta; (3) el texto no se guarda. Aun así, el resto del texto (diagnóstico, hechos) sigue siendo información de salud: la opción más segura para producción es activar la facturación en Google AI Studio (la capa de pago no usa el contenido para mejorar productos).

4. **Webhook:** publica y registra `https://health-doc-bot.lovable.app/api/whatsapp` en Meta → WhatsApp → Configuration, con el verify token; suscríbete al campo `messages`.
5. **Prueba:** escribe "Hola" al número → debe llegar la autorización → "ACEPTO" → pega la tutela de `src/test/fixtures/tutela-incompleta.txt` → "REVISAR".

El enlace `wa.me` de `/revision` puede quedarse igual: el mensaje "Hola, quiero revisar mi tutela" inicia el flujo.

### Notas técnicas
- Lovable despliega en **Cloudflare Workers**: por eso el bot usa Web Crypto (no `node:crypto` ni `pg`) y el cliente Supabase del proyecto.
- Sin IA la revisión tarda milisegundos. Con IA puede tardar 10–30 s y Meta reintenta si el webhook no responde 200 a tiempo. La tabla `mensajes_procesados` evita respuestas duplicadas, pero si se activa la IA conviene procesar en segundo plano (`ctx.waitUntil`).
- `/api/whatsapp` no usa sesión de Clerk: cada POST se autentica con la firma `X-Hub-Signature-256` de Meta.

## Desarrollo local

```bash
npm install            # o bun install
npx vitest run
npx tsc --noEmit
```

Para `vite dev` local, pon tus variables en `.env.local` (ignorado por git): `CLERK_PUBLISHABLE_KEY` y, si quieres IA, `GEMINI_API_KEY`. También hacen falta `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (en Lovable se inyectan solas).
