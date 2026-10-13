/**
 * Validación en el servidor, con extracción opcional por IA (Gemini o Claude).
 * Solo importar desde código de servidor (*.server.ts, server routes, handlers de server functions).
 */
import {
  combinarExtracciones,
  evaluar,
  extraerHeuristico,
  validarTexto,
  type ContextoValidacion,
  type ResultadoValidacion,
  type TutelaExtraida,
} from "./index";
import { anonimizar, contieneMarcador } from "./extraccion/anonimizar";

export type ProveedorIA = "gemini" | "anthropic";

type Entorno = Record<string, string | undefined>;

export interface OpcionesValidacion extends Partial<ContextoValidacion> {
  /** Proveedor de IA para la extracción. Sin proveedor se usa solo la heurística. Si la IA falla, cae a la heurística. */
  ia?: ProveedorIA | null;
  /** Variables de entorno (inyectable para pruebas). */
  entorno?: Entorno;
  fetch?: typeof fetch;
}

/**
 * Decide qué IA usar según las variables de entorno:
 * - IA_PROVEEDOR=gemini|anthropic|ninguno fuerza la elección.
 * - Gemini se activa con GEMINI_API_KEY (capa gratuita o de pago). El texto siempre se anonimiza
 *   y el usuario debe autorizar el envío (bot: mensaje de autorización; web: casilla).
 * - Claude se activa con ANTHROPIC_API_KEY.
 */
export function proveedorIADesdeEntorno(env: Entorno = process.env): ProveedorIA | null {
  const forzado = env["IA_PROVEEDOR"]?.toLowerCase();
  const geminiOk = Boolean(env["GEMINI_API_KEY"]);
  const claudeOk = Boolean(env["ANTHROPIC_API_KEY"]);
  if (forzado === "ninguno") return null;
  if (forzado === "gemini") return geminiOk ? "gemini" : null;
  if (forzado === "anthropic") return claudeOk ? "anthropic" : null;
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
  local: TutelaExtraida,
  env: Entorno,
  f: typeof fetch | undefined,
): Promise<{ extraccion: TutelaExtraida; modelo: string }> {
  const anonimo = anonimizar(texto, local);
  if (proveedor === "gemini") {
    const { extraerConGemini } = await import("./extraccion/gemini.server");
    const modelos = env["GEMINI_MODELOS"]
      ?.split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const r = await extraerConGemini(anonimo, {
      apiKey: env["GEMINI_API_KEY"] ?? "",
      ...(modelos?.length ? { modelos } : {}),
      ...(f ? { fetch: f } : {}),
    });
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

export async function validarTutela(
  texto: string,
  opciones: OpcionesValidacion = {},
): Promise<ResultadoValidacion> {
  const { ia, entorno, fetch: f, ...ctx } = opciones;
  if (!ia) return validarTexto(texto, ctx);
  const local = extraerHeuristico(texto);
  try {
    const r = await extraerConProveedor(ia, texto, local, entorno ?? process.env, f);
    return {
      ...evaluar(combinarExtracciones(r.extraccion, local), { ...ctx, origen: "ia+heuristica" }),
      modeloIA: r.modelo,
    };
  } catch (err) {
    console.warn(
      `[validador] Extracción con ${ia} falló; se usa heurística:`,
      (err as Error).message,
    );
    return evaluar(local, { ...ctx, origen: "heuristica" });
  }
}
