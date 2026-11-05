import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompartirReferido, SaldoRevisiones } from "@/components/compartir-referido";
import { mensajeInvitacion, type EstadoCuenta } from "@/lib/referidos/tipos";

/* Panel "comparte y gana revisiones": es el paso 1 del growth loop. */

const estado = (p: Partial<EstadoCuenta> = {}): EstadoCuenta => ({
  codigo: "ABCDEFG",
  creditos: 0,
  invitados: 0,
  invitadosActivados: 0,
  ...p,
});

describe("Panel de invitación", () => {
  it("arma un enlace de WhatsApp con el código y sin ningún dato del caso", () => {
    render(<CompartirReferido estado={estado()} sinSaldo />);
    const enlace = screen
      .getByRole("link", { name: /compartir por whatsapp/i })
      .getAttribute("href");
    expect(enlace).toContain("wa.me");
    const texto = decodeURIComponent(new URL(enlace ?? "").searchParams.get("text") ?? "");
    expect(texto).toContain("/r/ABCDEFG");
    // El mensaje es fijo: no puede filtrar nada de la tutela de quien comparte.
    expect(texto).toBe(mensajeInvitacion(`${window.location.origin}/r/ABCDEFG`));
    expect(texto).not.toMatch(/tutela de salud de|cédula|diagnóstico/i);
  });

  it("cambia el encabezado cuando la persona se queda sin saldo (el muro del loop)", () => {
    const { rerender } = render(
      <CompartirReferido estado={estado({ creditos: 2 })} sinSaldo={false} />,
    );
    expect(screen.getByRole("heading").textContent).toMatch(/Comparte y gana/i);
    rerender(<CompartirReferido estado={estado()} sinSaldo />);
    expect(screen.getByRole("heading").textContent).toMatch(/sin revisiones con IA/i);
  });

  it("muestra cuánta gente trajo y cuántas revisiones ganó", () => {
    render(
      <CompartirReferido
        estado={estado({ invitados: 3, invitadosActivados: 2 })}
        sinSaldo={false}
      />,
    );
    const estadoTexto = screen.getByText(/entraron por tu enlace/i).textContent ?? "";
    expect(estadoTexto).toContain("3 personas entraron");
    expect(estadoTexto).toContain("2 completaron");
    expect(estadoTexto).toContain("ganaste 4 revisiones");
  });

  it("sin invitados lo dice en vez de mostrar ceros", () => {
    render(<CompartirReferido estado={estado()} sinSaldo />);
    expect(screen.getByText(/todavía nadie ha entrado/i)).toBeInTheDocument();
  });
});

describe("Saldo", () => {
  it("usa singular y plural, y aclara que la revisión local sigue gratis", () => {
    const { rerender } = render(<SaldoRevisiones creditos={1} />);
    expect(screen.getByText(/te queda 1 revisión con IA/i)).toBeInTheDocument();
    rerender(<SaldoRevisiones creditos={3} />);
    expect(screen.getByText(/te quedan 3 revisiones con IA/i)).toBeInTheDocument();
    rerender(<SaldoRevisiones creditos={0} />);
    expect(screen.getByText(/gratis e ilimitada/i)).toBeInTheDocument();
  });
});
