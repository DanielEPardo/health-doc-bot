import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const aceptarAcuerdo = vi.fn(async (_a: unknown) => ({ ok: true }));
let aceptado = false;
let proveedorIA: "gemini" | null = null;
vi.mock("@/lib/historial.functions", () => ({
  getEstadoTerminos: vi.fn(async () => ({ aceptado })),
  getEstadoAutorizacionIA: vi.fn(async () => ({
    proveedor: proveedorIA,
    autorizada: false,
  })),
  aceptarAcuerdo: (a: unknown) => aceptarAcuerdo(a),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const { ExigirTerminos } = await import("@/components/exigir-terminos");

describe("Aceptación de términos", () => {
  it("sin aceptar, pide marcar la casilla (no viene marcada) y registra la aceptación", async () => {
    aceptado = false;
    proveedorIA = null;
    aceptarAcuerdo.mockClear();
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

describe("Autorización de IA en la ventana de términos", () => {
  it("es opcional, viene sin marcar y, si se marca, queda registrada una sola vez", async () => {
    aceptado = false;
    proveedorIA = "gemini";
    aceptarAcuerdo.mockClear();
    render(
      <ExigirTerminos>
        <p>contenido privado</p>
      </ExigirTerminos>,
    );
    const ia = await screen.findByRole("checkbox", { name: /autorizo el uso de inteligencia/i });
    expect(ia).not.toBeChecked();
    expect(
      screen.getByText(/sin tu nombre, cédula, teléfono, correo ni dirección/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Leí y acepto/ }));
    fireEvent.click(ia);
    fireEvent.click(screen.getByRole("button", { name: /Aceptar y continuar/ }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(aceptarAcuerdo.mock.calls.map((c) => (c[0] as { data: unknown }).data)).toEqual([
      { alcance: "terminos" },
      { alcance: "ia" },
    ]);
  });

  it("si no la marca, solo se registran los términos", async () => {
    aceptado = false;
    proveedorIA = "gemini";
    aceptarAcuerdo.mockClear();
    render(
      <ExigirTerminos>
        <p>contenido privado</p>
      </ExigirTerminos>,
    );
    await screen.findByRole("checkbox", { name: /autorizo el uso de inteligencia/i });
    fireEvent.click(screen.getByRole("checkbox", { name: /Leí y acepto/ }));
    fireEvent.click(screen.getByRole("button", { name: /Aceptar y continuar/ }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(aceptarAcuerdo.mock.calls.map((c) => (c[0] as { data: unknown }).data)).toEqual([
      { alcance: "terminos" },
    ]);
  });
});
