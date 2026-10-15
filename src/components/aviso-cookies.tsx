import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const CLAVE = "tutelaganas-aviso-cookies";

/**
 * Aviso informativo: solo usamos cookies necesarias (inicio de sesión y seguridad), así que no se
 * pide aceptarlas; se informa una vez. Si algún día se agregan cookies no necesarias, este aviso
 * debe convertirse en una solicitud de consentimiento con opción de rechazar.
 */
export function AvisoCookies() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      setVisible(localStorage.getItem(CLAVE) !== "visto");
    } catch {
      setVisible(true);
    }
  }, []);
  if (!visible) return null;
  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE, "visto");
    } catch {
      // Sin almacenamiento disponible: el aviso volverá a aparecer en la próxima visita.
    }
    setVisible(false);
  };
  return (
    <section className="aviso-cookies" aria-label="Aviso de cookies">
      <Cookie aria-hidden="true" className="aviso-cookies-icono" />
      <p>
        Solo usamos cookies necesarias para iniciar sesión y mantener tu cuenta segura. No usamos
        cookies de publicidad ni de analítica.{" "}
        <Link to="/cookies" className="text-link">
          Más información
        </Link>
      </p>
      <Button size="sm" onClick={cerrar}>
        Entendido
      </Button>
    </section>
  );
}
