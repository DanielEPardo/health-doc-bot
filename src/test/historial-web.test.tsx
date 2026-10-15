import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// Simula el servidor: historial disponible y ya autorizado por la persona.
const guardarTutela = vi.fn(
  async ({ data }: { data: { id: string | null; resultado: unknown } }) => ({
    id: data.id ?? "11111111-1111-1111-1111-111111111111",
    titulo: "Tutela contra EPS Sura",
    estado: data.resultado ? "revisada" : "borrador",
    resultado: data.resultado,
    creado: "",
    actualizado: "",
  }),
);
vi.mock("@/lib/historial.functions", () => ({
  getEstadoHistorial: vi.fn(async () => ({ disponible: true, autorizado: true })),
  aceptarAcuerdo: vi.fn(),
  guardarTutela: (a: { data: { id: string | null; resultado: unknown } }) => guardarTutela(a),
  obtenerTutela: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}));

const { RevisionWeb } = await import("@/components/revision-web");
const TUTELA = readFileSync(
  path.join(process.cwd(), "src/test/fixtures/tutela-completa.txt"),
  "utf8",
);

describe("Historial desde la revisión web", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    guardarTutela.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("guarda el borrador al dejar de escribir y luego la revisión, sobre la misma tutela", async () => {
    render(<RevisionWeb />);
    expect(await screen.findByLabelText(/Guardar automáticamente/)).toBeChecked();
    fireEvent.change(screen.getByLabelText("Texto de tu tutela"), { target: { value: TUTELA } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(guardarTutela).toHaveBeenCalledTimes(1);
    expect(guardarTutela.mock.calls[0]?.[0].data).toMatchObject({ id: null, resultado: null });
    expect(await screen.findByText(/Guardada en tu historial/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /revisar ahora/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(guardarTutela).toHaveBeenCalledTimes(2); // la revisión; no hay otro guardado automático
    expect(guardarTutela.mock.calls[1]?.[0].data).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111",
      resultado: { dictamen: "lista_para_presentar" },
    });
  });
});
