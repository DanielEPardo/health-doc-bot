import { useCallback, useEffect, useState } from "react";
import { aceptarAcuerdo, getEstadoAutorizacionIA } from "@/lib/historial.functions";
import { cabecerasDeSesion } from "@/lib/navegador";
import type { ProveedorAviso } from "@/lib/validador/aviso-ia";

export interface EstadoIA {
  /** Proveedor de IA del servidor; null si no hay IA configurada. */
  proveedor: ProveedorAviso | null;
  /** ¿La persona ya autorizó el uso de IA? (una sola vez, registrado en el servidor) */
  autorizada: boolean;
}

/** Se dispara al autorizar la IA (p. ej. desde la ventana de términos) para que la página se entere. */
export const EVENTO_IA_AUTORIZADA = "tutelaganas:ia-autorizada";

/** Registra la autorización de IA en el servidor y avisa al resto de la página. */
export async function autorizarIA(): Promise<void> {
  await aceptarAcuerdo({ data: { alcance: "ia" }, headers: await cabecerasDeSesion() });
  window.dispatchEvent(new Event(EVENTO_IA_AUTORIZADA));
}

/** Estado de la IA para la persona (consulta al servidor; sin sesión, la IA queda apagada). */
export function useAutorizacionIA() {
  const [estado, setEstado] = useState<EstadoIA>({
    proveedor: null,
    autorizada: false,
  });

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const e = await getEstadoAutorizacionIA({ headers: await cabecerasDeSesion() });
        if (vivo) setEstado(e);
      } catch {
        // Sin sesión o sin servidor: la revisión funciona sin IA.
      }
    })();
    const alAutorizar = () => setEstado((e) => ({ ...e, autorizada: true }));
    window.addEventListener(EVENTO_IA_AUTORIZADA, alAutorizar);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO_IA_AUTORIZADA, alAutorizar);
    };
  }, []);

  const autorizar = useCallback(() => autorizarIA(), []);
  return { estado, autorizar };
}
