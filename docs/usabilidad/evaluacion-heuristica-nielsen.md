# Evaluación heurística de usabilidad (Nielsen) — TuTelaGanas

**Fecha:** 9 de octubre de 2026 · **Método:** evaluación heurística con las 10 heurísticas de Jakob Nielsen (1994; revisadas por Nielsen Norman Group en 2020) · **Evaluador:** 1 (recomendado: 3–5 evaluadores para encontrar ~75 % de los problemas) · **Alcance:** inicio (`/`), registro e ingreso (`/sign-up`, `/sign-in`), revisión (`/revision`) con la revisión web, política de datos, páginas de error y 404. Probado en escritorio y en móvil (375 px).

**Escala de severidad (Nielsen):** 0 = no es problema · 1 = cosmético · 2 = menor · 3 = mayor (prioridad alta) · 4 = catástrofe (corregir antes de lanzar).

## Usuario de referencia

Persona con una tutela de salud ya redactada (a veces un borrador informal), poca familiaridad con términos jurídicos, muchas veces desde el celular y en una situación de urgencia médica (propia o de un familiar). Por eso pesan más la claridad del lenguaje (H2), la visibilidad del estado (H1) y la recuperación de errores (H9).

## Resumen

| # | Heurística | Hallazgos | Máx. severidad | Estado |
|---|---|---|---|---|
| H1 | Visibilidad del estado del sistema | 3 | 3 | ✅ Corregido |
| H2 | Coincidencia entre el sistema y el mundo real | 3 | 3 | ✅ Corregido (1 depende de Clerk) |
| H3 | Control y libertad del usuario | 2 | 2 | ✅ Corregido |
| H4 | Consistencia y estándares | 3 | 3 | ✅ Corregido (1 decisión de negocio) |
| H5 | Prevención de errores | 2 | 2 | ✅ Corregido |
| H6 | Reconocer antes que recordar | 1 | 2 | ✅ Corregido |
| H7 | Flexibilidad y eficiencia de uso | 1 | 1 | ✅ Corregido |
| H8 | Diseño estético y minimalista | 1 | 2 | ✅ Corregido |
| H9 | Ayudar a reconocer, diagnosticar y recuperarse de errores | 3 | 3 | ✅ Corregido |
| H10 | Ayuda y documentación | 1 | 2 | ✅ Corregido |

## Hallazgos y correcciones

### H1 — Visibilidad del estado del sistema
| Hallazgo | Sev. | Corrección | Archivo |
|---|---|---|---|
| El ingreso mostraba "Estamos conectando el ingreso…" **indefinidamente**, sin indicador de actividad (se observó en local al faltar la clave de Clerk). El usuario no sabe si esperar o irse. | 3 | Indicador giratorio "Cargando el ingreso seguro…"; a los 12 s cambia a un mensaje claro con acciones. | `src/components/auth-screen.tsx` |
| En la revisión web, si el usuario edita el texto después de revisar, el resultado viejo seguía visible como si fuera actual. | 3 | Aviso "Cambiaste el texto: este resultado corresponde a la versión anterior" y el botón pasa a "Revisar de nuevo". | `src/components/revision-web.tsx` |
| El puntaje "54/100" sin contexto visual. | 2 | Barra de progreso con color según el dictamen y conteo "4 por corregir primero · 10 para fortalecer · 7 ya están bien". | `revision-web.tsx` |

### H2 — Coincidencia con el mundo real
| Hallazgo | Sev. | Corrección |
|---|---|---|
| Los resultados usaban jerga jurídica como título: "Legitimación por activa", "Subsidiariedad", "Inmediatez", "Temeridad", "Hecho superado". | 3 | Títulos en forma de pregunta cotidiana con el término técnico entre paréntesis: "¿Por qué la tutela y no otro trámite? (subsidiariedad)", "¿La presentas a tiempo? (inmediatez)". |
| "Puntaje 54/100" se puede leer como probabilidad de ganar la tutela, lo que crea falsas expectativas. | 3 | Nota explícita: "El puntaje mide qué tan completa está tu tutela, no la probabilidad de ganarla". |
| El formulario de Clerk dice "para continuar en **My Application**" y pide nombre, correo y contraseña, aunque la página promete "solo tu celular o Google". | 3 | **Pendiente en la consola de Clerk** (no es código): renombrar la instancia a TuTelaGanas, activar teléfono, desactivar contraseña y ocultar nombre (ver `roadmap.md`). |

### H3 — Control y libertad del usuario
| Hallazgo | Sev. | Corrección |
|---|---|---|
| El logo del encabezado no llevaba al inicio (convención web universal); en `/revision` y en el ingreso no había forma evidente de volver. | 2 | El logo es ahora un enlace al inicio con foco visible. | 
| "Borrar texto" eliminaba el texto pegado sin posibilidad de recuperarlo. | 2 | Botón "Deshacer borrado" durante 10 s (se prefirió deshacer a un diálogo de confirmación, que interrumpe). |

