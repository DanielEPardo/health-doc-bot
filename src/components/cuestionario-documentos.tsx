import { useId, useRef, useState, type ReactNode } from "react";
import { FileUp, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcuerdoDatos } from "@/components/acuerdo-datos";
import { ACUERDO_DOCUMENTOS } from "@/lib/acuerdos";
import { aceptarAcuerdo } from "@/lib/historial.functions";
import { leerDocumentos, type DocumentoLeido } from "@/lib/documentos.functions";
import { archivoABase64, cabecerasDeSesion, motivoDe } from "@/lib/navegador";
import {
  ETIQUETA_RESPUESTA_EPS,
  type DocumentosDeclarados,
  type RespuestaEPS,
  type RespuestaSiNo,
} from "@/lib/validador";

const DECLARADOS_VACIOS: DocumentosDeclarados = {
  ordenMedica: "no_se",
  fechaOrden: null,
  servicioOrdenado: null,
  respuestaEPS: "no_se",
  fechaRespuestaEPS: null,
  soportesClinicos: "no_se",
  documentoIdentidad: "no_se",
};

export type ProveedorDocumentos = "gemini" | "anthropic";

const SI_NO: { valor: RespuestaSiNo; texto: string }[] = [
  { valor: "si", texto: "Sí" },
  { valor: "no", texto: "No" },
  { valor: "no_se", texto: "No sé" },
];

const hoy = () => new Date().toISOString().slice(0, 10);

