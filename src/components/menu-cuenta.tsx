import { SignedIn, UserButton } from "@clerk/clerk-react";
import { FileSearch, History } from "lucide-react";
import { useClerkReady } from "@/lib/clerk-ready";

/**
 * Ícono de perfil en el encabezado (solo con sesión iniciada). El menú lleva a «Mi perfil»
 * (datos de la cuenta, tutelas y autorizaciones), a «Mis tutelas» y a cerrar sesión.
 */
export function MenuCuenta() {
  const ready = useClerkReady();
  if (!ready) return null;
  return (
    <SignedIn>
      <span className="cuenta-menu">
        <UserButton
          userProfileMode="navigation"
          userProfileUrl="/perfil"
          appearance={{
            elements: { avatarBox: "cuenta-avatar", userButtonTrigger: "cuenta-boton" },
          }}
        >
          <UserButton.MenuItems>
            {/* «Administrar cuenta» se muestra como «Mi perfil» (ver localización en clerk-boundary). */}
            <UserButton.Action label="manageAccount" />
            <UserButton.Link
              label="Revisar una tutela"
              labelIcon={<FileSearch size={16} aria-hidden="true" />}
              href="/revision"
            />
            <UserButton.Link
              label="Mis tutelas"
              labelIcon={<History size={16} aria-hidden="true" />}
              href="/mis-tutelas"
            />
            <UserButton.Action label="signOut" />
          </UserButton.MenuItems>
        </UserButton>
      </span>
    </SignedIn>
  );
}
