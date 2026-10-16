import { useEffect, useState } from "react";
import type { RevisionDiccionario } from "@/lib/validador/redaccion/corrector";

/*
 * Revisión ortográfica con diccionario mientras la persona escribe (en un Web Worker, para no
 * trabar la página). Sin soporte de workers (pruebas, navegadores muy viejos) devuelve null y el
 * panel usa solo la lista de errores frecuentes.
 */

let worker: Worker | null = null;
let siguienteId = 0;
const pendientes = new Map<number, (r: RevisionDiccionario | null) => void>();

function obtenerWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("../lib/ortografia.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    return null;
  }
  worker.onmessage = (
    e: MessageEvent<{ id: number; ok: boolean; revision?: RevisionDiccionario }>,
  ) => {
    pendientes.get(e.data.id)?.(e.data.ok ? (e.data.revision ?? null) : null);
    pendientes.delete(e.data.id);
  };
  return worker;
}

function revisar(texto: string): Promise<RevisionDiccionario | null> {
  const w = obtenerWorker();
  if (!w) return Promise.resolve(null);
  const id = ++siguienteId;
  return new Promise((resolver) => {
    pendientes.set(id, resolver);
    w.postMessage({ id, texto });
  });
}

/**
 * Resultado del diccionario para `texto`. `cargando` es true mientras se revisa la primera versión
 * (la primera vez también se descarga el diccionario).
 */
export function useOrtografiaDiccionario(texto: string): {
  revision: RevisionDiccionario | null;
  cargando: boolean;
} {
  const [resultado, setResultado] = useState<{
    texto: string;
    revision: RevisionDiccionario | null;
  } | null>(null);
  const [soportado, setSoportado] = useState(false);
  useEffect(() => setSoportado(typeof Worker !== "undefined"), []);
  useEffect(() => {
    if (!texto.trim()) return;
    let vigente = true;
    const t = setTimeout(() => {
      void revisar(texto).then((revision) => {
        if (vigente) setResultado({ texto, revision });
      });
    }, 500);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto]);
  if (!texto.trim()) return { revision: null, cargando: false };
  // Mientras se revisa el texto nuevo se mantiene el resultado anterior (evita parpadeos).
  return { revision: resultado?.revision ?? null, cargando: soportado && !resultado };
}
