import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AlmacenArchivoReferidos } from "@/lib/referidos/almacen.server";
import {
  cerrarRevision,
  cobrarRevision,
  obtenerOCrearCuenta,
} from "@/lib/referidos/servicio.server";
import { codigoValido, generarCodigo } from "@/lib/referidos/codigo";
import { CREDITOS_INICIALES, CREDITOS_POR_REFERIDO } from "@/lib/referidos/tipos";

/* Growth loop "comparte y gana revisiones": atribución, premio y métrica. */

let carpeta: string;
let almacen: AlmacenArchivoReferidos;

beforeEach(async () => {
  carpeta = mkdtempSync(path.join(tmpdir(), "referidos-"));
  almacen = await AlmacenArchivoReferidos.crearEn(path.join(carpeta, "referidos.json"));
});
afterEach(() => rmSync(carpeta, { recursive: true, force: true }));

describe("Código de invitación", () => {
  it("es legible al dictarlo y no se repite", () => {
    const codigos = new Set(Array.from({ length: 500 }, generarCodigo));
    expect(codigos.size).toBe(500);
    for (const c of codigos) expect(codigoValido(c)).toBe(true);
    // Sin caracteres que se confunden al leer un enlace en voz alta.
    for (const c of codigos) expect(c).not.toMatch(/[01OIL]/);
    expect(codigoValido("abc")).toBe(false);
  });
});

describe("Cuenta nueva", () => {
  it("arranca con el saldo inicial y un enlace propio", async () => {
    const cuenta = await obtenerOCrearCuenta("user_1", null, almacen);
    expect(cuenta.creditos).toBe(CREDITOS_INICIALES);
    expect(codigoValido(cuenta.codigo)).toBe(true);
    expect(cuenta.invitadoPor).toBeNull();
    // Volver a pedirla no crea otra ni reinicia el saldo.
    await cobrarRevision("user_1", almacen);
    expect((await obtenerOCrearCuenta("user_1", null, almacen)).creditos).toBe(0);
  });
});

describe("Atribución de la invitación", () => {
  it("registra quién invitó, solo al crear la cuenta", async () => {
    const anfitrion = await obtenerOCrearCuenta("user_anfitrion", null, almacen);
    const invitado = await obtenerOCrearCuenta("user_invitado", anfitrion.codigo, almacen);
    expect(invitado.invitadoPor).toBe("user_anfitrion");

    // Una cuenta que ya existía no puede quedar atribuida después.
    const viejo = await obtenerOCrearCuenta("user_viejo", null, almacen);
    expect(viejo.invitadoPor).toBeNull();
    expect(
      (await obtenerOCrearCuenta("user_viejo", anfitrion.codigo, almacen)).invitadoPor,
    ).toBeNull();
  });

  it("ignora el autorreferido y los códigos inexistentes", async () => {
    const solo = await obtenerOCrearCuenta("user_solo", null, almacen);
    // Mismo usuario reusando su propio código: no debe contar (ya existía, y además es él mismo).
    const otro = await obtenerOCrearCuenta("user_otro", "NOEXIST", almacen);
    expect(otro.invitadoPor).toBeNull();
    const tercero = await obtenerOCrearCuenta("user_tercero", solo.codigo, almacen);
    expect(tercero.invitadoPor).toBe("user_solo");
  });
});

