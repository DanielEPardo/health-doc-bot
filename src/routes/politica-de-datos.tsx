import { createFileRoute, Link } from "@tanstack/react-router";
import { DatosResponsable, PaginaLegal } from "@/components/legal/pagina-legal";
import { RESPONSABLE } from "@/lib/datos-responsable";
import { puntosAvisoIA } from "@/lib/validador/aviso-ia";

const title = "Política de tratamiento de datos — TuTelaGanas";
const description =
  "Cómo tratamos tus datos personales y de salud, para qué, con quién y cómo ejercer tus derechos (Ley 1581 de 2012).";

export const Route = createFileRoute("/politica-de-datos")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Politica,
});

function Politica() {
  return (
    <PaginaLegal
      antetitulo="Tu información merece cuidado"
      titulo="Política de tratamiento de datos personales"
      intro={
        <p>
          TuTelaGanas ofrece una revisión orientativa de tutelas de salud en Colombia. Esta política
          explica qué datos tratamos, para qué, con quién los compartimos y cómo ejercer tus
          derechos, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013 (compilado en el
          Decreto 1074 de 2015).
        </p>
      }
      secciones={[
        {
          id: "responsable",
          titulo: "Responsable del tratamiento",
          contenido: (
            <>
              <DatosResponsable />
              <p>
                Las consultas y reclamos sobre tus datos los atiende el mismo responsable, en el
                correo {RESPONSABLE.correo}.
              </p>
            </>
          ),
        },
        {
          id: "datos",
          titulo: "Qué datos tratamos",
          contenido: (
            <ul className="legal-lista">
              <li>
                <strong>Datos de tu cuenta:</strong> celular o correo, y nombre o foto si los
                agregas en tu perfil. No te pedimos documento de identidad ni datos de salud para
                crear la cuenta.
              </li>
              <li>
                <strong>Contenido de tu tutela:</strong> el texto o PDF que revisas. Suele incluir
                tu nombre, cédula, dirección, diagnóstico y hechos de salud.
              </li>
              <li>
                <strong>Respuestas sobre tus documentos:</strong> si tienes orden médica, qué
                respondió la EPS, fechas y qué te ordenaron.
              </li>
              <li>
                <strong>Documentos que decidas subir</strong> (opcional): orden médica, respuesta de
                la EPS, exámenes o tu tutela escaneada.
              </li>
              <li>
                <strong>Por WhatsApp:</strong> tu número, los mensajes que nos envías y el resultado
                de la revisión.
              </li>
              <li>
                <strong>Constancias de autorización:</strong> qué aceptaste, la versión del texto y
                la fecha.
              </li>
              <li>
                <strong>Datos técnicos:</strong> los necesarios para mantener tu sesión (Clerk) y la
                seguridad del servicio. El proveedor de alojamiento (Lovable) también registra datos
                de visita, como las páginas vistas y el tiempo en ellas, para medir el
                funcionamiento del sitio; esos datos no incluyen el contenido de tu tutela.
              </li>
            </ul>
          ),
        },
        {
          id: "sensibles",
          titulo: "Datos sensibles y de niños, niñas y adolescentes",
          contenido: (
            <>
              <p>
                Los datos de salud son <strong>datos sensibles</strong>. Solo los tratamos con tu
                autorización previa, expresa e informada, y{" "}
                <strong>no estás obligado(a) a autorizar su tratamiento</strong> (Ley 1581, art. 6).
                Si no autorizas, no podremos revisar tu tutela por los medios que lo requieren, pero
                puedes revisarla en tu navegador sin enviarnos nada.
              </p>
              <p>
                Si la tutela es de un niño, niña o adolescente, quien la presenta como su
                representante es quien autoriza. Esos datos se tratan solo para proteger su derecho
                a la salud y respetando su interés superior.
              </p>
            </>
          ),
        },
        {
          id: "finalidades",
          titulo: "Para qué los usamos",
          contenido: (
            <ul className="legal-lista">
              <li>Crear y administrar tu cuenta e iniciar sesión.</li>
              <li>
                Revisar tu tutela frente a los requisitos del Decreto 2591 de 1991, la Ley 1751 de
                2015 y la jurisprudencia de la Corte Constitucional, y mostrarte el resultado.
              </li>
              <li>Guardar tu historial de tutelas, solo si lo autorizas.</li>
              <li>Leer tus documentos con inteligencia artificial, solo si lo autorizas aparte.</li>
              <li>Responder tus consultas, reclamos y solicitudes.</li>
              <li>Cumplir obligaciones legales y conservar la prueba de tus autorizaciones.</li>
            </ul>
          ),
        },
        {
          id: "como",
          titulo: "Cómo funciona cada opción",
          contenido: (
            <ul className="legal-lista">
              <li>
                <strong>Revisión en la página:</strong> se hace en tu navegador. El texto y el PDF
                no se envían a nuestros servidores ni se guardan, salvo que actives una de las
                opciones de abajo.
              </li>
              <li>
                <strong>Análisis con IA (opcional):</strong> antes de enviarlo quitamos tu nombre,
                documento, teléfono, correo y dirección. El texto restante lo procesa Google Gemini
                en su servicio gratuito, para extraer los elementos de la tutela, escribir
                observaciones jurídicas y sugerirte correcciones de redacción. En ese servicio
                Google puede usar el contenido para mejorar sus productos y personas de Google
                pueden leerlo. No lo guardamos. Te pedimos esta autorización una sola vez y puedes
                retirarla en «Mi perfil» → «Mis datos».
              </li>
              <li>
                <strong>Historial (opcional):</strong> guardamos el texto, tus respuestas y el
                resultado, cifrados, para que continúes después. Solo tú los ves desde tu cuenta.
              </li>
              <li>
                <strong>Lectura de documentos (opcional):</strong> los documentos no se pueden
                anonimizar. Solo usamos un servicio de IA cuyas condiciones no permiten usar tu
                información para entrenar sus modelos. No guardamos los archivos; solo usamos la
                fecha, el servicio, la entidad y el motivo de una negación.
              </li>
              <li>
                <strong>WhatsApp:</strong> te pedimos autorización antes de recibir la tutela. Al
                revisar borramos el texto y conservamos solo el resultado (puntaje y puntos
                cumplidos), sin tu nombre, documento ni diagnóstico. Escribe BORRAR para eliminar
                tus datos.
              </li>
            </ul>
          ),
        },
        {
          id: "ia",
          titulo: "Uso de inteligencia artificial",
          contenido: (
            <>
              <p>
                Este aviso aplica solo si autorizas el análisis con IA, en la web o en WhatsApp.
              </p>
              <dl className="policy-aviso-ia">
                {puntosAvisoIA("gemini", "web").map((p) => (
                  <div key={p.titulo}>
                    <dt>{p.titulo}</dt>
                    <dd>{p.texto}</dd>
                  </div>
                ))}
              </dl>
            </>
          ),
        },
        {
          id: "encargados",
          titulo: "Con quién los compartimos",
          contenido: (
            <>
              <p>
                No vendemos tus datos ni los compartimos para otros fines. Para funcionar usamos
                proveedores que los tratan por cuenta nuestra (encargados), según la opción que
                uses:
              </p>
              <ul className="legal-lista">
                <li>Clerk: cuenta e inicio de sesión.</li>
                <li>
                  Lovable Cloud (Supabase y Cloudflare): alojamiento, base de datos y medición de
                  visitas.
                </li>
                <li>Meta (WhatsApp) y Twilio: mensajes, si nos escribes por WhatsApp.</li>
                <li>
                  Google (Gemini) o Anthropic (Claude): análisis con IA, redacción sugerida y
                  lectura de documentos, si los autorizas. Si está activado, OpenRouter procesa la
                  redacción sugerida cuando Gemini no responde, con el mismo texto sin tus datos de
                  identificación.
                </li>
              </ul>
              <p>
                Algunos de estos proveedores están fuera de Colombia, principalmente en Estados
                Unidos, así que tus datos pueden transmitirse a otros países. Al autorizar el
                tratamiento autorizas esa transmisión, que hacemos solo para las finalidades de esta
                política y exigiendo medidas de seguridad.
              </p>
            </>
          ),
        },
        {
          id: "derechos",
          titulo: "Tus derechos",
          contenido: (
            <>
              <p>Como titular puedes (Ley 1581, art. 8):</p>
              <ul className="legal-lista">
                <li>Conocer, actualizar y rectificar tus datos.</li>
                <li>Pedir prueba de la autorización que nos diste.</li>
                <li>Saber qué uso le damos a tus datos.</li>
                <li>
                  Revocar tu autorización y pedir que suprimamos tus datos, cuando no exista un
                  deber legal o contractual de conservarlos.
                </li>
                <li>
                  Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después
                  de haber acudido a nosotros.
                </li>
                <li>Acceder gratis a tus datos.</li>
              </ul>
              <p>
                Muchos de estos derechos los ejerces tú mismo(a): en «Mi perfil» → «Mis datos»
                puedes ver y retirar tus autorizaciones; en «Mis tutelas» puedes eliminar tu
                historial; en «Mi perfil» → «Seguridad» puedes eliminar tu cuenta (eso también borra
                tu historial).
              </p>
            </>
          ),
        },
        {
          id: "procedimiento",
          titulo: "Cómo hacer consultas y reclamos",
          contenido: (
            <>
              <p>
                Escríbenos a <strong>{RESPONSABLE.correo}</strong> con tu nombre, el celular o
                correo de tu cuenta, lo que pides y cómo quieres recibir la respuesta. No incluyas
                datos de salud si no son indispensables.
              </p>
              <ul className="legal-lista">
                <li>
                  <strong>Consultas</strong> (conocer tus datos): respondemos en máximo 10 días
                  hábiles. Si no es posible, te avisamos y respondemos en máximo 5 días hábiles más
                  (Ley 1581, art. 14).
                </li>
                <li>
                  <strong>Reclamos</strong> (corregir, actualizar, suprimir o revocar): respondemos
                  en máximo 15 días hábiles. Si no es posible, te avisamos y respondemos en máximo 8
                  días hábiles más. Si falta información, te la pedimos dentro de los 5 días
                  siguientes (Ley 1581, art. 15).
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "seguridad",
          titulo: "Seguridad y conservación",
          contenido: (
            <ul className="legal-lista">
              <li>
                Conexiones cifradas, acceso a la base de datos solo desde el servidor, historial
                cifrado y verificación de tu sesión en cada operación privada.
              </li>
              <li>
                Texto recibido por WhatsApp: se borra al revisarlo. Archivos subidos para leer con
                IA: no se guardan.
              </li>
              <li>
                Historial: hasta que lo elimines, retires la autorización o elimines tu cuenta.
              </li>
              <li>
                Constancias de autorización: se conservan como prueba aunque borres tus datos (Ley
                1581, art. 17).
              </li>
            </ul>
          ),
        },
        {
          id: "vigencia",
          titulo: "Vigencia y cambios",
          contenido: (
            <p>
              Esta política rige desde la fecha indicada arriba y mientras prestemos el servicio. Si
              hacemos cambios importantes, te avisaremos en la página y, cuando corresponda, te
              pediremos una nueva autorización.
            </p>
          ),
        },
      ]}
    />
  );
}