function Opciones<T extends string>({
  pregunta,
  ayuda,
  nombre,
  valor,
  opciones,
  onCambio,
  children,
}: {
  pregunta: string;
  ayuda?: string;
  nombre: string;
  valor: T;
  opciones: { valor: T; texto: string }[];
  onCambio: (v: T) => void;
  children?: ReactNode;
}) {
  return (
    <fieldset className="cuestionario-pregunta">
      <legend>{pregunta}</legend>
      {ayuda && <p className="cuestionario-ayuda">{ayuda}</p>}
      <div className="cuestionario-opciones">
        {opciones.map((o) => (
          <label key={o.valor} className="cuestionario-opcion">
            <input
              type="radio"
              name={nombre}
              value={o.valor}
              checked={valor === o.valor}
              onChange={() => onCambio(o.valor)}
            />
            <span>{o.texto}</span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

const ETIQUETA_TIPO: Record<DocumentoLeido["tipo"], string> = {
  orden_medica: "Orden médica",
  negacion_eps: "Negación de la EPS",
  autorizacion_eps: "Autorización de la EPS",
  solicitud_eps: "Solicitud a la EPS",
  examen_o_historia: "Examen o historia clínica",
  documento_identidad: "Documento de identidad",
  otro: "Otro documento",
};

/** Subir documentos para que la IA llene el cuestionario (con acuerdo de datos aparte). */
function LecturaDocumentos({
  proveedor,
  acuerdoAceptado,
  onAcuerdo,
  previos,
  onDeclarados,
}: {
  proveedor: ProveedorDocumentos;
  acuerdoAceptado: boolean;
  onAcuerdo: () => void;
  previos: DocumentosDeclarados | null;
  onDeclarados: (d: DocumentosDeclarados) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [leidos, setLeidos] = useState<DocumentoLeido[]>([]);
  const [error, setError] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  const subir = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    setError("");
    setLeyendo(true);
    try {
      const archivos = await Promise.all(
        Array.from(lista).map(async (f) => ({
          nombre: f.name,
          tipo: f.type,
          base64: await archivoABase64(f),
        })),
      );
      const r = await leerDocumentos({
        data: { archivos, previos },
        headers: await cabecerasDeSesion(),
      });
      setLeidos(r.documentos);
      onDeclarados(r.declarados);
    } catch (err) {
      setError(`No pudimos leer tus documentos (${motivoDe(err)}).`);
    } finally {
      setLeyendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  if (!abierto)
    return (
      <div className="documentos-ia">
        <p>
          <strong>¿Prefieres que los leamos por ti?</strong> Sube fotos o PDF de tus documentos y
          llenamos estas respuestas automáticamente.
        </p>
        <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>
          <Paperclip aria-hidden="true" /> Subir mis documentos
        </Button>
      </div>
    );

  if (!acuerdoAceptado)
    return (
      <AcuerdoDatos
        titulo={ACUERDO_DOCUMENTOS.titulo}
        puntos={ACUERDO_DOCUMENTOS.puntos(proveedor)}
        textoBoton="Autorizo y quiero subir mis documentos"
        onAceptar={async () => {
          await aceptarAcuerdo({
            data: { alcance: "documentos" },
            headers: await cabecerasDeSesion(),
          });
          onAcuerdo();
        }}
        onCancelar={() => setAbierto(false)}
      />
    );

  return (
    <div className="documentos-ia">
      <label className="revision-web-label" htmlFor="documentos-archivos">
        Elige hasta 4 archivos (PDF, JPG o PNG, máximo 5 MB cada uno)
      </label>
      <input
        ref={entrada}
        id="documentos-archivos"
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="documentos-ia-archivo"
        disabled={leyendo}
        onChange={(e) => void subir(e.target.files)}
      />
      {leyendo && (
        <p className="revision-web-cargando" role="status">
          <Loader2 aria-hidden="true" className="animate-spin" /> Leyendo tus documentos… puede
          tardar hasta un minuto.
        </p>
      )}
      {error && (
        <p role="alert" className="revision-web-aviso">
          {error}
        </p>
      )}
      {leidos.length > 0 && (
        <div role="status" className="documentos-ia-leidos">
          <p>
            <strong>Esto encontramos.</strong> Ya llenamos las respuestas de arriba: revisa que sean
            correctas. Los archivos no se guardaron.
          </p>
          <ul>
            {leidos.map((d, i) => (
              <li key={`${d.archivo}-${i}`}>
                <FileUp aria-hidden="true" />{" "}
                <span className="documentos-ia-nombre">{d.archivo}</span>:{" "}
                {d.legible
                  ? [ETIQUETA_TIPO[d.tipo], d.fecha, d.servicio, d.motivo && `Motivo: ${d.motivo}`]
                      .filter(Boolean)
                      .join(" · ")
                  : "no se pudo leer. Sube una foto más nítida o responde a mano."}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Preguntas sobre documentos de soporte, sin recibirlos: la revisión compara las respuestas con
 * el texto de la tutela (reglas D01–D05) y arma la lista de anexos.
 */
export function CuestionarioDocumentos({
  valor,
  onCambio,
  proveedorDocumentos,
  acuerdoDocumentos,
  onAcuerdoDocumentos,
}: {
  valor: DocumentosDeclarados | null;
  onCambio: (d: DocumentosDeclarados | null) => void;
  proveedorDocumentos: ProveedorDocumentos | null;
  acuerdoDocumentos: boolean;
  onAcuerdoDocumentos: () => void;
}) {
  const id = useId();
  const d = valor ?? DECLARADOS_VACIOS;
  const cambiar = (c: Partial<DocumentosDeclarados>) => onCambio({ ...d, ...c });
  const pideFechaEPS = ["negacion_escrita", "sin_respuesta", "autorizo_sin_entregar"].includes(
    d.respuestaEPS,
  );

  return (
    <details className="cuestionario" open={valor !== null}>
      <summary>
        <Paperclip aria-hidden="true" /> Cuéntanos sobre tus documentos{" "}
        <span className="cuestionario-etiqueta">recomendado</span>
      </summary>
      <p className="cuestionario-intro">
        Con 4 preguntas comparamos tus documentos con lo que dice la tutela y te decimos qué
        adjuntar. <strong>No tienes que enviarnos los documentos.</strong>
      </p>

      <Opciones
        pregunta="1. ¿Tienes la orden o fórmula del médico para lo que pides?"
        ayuda="También sirve la autorización de servicios o el MIPRES."
        nombre={`${id}-orden`}
        valor={d.ordenMedica}
        opciones={SI_NO}
        onCambio={(v) => cambiar({ ordenMedica: v })}
      >
        {d.ordenMedica === "si" && (
          <div className="cuestionario-detalle">
            <label>
              <span>¿Qué te ordenó? (como aparece en la orden)</span>
              <input
                type="text"
                maxLength={120}
                placeholder="Ej.: resonancia magnética de rodilla"
                value={d.servicioOrdenado ?? ""}
                onChange={(e) => cambiar({ servicioOrdenado: e.target.value || null })}
              />
            </label>
            <label>
              <span>Fecha de la orden</span>
              <input
                type="date"
                max={hoy()}
                value={d.fechaOrden ?? ""}
                onChange={(e) => cambiar({ fechaOrden: e.target.value || null })}
              />
            </label>
          </div>
        )}
      </Opciones>

      <Opciones<RespuestaEPS>
        pregunta="2. ¿Qué hizo la EPS cuando le pediste el servicio?"
        nombre={`${id}-eps`}
        valor={d.respuestaEPS}
        opciones={(Object.keys(ETIQUETA_RESPUESTA_EPS) as RespuestaEPS[]).map((v) => ({
          valor: v,
          texto: ETIQUETA_RESPUESTA_EPS[v],
        }))}
        onCambio={(v) => cambiar({ respuestaEPS: v })}
      >
        {pideFechaEPS && (
          <div className="cuestionario-detalle">
            <label>
              <span>
                {d.respuestaEPS === "sin_respuesta"
                  ? "¿Cuándo hiciste la solicitud?"
                  : "Fecha de la respuesta de la EPS"}
              </span>
              <input
                type="date"
                max={hoy()}
                value={d.fechaRespuestaEPS ?? ""}
                onChange={(e) => cambiar({ fechaRespuestaEPS: e.target.value || null })}
              />
            </label>
          </div>
        )}
      </Opciones>

      <Opciones
        pregunta="3. ¿Tienes exámenes o historia clínica que muestren tu diagnóstico o la urgencia?"
        nombre={`${id}-soportes`}
        valor={d.soportesClinicos}
        opciones={SI_NO}
        onCambio={(v) => cambiar({ soportesClinicos: v })}
      />

      <Opciones
        pregunta="4. ¿Tienes copia de tu documento de identidad?"
        nombre={`${id}-identidad`}
        valor={d.documentoIdentidad}
        opciones={SI_NO}
        onCambio={(v) => cambiar({ documentoIdentidad: v })}
      />

      {valor !== null && (
        <Button size="sm" variant="ghost" onClick={() => onCambio(null)}>
          Borrar mis respuestas
        </Button>
      )}

      {proveedorDocumentos && (
        <LecturaDocumentos
          proveedor={proveedorDocumentos}
          acuerdoAceptado={acuerdoDocumentos}
          onAcuerdo={onAcuerdoDocumentos}
          previos={valor}
          onDeclarados={onCambio}
        />
      )}
    </details>
  );
}
