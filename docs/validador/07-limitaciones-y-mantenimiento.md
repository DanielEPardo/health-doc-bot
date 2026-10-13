# 7. Limitaciones y mantenimiento

## 7.1 Limitaciones honestas

1. **Revisión de forma, no de fondo.** El sistema verifica que la tutela *contenga* los elementos exigidos y *argumente* lo que la jurisprudencia pide. No puede saber si los hechos son ciertos, si la orden médica existe de verdad o si el juez fallará a favor.
2. **El extractor heurístico lee palabras clave.** Puede fallar con textos muy informales, con errores de ortografía graves o con estructuras poco comunes. Por eso:
   - Ninguna regla rechaza la tutela: solo señala y recomienda.
   - Cuando no puede decidir, marca `revisar`.
   - El extractor con IA mejora mucho la lectura de textos desordenados.
3. **Distingue mal entre servicio *mencionado* y servicio *pedido*.** Ej.: "necesito transporte para la hemodiálisis" detecta transporte y procedimiento. Las reglas están escritas para tolerarlo (S01 trata el transporte como excepción).
4. **El umbral de 6 meses (P01) no es legal.** La tutela no caduca (SU-961 de 1999). Es una alerta para pedir justificación.
5. **El puntaje es orientativo.** Pondera crítico ×3, importante ×2, recomendación ×1; no mide probabilidad de éxito.
6. **Solo salud.** Las reglas S01–S09 son específicas de tutelas contra EPS. Para otros temas (pensiones, educación) habría que añadir reglas.
7. **Solo texto.** El bot no lee PDF, Word ni fotos; pide pegar el texto. (Con IA se podría enviar el PDF a Claude como documento; queda como mejora.)
8. **No reemplaza a un abogado.** El descargo acompaña cada reporte.

## 7.2 Calendario de mantenimiento

| Cuándo | Qué revisar | Dónde |
|---|---|---|
| Cada enero | Nueva resolución del PBS (hoy: Resolución 2765 de 2025, vigencia 2026) | `src/lib/validador/normativa/fuentes.ts` → `PBS-VIGENTE` |
| Cada semestre | Nuevas sentencias SU en salud; cambios de criterio sobre Supersalud, tratamiento integral, transporte | `docs/03-jurisprudencia.md`, `src/lib/validador/reglas/` |
| Cuando cambie | Lista de EPS (liquidaciones, fusiones, reforma a la salud) | `EPS_CONOCIDAS` en `src/lib/validador/extraccion/heuristica.ts` |
| Cuando cambie | Reglas de reparto (Decreto 1069 de 2015) | regla C01 |
| Continuo | Casos mal detectados en producción → convertirlos en fixtures anonimizados + prueba | `src/test/` |

## 7.3 Cómo agregar o cambiar una regla

1. Si hace falta, agregar la fuente en `src/lib/validador/normativa/fuentes.ts` (con URL oficial).
2. Agregar el campo necesario en `TutelaExtraida` (`src/lib/validador/types.ts`), en el extractor heurístico y en `ESQUEMA_EXTRACCION` (`src/lib/validador/extraccion/ia.server.ts`).
3. Escribir la regla en el archivo de su categoría en `src/lib/validador/reglas/` con `id`, `severidad`, `fuentes` y textos claros para el usuario.
4. Agregar una prueba en `src/test/`.
5. `npm test && npx tsc --noEmit`, y actualizar `04-matriz-de-reglas.md` y `fuentes.md`.
