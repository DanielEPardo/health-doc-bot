/**
 * Aviso legal sobre el uso de inteligencia artificial. Lo comparten el bot de WhatsApp
 * (se envía antes de pedir la autorización y queda en la constancia del consentimiento)
 * y la web (/revision, junto a la casilla de autorización). Fundamento en
 * docs/validador/06-proteccion-de-datos.md: Ley 1581 de 2012 (arts. 4 lit. e, 5, 6 y 26)
 * y SIC, Circular Externa 002 de 2024 (datos personales en sistemas de IA).
 */

export type ProveedorAviso = "gemini" | "anthropic";

const NOMBRE: Record<ProveedorAviso, string> = {
  gemini: "Google Gemini",
  anthropic: "Claude (Anthropic)",
};

const DATOS: Record<ProveedorAviso, string> = {
  gemini:
    "Antes de enviarla quitamos tu nombre, cédula, teléfono, correo y dirección. El resto del texto, que incluye información de salud, lo procesa Google en servidores fuera de Colombia, en su servicio gratuito: Google puede usarlo para mejorar sus productos y personas de Google pueden leerlo. Nosotros no guardamos el texto.",
  anthropic:
    "Antes de enviarla quitamos tu nombre, cédula, teléfono, correo y dirección. El resto del texto, que incluye información de salud, lo procesa Anthropic en servidores fuera de Colombia. Nosotros no guardamos el texto.",
};

export interface PuntoAviso {
  titulo: string;
  texto: string;
}

const SIN_IA = {
  whatsapp:
    "Si prefieres que no usemos IA, no aceptes y revisa tu tutela en https://health-doc-bot.lovable.app/revision, donde la revisión se hace solo en tu navegador.",
  web: "Si no marcas la casilla, la revisión se hace solo en tu navegador, sin IA.",
} as const;

/** Puntos del aviso, en lenguaje claro. `respaldo`: la web puede usar OpenRouter si el proveedor falla. */
export function puntosAvisoIA(
  proveedor: ProveedorAviso,
  canal: keyof typeof SIN_IA,
  opciones: { respaldo?: boolean } = {},
): PuntoAviso[] {
  const redaccion =
    canal === "web"
      ? " En esta página también te sugiere correcciones de ortografía y redacción; tú decides si las usas."
      : "";
  const respaldo =
    canal === "web" && opciones.respaldo
      ? " Para la redacción sugerida, si ese servicio no responde, el mismo texto sin tus datos de identificación puede procesarlo un modelo gratuito por medio de OpenRouter, que según el modelo también puede usarlo para entrenar sus sistemas."
      : "";
  return [
    {
      titulo: "Qué hace la IA",
      texto: `Usamos inteligencia artificial (${NOMBRE[proveedor]}) como apoyo: lee tu tutela y escribe observaciones con base en la Constitución Política, el Decreto 2591 de 1991, la Ley Estatutaria 1751 de 2015 y la jurisprudencia de la Corte Constitucional.${redaccion}`,
    },
    {
      titulo: "Qué decide y qué no",
      texto:
        "Lo que cumple, lo que falta y el puntaje lo dan reglas fijas y verificables, cada una con su fundamento. Lo que escribe la IA aparece aparte, como «Observaciones de la IA», y no cambia ese resultado.",
    },
    {
      titulo: "Puede equivocarse",
      texto:
        "La IA puede cometer errores u omitir información. Antes de usar una norma o una sentencia en tu tutela, revísala en el enlace oficial.",
    },
    {
      titulo: "No es asesoría jurídica",
      texto:
        "No reemplaza a un abogado, a la Defensoría del Pueblo ni a la Personería. Nada se decide de forma automática sobre tu caso: tú decides qué cambiar y si presentas la tutela, y solo el juez decide.",
    },
    { titulo: "Tus datos", texto: `${DATOS[proveedor]}${respaldo}` },
    {
      titulo: "Es voluntario",
      texto: `No estás obligado(a) a aceptar el análisis con IA. ${SIN_IA[canal]} Puedes revocar tu autorización y pedir que borremos tus datos cuando quieras (Ley 1581 de 2012).`,
    },
  ];
}

/** Versión para WhatsApp (*negrita*). */
export function avisoIAWhatsApp(proveedor: ProveedorAviso): string {
  return [
    "⚖️ *Aviso legal sobre el uso de inteligencia artificial*",
    ...puntosAvisoIA(proveedor, "whatsapp").map((p) => `• *${p.titulo}:* ${p.texto}`),
  ].join("\n\n");
}

/** Nota corta que acompaña las observaciones de la IA en cada reporte. */
export const NOTA_OBSERVACIONES_IA =
  "Generadas con inteligencia artificial a partir de la Constitución, la ley y la jurisprudencia citadas. Son complementarias, pueden tener errores y no son asesoría jurídica: verifica cada fuente antes de usarla.";
