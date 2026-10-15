import { useCallback, useEffect, useRef, useState } from "react";
import {
  aceptarAcuerdo,
  getEstadoHistorial,
  guardarTutela,
  obtenerTutela,
} from "@/lib/historial.functions";
import type { ResumenResultado, TutelaGuardada } from "@/lib/historial/tipos";
import { cabecerasDeSesion, motivoDe } from "@/lib/navegador";
import type { DocumentosDeclarados } from "@/lib/validador";

type EstadoGuardado = "guardando" | "guardado" | "error" | null;

const firma = (texto: string, declarados: DocumentosDeclarados | null) =>
  JSON.stringify({ texto, declarados });

/**
 * Guardado en el historial de la cuenta. Las escrituras van en cola (una a la vez) para que la
 * primera cree la tutela y las siguientes la actualicen, sin duplicados.
 */
export function useHistorial() {
  const [estado, setEstado] = useState<{ disponible: boolean; autorizado: boolean } | null>(null);
  const [activo, setActivo] = useState(false);
  const [id, setIdEstado] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<EstadoGuardado>(null);
  const [error, setError] = useState("");
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  const ultimo = useRef("");
  const idRef = useRef<string | null>(null);

  const setId = useCallback((nuevo: string | null) => {
    idRef.current = nuevo;
    setIdEstado(nuevo);
  }, []);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const e = await getEstadoHistorial({ headers: await cabecerasDeSesion() });
        if (!vivo) return;
        setEstado(e);
        if (e.autorizado) setActivo(true);
      } catch {
        if (vivo) setEstado({ disponible: false, autorizado: false });
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /** Guarda si hay cambios (o siempre, si trae resultado de una revisión). */
  const guardar = useCallback(
    (texto: string, declarados: DocumentosDeclarados | null, resultado?: ResumenResultado) => {
      const f = firma(texto, declarados);
      if (!resultado && f === ultimo.current) return;
      cola.current = cola.current.then(async () => {
        if (!resultado && f === ultimo.current) return;
        setGuardado("guardando");
        try {
          const r = await guardarTutela({
            data: { id: idRef.current, texto, declarados, resultado: resultado ?? null },
            headers: await cabecerasDeSesion(),
          });
          setId(r.id);
          ultimo.current = f;
          setGuardado("guardado");
          setError("");
        } catch (err) {
          setGuardado("error");
          setError(motivoDe(err));
        }
      });
    },
    [setId],
  );

  const cargar = useCallback(
    async (tutelaId: string): Promise<TutelaGuardada> => {
      const t = await obtenerTutela({ data: { id: tutelaId }, headers: await cabecerasDeSesion() });
      setId(t.id);
      ultimo.current = firma(t.texto, t.declarados);
      setActivo(true);
      return t;
    },
    [setId],
  );

  /** Empieza una tutela nueva: lo siguiente que se guarde crea otra entrada en el historial. */
  const nueva = useCallback(() => {
    setId(null);
    ultimo.current = "";
    setGuardado(null);
  }, [setId]);

  const autorizar = useCallback(async () => {
    await aceptarAcuerdo({ data: { alcance: "historial" }, headers: await cabecerasDeSesion() });
    setEstado({ disponible: true, autorizado: true });
    setActivo(true);
  }, []);

  return {
    estado,
    activo,
    setActivo,
    id,
    setId,
    guardado,
    error,
    guardar,
    cargar,
    nueva,
    autorizar,
  };
}

export type Historial = ReturnType<typeof useHistorial>;
