/** Tipos de la redacción sugerida (seguros para el navegador). */

export interface Correccion {
  original: string;
  corregido: string;
  motivo: string;
  /**
   * ortografia: tildes, letras, mayúsculas, puntuación. redaccion: frase reescrita para que se
   * entienda mejor. formalidad: lenguaje informal u ofensivo, o una frase que no tiene relación
   * con el caso (con `corregido` vacío = quitarla).
   */
  tipo: "ortografia" | "redaccion" | "formalidad";
  /** Si es true, se corrigen todas las apariciones de la palabra (correcciones sin IA). */
  global?: boolean | undefined;
  /** Forma correcta en minúscula (o nombre propio) para corregir cada aparición con su mayúscula. */
  base?: string | undefined;
}

export interface TemaTutela {
  /** ¿El texto es una acción de tutela de salud? */
  esTutelaDeSalud: boolean;
  /** Explicación corta para la persona (vacía si todo está bien). */
  observacion: string;
  /**
   * Solo en la revisión sin IA. Todos menos «otra_tutela» detienen la revisión (no se muestra un
   * puntaje para un texto que no es una tutela); los demás solo avisan.
   */
  tipo?: "sin_sentido" | "otro_tema" | "otra_tutela" | "no_es_tutela" | undefined;
}

/** ¿El texto claramente no es una tutela? (no tiene sentido revisarlo con las reglas) */
export const temaDetieneRevision = (t: TemaTutela | null | undefined) =>
  t?.tipo === "sin_sentido" || t?.tipo === "otro_tema" || t?.tipo === "no_es_tutela";

export interface SeccionIA {
  titulo: string;
  texto: string;
  posicion: "inicio" | "final";
}

export interface RedaccionIA {
  tema: TemaTutela;
  correcciones: Correccion[];
  secciones: SeccionIA[];
  /** Modelo que respondió, p. ej. "gemini-3.6-flash" u "openrouter/free". */
  modelo: string;
}

export interface Pendiente {
  id: string;
  titulo: string;
  recomendacion: string;
}
