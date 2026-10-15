import type { Regla } from "../types";
import { reglasFormales } from "./formales";
import { reglasLegitimacion, reglasProcedencia } from "./procedencia";
import { reglasCompetencia, reglasPruebas, reglasSalud } from "./salud";
import { reglasDocumentos } from "./documentos";

/** Todas las reglas, en el orden en que se reportan. */
export const REGLAS: readonly Regla[] = [
  ...reglasFormales,
  ...reglasLegitimacion,
  ...reglasProcedencia,
  ...reglasSalud,
  ...reglasPruebas,
  ...reglasCompetencia,
];

/** Reglas del cuestionario de documentos: solo se evalúan si la persona respondió (ctx.documentos). */
export const REGLAS_DOCUMENTOS: readonly Regla[] = reglasDocumentos;
