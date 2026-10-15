/**
 * Datos del responsable del tratamiento que aparecen en la política de datos y los términos
 * (Decreto 1377 de 2013, art. 13, compilado en el Decreto 1074 de 2015).
 *
 * ⚠️ COMPLETAR antes de publicar: razón social o nombre, NIT o cédula y domicilio. Mientras tengan
 * el texto "[Por completar", las páginas lo muestran así para que se note que falta.
 */
export const RESPONSABLE = {
  nombre: "[Por completar: razón social o nombre completo del responsable]",
  identificacion: "[Por completar: NIT o número de cédula]",
  domicilio: "[Por completar: dirección y ciudad]",
  correo: "tutelaganas@gmail.com",
  whatsapp: "+57 310 690 7908",
} as const;

/** Fecha en que entran en vigencia las versiones actuales de los documentos legales. */
export const VIGENCIA_DOCUMENTOS = "11 de octubre de 2026";

export const faltanDatosResponsable = () =>
  Object.values(RESPONSABLE).some((v) => v.startsWith("[Por completar"));
