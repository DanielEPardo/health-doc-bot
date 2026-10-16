/**
 * Historial de tutelas por cuenta (Clerk). Solo servidor.
 * El contenido (título, texto, respuestas y resultado) se guarda CIFRADO (cifrado.server.ts);
 * en claro solo quedan el estado y las fechas. Tablas: supabase/migrations/20261011120000_historial_tutelas.sql.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { extraerHeuristico, type DocumentosDeclarados } from "@/lib/validador";
import { claveEfimera, cifrar, descifrar, importarClave } from "./cifrado.server";
import {
  MAX_TUTELAS,
  type EstadoTutela,
  type ResumenResultado,
  type TutelaEnLista,
  type TutelaGuardada,
} from "./tipos";

export interface FilaTutela {
  id: string;
  usuario_id: string;
  estado: EstadoTutela;
  contenido: string;
  creado: string;
  actualizado: string;
}

export interface AlmacenHistorial {
  listar(usuario: string): Promise<FilaTutela[]>;
  obtener(usuario: string, id: string): Promise<FilaTutela | null>;
  insertar(usuario: string, estado: EstadoTutela, contenido: string): Promise<FilaTutela>;
  actualizar(
    usuario: string,
    id: string,
    cambios: { estado?: EstadoTutela; contenido?: string },
  ): Promise<FilaTutela | null>;
  eliminar(usuario: string, id: string): Promise<void>;
  eliminarTodo(usuario: string): Promise<void>;
  registrarConsentimiento(
    usuario: string,
    alcance: string,
    version: string,
    texto: string,
  ): Promise<void>;
  tieneConsentimiento(usuario: string, alcance: string, version: string): Promise<boolean>;
  /** Autorizaciones vigentes (no revocadas) de la persona. */
  listarConsentimientos(usuario: string): Promise<ConsentimientoVigente[]>;
  /** Revoca (Ley 1581 art. 8 lit. e): se conserva la prueba con la fecha de revocación. */
  revocarConsentimiento(usuario: string, alcance: string): Promise<void>;
}

export interface ConsentimientoVigente {
  alcance: string;
  version: string;
  aceptado_en: string;
}

/** Solo desarrollo y pruebas: se pierde al reiniciar el servidor. */
export class AlmacenHistorialMemoria implements AlmacenHistorial {
  readonly filas = new Map<string, FilaTutela>();
  readonly consentimientos: {
    usuario: string;
    alcance: string;
    version: string;
    texto: string;
    aceptado_en: string;
    revocado_en: string | null;
  }[] = [];
  async listar(u: string) {
    return [...this.filas.values()]
      .filter((f) => f.usuario_id === u)
      .sort((a, b) => b.actualizado.localeCompare(a.actualizado));
  }
  async obtener(u: string, id: string) {
    const f = this.filas.get(id);
    return f && f.usuario_id === u ? f : null;
  }
  async insertar(u: string, estado: EstadoTutela, contenido: string) {
    const ahora = new Date().toISOString();
    const f: FilaTutela = {
      id: crypto.randomUUID(),
      usuario_id: u,
      estado,
      contenido,
      creado: ahora,
      actualizado: ahora,
    };
    this.filas.set(f.id, f);
    return f;
  }
  async actualizar(u: string, id: string, c: { estado?: EstadoTutela; contenido?: string }) {
    const f = await this.obtener(u, id);
    if (!f) return null;
    const nueva = { ...f, ...c, actualizado: new Date().toISOString() };
    this.filas.set(id, nueva);
    return nueva;
  }
  async eliminar(u: string, id: string) {
    if ((await this.obtener(u, id)) !== null) this.filas.delete(id);
  }
  async eliminarTodo(u: string) {
    for (const f of await this.listar(u)) this.filas.delete(f.id);
  }
  async registrarConsentimiento(usuario: string, alcance: string, version: string, texto: string) {
    this.consentimientos.push({
      usuario,
      alcance,
      version,
      texto,
      aceptado_en: new Date().toISOString(),
      revocado_en: null,
    });
  }
  async tieneConsentimiento(u: string, alcance: string, version: string) {
    return this.consentimientos.some(
      (c) => c.usuario === u && c.alcance === alcance && c.version === version && !c.revocado_en,
    );
  }
  async listarConsentimientos(u: string) {
    return this.consentimientos
      .filter((c) => c.usuario === u && !c.revocado_en)
      .map(({ alcance, version, aceptado_en }) => ({ alcance, version, aceptado_en }));
  }
  async revocarConsentimiento(u: string, alcance: string) {
    const ahora = new Date().toISOString();
    for (const c of this.consentimientos)
      if (c.usuario === u && c.alcance === alcance && !c.revocado_en) c.revocado_en = ahora;
  }
}

