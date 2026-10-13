import type { Dictamen, Estado, ResultadoRegla, ResultadoValidacion } from "../types";

/** Límite de caracteres de un mensaje de texto de WhatsApp Cloud API. */
export const LIMITE_WHATSAPP = 4096;

const TITULO: Record<Dictamen, string> = {
  lista_para_presentar: "✅ Tu tutela tiene los elementos principales",
  requiere_ajustes: "🟡 Tu tutela necesita algunos ajustes",
  incompleta: "🔴 A tu tutela le faltan elementos esenciales",
};

const ICONO: Record<Estado, string> = {
  cumple: "✅",
  debil: "🟡",
  no_cumple: "❌",
  revisar: "🔎",
  no_aplica: "➖",
};

const ORDEN_SEV = { critico: 0, importante: 1, recomendacion: 2 } as const;

function linea(r: ResultadoRegla, conFuente: boolean): string {
  const fuente =
    conFuente && r.fuentes[0]
      ? `\n   _Fundamento: ${r.fuentes
          .map((f) => f.cita)
          .slice(0, 2)
          .join("; ")}_`
      : "";
  return `${ICONO[r.estado]} *${r.titulo}*\n   ${r.recomendacion || r.hallazgo}${fuente}`;
}

/**
 * Convierte el resultado en uno o varios mensajes de WhatsApp (formato *negrita* / _cursiva_),
 * cada uno de máximo 4096 caracteres.
 */
export function formatearWhatsApp(
  res: ResultadoValidacion,
  opciones: { incluirFuentes?: boolean } = {},
): string[] {
  const conFuente = opciones.incluirFuentes ?? true;
  const pendientes = res.resultados
    .filter((r) => r.estado === "no_cumple" || r.estado === "debil" || r.estado === "revisar")
    .sort((a, b) => ORDEN_SEV[a.severidad] - ORDEN_SEV[b.severidad]);
  const cumplidos = res.resultados.filter((r) => r.estado === "cumple");
  const notas = cumplidos.filter((r) => r.recomendacion && r.severidad === "recomendacion");

  const bloques: string[] = [];
  bloques.push(
    `*${TITULO[res.dictamen]}*\nPuntaje orientativo: *${res.puntaje}/100*\nCumple ${res.resumen.cumple} · Por mejorar ${res.resumen.debil + res.resumen.revisar} · Falta ${res.resumen.no_cumple}`,
  );

  const criticos = pendientes.filter((r) => r.severidad === "critico");
  const otros = pendientes.filter((r) => r.severidad !== "critico");
  if (criticos.length)
    bloques.push(
      `*Lo que debes corregir primero:*\n\n${criticos.map((r) => linea(r, conFuente)).join("\n\n")}`,
    );
  if (otros.length)
    bloques.push(
      `*Para fortalecer tu tutela:*\n\n${otros.map((r) => linea(r, conFuente)).join("\n\n")}`,
    );
  if (cumplidos.length)
    bloques.push(`*Lo que ya está bien:*\n${cumplidos.map((r) => `✅ ${r.titulo}`).join("\n")}`);
  if (notas.length)
    bloques.push(
      `*Notas útiles para tu caso:*\n\n${notas.map((r) => `💡 ${r.recomendacion}`).join("\n\n")}`,
    );
  bloques.push(`_${res.descargo}_`);

  return empaquetar(bloques, LIMITE_WHATSAPP);
}

/** Agrupa bloques en mensajes sin pasar el límite; parte por líneas un bloque demasiado largo. */
export function empaquetar(bloques: string[], limite: number): string[] {
  const piezas = bloques.flatMap((b) => (b.length <= limite ? [b] : partirPorLineas(b, limite)));
  const mensajes: string[] = [];
  let actual = "";
  for (const p of piezas) {
    const candidato = actual ? `${actual}\n\n${p}` : p;
    if (candidato.length <= limite) actual = candidato;
    else {
      if (actual) mensajes.push(actual);
      actual = p;
    }
  }
  if (actual) mensajes.push(actual);
  return mensajes;
}

function partirPorLineas(texto: string, limite: number): string[] {
  const out: string[] = [];
  let actual = "";
  for (const l of texto.split("\n")) {
    const candidato = actual ? `${actual}\n${l}` : l;
    if (candidato.length <= limite) actual = candidato;
    else {
      if (actual) out.push(actual);
      actual = l.slice(0, limite);
    }
  }
  if (actual) out.push(actual);
  return out;
}

/** Versión en texto plano / Markdown para panel web o correo. */
export function formatearMarkdown(res: ResultadoValidacion): string {
  const filas = res.resultados
    .filter((r) => r.estado !== "no_aplica")
    .map(
      (r) =>
        `| ${r.reglaId} | ${ICONO[r.estado]} ${r.titulo} | ${r.severidad} | ${r.hallazgo} | ${r.recomendacion || "—"} | ${r.fuentes.map((f) => `[${f.cita}](${f.url})`).join("<br>")} |`,
    );
  return [
    `# Revisión de tutela — ${TITULO[res.dictamen]}`,
    `Puntaje orientativo: **${res.puntaje}/100** · Extracción: ${res.origenExtraccion} · Versión ${res.version}`,
    "",
    "| Regla | Resultado | Severidad | Hallazgo | Recomendación | Fundamento |",
    "|---|---|---|---|---|---|",
    ...filas,
    "",
    `> ${res.descargo}`,
  ].join("\n");
}
