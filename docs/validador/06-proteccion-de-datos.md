# 6. Protección de datos personales

Una tutela de salud contiene **datos sensibles** (diagnósticos, tratamientos) y datos de identificación. El sistema está diseñado alrededor de la **Ley 1581 de 2012** y su reglamentación (Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015).

## 6.1 Obligaciones y cómo las atiende el sistema

| Obligación | Fundamento | Implementación |
|---|---|---|
| Los datos de salud son sensibles y su tratamiento está prohibido salvo autorización **explícita** | Ley 1581, arts. 5 y 6 | El bot pide "ACEPTO" **antes** de recibir la tutela; la web exige casilla `autorizaDatosSensibles`. |
| Informar que el titular **no está obligado** a autorizar datos sensibles | Decreto 1377/2013 (Decreto 1074/2015) | Texto `TEXTOS.autorizacion` en `bot.ts`. |
| Conservar **prueba** de la autorización | Ley 1581, art. 17 lit. b | Tabla `consentimientos` guarda el texto exacto aceptado y la fecha. |
| **Finalidad** limitada | Ley 1581, art. 4 lit. b | El texto se usa solo para la revisión. |
| **Minimización / temporalidad** | Ley 1581, art. 4 | El texto se borra al revisar (`buffer = ""`); se guarda solo `ResumenRevision` (dictamen, puntaje, estado por regla) **sin nombre, cédula ni diagnóstico** (prueba automatizada en `src/test/whatsapp-bot.test.ts`). Script SQL para vaciar textos abandonados a las 24 h. |
| Derecho a **suprimir** datos y revocar autorización | Ley 1581, art. 8 | Comando `BORRAR` → `borrarTodo()`. |
| **Seguridad** | Ley 1581, art. 4 lit. g | Firma HMAC de Meta verificada; secretos solo en servidor; RLS en tablas; nada expuesto al navegador. |
| Informar a los **encargados** | Ley 1581, art. 3 lit. d | El texto de autorización menciona a Meta y al proveedor de análisis. Actualizar `/politica-de-datos` para nombrar: Clerk, Meta (WhatsApp) y, si se activa la IA, Anthropic. |

| **Transparencia** sobre el uso de IA | Ley 1581, art. 4 lit. e; SIC, Circular Externa 002 de 2024 (tratamiento de datos personales en sistemas de IA) | Aviso legal único en `src/lib/validador/aviso-ia.ts`: qué hace la IA, que no decide el resultado, que puede equivocarse, que no es asesoría jurídica, qué datos salen y hacia dónde, y que es voluntario. El bot lo envía **antes** de pedir "ACEPTO" (y con el comando `IA`) y queda en la constancia del consentimiento; la web lo muestra junto a la casilla; `/politica-de-datos` lo repite. Cada reporte marca las «Observaciones de la IA» aparte, con su advertencia. |
| Sin **decisiones automatizadas** sobre la persona | Ley 1581, art. 4 (finalidad y libertad) | La IA no decide: el dictamen y el puntaje salen de reglas fijas con fundamento; sus observaciones son complementarias y solo pueden citar fuentes del catálogo (`normativa/fuentes.ts`). |

## 6.2 Lo que NO se debe hacer

- Pedir fotos de la historia clínica o de documentos por WhatsApp.
- Guardar el texto completo de las tutelas "para entrenar" o "para estadísticas" sin una autorización específica para esa finalidad.
- Registrar el texto en logs (`console.log`) en producción.
- Subir tutelas reales al repositorio (la carpeta una carpeta fuera del repositorio está en `.gitignore`).

## 6.3 Transferencia internacional

Meta, Clerk, Google (Gemini) y Anthropic procesan datos fuera de Colombia. La Ley 1581 (art. 26) regula la transferencia internacional; una de sus excepciones es la autorización expresa e inequívoca del titular, por eso el aviso de IA dice que el texto anonimizado se procesa fuera de Colombia; la transmisión a un **encargado** que actúa por cuenta del responsable se rige por un contrato de transmisión. Recomendación: revisar con un abogado los términos de cada proveedor y reflejarlos en la política.
