# Validador de tutelas — fundamentación

Documentación jurídica y técnica del validador integrado en TuTelaGanas. El código vive en `src/lib/validador/` (motor y reglas) y `src/lib/whatsapp/` (bot).

| Documento | Contenido |
|---|---|
| [01 — Análisis de la página](01-analisis-de-la-pagina.md) | Qué hacía la página y qué agrega el sistema |
| [02 — Marco normativo](02-marco-normativo.md) | Constitución (art. 86), Decreto 2591 de 1991, Ley 1751 de 2015, reparto, Supersalud, Ley 2213 |
| [03 — Jurisprudencia](03-jurisprudencia.md) | T-760/08, SU-508/20, SU-124/18, SU-961/99, SU-055/15, SU-522/19 y más: qué regla aporta cada una |
| [04 — Matriz de reglas](04-matriz-de-reglas.md) | Las 26 reglas con severidad y fundamento enlazado |
| [06 — Protección de datos](06-proteccion-de-datos.md) | Ley 1581 de 2012: autorización, minimización, supresión |
| [07 — Limitaciones y mantenimiento](07-limitaciones-y-mantenimiento.md) | Qué no hace el sistema y qué actualizar cada año |
| [Fuentes](fuentes.md) | Bibliografía completa con enlaces oficiales |

La guía para poner en marcha el bot está en [INTEGRACION.md](../../INTEGRACION.md).

## Reglas del cuestionario de documentos (D01–D05)

Se evalúan solo si la persona responde las preguntas sobre sus documentos (sin enviarlos). Comparan lo que dice tener con el texto de la tutela:

| Regla | Qué revisa | Fundamento |
|---|---|---|
| D01 | Tiene la orden médica y la tutela la menciona (o al revés) | T-760 de 2008; SU-508 de 2020 |
| D02 | Lo que se pide coincide con lo que ordenó el médico | T-760 de 2008; SU-508 de 2020 |
| D03 | Qué respondió la EPS y cómo se prueba (negación escrita/verbal, silencio y plazo de 15 días hábiles, autorización sin entrega, sin solicitud previa) | Decreto 2591 art. 5; SU-508 de 2020; Ley 1755 de 2015 |
| D04 | Fechas de los documentos (inmediatez) y que estén en los hechos | SU-961 de 1999 |
| D05 | Documentos por relacionar en «Pruebas y anexos» o por conseguir | Decreto 2591 art. 14 |

Código: `src/lib/validador/documentos.ts` y `src/lib/validador/reglas/documentos.ts`.
