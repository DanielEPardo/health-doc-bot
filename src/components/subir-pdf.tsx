import { useRef, useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcuerdoDatos } from "@/components/acuerdo-datos";
import type { ProveedorDocumentos } from "@/components/cuestionario-documentos";
import { ACUERDO_DOCUMENTOS } from "@/lib/acuerdos";
import { aceptarAcuerdo } from "@/lib/historial.functions";
import { transcribirTutela } from "@/lib/documentos.functions";
import { archivoABase64, archivoABytes, cabecerasDeSesion, motivoDe } from "@/lib/navegador";
import { MAX_BYTES_PDF } from "@/lib/pdf";

/**
 * Subir la tutela en PDF. El texto se extrae EN EL NAVEGADOR (el PDF no sale del dispositivo).
 * Si el PDF está escaneado (es una imagen), se ofrece leerlo con IA, con el acuerdo de documentos.
 */
export function SubirPDF({
  onTexto,
  proveedorDocumentos,
  acuerdoDocumentos,
  onAcuerdoDocumentos,
}: {
  onTexto: (texto: string, aviso: string) => void;
  proveedorDocumentos: ProveedorDocumentos | null;
  acuerdoDocumentos: boolean;
  onAcuerdoDocumentos: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState("");
  const [escaneado, setEscaneado] = useState<File | null>(null);
  const [transcribiendo, setTranscribiendo] = useState(false);

  const abrir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError("");
    setEscaneado(null);
    if (archivo.type !== "application/pdf" && !/\.pdf$/i.test(archivo.name)) {
      setError(
        "Ese archivo no es un PDF. Si tu tutela está en Word, ábrela, copia todo el texto y pégalo abajo.",
      );
      return;
    }
    if (archivo.size > MAX_BYTES_PDF) {
      setError("El PDF pesa más de 10 MB. Sube solo el escrito de la tutela, sin anexos.");
      return;
    }
    setLeyendo(true);
    try {
      const { textoDePDF } = await import("@/lib/pdf");
      const r = await textoDePDF(await archivoABytes(archivo));
      if (r.escaneado) setEscaneado(archivo);
      else
        onTexto(
          r.texto,
          `Leímos tu PDF (${r.paginas} ${r.paginas === 1 ? "página" : "páginas"}). Revisa que el texto esté completo antes de revisarla.`,
        );
    } catch (err) {
      setError(`${motivoDe(err)}.`);
    } finally {
      setLeyendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const transcribir = async () => {
    if (!escaneado) return;
    setTranscribiendo(true);
    setError("");
    try {
      const r = await transcribirTutela({
        data: {
          archivo: {
            nombre: escaneado.name,
            tipo: "application/pdf",
            base64: await archivoABase64(escaneado),
          },
        },
        headers: await cabecerasDeSesion(),
      });
      setEscaneado(null);
      onTexto(
        r.texto,
        "Leímos tu PDF escaneado con IA. Revisa el texto: puede tener errores de lectura.",
      );
    } catch (err) {
      setError(`No pudimos leer el PDF escaneado (${motivoDe(err)}).`);
    } finally {
      setTranscribiendo(false);
    }
  };

  return (
    <div className="subir-pdf">
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void abrir(e.target.files?.[0])}
      />
      <Button
        variant="outline"
        onClick={() => entrada.current?.click()}
        disabled={leyendo || transcribiendo}
      >
        {leyendo ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <FileText aria-hidden="true" />
        )}{" "}
        {leyendo ? "Leyendo el PDF…" : "Subir mi tutela en PDF"}
      </Button>
      <span className="subir-pdf-nota">
        El PDF se lee en tu navegador: no se envía a ningún lado.
      </span>
      {error && (
        <p role="alert" className="revision-web-aviso">
          {error}
        </p>
      )}
      {escaneado && (
        <div className="subir-pdf-escaneado" role="status">
          <p>
            <strong>Tu PDF parece escaneado</strong> (es una foto del documento), así que no tiene
            texto que podamos leer en tu navegador.
            {proveedorDocumentos
              ? " Podemos leerlo con IA, o puedes pegar el texto abajo."
              : " Pega el texto abajo o, si la tienes en Word, abre el archivo y copia todo."}
          </p>
          {proveedorDocumentos &&
            (acuerdoDocumentos ? (
              <Button size="sm" onClick={() => void transcribir()} disabled={transcribiendo}>
                {transcribiendo ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Sparkles aria-hidden="true" />
                )}{" "}
                {transcribiendo ? "Leyendo con IA… (hasta 1 minuto)" : "Leer el PDF con IA"}
              </Button>
            ) : (
              <AcuerdoDatos
                titulo={ACUERDO_DOCUMENTOS.titulo}
                puntos={ACUERDO_DOCUMENTOS.puntos(proveedorDocumentos)}
                textoBoton="Autorizo y quiero que lean mi PDF"
                onAceptar={async () => {
                  await aceptarAcuerdo({
                    data: { alcance: "documentos" },
                    headers: await cabecerasDeSesion(),
                  });
                  onAcuerdoDocumentos();
                }}
                onCancelar={() => setEscaneado(null)}
              />
            ))}
        </div>
      )}
    </div>
  );
}