### H4 — Consistencia y estándares
| Hallazgo | Sev. | Corrección |
|---|---|---|
| La página 404 y las de error estaban **en inglés** ("Page not found", "Try again", "Go home") en un sitio en español. | 3 | Traducidas, con `lang="es-CO"` y textos orientados a la acción. (`src/routes/__root.tsx`, `src/lib/error-page.ts`) |
| El inicio decía solo "Envíanos tu tutela por WhatsApp", pero `/revision` ofrece también revisión en la web. | 2 | El texto del inicio y el paso 2 de "Cómo funciona" mencionan ambos canales cuando `REVISION_WEB_HABILITADA` está activo. |
| La FAQ dice "Sí, la revisión tiene un costo", pero la revisión web es gratuita e inmediata. | 2 | **Decisión de negocio pendiente:** cobrar solo la revisión por WhatsApp (y ajustar la FAQ), o apagar la revisión web (`REVISION_WEB_HABILITADA = false`). |

### H5 — Prevención de errores
| Hallazgo | Sev. | Corrección |
|---|---|---|
| El usuario podía pegar solo una parte de la tutela sin darse cuenta. | 2 | Contador visible "N caracteres (mínimo 300)" que se actualiza al escribir. |
| Riesgo de pegar historia clínica completa (datos sensibles innecesarios). | 2 | Recordatorio permanente bajo el campo; el texto no sale del navegador ni se guarda en `localStorage` (decisión de privacidad deliberada). |

### H6 — Reconocer antes que recordar
| Hallazgo | Sev. | Corrección |
|---|---|---|
| Para corregir la tutela, el usuario tenía que recordar las recomendaciones mientras editaba su documento en otra aplicación. | 2 | Botón "Copiar lista de correcciones": copia la lista priorizada con recomendaciones y fundamentos para pegarla junto al documento. Los puntos críticos aparecen abiertos por defecto. |

### H7 — Flexibilidad y eficiencia de uso
| Hallazgo | Sev. | Corrección |
|---|---|---|
| Para revisar varias versiones seguidas había que ir al botón con el mouse cada vez. | 1 | Atajo Ctrl/⌘ + Enter (indicado en la ayuda del campo). |

### H8 — Diseño estético y minimalista
| Hallazgo | Sev. | Corrección |
|---|---|---|
| La lista "Lo que ya está bien" (hasta 20 puntos) competía visualmente con lo que hay que corregir. | 2 | Agrupada en un solo desplegable "Ver los N puntos que ya están bien". |

### H9 — Reconocer, diagnosticar y recuperarse de errores
| Hallazgo | Sev. | Corrección |
|---|---|---|
| El ingreso que no carga no ofrecía salida. | 3 | Mensaje que explica la causa probable + botones "Intentar de nuevo", "Escribir por WhatsApp" y enlace al inicio. |
| Las páginas de error no decían qué hacer ni si se perdió información. | 2 | "Tuvimos un problema de nuestro lado; tu información no se perdió…" + contacto. |
| El aviso de texto corto era genérico. | 2 | Mensajes específicos: texto vacío ("Aún no has pegado tu tutela…"), texto corto (con la cantidad de caracteres) y texto demasiado largo (qué quitar). El campo se marca con `aria-invalid`. |

### H10 — Ayuda y documentación
| Hallazgo | Sev. | Corrección |
|---|---|---|
| No había ayuda para saber qué debe contener una tutela antes de pegarla. | 2 | Desplegable "¿Qué partes debe tener una tutela?" (basado en los arts. 14 y 37 del Decreto 2591) y remisión a la Defensoría del Pueblo y la Personería para quien aún no la tiene escrita. Cada resultado conserva su fundamento enlazado. |

## Análisis con IA (agregado después)

La opción de IA en `/revision` se diseñó con las mismas heurísticas:
- **H1:** mientras analiza, el botón muestra "Analizando con IA…" con indicador giratorio y un mensaje explica que, si el modelo más reciente está ocupado, se prueba el siguiente. El resultado indica si se hizo "con IA (modelo)" o "en tu navegador".
- **H5 / consentimiento:** la IA es opcional (casilla desmarcada por defecto) y el texto explica qué se envía, a quién y con qué riesgo.
- **H8:** si el servidor no tiene IA configurada, la opción no se muestra.
- **H9:** si la IA falla (sesión vencida, cuota, red), el usuario recibe igual la revisión local y un aviso con el motivo.

## Verificación

- Pruebas automatizadas de la interfaz (`src/test/revision-web.test.tsx`): mensaje de texto vacío (H9), aviso de resultado desactualizado y atajo Ctrl+Enter (H1, H7), deshacer el borrado (H3).
- Revisión visual en el navegador, en escritorio y en móvil (375 px), y comprobación de la 404 en español.

## Pendientes y recomendaciones

1. **Clerk** (H2, sev. 3): nombre de la instancia y registro solo con celular o Google.
2. **Costo vs. revisión gratuita** (H4, sev. 2): decidir y alinear la FAQ.
3. **Prueba con usuarios reales** (5 personas que hayan presentado una tutela de salud): la evaluación heurística no reemplaza las pruebas de usabilidad.
4. La 404 no define `<title>` propio (sev. 1).
