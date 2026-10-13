# 1. Análisis de la página TuTelaGanas

Exploración realizada el 9 de octubre de 2026 sobre https://health-doc-bot.lovable.app con la extensión Claude in Chrome (lectura del DOM y de los bundles públicos de JavaScript). No se creó cuenta ni se envió ningún formulario.

## 1.1 Qué es

**TuTelaGanas** ofrece una *revisión orientativa* de tutelas **de salud** ya redactadas, antes de radicarlas en el juzgado. El usuario:

1. Crea una cuenta (celular o Google).
2. Desde su cuenta abre un chat de WhatsApp (`https://wa.me/573106907908?text=Hola,%20quiero%20revisar%20mi%20tutela.`) y envía el texto de su tutela junto con el celular o correo de su cuenta.
3. Recibe qué puntos cumple, cuáles no y qué corregir.

Promesas explícitas de la landing (el sistema las respeta todas):

| Promesa en la página | Cómo la cumple este sistema |
|---|---|
| "No redactamos la tutela por ti" | El motor solo **señala** faltantes y da recomendaciones; nunca genera el escrito. |
| "No garantizamos que el juez falle a tu favor" / "no reemplaza a un abogado" | Cada reporte termina con el `DESCARGO` (`src/lib/validador/motor.ts`). |
| "La revisión se basa en el Decreto 2591 de 1991 y en jurisprudencia de la Corte Constitucional" | Cada regla cita su fundamento con enlace a la fuente oficial (`src/lib/validador/normativa/fuentes.ts`). |
| "Tus datos de salud son sensibles… el contenido se usa únicamente para la revisión" | El bot pide autorización expresa, descarta el texto tras revisar y guarda solo un resumen sin datos personales (`src/lib/whatsapp/bot.server.ts`). |
| "Es una revisión orientativa de requisitos" | Puntaje y dictamen se presentan como orientativos. |

## 1.2 Qué revisa hoy (según la página) y cómo se amplía

La página anuncia 5 puntos. El sistema los cubre y los amplía a 26 reglas:

| Punto de la página | Reglas del sistema |
|---|---|
| Que quede claro quién presenta la tutela y contra qué entidad | F01, F02, F03, L01, L02 |
| Que los hechos estén explicados de forma ordenada | F04 (hechos numerados y con fechas) |
| Que se identifique qué derecho se está vulnerando | F05 |
| Que haya soportes: orden médica, negación de la EPS, otros documentos | S01, S02, A01 |
| Que la tutela sea el camino adecuado en tu caso | P01 (inmediatez), P02 (subsidiariedad), P04 (temeridad), P05 (hecho superado) |
| *(nuevo)* | F06 pretensiones, F07 juramento, F08 firma, P03 medida provisional, S03 diagnóstico, S04 servicio, S05 tratamiento integral, S06 sujetos de especial protección, S07 servicios fuera del PBS, S08 transporte/insumos/cuidador, S09 derecho de petición, C01 juez de reparto |

## 1.3 Arquitectura técnica observada

| Elemento | Hallazgo |
|---|---|
| Plataforma | Proyecto Lovable (`lovable.dev/projects/...`), React + **TanStack Start** (se ven `createServerFn`/`_serverFn` en los bundles). |
| Autenticación | **Clerk** (`clerk.accounts.dev`), con celular o Google. |
| Rutas | `/` (landing), `/sign-up`, `/sign-in`, `/revision` (tras iniciar sesión: instrucciones + botón "Abrir WhatsApp"), `/politica-de-datos`. |
| Canal de revisión | Enlace `wa.me` a un número personal/business (+57 310 690 7908). No se observó un webhook de WhatsApp en la app: **la revisión hoy parece manual**. |
| Contacto | tutelaganas@gmail.com |
| Cobro | La FAQ dice que la revisión tiene un costo que se informa antes de comenzar. No se observó pasarela de pago. |

## 1.4 Brechas que este sistema resuelve

1. **Automatizar la revisión**: el motor produce el mismo reporte siempre, en segundos y con fundamento citado.
2. **Bot de WhatsApp**: pasar del enlace `wa.me` manual a la **WhatsApp Cloud API** con webhook (`/api/whatsapp`).
3. **Autorización de datos sensibles**: la política de la página dice correctamente que *crear la cuenta no es autorización para tratar datos de salud*; el bot la solicita y la registra antes de recibir el texto.
4. **Vinculación con la cuenta**: hoy se pide al usuario escribir su celular/correo. Con la Cloud API el número llega en cada mensaje (`from`) y puede buscarse el usuario en Clerk por número (ver guía de integración, paso opcional).

## 1.5 Recomendaciones para la página

- Agregar en `/revision` un recordatorio de **no enviar historias clínicas completas** (el bot también lo dice).
- Publicar en `/politica-de-datos` el responsable del tratamiento con NIT/cédula y dirección física (requisito de la política de tratamiento según el Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015) y el tiempo de conservación de las revisiones.
- Si se cobra, informar el precio **antes** de pedir el texto (la FAQ ya lo promete). El punto natural es entre "ACEPTO" y "pega tu tutela" en `procesarMensaje`.
