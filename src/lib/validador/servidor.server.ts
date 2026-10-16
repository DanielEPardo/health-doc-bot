/**
 * Validación en el servidor, con IA opcional (OpenRouter; Gemini o Claude como alternativas) en dos pasos:
 *   1. Extracción: la IA lleva los hechos al esquema fijo; las reglas deciden dictamen y puntaje.
 *   2. Análisis jurídico complementario (analisis/juridico.ts): observaciones con base en la
 *      Constitución, la ley y la jurisprudencia del catálogo de fuentes. No cambia el dictamen.
 * Todo lo que sale hacia la IA pasa antes por anonimizar().
 * Solo importar desde código de servidor (*.server.ts, server routes, handlers de server functions).
 */
import {
  combinarExtracciones,
  contextoDocumentos,
  evaluar,
  extraerHeuristico,
  validarTexto,
  type AnalisisJuridicoIA,
  type ContextoValidacion,
  type DocumentosDeclarados,
  type ResultadoRegla,
  type ResultadoValidacion,
  type TutelaExtraida,
} from "./index";
import { anonimizar, contieneMarcador } from "./extraccion/anonimizar";

export type ProveedorIA = "openrouter" | "gemini" | "anthropic";

type Entorno = Record<string, string | undefined>;

export interface OpcionesValidacion extends Partial<ContextoValidacion> {
  /** Proveedor de IA para la extracción. Sin proveedor se usa solo la heurística. Si la IA falla, cae a la heurística. */
  ia?: ProveedorIA | null;
  /** Variables de entorno (inyectable para pruebas). */
  entorno?: Entorno;
  fetch?: typeof fetch;
  /** Respuestas del cuestionario de documentos. */
  declarados?: DocumentosDeclarados | null | undefined;
}

/**
 * Decide qué IA usar según las variables de entorno:
 * - IA_PROVEEDOR=openrouter|gemini|anthropic|ninguno fuerza la elección.
 * - OpenRouter (proveedor principal) se activa con OPENROUTER_API_KEY: modelos de pago baratos que
 *   no guardan ni entrenan con el texto (ver extraccion/openrouter.server.ts).
 * - Gemini se activa con GEMINI_API_KEY (capa gratuita o de pago). El texto siempre se anonimiza
 *   y el usuario debe autorizar el envío (bot: mensaje de autorización; web: autorización única al entrar, registrada como alcance «ia»).
 * - Claude se activa con ANTHROPIC_API_KEY.
 * - IA_ANALISIS=no desactiva solo el análisis jurídico (paso 2) y deja la extracción.
 */
export function proveedorIADesdeEntorno(env: Entorno = process.env): ProveedorIA | null {
  const forzado = env["IA_PROVEEDOR"]?.trim().toLowerCase();
  const openRouterOk = Boolean(env["OPENROUTER_API_KEY"]?.trim());
  const geminiOk = Boolean(env["GEMINI_API_KEY"]?.trim());
  const claudeOk = Boolean(env["ANTHROPIC_API_KEY"]?.trim());
  // Solo «ninguno» apaga la IA. Si el proveedor forzado no tiene clave (o el valor no es válido),
  // se usa el que sí esté configurado, para que un secreto mal escrito no apague la IA en silencio.
  if (forzado === "ninguno") return null;
  if (forzado === "openrouter" && openRouterOk) return "openrouter";
  if (forzado === "gemini" && geminiOk) return "gemini";
  if (forzado === "anthropic" && claudeOk) return "anthropic";
  if (forzado && !["openrouter", "gemini", "anthropic"].includes(forzado))
    console.warn(
      `[validador] IA_PROVEEDOR="${forzado}" no es válido (openrouter, gemini, anthropic o ninguno).`,
    );
  if (openRouterOk) return "openrouter";
  if (geminiOk) return "gemini";
  if (claudeOk) return "anthropic";
  return null;
}

/** Los datos de identificación los aporta la extracción local; la IA solo vio marcadores. */
function restaurarIdentidad(ia: TutelaExtraida, local: TutelaExtraida): TutelaExtraida {
  const elegir = (v: string | null, l: string | null) => (contieneMarcador(v) ? (l ?? v) : v);
  return {
    ...ia,
    accionante: {
      ...ia.accionante,
      nombre: elegir(ia.accionante.nombre, local.accionante.nombre),
      documento: elegir(ia.accionante.documento, local.accionante.documento),
      contacto: elegir(ia.accionante.contacto, local.accionante.contacto),
      residencia: elegir(ia.accionante.residencia, local.accionante.residencia),
    },
    afectado: { ...ia.afectado, nombre: elegir(ia.afectado.nombre, local.afectado.nombre) },
  };
}

