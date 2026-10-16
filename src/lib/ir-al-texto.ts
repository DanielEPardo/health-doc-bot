/**
 * Llevar a la persona al lugar del texto donde está una sugerencia (panel «Redacción sugerida»):
 * se selecciona el fragmento dentro del cuadro de texto y se desplaza para que se vea su contexto.
 */

export interface Rango {
  inicio: number;
  fin: number;
}

const LETRA = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Siguiente aparición de `fragmento` a partir de `desde` (si no hay más, vuelve al inicio).
 * Con `palabra`, solo palabras completas y sin distinguir mayúsculas («despues» encuentra «Despues»).
 */
export function buscarAparicion(
  texto: string,
  fragmento: string,
  desde = 0,
  palabra = false,
): Rango | null {
  if (!fragmento) return null;
  const re = palabra
    ? new RegExp(`(?<![${LETRA}])${escapar(fragmento)}(?![${LETRA}])`, "gi")
    : new RegExp(escapar(fragmento), "g");
  const todas = [...texto.matchAll(re)].map((m) => ({
    inicio: m.index,
    fin: m.index + m[0].length,
  }));
  return todas.find((r) => r.inicio >= desde) ?? todas[0] ?? null;
}

/** Posición vertical (en px, dentro del contenido del textarea) del carácter `indice`. */
function alturaHasta(ta: HTMLTextAreaElement, indice: number): number {
  const estilo = getComputedStyle(ta);
  const espejo = document.createElement("div");
  for (const p of [
    "boxSizing",
    "width",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
  ] as const)
    espejo.style[p] = estilo[p];
  Object.assign(espejo.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    borderStyle: "solid",
  });
  espejo.textContent = ta.value.slice(0, indice);
  const marca = document.createElement("span");
  marca.textContent = "​";
  espejo.append(marca);
  document.body.append(espejo);
  const y = marca.offsetTop;
  espejo.remove();
  return y;
}

/** Selecciona el rango en el cuadro de texto y lo desplaza (y la página) para que se vea. */
export function mostrarEnTextarea(ta: HTMLTextAreaElement, r: Rango): void {
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(r.inicio, r.fin);
  const y = alturaHasta(ta, r.inicio);
  ta.scrollTop = Math.max(0, y - ta.clientHeight / 3);
  // En celular el cuadro queda arriba del panel: se lleva la línea a la vista.
  const caja = ta.getBoundingClientRect();
  const linea = caja.top + (y - ta.scrollTop);
  if (linea < 80 || linea > window.innerHeight - 80)
    window.scrollBy({ top: linea - window.innerHeight / 3, behavior: "smooth" });
}
