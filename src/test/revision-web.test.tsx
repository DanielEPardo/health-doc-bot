import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { RevisionWeb } from "@/components/revision-web";
import { crearPDF } from "./pdf-ayuda";

describe("Revisión en la web", () => {
  it("revisar lleva a la página del resultado y se puede volver al texto", () => {
    render(<RevisionWeb />);
    const caja = screen.getByLabelText("Texto de tu tutela") as HTMLTextAreaElement;
    fireEvent.change(caja, {
      target: {
        value: readFileSync(
          path.join(process.cwd(), "src/test/fixtures/tutela-incompleta.txt"),
          "utf8",
        ),
      },
    });
    expect(screen.getByRole("heading", { level: 1, name: /Tu tutela/ })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /revisar ahora/i }));
    // El texto queda en su página (oculta) y el resultado en otra.
    expect(caja).not.toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: /Resultado/ })).toBeVisible();
    const pasos = screen.getByRole("navigation", { name: "Pasos de la revisión" });
    expect(within(pasos).getByRole("button", { name: /Resultado/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    fireEvent.click(within(pasos).getByRole("button", { name: /Tu tutela/ }));
    expect(caja).toBeVisible();
    expect(caja.value).toContain("Señor");
    expect(screen.getByRole("button", { name: /Ver el último resultado/ })).toBeInTheDocument();
  });

  it("si el texto no es una tutela, avisa en la página del texto sin ir al resultado", () => {
    render(<RevisionWeb />);
    const caja = screen.getByLabelText("Texto de tu tutela");
    fireEvent.change(caja, {
      target: {
        value:
          "Señor rector, solicito respetuosamente que se revise la nota de mi examen de matemáticas porque considero que tengo derecho a una segunda calificación. El profesor no explicó los temas y la cita que pedí con coordinación nunca me la dieron. Le pido que ordene repetir la evaluación. También pido que me entreguen las notas del semestre pasado.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /revisar ahora/i }));
    expect(screen.getByRole("heading", { name: /no parece una tutela de salud/ })).toBeVisible();
    expect(caja).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Revisarla de todos modos/ }));
    expect(screen.getByRole("heading", { level: 1, name: /Resultado/ })).toBeVisible();
  });

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
    fireEvent.change(screen.getByLabelText("Texto de tu tutela"), {
      target: { value: leer("tutela-completa.txt") },
    });
    fireEvent.click(screen.getByRole("button", { name: /revisar ahora/i }));
    // Página del resultado → página (opcional) de los documentos.
    fireEvent.click(
      screen.getByRole("button", { name: /Responder preguntas sobre mis documentos/ }),
    );
    expect(screen.getByRole("heading", { level: 1, name: "Tus documentos" })).toBeVisible();
    const orden = screen.getByRole("group", { name: /orden o fórmula del médico/ });
    fireEvent.click(within(orden).getByLabelText("Sí"));
    fireEvent.change(screen.getByLabelText(/¿Qué te ordenó\?/), {
      target: { value: "resonancia de columna" },
    });
    fireEvent.click(screen.getByLabelText(/Me lo negó de palabra/));
    fireEvent.click(screen.getByRole("button", { name: /Actualizar la revisión/ }));
    expect(screen.getByRole("heading", { level: 1, name: /Resultado/ })).toBeInTheDocument();
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

describe("Cuestionario de documentos — respuestas", () => {
  it("las preguntas sin responder no vienen marcadas y elegir «No sé» sí cuenta como respuesta", () => {
    render(<RevisionWeb />);
    fireEvent.change(screen.getByLabelText("Texto de tu tutela"), {
      target: {
        value: readFileSync(
          path.join(process.cwd(), "src/test/fixtures/tutela-incompleta.txt"),
          "utf8",
        ),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /revisar ahora/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Responder preguntas sobre mis documentos/ }),
    );
    const orden = screen.getByRole("group", { name: /orden o fórmula del médico/ });
    for (const opcion of within(orden).getAllByRole("radio")) expect(opcion).not.toBeChecked();
    fireEvent.click(within(orden).getByLabelText("No sé"));
    expect(within(orden).getByLabelText("No sé")).toBeChecked();
    const eps = screen.getByRole("group", { name: /Qué hizo la EPS/ });
    for (const opcion of within(eps).getAllByRole("radio")) expect(opcion).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /Actualizar la revisión/ }));
    expect(screen.getByText("Tu orden médica")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Documentos para adjuntar/ })).toBeInTheDocument();
  });
});

describe("Redacción sugerida (panel al lado del texto)", () => {
  it("después de revisar propone las partes que faltan y se pueden agregar con un clic", () => {
    render(<RevisionWeb />);
    const caja = screen.getByLabelText("Texto de tu tutela") as HTMLTextAreaElement;
    expect(screen.getByRole("complementary", { name: "Redacción sugerida" })).toBeInTheDocument();
    fireEvent.change(caja, {
      target: {
        value: readFileSync(
          path.join(process.cwd(), "src/test/fixtures/tutela-incompleta.txt"),
          "utf8",
        ),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /revisar ahora/i }));
    // Del resultado se vuelve a la página del texto, donde están las partes propuestas.
    fireEvent.click(screen.getByRole("button", { name: /Corregir mi texto/ }));
    const panel = screen.getByRole("complementary", { name: "Redacción sugerida" });
    const tarjeta = within(panel).getByText("Juramento").closest("li")!;
    fireEvent.click(within(tarjeta).getByRole("button", { name: /Agregar al final/ }));
    expect(caja.value).toMatch(/\n\nJURAMENTO\nBajo la gravedad del juramento/);
    expect(within(tarjeta).getByRole("button", { name: /Agregada/ })).toBeDisabled();
  });
});

describe("Redacción sugerida — ortografía mientras se escribe", () => {
  it("marca errores frecuentes sin IA y los corrige con un clic", () => {
    render(<RevisionWeb />);
    const caja = screen.getByLabelText("Texto de tu tutela") as HTMLTextAreaElement;
    fireEvent.change(caja, {
      target: { value: "Señor juez, despues de la cita la eps no respondio." },
    });
    const panel = screen.getByRole("complementary", { name: "Redacción sugerida" });
    expect(within(panel).getByText("despues")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: /Aplicar todas/ }));
    expect(caja.value).toBe("Señor juez, después de la cita la EPS no respondió.");
  });
});