async function extraerConProveedor(
  proveedor: ProveedorIA,
  texto: string,
  anonimo: string,
  local: TutelaExtraida,
  env: Entorno,
  f: typeof fetch | undefined,
): Promise<{ extraccion: TutelaExtraida; modelo: string }> {
  if (proveedor === "openrouter") {
    const { extraerConOpenRouter, opcionesOpenRouter } =
      await import("./extraccion/openrouter.server");
    const r = await extraerConOpenRouter(anonimo, opcionesOpenRouter("revision", env, f));
    return {
      extraccion: { ...restaurarIdentidad(r.extraccion, local), longitudTexto: texto.length },
      modelo: r.modelo,
    };
  }
  if (proveedor === "gemini") {
    const { extraerConGemini } = await import("./extraccion/gemini.server");
    const r = await extraerConGemini(anonimo, opcionesGemini(env, f));
    return {
      extraccion: { ...restaurarIdentidad(r.extraccion, local), longitudTexto: texto.length },
      modelo: r.modelo,
    };
  }
  const { extraerConIA, MODELO_POR_DEFECTO } = await import("./extraccion/ia.server");
  const e = await extraerConIA(anonimo);
  return {
    extraccion: { ...restaurarIdentidad(e, local), longitudTexto: texto.length },
    modelo: MODELO_POR_DEFECTO,
  };
}

function opcionesGemini(env: Entorno, f: typeof fetch | undefined) {
  const modelos = env["GEMINI_MODELOS"]
    ?.split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return {
    apiKey: env["GEMINI_API_KEY"] ?? "",
    ...(modelos?.length ? { modelos } : {}),
    ...(f ? { fetch: f } : {}),
  };
}

/** Paso 2: análisis jurídico. Si falla, la revisión sigue sin él (devuelve undefined). */
async function analizarConProveedor(
  proveedor: ProveedorIA,
  anonimo: string,
  resultados: ResultadoRegla[],
  env: Entorno,
  f: typeof fetch | undefined,
): Promise<AnalisisJuridicoIA | undefined> {
  if (env["IA_ANALISIS"]?.toLowerCase() === "no") return undefined;
  try {
    if (proveedor === "openrouter") {
      const { analizarConOpenRouter, opcionesOpenRouter } =
        await import("./extraccion/openrouter.server");
      return await analizarConOpenRouter(anonimo, resultados, opcionesOpenRouter("revision", env, f));
    }
    if (proveedor === "gemini") {
      const { analizarConGemini } = await import("./extraccion/gemini.server");
      return await analizarConGemini(anonimo, resultados, opcionesGemini(env, f));
    }
    const { analizarConClaude } = await import("./extraccion/ia.server");
    return await analizarConClaude(anonimo, resultados);
  } catch (err) {
    console.warn(`[validador] Análisis jurídico con ${proveedor} falló:`, (err as Error).message);
    return undefined;
  }
}

export async function validarTutela(
  texto: string,
  opciones: OpcionesValidacion = {},
): Promise<ResultadoValidacion> {
  const { ia, entorno, fetch: f, declarados, ...resto } = opciones;
  const ctx = { ...resto, ...contextoDocumentos(texto, declarados) };
  if (!ia) return validarTexto(texto, ctx);
  const env = entorno ?? process.env;
  const local = extraerHeuristico(texto);
  const anonimo = anonimizar(texto, local);
  let r: { extraccion: TutelaExtraida; modelo: string };
  try {
    r = await extraerConProveedor(ia, texto, anonimo, local, env, f);
  } catch (err) {
    console.warn(
      `[validador] Extracción con ${ia} falló; se usa heurística:`,
      (err as Error).message,
    );
    // Si la extracción falló (cuota, caída), el análisis casi seguro también: no se intenta.
    return evaluar(local, { ...ctx, origen: "heuristica" });
  }
  const res = evaluar(combinarExtracciones(r.extraccion, local), {
    ...ctx,
    origen: "ia+heuristica",
  });
  const analisisIA = await analizarConProveedor(ia, anonimo, res.resultados, env, f);
  return { ...res, modeloIA: r.modelo, ...(analisisIA ? { analisisIA } : {}) };
}
