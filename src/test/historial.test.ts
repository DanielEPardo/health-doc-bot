import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AlmacenHistorialMemoria, Historial, tituloDe } from "@/lib/historial/almacen.server";
import { claveEfimera, cifrar, descifrar, importarClave } from "@/lib/historial/cifrado.server";

const TUTELA = readFileSync(
  path.join(process.cwd(), "src/test/fixtures/tutela-completa.txt"),
  "utf8",
);
const RESULTADO = {
  dictamen: "lista_para_presentar" as const,
  puntaje: 92,
  fecha: "2026-10-11T10:00:00.000Z",
  modeloIA: null,
};

async function nuevo() {
  const almacen = new AlmacenHistorialMemoria();
  return { almacen, h: new Historial(almacen, await claveEfimera()) };
}

describe("Historial — cifrado", () => {
  it("cifra con AES-GCM y no se puede abrir con otro usuario como contexto", async () => {
    const clave = await claveEfimera();
    const c = await cifrar(clave, "texto secreto", "user_a");
    expect(c).not.toContain("secreto");
    expect(await descifrar(clave, c, "user_a")).toBe("texto secreto");
    await expect(descifrar(clave, c, "user_b")).rejects.toThrow();
  });
  it("exige una clave de 32 bytes", async () => {
    await expect(importarClave(btoa("corta"))).rejects.toThrow(/32 bytes/);
    await expect(importarClave(Buffer.alloc(32, 1).toString("base64"))).resolves.toBeTruthy();
  });
});

describe("Historial — tutelas por cuenta", () => {
  it("guarda un borrador, lo revisa y queda cifrado en la base", async () => {
    const { almacen, h } = await nuevo();
    const borrador = await h.guardar("user_a", { texto: TUTELA.slice(0, 500), declarados: null });
    expect(borrador.estado).toBe("borrador");
    expect(borrador.titulo).toMatch(/^Tutela contra EPS Sura/);

    const revisada = await h.guardar("user_a", {
      id: borrador.id,
      texto: TUTELA,
      declarados: null,
      resultado: RESULTADO,
    });
    expect(revisada.id).toBe(borrador.id);
    expect(revisada.estado).toBe("revisada");
    expect(revisada.resultado?.puntaje).toBe(92);

    const crudo = JSON.stringify([...almacen.filas.values()]);
    for (const dato of ["43.555.123", "María", "artrosis", "EPS Sura"])
      expect(crudo).not.toContain(dato);
    expect((await h.obtener("user_a", borrador.id))?.texto).toBe(TUTELA);
  });

  it("separa borradores y revisadas, y una tutela editada vuelve a quedar en progreso", async () => {
    const { h } = await nuevo();
    const a = await h.guardar("u", { texto: TUTELA, declarados: null, resultado: RESULTADO });
    await h.guardar("u", { texto: "Señor juez, otra tutela a medias", declarados: null });
    const lista = await h.listar("u");
    expect(lista.map((t) => t.estado).sort()).toEqual(["borrador", "revisada"]);
    expect(JSON.stringify(lista)).not.toContain("Señor juez"); // la lista no lleva el texto
    await h.guardar("u", { id: a.id, texto: `${TUTELA}\nnuevo hecho`, declarados: null });
    expect((await h.obtener("u", a.id))?.estado).toBe("borrador");
  });

  it("una tutela presentada sigue presentada aunque se edite", async () => {
    const { h } = await nuevo();
    const a = await h.guardar("u", { texto: TUTELA, declarados: null, resultado: RESULTADO });
    await h.marcarEstado("u", a.id, "presentada");
    await h.guardar("u", { id: a.id, texto: TUTELA, declarados: null });
    expect((await h.obtener("u", a.id))?.estado).toBe("presentada");
  });

  it("nadie ve ni modifica las tutelas de otra cuenta", async () => {
    const { almacen, h } = await nuevo();
    const a = await h.guardar("user_a", { texto: TUTELA, declarados: null });
    expect(await h.obtener("user_b", a.id)).toBeNull();
    expect(await h.listar("user_b")).toEqual([]);
    await expect(h.guardar("user_b", { id: a.id, texto: "x", declarados: null })).rejects.toThrow(
      /ya no existe/,
    );
    await almacen.eliminar("user_b", a.id);
    expect(await h.obtener("user_a", a.id)).not.toBeNull();
    await almacen.eliminarTodo("user_a");
    expect(await h.listar("user_a")).toEqual([]);
  });

  it("título por defecto cuando no se reconoce la entidad", () => {
    expect(tituloDe("texto sin entidad", new Date("2026-10-11T12:00:00"))).toMatch(
      /^Tutela sin título/,
    );
  });
});

describe("Historial — autorizaciones", () => {
  it("retirar la autorización la deja sin efecto y se conserva la prueba", async () => {
    const almacen = new AlmacenHistorialMemoria();
    await almacen.registrarConsentimiento("u", "historial", "v1", "texto");
    expect(await almacen.tieneConsentimiento("u", "historial", "v1")).toBe(true);
    expect(await almacen.listarConsentimientos("u")).toHaveLength(1);
    await almacen.revocarConsentimiento("u", "historial");
    expect(await almacen.tieneConsentimiento("u", "historial", "v1")).toBe(false);
    expect(await almacen.listarConsentimientos("u")).toEqual([]);
    expect(almacen.consentimientos[0]?.revocado_en).toBeTruthy();
  });
});
