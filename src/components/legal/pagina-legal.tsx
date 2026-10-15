import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { RESPONSABLE, VIGENCIA_DOCUMENTOS } from "@/lib/datos-responsable";

/** Estructura común de las páginas legales: título, índice, secciones y pie con vigencia. */
export function PaginaLegal({
  antetitulo,
  titulo,
  intro,
  secciones,
}: {
  antetitulo: string;
  titulo: string;
  intro: ReactNode;
  secciones: { id: string; titulo: string; contenido: ReactNode }[];
}) {
  return (
    <main className="content-width policy legal">
      <p className="section-kicker">{antetitulo}</p>
      <h1>{titulo}</h1>
      <p className="legal-vigencia">Vigente desde el {VIGENCIA_DOCUMENTOS}.</p>
      <div className="legal-intro">{intro}</div>
      <nav aria-label="Contenido de esta página" className="legal-indice">
        <p>En esta página</p>
        <ol>
          {secciones.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-link">
                {s.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {secciones.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`}>
          <h2 id={`${s.id}-titulo`}>
            {i + 1}. {s.titulo}
          </h2>
          {s.contenido}
        </section>
      ))}
      <p className="legal-pie">
        ¿Dudas? Escríbenos a{" "}
        <a className="text-link" href={`mailto:${RESPONSABLE.correo}`}>
          {RESPONSABLE.correo}
        </a>
        . Ver también:{" "}
        <Link to="/politica-de-datos" className="text-link">
          Política de datos
        </Link>{" "}
        ·{" "}
        <Link to="/terminos" className="text-link">
          Términos y condiciones
        </Link>
        .
      </p>
      <p>
        <Link to="/" className="text-link">
          Volver a TuTelaGanas
        </Link>
      </p>
    </main>
  );
}

/** Bloque con los datos del responsable (los que falten se ven resaltados). */
export function DatosResponsable() {
  const fila = (etiqueta: string, valor: string) => (
    <li>
      <strong>{etiqueta}:</strong>{" "}
      {valor.startsWith("[Por completar") ? (
        <mark className="legal-pendiente">{valor}</mark>
      ) : (
        valor
      )}
    </li>
  );
  return (
    <ul className="legal-lista">
      {fila("Responsable", RESPONSABLE.nombre)}
      {fila("Identificación", RESPONSABLE.identificacion)}
      {fila("Domicilio", RESPONSABLE.domicilio)}
      {fila("Correo", RESPONSABLE.correo)}
      {fila("WhatsApp", RESPONSABLE.whatsapp)}
    </ul>
  );
}
