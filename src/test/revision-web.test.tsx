import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RevisionWeb } from "@/components/revision-web";

describe("Revisión en la web", () => {
  it("pide un texto mínimo antes de revisar", () => {
    render(<RevisionWeb />);
    fireEvent.click(screen.getByRole("button", { name: /revisar ahora/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Aún no has pegado/);
  });
  it("muestra el dictamen y lo que falta de una tutela incompleta", () => {
    render(<RevisionWeb />);
    const texto = readFileSync(
      path.join(process.cwd(), "src/test/fixtures/tutela-incompleta.txt"),
      "utf8",
    );
    fireEvent.change(screen.getByLabelText("Texto de tu tutela"), { target: { value: texto } });
    fireEvent.click(screen.getByRole("button", { name: /revisar ahora/i }));
    expect(
      screen.getByRole("heading", { name: /le faltan elementos esenciales/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lo que debes corregir primero")).toBeInTheDocument();
    expect(
      screen.getByText("Juramento de que no presentaste otra tutela igual"),
    ).toBeInTheDocument();
  });

  it("H1: avisa cuando el texto cambió después de revisar; H7: Ctrl+Enter revisa", () => {
    render(<RevisionWeb />);
    const caja = screen.getByLabelText("Texto de tu tutela");
    const texto = readFileSync(
      path.join(process.cwd(), "src/test/fixtures/tutela-completa.txt"),
      "utf8",
    );
    fireEvent.change(caja, { target: { value: texto } });
    fireEvent.keyDown(caja, { key: "Enter", ctrlKey: true });
    expect(
      screen.getByRole("heading", { name: /tiene los elementos principales/i }),
    ).toBeInTheDocument();
    fireEvent.change(caja, { target: { value: texto + " cambio" } });
    expect(screen.getByText(/Cambiaste el texto/)).toBeInTheDocument();
  });
  it("H3: se puede deshacer el borrado", () => {
    render(<RevisionWeb />);
    const caja = screen.getByLabelText("Texto de tu tutela") as HTMLTextAreaElement;
    fireEvent.change(caja, { target: { value: "borrador de mi tutela" } });
    fireEvent.click(screen.getByRole("button", { name: /borrar texto/i }));
    expect(caja.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /deshacer borrado/i }));
    expect(caja.value).toBe("borrador de mi tutela");
  });
});
