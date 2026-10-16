/// <reference lib="webworker" />
/**
 * Web Worker del corrector ortográfico: carga el diccionario de español de Colombia (una sola vez,
 * ~250 KB comprimido) y revisa el texto sin bloquear la página. El texto no sale del navegador.
 * Imports relativos: el bundle del worker no usa los alias de la app.
 */
import {
  crearCorrector,
  revisarConDiccionario,
  type Corrector,
} from "./validador/redaccion/corrector";

let corrector: Promise<Corrector> | null = null;

const leer = async (ruta: string) => {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
  return r.text();
};

self.onmessage = async (e: MessageEvent<{ id: number; texto: string }>) => {
  const { id, texto } = e.data;
  corrector ??= Promise.all([leer("/diccionario/es-co.aff"), leer("/diccionario/es-co.dic")]).then(
    ([aff, dic]) => crearCorrector(aff, dic),
  );
  try {
    const c = await corrector;
    self.postMessage({ id, ok: true, revision: revisarConDiccionario(texto, c) });
  } catch (err) {
    corrector = null;
    self.postMessage({ id, ok: false, error: (err as Error).message });
  }
};
