import { createFileRoute } from "@tanstack/react-router";
import { PaginaLegal } from "@/components/legal/pagina-legal";

const title = "Política de cookies — TuTelaGanas";
const description =
  "Qué cookies y almacenamiento usa TuTelaGanas: solo los necesarios para iniciar sesión y mantener tu cuenta segura.";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Cookies,
});

const COOKIES = [
  {
    nombre: "__session, __client_uat",
    quien: "Clerk (inicio de sesión)",
    para: "Saber que iniciaste sesión y mantenerla segura.",
    duracion: "Mientras dure tu sesión",
  },
  {
    nombre: "__client y similares",
    quien: "Clerk, en su propio dominio",
    para: "Recordar tu sesión en el servicio de cuentas.",
    duracion: "Hasta que cierres sesión o expire",
  },
  {
    nombre: "__clerk_db_jwt",
    quien: "Clerk, solo en entornos de prueba",
    para: "Funcionamiento del inicio de sesión en desarrollo.",
    duracion: "Sesión de prueba",
  },
  {
    nombre: "tutelaganas-aviso-cookies (almacenamiento local)",
    quien: "TuTelaGanas",
    para: "Recordar que ya viste el aviso de cookies para no mostrarlo otra vez.",
    duracion: "Hasta que borres los datos del navegador",
  },
];

function Cookies() {
  return (
    <PaginaLegal
      antetitulo="Transparencia"
      titulo="Política de cookies"
      intro={
        <p>
          Las cookies son pequeños archivos que una página guarda en tu navegador.{" "}
          <strong>
            En TuTelaGanas solo usamos las necesarias para que puedas iniciar sesión y para mantener
            tu cuenta segura.
          </strong>{" "}
          No usamos cookies de publicidad, de analítica ni de redes sociales.
        </p>
      }
      secciones={[
        {
          id: "cuales",
          titulo: "Qué cookies usamos",
          contenido: (
            <div className="legal-tabla-contenedor">
              <table className="legal-tabla">
                <caption className="sr-only">Cookies y almacenamiento que usa TuTelaGanas</caption>
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">De quién</th>
                    <th scope="col">Para qué</th>
                    <th scope="col">Duración</th>
                  </tr>
                </thead>
                <tbody>
                  {COOKIES.map((c) => (
                    <tr key={c.nombre}>
                      <th scope="row">{c.nombre}</th>
                      <td data-etiqueta="De quién">{c.quien}</td>
                      <td data-etiqueta="Para qué">{c.para}</td>
                      <td data-etiqueta="Duración">{c.duracion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: "terceros",
          titulo: "Servicios de terceros",
          contenido: (
            <ul className="legal-lista">
              <li>
                <strong>Clerk</strong> maneja el inicio de sesión y puede guardar datos técnicos en
                el almacenamiento local de tu navegador para que funcione.
              </li>
              <li>
                <strong>Google Fonts</strong> nos entrega la tipografía de la página. Al cargarla,
                Google recibe datos técnicos como tu dirección IP.
              </li>
              <li>
                <strong>El proveedor de alojamiento</strong> (Lovable Cloud, sobre Cloudflare) puede
                usar cookies técnicas de seguridad para proteger el sitio de ataques.
              </li>
            </ul>
          ),
        },
        {
          id: "por-que",
          titulo: "Por qué no te pedimos aceptarlas",
          contenido: (
            <p>
              Como solo usamos cookies necesarias para prestar el servicio que pides (iniciar
              sesión), no te pedimos que las aceptes: te informamos con un aviso. Si algún día
              agregamos cookies que no sean necesarias, te pediremos permiso antes y podrás
              rechazarlas.
            </p>
          ),
        },
        {
          id: "control",
          titulo: "Cómo controlarlas",
          contenido: (
            <p>
              Puedes borrar o bloquear las cookies en la configuración de tu navegador. Si bloqueas
              las de Clerk, no podrás iniciar sesión, pero la página de inicio y las páginas de
              información seguirán funcionando.
            </p>
          ),
        },
        {
          id: "cambios",
          titulo: "Cambios",
          contenido: (
            <p>
              Si cambiamos las cookies que usamos, actualizaremos esta página y la fecha de
              vigencia.
            </p>
          ),
        },
      ]}
    />
  );
}
