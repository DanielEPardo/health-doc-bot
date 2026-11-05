/**
 * Almacenamiento del growth loop. Dos implementaciones con el mismo contrato:
 *   · Supabase (Lovable Cloud) en producción — tablas de
 *     supabase/migrations/20261105120000_growth_loop_referidos.sql.
 *   · Archivo JSON para desarrollo local, para poder probar el loop sin base de datos.
 * Se elige sola según haya o no credenciales de Supabase.
 *
 * Ninguna de las dos guarda texto de tutelas ni datos de salud: solo saldo y fechas.
 */
import { CREDITOS_INICIALES, CREDITOS_POR_REFERIDO } from "./tipos";

export interface Cuenta {
  userId: string;
  codigo: string;
  creditos: number;
  invitadoPor: string | null;
  primeraRevisionEn: string | null;
  creadoEn: string;
}

export interface ConteoInvitados {
  total: number;
  activados: number;
}

export interface MetricasCrudas {
  referidosActivados: number;
  usuariosActivos: number;
  invitacionesAceptadas: number;
}

export interface AlmacenReferidos {
  porUsuario(userId: string): Promise<Cuenta | null>;
  porCodigo(codigo: string): Promise<Cuenta | null>;
  crear(cuenta: Cuenta): Promise<Cuenta>;
  /** Descuenta 1 crédito solo si queda saldo. Atómico. */
  consumirCredito(userId: string): Promise<boolean>;
  devolverCredito(userId: string): Promise<void>;
  /** Marca la primera revisión y premia a quien invitó. Devuelve true solo la primera vez. */
  acreditarPrimeraRevision(userId: string): Promise<boolean>;
  registrarRevisionIA(userId: string): Promise<void>;
  contarInvitados(userId: string): Promise<ConteoInvitados>;
  metricas(dias: number): Promise<MetricasCrudas>;
}

// ---------------------------------------------------------------------------
// Supabase (producción)
// ---------------------------------------------------------------------------

const FILA = "user_id, codigo, creditos, invitado_por, primera_revision_en, creado_en";

interface FilaCuenta {
  user_id: string;
  codigo: string;
  creditos: number;
  invitado_por: string | null;
  primera_revision_en: string | null;
  creado_en: string;
}

/**
 * Forma mínima del cliente de Supabase que usa este almacén. Se tipa aquí (en vez de importar
 * SupabaseClient) porque las tablas del loop todavía no están en los tipos generados del proyecto:
 * Lovable los regenera al aplicar la migración.
 */
interface Respuesta<T> {
  data: T | null;
  error: { message: string } | null;
}
interface Consulta {
  select(columnas: string): Consulta;
  eq(columna: string, valor: string): Consulta;
  insert(fila: Record<string, unknown>): Consulta;
  maybeSingle(): PromiseLike<Respuesta<FilaCuenta>>;
  single(): PromiseLike<Respuesta<FilaCuenta>>;
  then<R>(alResolver: (r: Respuesta<unknown[]>) => R): PromiseLike<R>;
}
interface Db {
  from(tabla: string): Consulta;
  rpc(funcion: string, argumentos: Record<string, unknown>): PromiseLike<Respuesta<unknown>>;
}

const desdeFila = (f: FilaCuenta): Cuenta => ({
  userId: f.user_id,
  codigo: f.codigo,
  creditos: f.creditos,
  invitadoPor: f.invitado_por,
  primeraRevisionEn: f.primera_revision_en,
  creadoEn: f.creado_en,
});

export class AlmacenSupabaseReferidos implements AlmacenReferidos {
  constructor(private readonly db: Db) {}

  static async crearCliente(): Promise<AlmacenSupabaseReferidos> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return new AlmacenSupabaseReferidos(supabaseAdmin as unknown as Db);
  }

  private static revisar(error: { message: string } | null, op: string): void {
    if (error) throw new Error(`[referidos] Supabase ${op}: ${error.message}`);
  }

  private async uno(columna: string, valor: string): Promise<Cuenta | null> {
    const { data, error } = await this.db
      .from("cuentas")
      .select(FILA)
      .eq(columna, valor)
      .maybeSingle();
    AlmacenSupabaseReferidos.revisar(error, "consultar cuenta");
    return data ? desdeFila(data as FilaCuenta) : null;
  }

  porUsuario(userId: string) {
    return this.uno("user_id", userId);
  }
  porCodigo(codigo: string) {
    return this.uno("codigo", codigo);
  }

  async crear(c: Cuenta): Promise<Cuenta> {
    const { data, error } = await this.db
      .from("cuentas")
      .insert({
        user_id: c.userId,
        codigo: c.codigo,
        creditos: c.creditos,
        invitado_por: c.invitadoPor,
      })
      .select(FILA)
      .single();
    AlmacenSupabaseReferidos.revisar(error, "crear cuenta");
    return desdeFila(data as FilaCuenta);
  }

  async consumirCredito(userId: string): Promise<boolean> {
    const { data, error } = await this.db.rpc("consumir_credito", { p_user_id: userId });
    AlmacenSupabaseReferidos.revisar(error, "consumir crédito");
    return data === true;
  }

  async devolverCredito(userId: string): Promise<void> {
    const { error } = await this.db.rpc("sumar_creditos", { p_user_id: userId, p_cantidad: 1 });
    AlmacenSupabaseReferidos.revisar(error, "devolver crédito");
  }

  async acreditarPrimeraRevision(userId: string): Promise<boolean> {
    const { data, error } = await this.db.rpc("acreditar_primera_revision", { p_user_id: userId });
    AlmacenSupabaseReferidos.revisar(error, "acreditar primera revisión");
    return data === true;
  }

  async registrarRevisionIA(userId: string): Promise<void> {
    const { error } = await this.db.from("revisiones_ia").insert({ user_id: userId });
    AlmacenSupabaseReferidos.revisar(error, "registrar revisión");
  }

  async contarInvitados(userId: string): Promise<ConteoInvitados> {
    const { data, error } = await this.db
      .from("cuentas")
      .select("primera_revision_en")
      .eq("invitado_por", userId);
    AlmacenSupabaseReferidos.revisar(error, "contar invitados");
    const filas = (data ?? []) as unknown as { primera_revision_en: string | null }[];
    return {
      total: filas.length,
      activados: filas.filter((f) => f.primera_revision_en).length,
    };
  }

  async metricas(dias: number): Promise<MetricasCrudas> {
    const { data, error } = await this.db.rpc("metricas_loop", { p_dias: dias });
    AlmacenSupabaseReferidos.revisar(error, "métricas");
    const f = (Array.isArray(data) ? data[0] : data) as
      | { referidos_activados: number; usuarios_activos: number; invitaciones_enviadas: number }
      | undefined;
    return {
      referidosActivados: Number(f?.referidos_activados ?? 0),
      usuariosActivos: Number(f?.usuarios_activos ?? 0),
      invitacionesAceptadas: Number(f?.invitaciones_enviadas ?? 0),
    };
  }
}

