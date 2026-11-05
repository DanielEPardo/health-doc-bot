/** ¿Este usuario puede ver las métricas del loop? ADMIN_USER_IDS = lista separada por comas. */
export function esAdministrador(userId: string): boolean {
  const lista = (process.env["ADMIN_USER_IDS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Sin lista configurada, las métricas solo se ven fuera de producción (desarrollo local).
  if (lista.length === 0) return process.env["NODE_ENV"] !== "production";
  return lista.includes(userId);
}