export class AlmacenHistorialSupabase implements AlmacenHistorial {
  constructor(private readonly db: SupabaseClient) {}

  static async crear(): Promise<AlmacenHistorialSupabase> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Las tablas aún no están en los tipos generados; Lovable los regenera al aplicar la migración.
    return new AlmacenHistorialSupabase(supabaseAdmin as unknown as SupabaseClient);
  }

  private static ok<T>(r: { data: T; error: { message: string } | null }, op: string): T {
    if (r.error) {
      // La autorización de IA necesita la migración 20261015120000_autorizacion_ia.sql.
      if (/alcance_check/.test(r.error.message))
        throw new Error(
          "La base de datos aún no acepta esta autorización: falta aplicar la migración 20261015120000_autorizacion_ia.sql",
        );
      throw new Error(`[historial] Supabase ${op}: ${r.error.message}`);
    }
    return r.data;
  }

  async listar(u: string) {
    return AlmacenHistorialSupabase.ok(
      await this.db
        .from("tutelas")
        .select("*")
        .eq("usuario_id", u)
        .order("actualizado", { ascending: false })
        .limit(MAX_TUTELAS),
      "listar",
    ) as FilaTutela[];
  }
  async obtener(u: string, id: string) {
    return AlmacenHistorialSupabase.ok(
      await this.db.from("tutelas").select("*").eq("usuario_id", u).eq("id", id).maybeSingle(),
      "obtener",
    ) as FilaTutela | null;
  }
  async insertar(u: string, estado: EstadoTutela, contenido: string) {
    return AlmacenHistorialSupabase.ok(
      await this.db
        .from("tutelas")
        .insert({ usuario_id: u, estado, contenido })
        .select("*")
        .single(),
      "insertar",
    ) as FilaTutela;
  }
  async actualizar(u: string, id: string, c: { estado?: EstadoTutela; contenido?: string }) {
    return AlmacenHistorialSupabase.ok(
      await this.db
        .from("tutelas")
        .update({ ...c, actualizado: new Date().toISOString() })
        .eq("usuario_id", u)
        .eq("id", id)
        .select("*")
        .maybeSingle(),
      "actualizar",
    ) as FilaTutela | null;
  }
  async eliminar(u: string, id: string) {
    AlmacenHistorialSupabase.ok(
      await this.db.from("tutelas").delete().eq("usuario_id", u).eq("id", id),
      "eliminar",
    );
  }
  async eliminarTodo(u: string) {
    AlmacenHistorialSupabase.ok(
      await this.db.from("tutelas").delete().eq("usuario_id", u),
      "eliminar todo",
    );
  }
  async registrarConsentimiento(usuario: string, alcance: string, version: string, texto: string) {
    AlmacenHistorialSupabase.ok(
      await this.db
        .from("consentimientos_web")
        .insert({ usuario_id: usuario, alcance, version, texto_autorizacion: texto }),
      "consentimiento",
    );
  }
  async tieneConsentimiento(u: string, alcance: string, version: string) {
    const filas = AlmacenHistorialSupabase.ok(
      await this.db
        .from("consentimientos_web")
        .select("id")
        .eq("usuario_id", u)
        .eq("alcance", alcance)
        .eq("version", version)
        .is("revocado_en", null)
        .limit(1),
      "consultar consentimiento",
    ) as unknown[] | null;
    return (filas?.length ?? 0) > 0;
  }
  async listarConsentimientos(u: string) {
    return AlmacenHistorialSupabase.ok(
      await this.db
        .from("consentimientos_web")
        .select("alcance, version, aceptado_en")
        .eq("usuario_id", u)
        .is("revocado_en", null)
        .order("aceptado_en", { ascending: false }),
      "listar consentimientos",
    ) as ConsentimientoVigente[];
  }
  async revocarConsentimiento(u: string, alcance: string) {
    AlmacenHistorialSupabase.ok(
      await this.db
        .from("consentimientos_web")
        .update({ revocado_en: new Date().toISOString() })
        .eq("usuario_id", u)
        .eq("alcance", alcance)
        .is("revocado_en", null),
      "revocar consentimiento",
    );
  }
}

// ---------------------------------------------------------------------------
// Servicio: cifra, titula y aplica límites
// ---------------------------------------------------------------------------

interface Contenido {
  titulo: string;
  texto: string;
  declarados: DocumentosDeclarados | null;
  resultado: ResumenResultado | null;
}

export interface EntradaGuardar {
  id?: string | null | undefined;
  texto: string;
  declarados: DocumentosDeclarados | null;
  /** Si viene, la tutela queda "revisada"; si no, queda como borrador. */
  resultado?: ResumenResultado | null | undefined;
}

