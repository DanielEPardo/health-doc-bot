import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { RevisionWeb } from "@/components/revision-web";
import { crearPDF } from "./pdf-ayuda";

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

describe("Revisión en la web — documentos y PDF", () => {
  const leer = (n: string) =>
    readFileSync(path.join(process.cwd(), "src/test/fixtures", n), "utf8");

  it("con las respuestas sobre documentos agrega las reglas D## y la lista de anexos", () => {
    render(<RevisionWeb />);
    fireEvent.click(screen.getByText(/Cuéntanos sobre tus documentos/));
    const orden = screen.getByRole("group", { name: /orden o fórmula del médico/ });
    fireEvent.click(within(orden).getByLabelText("Sí"));
    fireEvent.change(screen.getByLabelText(/¿Qué te ordenó\?/), {
      target: { value: "resonancia de columna" },
    });
    fireEvent.click(screen.getByLabelText(/Me lo negó de palabra/));
    fireEvent.change(screen.getByLabelText("Texto de tu tutela"), {
      target: { value: leer("tutela-completa.txt") },
    });
    fireEvent.click(screen.getByRole("button", { name: /revisar ahora/i }));
    expect(screen.getByText("¿Pides lo mismo que ordenó el médico?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Documentos para adjuntar/ })).toBeInTheDocument();
    expect(screen.getByText(/Negación por escrito o radicado/)).toBeInTheDocument();
  });

  it("sube la tutela en PDF y llena el texto (leído en el navegador)", async () => {
    const { container } = render(<RevisionWeb />);
    const pdf = crearPDF(leer("tutela-completa.txt").split("\n"));
    const archivo = new File([pdf.slice().buffer], "tutela.pdf", { type: "application/pdf" });
    const entrada = container.querySelector(
      'input[type="file"][accept*="pdf"]',
    ) as HTMLInputElement;
    fireEvent.change(entrada, { target: { files: [archivo] } });
    expect(await screen.findByText(/Leímos tu PDF \(1 página\)/)).toBeInTheDocument();
    expect((screen.getByLabelText("Texto de tu tutela") as HTMLTextAreaElement).value).toContain(
      "EPS Sura",
    );
  });

  it("rechaza archivos que no son PDF con un mensaje útil", async () => {
    const { container } = render(<RevisionWeb />);
    const entrada = container.querySelector(
      'input[type="file"][accept*="pdf"]',
    ) as HTMLInputElement;
    fireEvent.change(entrada, {
      target: { files: [new File(["hola"], "tutela.docx", { type: "application/msword" })] },
    });
    expect(await screen.findByText(/no es un PDF/)).toBeInTheDocument();
  });
});
