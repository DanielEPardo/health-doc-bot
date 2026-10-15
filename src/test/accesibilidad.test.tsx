import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";

// Rutas sin router real: createFileRoute devuelve las opciones y Link es un enlace normal.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opciones: object) => ({ options: opciones }),
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const { Route: RutaDatos } = await import("@/routes/politica-de-datos");
const { Route: RutaTerminos } = await import("@/routes/terminos");
const { RevisionWeb } = await import("@/components/revision-web");

/** Revisa con axe-core (WCAG 2.1 A/AA). El contraste de color no se puede medir en jsdom. */
async function violaciones(contenedor: HTMLElement) {
  const r = await axe.run(contenedor, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const componente = (ruta: unknown) =>
  (ruta as { options: { component: () => ReactNode } }).options.component;

describe("Accesibilidad (axe-core, WCAG 2.1 AA)", () => {
  it.each([
    ["política de datos", RutaDatos],
    ["términos", RutaTerminos],
  ])("la página de %s no tiene violaciones", async (_n, ruta) => {
    const Pagina = componente(ruta);
    const { container } = render(<Pagina />);
    expect(await violaciones(container)).toEqual([]);
  });

  it("la revisión web (con cuestionario abierto) no tiene violaciones", async () => {
    const { container } = render(<RevisionWeb />);
    container.querySelector("details")?.setAttribute("open", "");
    expect(await violaciones(container)).toEqual([]);
  });

  it("toda imagen del sitio tiene texto alternativo", async () => {
    const fuentes = import.meta.glob("/src/**/*.tsx", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    const sinAlt = Object.entries(fuentes)
      .filter(([archivo]) => !archivo.includes("/components/ui/") && !archivo.includes("/test/"))
      .flatMap(([archivo, codigo]) =>
        [...String(codigo).matchAll(/<img\b[^>]*>/g)]
          .filter((m) => !/\balt=/.test(m[0]))
          .map(() => archivo),
      );
    expect(sinAlt).toEqual([]);
  });
});