/** "Tutela contra EPS Sura — cirugía de reemplazo…" a partir del texto. */
export function tituloDe(texto: string, fecha = new Date()): string {
  const t = extraerHeuristico(texto);
  const entidad = t.accionadas[0]?.nombre;
  const servicio = t.servicios[0]?.descripcion?.replace(/\s+/g, " ").trim();
  if (entidad) {
    const corto = servicio && servicio.length > 50 ? `${servicio.slice(0, 50)}…` : servicio;
    return corto ? `Tutela contra ${entidad} — ${corto}` : `Tutela contra ${entidad}`;
  }
  return `Tutela sin título (${fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })})`;
}

export class Historial {
  constructor(
    readonly almacen: AlmacenHistorial,
    private readonly clave: CryptoKey,
  ) {}

  private async abrir(f: FilaTutela): Promise<TutelaGuardada> {
    const c = JSON.parse(await descifrar(this.clave, f.contenido, f.usuario_id)) as Contenido;
    return { id: f.id, estado: f.estado, creado: f.creado, actualizado: f.actualizado, ...c };
  }

  async listar(usuario: string): Promise<TutelaEnLista[]> {
    const filas = await this.almacen.listar(usuario);
    const abiertas = await Promise.all(
      filas.map(
        (f) => this.abrir(f).catch(() => null), // si la clave cambió, la fila no se puede leer: se omite
      ),
    );
    return abiertas
      .filter((t): t is TutelaGuardada => t !== null)
      .map(({ texto: _t, declarados: _d, ...resto }) => resto);
  }

  async obtener(usuario: string, id: string): Promise<TutelaGuardada | null> {
    const f = await this.almacen.obtener(usuario, id);
    return f ? this.abrir(f) : null;
  }

  async guardar(usuario: string, e: EntradaGuardar): Promise<TutelaEnLista> {
    const contenido: Contenido = {
      titulo: tituloDe(e.texto),
      texto: e.texto,
      declarados: e.declarados,
      resultado: e.resultado ?? null,
    };
    const cifrado = await cifrar(this.clave, JSON.stringify(contenido), usuario);
    const estado: EstadoTutela = e.resultado ? "revisada" : "borrador";
    let fila: FilaTutela | null = null;
    if (e.id) {
      const previa = await this.almacen.obtener(usuario, e.id);
      if (!previa) throw new Error("Esa tutela ya no existe en tu historial.");
      // Una tutela presentada sigue presentada aunque se edite; si no, el estado depende de si se revisó.
      fila = await this.almacen.actualizar(usuario, e.id, {
        contenido: cifrado,
        estado: previa.estado === "presentada" ? "presentada" : estado,
      });
    } else {
      if ((await this.almacen.listar(usuario)).length >= MAX_TUTELAS)
        throw new Error(
          `Tu historial tiene el máximo de ${MAX_TUTELAS} tutelas. Elimina alguna para guardar esta.`,
        );
      fila = await this.almacen.insertar(usuario, estado, cifrado);
    }
    if (!fila) throw new Error("No pudimos guardar la tutela.");
    const { texto: _t, declarados: _d, ...resto } = await this.abrir(fila);
    return resto;
  }

  async marcarEstado(usuario: string, id: string, estado: EstadoTutela): Promise<void> {
    if (!(await this.almacen.actualizar(usuario, id, { estado })))
      throw new Error("Esa tutela ya no existe en tu historial.");
  }
}

let memoria: AlmacenHistorialMemoria | undefined;
let claveLocal: Promise<CryptoKey> | undefined;

/** Almacén según el entorno: HISTORIAL_ALMACEN=memoria (local, sin Supabase) o Lovable Cloud. */
export async function almacenDesdeEntorno(env = process.env): Promise<AlmacenHistorial> {
  if (env["HISTORIAL_ALMACEN"] === "memoria") return (memoria ??= new AlmacenHistorialMemoria());
  return AlmacenHistorialSupabase.crear();
}

/** Historial con cifrado. En producción exige HISTORIAL_CLAVE (32 bytes en base64). */
export async function historialDesdeEntorno(env = process.env): Promise<Historial> {
  const claveB64 = env["HISTORIAL_CLAVE"];
  if (env["HISTORIAL_ALMACEN"] === "memoria") {
    claveLocal ??= claveB64 ? importarClave(claveB64) : claveEfimera();
    return new Historial(await almacenDesdeEntorno(env), await claveLocal);
  }
  if (!claveB64) throw new Error("El historial no está disponible en este momento.");
  return new Historial(await almacenDesdeEntorno(env), await importarClave(claveB64));
}

/** ¿Se puede usar el historial con esta configuración? (no expone claves) */
export function historialConfigurado(env = process.env): boolean {
  return env["HISTORIAL_ALMACEN"] === "memoria" || Boolean(env["HISTORIAL_CLAVE"]);
}