describe("El loop completo", () => {
  it("premia a quien invita cuando el invitado completa su PRIMERA revisión, una sola vez", async () => {
    const anfitrion = await obtenerOCrearCuenta("user_a", null, almacen);
    await obtenerOCrearCuenta("user_b", anfitrion.codigo, almacen);

    // Registrarse no basta: el premio llega con la primera revisión.
    expect((await almacen.porUsuario("user_a"))?.creditos).toBe(CREDITOS_INICIALES);

    expect(await cobrarRevision("user_b", almacen)).toBe(true);
    expect((await cerrarRevision("user_b", almacen)).premioEntregado).toBe(true);
    expect((await almacen.porUsuario("user_a"))?.creditos).toBe(
      CREDITOS_INICIALES + CREDITOS_POR_REFERIDO,
    );

    // La segunda revisión del invitado no vuelve a pagar.
    await almacen.devolverCredito("user_b");
    await cobrarRevision("user_b", almacen);
    expect((await cerrarRevision("user_b", almacen)).premioEntregado).toBe(false);
    expect((await almacen.porUsuario("user_a"))?.creditos).toBe(
      CREDITOS_INICIALES + CREDITOS_POR_REFERIDO,
    );
  });

  it("sin saldo no se puede revisar con IA (ahí aparece el muro)", async () => {
    await obtenerOCrearCuenta("user_c", null, almacen);
    expect(await cobrarRevision("user_c", almacen)).toBe(true);
    expect(await cobrarRevision("user_c", almacen)).toBe(false);
    expect((await almacen.porUsuario("user_c"))?.creditos).toBe(0);
  });

  it("cuenta invitados y activados para el panel de quien comparte", async () => {
    const a = await obtenerOCrearCuenta("user_d", null, almacen);
    await obtenerOCrearCuenta("user_e", a.codigo, almacen);
    await obtenerOCrearCuenta("user_f", a.codigo, almacen);
    await cobrarRevision("user_e", almacen);
    await cerrarRevision("user_e", almacen);
    expect(await almacen.contarInvitados("user_d")).toEqual({ total: 2, activados: 1 });
  });
});

describe("Métrica del loop", () => {
  it("es referidos activados ÷ usuarios activos en la ventana", async () => {
    const a = await obtenerOCrearCuenta("user_g", null, almacen);
    await obtenerOCrearCuenta("user_h", a.codigo, almacen);
    await obtenerOCrearCuenta("user_i", a.codigo, almacen);

    // Tres usuarios activos; de ellos, dos invitados completan su primera revisión.
    for (const u of ["user_g", "user_h", "user_i"]) {
      await cobrarRevision(u, almacen);
      await cerrarRevision(u, almacen);
    }
    const m = await almacen.metricas(7);
    expect(m.usuariosActivos).toBe(3);
    expect(m.referidosActivados).toBe(2);
    expect(m.invitacionesAceptadas).toBe(2);
    expect(m.referidosActivados / m.usuariosActivos).toBeCloseTo(0.67, 2);
  });

  it("no cuenta lo que quedó fuera de la ventana de días", async () => {
    const ruta = path.join(carpeta, "referidos.json");
    const a = await obtenerOCrearCuenta("user_j", null, almacen);
    await obtenerOCrearCuenta("user_k", a.codigo, almacen);
    await cobrarRevision("user_k", almacen);
    await cerrarRevision("user_k", almacen);
    expect((await almacen.metricas(7)).referidosActivados).toBe(1);

    // Se envejece lo guardado 10 días: la ventana de 7 ya no debe verlo.
    const { readFileSync, writeFileSync } = await import("node:fs");
    const hace10Dias = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const datos = JSON.parse(readFileSync(ruta, "utf8")) as {
      cuentas: Record<string, { creadoEn: string; primeraRevisionEn: string | null }>;
      revisiones: { creadoEn: string }[];
    };
    for (const cuenta of Object.values(datos.cuentas)) {
      cuenta.creadoEn = hace10Dias;
      if (cuenta.primeraRevisionEn) cuenta.primeraRevisionEn = hace10Dias;
    }
    for (const r of datos.revisiones) r.creadoEn = hace10Dias;
    writeFileSync(ruta, JSON.stringify(datos), "utf8");

    const fuera = await almacen.metricas(7);
    expect(fuera.referidosActivados).toBe(0);
    expect(fuera.usuariosActivos).toBe(0);
    expect(fuera.invitacionesAceptadas).toBe(0);
  });
});