// ---------------------------------------------------------------------------
// Archivo JSON (desarrollo local, sin base de datos)
// ---------------------------------------------------------------------------

interface Datos {
  cuentas: Record<string, Cuenta>;
  revisiones: { userId: string; creadoEn: string }[];
}
const VACIO: Datos = { cuentas: {}, revisiones: [] };

export class AlmacenArchivoReferidos implements AlmacenReferidos {
  private cola: Promise<unknown> = Promise.resolve();
  private constructor(private readonly ruta: string) {}

  static async crearEn(ruta?: string): Promise<AlmacenArchivoReferidos> {
    const path = await import("node:path");
    const destino =
      ruta ??
      process.env["REFERIDOS_ARCHIVO"] ??
      path.join(process.cwd(), ".datos-local", "referidos.json");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(destino), { recursive: true });
    return new AlmacenArchivoReferidos(destino);
  }

  private async leer(): Promise<Datos> {
    const { readFile } = await import("node:fs/promises");
    try {
      return { ...VACIO, ...(JSON.parse(await readFile(this.ruta, "utf8")) as Partial<Datos>) };
    } catch {
      return structuredClone(VACIO);
    }
  }

  /** Lecturas y escrituras en serie: el servidor atiende varias peticiones a la vez. */
  private transaccion<T>(fn: (d: Datos) => T): Promise<T> {
    const siguiente = this.cola.then(async () => {
      const datos = await this.leer();
      const r = fn(datos);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(this.ruta, `${JSON.stringify(datos, null, 2)}\n`, "utf8");
      return r;
    });
    this.cola = siguiente.catch(() => undefined);
    return siguiente;
  }

  async porUsuario(userId: string) {
    return (await this.leer()).cuentas[userId] ?? null;
  }

  async porCodigo(codigo: string) {
    return Object.values((await this.leer()).cuentas).find((c) => c.codigo === codigo) ?? null;
  }

  async crear(c: Cuenta) {
    return this.transaccion((d) => {
      d.cuentas[c.userId] = c;
      return c;
    });
  }

  async consumirCredito(userId: string) {
    return this.transaccion((d) => {
      const c = d.cuentas[userId];
      if (!c || c.creditos <= 0) return false;
      c.creditos -= 1;
      return true;
    });
  }

  async devolverCredito(userId: string) {
    await this.transaccion((d) => {
      const c = d.cuentas[userId];
      if (c) c.creditos += 1;
    });
  }

  async acreditarPrimeraRevision(userId: string) {
    return this.transaccion((d) => {
      const c = d.cuentas[userId];
      if (!c || c.primeraRevisionEn) return false;
      c.primeraRevisionEn = new Date().toISOString();
      if (c.invitadoPor) {
        const padrino = d.cuentas[c.invitadoPor];
        if (padrino) padrino.creditos += CREDITOS_POR_REFERIDO;
      }
      return true;
    });
  }

  async registrarRevisionIA(userId: string) {
    await this.transaccion((d) => {
      d.revisiones.push({ userId, creadoEn: new Date().toISOString() });
    });
  }

  async contarInvitados(userId: string) {
    const cuentas = Object.values((await this.leer()).cuentas).filter(
      (c) => c.invitadoPor === userId,
    );
    return { total: cuentas.length, activados: cuentas.filter((c) => c.primeraRevisionEn).length };
  }

  async metricas(dias: number): Promise<MetricasCrudas> {
    const d = await this.leer();
    const desde = Date.now() - dias * 86_400_000;
    const dentro = (f: string | null) => Boolean(f) && new Date(f as string).getTime() >= desde;
    const cuentas = Object.values(d.cuentas);
    return {
      referidosActivados: cuentas.filter((c) => c.invitadoPor && dentro(c.primeraRevisionEn))
        .length,
      usuariosActivos: new Set(d.revisiones.filter((r) => dentro(r.creadoEn)).map((r) => r.userId))
        .size,
      invitacionesAceptadas: cuentas.filter((c) => c.invitadoPor && dentro(c.creadoEn)).length,
    };
  }
}

// ---------------------------------------------------------------------------

/** Supabase si está configurado; si no, archivo local (solo fuera de producción). */
export async function crearAlmacenReferidos(): Promise<AlmacenReferidos> {
  if (process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"])
    return AlmacenSupabaseReferidos.crearCliente();
  if (process.env["NODE_ENV"] === "production")
    throw new Error("[referidos] Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  return AlmacenArchivoReferidos.crearEn();
}

export { CREDITOS_INICIALES };
