/** Tipos de la redacción sugerida (seguros para el navegador). */

export interface Correccion {
  original: string;
  corregido: string;
  motivo: string;
  /** ortografia: tildes, letras, mayúsculas, puntuación. redaccion: frase reescrita para que se entienda mejor. */
  tipo: "ortografia" | "redaccion";
  /** Si es true, se corrigen todas las apariciones de la palabra (correcciones sin IA). */
  global?: boolean | undefined;
}

export interface TemaTutela {
  /** ¿El texto es una acción de tutela de salud? */
  esTutelaDeSalud: boolean;
  /** Explicación corta para la persona (vacía si todo está bien). */
  observacion: string;
}

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
