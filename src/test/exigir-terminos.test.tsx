import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const aceptarAcuerdo = vi.fn(async (_a: unknown) => ({ ok: true }));
let aceptado = false;
vi.mock("@/lib/historial.functions", () => ({
  getEstadoTerminos: vi.fn(async () => ({ aceptado })),
  aceptarAcuerdo: (a: unknown) => aceptarAcuerdo(a),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const { ExigirTerminos } = await import("@/components/exigir-terminos");

describe("Aceptación de términos", () => {
  it("sin aceptar, pide marcar la casilla (no viene marcada) y registra la aceptación", async () => {
    aceptado = false;
    render(
      <ExigirTerminos>
        <p>contenido privado</p>
      </ExigirTerminos>,
    );
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Antes de continuar");
    const boton = screen.getByRole("button", { name: /Aceptar y continuar/ });
    const casilla = screen.getByRole("checkbox", { name: /Leí y acepto/ });
    expect(casilla).not.toBeChecked();
    expect(boton).toBeDisabled();
    fireEvent.click(casilla);
    fireEvent.click(boton);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(aceptarAcuerdo).toHaveBeenCalledWith(
      expect.objectContaining({ data: { alcance: "terminos" } }),
    );
  });

  it("si ya aceptó la versión vigente, no muestra nada", async () => {
    aceptado = true;
    render(
      <ExigirTerminos>
        <p>contenido privado</p>
      </ExigirTerminos>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("contenido privado")).toBeInTheDocument();
  });
});
