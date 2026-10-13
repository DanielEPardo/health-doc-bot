import type { Regla } from "../types";
import { reglasFormales } from "./formales";
import { reglasLegitimacion, reglasProcedencia } from "./procedencia";
import { reglasCompetencia, reglasPruebas, reglasSalud } from "./salud";

/** Todas las reglas, en el orden en que se reportan. */
export const REGLAS: readonly Regla[] = [
  ...reglasFormales,
  ...reglasLegitimacion,
  ...reglasProcedencia,
  ...reglasSalud,
  ...reglasPruebas,
  ...reglasCompetencia,
];
