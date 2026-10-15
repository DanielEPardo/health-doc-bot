import { createFileRoute, Link } from "@tanstack/react-router";
import { DatosResponsable, PaginaLegal } from "@/components/legal/pagina-legal";

const title = "Términos y condiciones — TuTelaGanas";
const description =
  "Reglas de uso de TuTelaGanas: qué es y qué no es la revisión de tutelas, tu cuenta y tus responsabilidades.";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Terminos,
});

function Terminos() {
  return (
    <PaginaLegal
      antetitulo="Reglas claras"
      titulo="Términos y condiciones de uso"
      intro={
        <p>
          Estos términos regulan el uso de TuTelaGanas en la página web y por WhatsApp. Al crear tu
          cuenta o usar el servicio, los aceptas. Léelos junto con la{" "}
          <Link to="/politica-de-datos" className="text-link">
            política de tratamiento de datos
          </Link>
          .
        </p>
      }
      secciones={[
        {
          id: "quienes",
          titulo: "Quiénes somos",
          contenido: <DatosResponsable />,
        },
        {
          id: "servicio",
          titulo: "Qué es el servicio y qué no es",
          contenido: (
            <>
              <p>
                TuTelaGanas revisa de forma <strong>automatizada y orientativa</strong> si una
                tutela de salud ya redactada tiene los requisitos del Decreto 2591 de 1991, la Ley
                1751 de 2015 y la jurisprudencia de la Corte Constitucional, y te indica qué falta o
                qué puedes fortalecer, con su fundamento.
              </p>
              <ul className="legal-lista">
                <li>
                  <strong>No es asesoría jurídica</strong> ni reemplaza a un abogado. No somos una
                  firma de abogados y no te representamos ante ningún juzgado ni entidad.
                </li>
                <li>
                  <strong>No garantiza el resultado</strong> de tu tutela: lo decide el juez. El
                  puntaje mide qué tan completa está, no la probabilidad de ganar.
                </li>
                <li>No redacta tu tutela ni la presenta por ti.</li>
                <li>
                  Para casos complejos o urgentes, acude a un abogado, a un consultorio jurídico
                  universitario, a la Defensoría del Pueblo o a la Personería, que ayudan gratis.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "cuenta",
          titulo: "Tu cuenta",
          contenido: (
            <ul className="legal-lista">
              <li>
                Debes ser mayor de 18 años. Si revisas la tutela de un menor o de otra persona,
                debes actuar como su representante o agente oficioso.
              </li>
              <li>Los datos de tu cuenta deben ser verdaderos y estar actualizados.</li>
              <li>
                Cuida tu acceso: eres responsable de lo que se haga con tu cuenta. Avísanos si crees
                que alguien más la está usando.
              </li>
              <li>
                Puedes eliminar tu cuenta cuando quieras en «Mi perfil» → «Seguridad». Eso también
                borra tu historial de tutelas.
              </li>
            </ul>
          ),
        },
        {
          id: "uso",
          titulo: "Uso adecuado",
          contenido: (
            <>
              <p>Te comprometes a no:</p>
              <ul className="legal-lista">
                <li>Usar el servicio para fines ilegales o para engañar a un juez.</li>
                <li>Subir datos de otras personas sin tener derecho a hacerlo.</li>
                <li>
                  Intentar acceder a cuentas o información ajena, o afectar el funcionamiento del
                  servicio.
                </li>
                <li>
                  Usar programas automáticos para hacer revisiones masivas o copiar el contenido.
                </li>
              </ul>
              <p>Podemos suspender cuentas que incumplan estas reglas.</p>
            </>
          ),
        },
        {
          id: "contenido",
          titulo: "Tu contenido",
          contenido: (
            <ul className="legal-lista">
              <li>
                Tu tutela y tus documentos son tuyos. Nos permites tratarlos solo para prestarte el
                servicio, como explica la política de datos.
              </li>
              <li>
                Eres responsable de lo que dice tu tutela: lo que afirmes ante un juez se entiende
                bajo la gravedad del juramento.
              </li>
              <li>
                Las funciones con IA, historial y lectura de documentos son opcionales y cada una
                requiere tu autorización aparte.
              </li>
            </ul>
          ),
        },
        {
          id: "precio",
          titulo: "Precio",
          contenido: (
            <p>
              Si alguna revisión tiene costo, antes de comenzar te informaremos el valor, la forma
              de pago y tus derechos como consumidor (Ley 1480 de 2011). No se cobra nada sin que lo
              aceptes.
            </p>
          ),
        },
        {
          id: "disponibilidad",
          titulo: "Disponibilidad",
          contenido: (
            <p>
              Hacemos lo posible para que el servicio funcione siempre, pero puede tener fallas o
              interrupciones, incluidas las de proveedores como WhatsApp o los servicios de IA. Si
              la IA falla, la revisión se hace con nuestras reglas sin IA.
            </p>
          ),
        },
        {
          id: "responsabilidad",
          titulo: "Responsabilidad",
          contenido: (
            <p>
              Respondemos por prestar el servicio como se describe en estos términos. No respondemos
              por las decisiones de jueces o EPS, ni por decisiones que tomes sin consultar a un
              abogado cuando tu caso lo requiera. Nada en estos términos limita los derechos que la
              ley colombiana te da como consumidor y que no se pueden renunciar.
            </p>
          ),
        },
        {
          id: "propiedad",
          titulo: "Propiedad intelectual",
          contenido: (
            <p>
              El diseño, los textos de las recomendaciones, las reglas de revisión y la marca
              TuTelaGanas nos pertenecen o los usamos con permiso. Las normas y sentencias citadas
              son públicas.
            </p>
          ),
        },
        {
          id: "cambios",
          titulo: "Cambios a estos términos",
          contenido: (
            <p>
              Si cambiamos estos términos, te avisaremos en la página y te pediremos aceptarlos de
              nuevo antes de seguir usando tu cuenta.
            </p>
          ),
        },
        {
          id: "ley",
          titulo: "Ley aplicable y reclamos",
          contenido: (
            <p>
              Estos términos se rigen por las leyes de Colombia. Si tienes un reclamo, escríbenos
              primero; también puedes acudir a la Superintendencia de Industria y Comercio en temas
              de consumidor y de protección de datos.
            </p>
          ),
        },
      ]}
    />
  );
}
