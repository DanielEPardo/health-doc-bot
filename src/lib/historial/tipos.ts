/** Tipos del historial de tutelas (seguros para el navegador). */
import type { Dictamen, DocumentosDeclarados } from "@/lib/validador";

/** borrador = sin revisar o editada después de revisar (inconclusa); revisada; presentada ante el juez. */
export type EstadoTutela = "borrador" | "revisada" | "presentada";

export interface ResumenResultado {
  dictamen: Dictamen;
  puntaje: number;
  fecha: string;
  modeloIA: string | null;
}

export interface TutelaGuardada {
  id: string;
  titulo: string;
  estado: EstadoTutela;
  texto: string;
  declarados: DocumentosDeclarados | null;
  resultado: ResumenResultado | null;
  creado: string;
  actualizado: string;
}

export type TutelaEnLista = Omit<TutelaGuardada, "texto" | "declarados">;

/** Máximo de tutelas guardadas por cuenta. */
export const MAX_TUTELAS = 50;
