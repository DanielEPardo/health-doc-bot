import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  agregarSeccion,
  extraerHeuristico,
  pendientesPorCompletar,
  seccionesSugeridas,
  validarTexto,
} from "@/lib/validador";
import { anonimizar } from "@/lib/validador/extraccion/anonimizar";
import { _limpiarCacheModelos } from "@/lib/validador/extraccion/gemini.server";
import { normalizarRedaccion, sugerirRedaccionIA } from "@/lib/redaccion-ia.server";
import { MODELOS_OPENROUTER } from "@/lib/validador/extraccion/openrouter.server";
import { crearCorrector, revisarConDiccionario } from "@/lib/validador/redaccion/corrector";
import { temaDetieneRevision } from "@/lib/redaccion-tipos";
import { buscarAparicion } from "@/lib/ir-al-texto";
import {
  aplicarCorreccion,
  frasesFueraDeLugar,
  revisarFormalidad,
  palabrasNoReconocidas,
  revisarOrtografia,
  revisarTema,
} from "@/lib/validador";

const leer = (n: string) => readFileSync(path.join(process.cwd(), "src/test/fixtures", n), "utf8");
const FECHA = new Date("2026-10-15T12:00:00-05:00");
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

beforeEach(() => _limpiarCacheModelos());

describe("Redacción sugerida sin IA (plantillas)", () => {
  it("propone las partes que faltan, en el orden de la tutela y con espacios para completar", () => {
    const t = leer("tutela-incompleta.txt");
    const res = validarTexto(t, { fechaReferencia: FECHA });
    const s = seccionesSugeridas(res.resultados, extraerHeuristico(t));
    const ids = s.map((x) => x.id);
    for (const id of ["identificacion", "pretensiones", "juramento", "pruebas", "cierre"])
      expect(ids, id).toContain(id);
    expect(ids.indexOf("identificacion")).toBeLessThan(ids.indexOf("juramento"));
    const juramento = s.find((x) => x.id === "juramento")!;
    expect(juramento.texto).toMatch(/^JURAMENTO\nBajo la gravedad del juramento/);
    expect(pendientesPorCompletar(s.find((x) => x.id === "cierre")!.texto)).toBeGreaterThan(0);
  });

  it("usa los datos que encuentra en la tutela (EPS, nombre)", () => {
    const t = leer("tutela-completa.txt").replace(/JURAMENTO[\s\S]*?(?=\n[A-ZÁÉÍÓÚ ]{6,}\n|$)/, "");
    const res = validarTexto(t, { fechaReferencia: FECHA });
    const juramento = seccionesSugeridas(res.resultados, extraerHeuristico(t)).find(
      (x) => x.id === "juramento",
    );
    expect(juramento).toBeDefined();
    const pret = seccionesSugeridas(
      [{ reglaId: "F06", estado: "debil", hallazgo: "x" }],
      extraerHeuristico(leer("tutela-completa.txt")),
    )[0];
    expect(pret?.texto).toContain("EPS Sura");
  });

  it("una tutela completa no recibe plantillas", () => {
    const t = leer("tutela-completa.txt");
    const res = validarTexto(t, { fechaReferencia: FECHA });
    expect(seccionesSugeridas(res.resultados, extraerHeuristico(t))).toEqual([]);
  });

  it("agrega la sección al inicio o al final del texto", () => {
    expect(agregarSeccion("cuerpo", { texto: "ENCABEZADO", posicion: "inicio" })).toBe(
      "ENCABEZADO\n\ncuerpo",
    );
    expect(agregarSeccion("cuerpo\n", { texto: "JURAMENTO", posicion: "final" })).toBe(
      "cuerpo\n\nJURAMENTO",
    );
  });
});

describe("Redacción sugerida con IA", () => {
  const t = leer("tutela-completa.txt");
  const anonimo = anonimizar(t, extraerHeuristico(t));
  const respuesta = {
    tema: { esTutelaDeSalud: true, observacion: "" },
    correcciones: [
      { tipo: "ortografia", original: "medica", corregido: "médica", motivo: "falta tilde" },
      { tipo: "ortografia", original: "texto que no existe", corregido: "x", motivo: "inventado" },
      { tipo: "ortografia", original: "[NOMBRE]", corregido: "Ana", motivo: "toca un marcador" },
      { tipo: "ortografia", original: "igual", corregido: "igual", motivo: "sin cambio" },
    ],
    secciones: [{ titulo: "Juramento", texto: "Yo, [NOMBRE], juro…", posicion: "final" }],
  };

  it("solo acepta correcciones de fragmentos que existen en el texto y no tocan marcadores", () => {
    const r = normalizarRedaccion(respuesta, anonimo, "m");
    expect(r.correcciones.map((c) => c.original)).toEqual(
      anonimo.includes("medica") ? ["medica"] : [],
    );
    expect(r.secciones).toHaveLength(1);
  });

  it("usa OpenRouter con modelos baratos, esquema JSON y sin retención de datos", async () => {
    const pedidas: { url: string; cuerpo: string }[] = [];
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      pedidas.push({ url, cuerpo: String(init?.body ?? "") });
      const { model } = JSON.parse(String(init?.body ?? "{}")) as { model: string };
      // El primer modelo falla: se prueba el siguiente.
      if (model === MODELOS_OPENROUTER.redaccion[0])
        return json({ error: { message: "overloaded" } }, 503);
      return json({ choices: [{ message: { content: JSON.stringify(respuesta) } }] });
    });
    const r = await sugerirRedaccionIA(anonimo, [], {
      entorno: { OPENROUTER_API_KEY: "or", GEMINI_API_KEY: "no-se-usa" },
      fetch: f as unknown as typeof fetch,
    });
    expect(r.modelo).toBe(MODELOS_OPENROUTER.redaccion[1]);
    expect(pedidas.every((p) => p.url.includes("openrouter.ai"))).toBe(true);
    const cuerpo = JSON.parse(pedidas[1]!.cuerpo);
    expect(cuerpo.response_format.type).toBe("json_schema");
    expect(cuerpo.provider).toEqual({ require_parameters: true, data_collection: "deny" });
    for (const p of pedidas)
      for (const dato of ["43.555.123", "María Fernanda", "mariaf.rios"])
        expect(p.cuerpo).not.toContain(dato);
  });

  it("OPENROUTER_MODELO cambia los modelos, y si todos fallan el error llega a la persona", async () => {
    const modelos: string[] = [];
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      modelos.push((JSON.parse(String(init?.body ?? "{}")) as { model: string }).model);
      return json({ error: { message: "quota" } }, 429);
    });
    await expect(
      sugerirRedaccionIA(anonimo, [], {
        entorno: { OPENROUTER_API_KEY: "or", OPENROUTER_MODELO: "x/uno, y/dos" },
        fetch: f as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/OpenRouter no respondió/);
    expect(modelos).toEqual(["x/uno", "y/dos"]);
  });
});

describe("Ortografía y tema sin IA", () => {
  const t = leer("tutela-incompleta.txt");

  it("encuentra tildes y siglas frecuentes, y mayúsculas al inicio de oración", () => {
    const c = revisarOrtografia(t);
    const pares = Object.fromEntries(c.map((x) => [x.original, x.corregido]));
    expect(pares["despues"]).toBe("después");
    expect(pares["atencion"]).toBe("atención");
    expect(pares["rapido"]).toBe("rápido");
    expect(pares["tenia"]).toBe("tenía");
    expect(pares["eps"]).toBe("EPS");
    expect(c.some((x) => x.motivo === "mayúscula después de punto")).toBe(true);
  });

  it("no toca palabras que cambian de sentido según el contexto", () => {
    const c = revisarOrtografia(
      "Esta es mi tutela. El médico me formula y solicite que se radique.",
    );
    expect(c.map((x) => x.original)).not.toContain("Esta");
    expect(c.map((x) => x.original)).not.toContain("formula");
    expect(c.map((x) => x.original)).not.toContain("radique");
  });

  it("corrige todas las apariciones y respeta la mayúscula inicial", () => {
    const c = revisarOrtografia("Despues fui. despues volví")[0]!;
    expect(aplicarCorreccion("Despues fui. despues volví", c)).toBe("Después fui. después volví");
  });

  it("avisa si el texto no parece una tutela de salud", () => {
    expect(revisarTema(t)?.esTutelaDeSalud).toBe(true);
    const receta = "Ingredientes para la torta: harina, huevos, azúcar y mantequilla. ".repeat(4);
    expect(revisarTema(receta)?.esTutelaDeSalud).toBe(false);
    expect(revisarTema("muy corto")).toBeNull();
  });

  it("la IA también puede marcar que no es una tutela de salud y proponer frases más claras", () => {
    const r = normalizarRedaccion(
      {
        tema: { esTutelaDeSalud: false, observacion: "Es una carta de queja, no una tutela." },
        correcciones: [
          {
            tipo: "redaccion",
            original: "yo pago la salud cumplido todos los meses",
            corregido: "Pago cumplidamente mi afiliación a la salud todos los meses",
            motivo: "más claro",
          },
        ],
        secciones: [],
      },
      t,
      "m",
    );
    expect(r.tema).toEqual({
      esTutelaDeSalud: false,
      observacion: "Es una carta de queja, no una tutela.",
    });
    expect(r.correcciones[0]?.tipo).toBe("redaccion");
  });
});

describe("Texto sin sentido", () => {
  const basura =
    "Quiero comer jandkjwrjknqwknqwkdnqwkemqkwlenqklw jbefbwjelknrfkljwenfrklwendflkenwfklnwefklnweklfnwe wnfklqnwfklqwndfklqnfklnqwfklnwfklnewfknqwkfnwkfnqwklfnkqwnfklqwnfkenfkqwnfklenfknq";

  it("marca las palabras que no parecen español", () => {
    const raras = palabrasNoReconocidas(basura);
    expect(raras.length).toBeGreaterThanOrEqual(3);
    expect(raras.join(" ")).not.toMatch(/Quiero|comer/);
  });

  it("no marca palabras normales de una tutela (incluidas siglas y palabras largas)", () => {
    for (const f of ["tutela-completa.txt", "tutela-incompleta.txt", "tutela-agente-oficioso.txt"])
      expect(palabrasNoReconocidas(leer(f)), f).toEqual([]);
    expect(
      palabrasNoReconocidas(
        "La inconstitucionalidad y la responsabilidad de la EPS con el MIPRES y la construcción del instrumento abstracto.",
      ),
    ).toEqual([]);
  });

  it("si casi todo es texto sin sentido, el tema lo dice", () => {
    expect(revisarTema(basura)?.observacion).toMatch(/no tiene palabras que podamos entender/);
  });
});

describe("Ortografía con diccionario (es-CO)", () => {
  const raiz = path.join(process.cwd(), "public/diccionario");
  const corrector = crearCorrector(
    readFileSync(path.join(raiz, "es-co.aff"), "utf8"),
    readFileSync(path.join(raiz, "es-co.dic"), "utf8"),
  );
  const cambios = (t: string) =>
    revisarConDiccionario(t, corrector).correcciones.map((c) => `${c.original}→${c.corregido}`);

  it("detecta errores de tipeo y propone la palabra correcta", () => {
    const t =
      "Señor juez, cuandow fui a la EPS no me dieron el medicamneto. Ya fui tres beces, tengo dolor de cabesa, el tratamineto es urjente y la negaron sin raxon. Nesecitamos ayuda.";
    expect(cambios(t)).toEqual([
      "cuandow→cuando",
      "medicamneto→medicamento",
      "beces→veces",
      "cabesa→cabeza",
      "tratamineto→tratamiento",
      "urjente→urgente",
      "raxon→razón",
      "Nesecitamos→Necesitamos",
    ]);
  });

  it("no marca palabras correctas de las tutelas de ejemplo (términos médicos, EPS, nombres)", () => {
    for (const f of ["tutela-completa.txt", "tutela-agente-oficioso.txt"]) {
      const r = revisarConDiccionario(leer(f), corrector);
      expect([...r.correcciones.map((c) => c.original), ...r.desconocidas], f).toEqual([]);
    }
    const r = revisarConDiccionario(
      "Presento tutela contra Colpensiones y Famisanar. 2. Colpensiones no responde. Me ordenaron hemodiálisis, adalimumab y una valoración por el reumatólogo en la IPS.",
      corrector,
    );
    expect([...r.correcciones, ...r.desconocidas]).toEqual([]);
  });

  it("aplica la corrección en cada aparición con su mayúscula", () => {
    const t = "Cuandow llegué. Y cuandow volví";
    const c = revisarConDiccionario(t, corrector).correcciones[0]!;
    expect(aplicarCorreccion(t, c)).toBe("Cuando llegué. Y cuando volví");
  });

  it("las palabras sin sentido no tienen corrección y cuentan como no reconocidas", () => {
    const r = revisarConDiccionario("asdkj qwlek zxmcn hola poiuy lkjhg mnbvc asdfg", corrector);
    expect(r.correcciones).toEqual([]);
    expect(r.desconocidas).toContain("asdkj");
    expect(r.noReconocidas / r.revisadas).toBeGreaterThan(0.5);
  });
});

describe("¿Es una tutela de salud? (sin IA)", () => {
  it("las tutelas de ejemplo, aunque estén mal escritas, sí lo son", () => {
    for (const f of ["tutela-completa.txt", "tutela-incompleta.txt", "tutela-agente-oficioso.txt"])
      expect(revisarTema(leer(f))?.esTutelaDeSalud, f).toBe(true);
  });

  it("un texto de otro tema detiene la revisión, aunque diga «solicito», «derecho» o «cita»", () => {
    const colegio =
      "Señor rector, solicito respetuosamente que se revise la nota de mi examen de matemáticas porque considero que tengo derecho a una segunda calificación. El profesor no explicó los temas y la cita que pedí con coordinación nunca me la dieron. Le pido que ordene repetir la evaluación.";
    const tema = revisarTema(colegio);
    expect(tema?.tipo).toBe("otro_tema");
    expect(temaDetieneRevision(tema)).toBe(true);
  });

  it("una tutela que no es de salud solo avisa", () => {
    const pension =
      "Señor Juez Laboral del Circuito de Bogotá. Yo, Pedro Ruiz, presento acción de tutela contra Colpensiones por la vulneración de mis derechos fundamentales al mínimo vital. PRETENSIONES: Solicito ordenar a Colpensiones resolver mi solicitud de pensión en 48 horas.";
    const tema = revisarTema(pension);
    expect(tema?.tipo).toBe("otra_tutela");
    expect(temaDetieneRevision(tema)).toBe(false);
  });

  it("con muchas palabras fuera del diccionario, el texto se marca como sin sentido", () => {
    const t = leer("tutela-completa.txt");
    expect(revisarTema(t, { proporcionDesconocidas: 0.6 })?.tipo).toBe("sin_sentido");
  });
});

describe("Tono formal y frases fuera de lugar", () => {
  const completa = leer("tutela-completa.txt");
  const corte = completa.indexOf("\n\n", completa.length / 2);
  const conGallinas = `${completa.slice(0, corte)} Las gallinas vuelan altos y el cielo es azul pokemon.${completa.slice(corte)}`;

  it("marca una frase sin relación con el caso y la quita limpiamente", () => {
    const [c] = frasesFueraDeLugar(conGallinas);
    expect(c?.original).toBe("Las gallinas vuelan altos y el cielo es azul pokemon.");
    expect(c?.corregido).toBe("");
    expect(aplicarCorreccion(conGallinas, c!)).toBe(completa);
  });

  it("no marca frases de las tutelas de ejemplo (cortesía, firmas, hechos sobre la EPS)", () => {
    for (const f of ["tutela-completa.txt", "tutela-incompleta.txt", "tutela-agente-oficioso.txt"])
      expect(frasesFueraDeLugar(leer(f)), f).toEqual([]);
    expect(
      frasesFueraDeLugar(
        "Colpensiones no ha respondido. Gracias por su atención y que Dios le pague.",
      ),
    ).toEqual([]);
  });

  it("señala lenguaje informal u ofensivo y propone la forma respetuosa cuando la hay", () => {
    const r = revisarFormalidad("Parce, porfa ordénele a esos ladrones de la EPS jajaja!!! 😡");
    expect(r.correcciones.map((c) => `${c.original}→${c.corregido}`)).toEqual(["porfa→por favor"]);
    expect(r.avisos.map((a) => a.fragmento)).toEqual(["jajaja", "Parce", "ladrones", "😡", "!!!"]);
    expect(revisarFormalidad(leer("tutela-completa.txt"))).toEqual({
      correcciones: [],
      avisos: [],
    });
  });

  it("la IA puede pedir quitar un pedazo (formalidad con corregido vacío), pero no la ortografía", () => {
    const r = normalizarRedaccion(
      {
        tema: { esTutelaDeSalud: true, observacion: "" },
        correcciones: [
          {
            tipo: "formalidad",
            original: "Las gallinas vuelan altos",
            corregido: "",
            motivo: "no tiene relación",
          },
          { tipo: "ortografia", original: "cielo", corregido: "", motivo: "x" },
        ],
        secciones: [],
      },
      conGallinas,
      "m",
    );
    expect(r.correcciones).toEqual([
      {
        tipo: "formalidad",
        original: "Las gallinas vuelan altos",
        corregido: "",
        motivo: "no tiene relación",
      },
    ]);
  });
});

describe("Ver la sugerencia en el texto", () => {
  const t = "Despues fui a la EPS. Ya despues volví y despuesito me atendieron.";

  it("encuentra la siguiente aparición y vuelve al inicio al llegar al final", () => {
    const a = buscarAparicion(t, "despues", 0, true)!;
    expect(t.slice(a.inicio, a.fin)).toBe("Despues");
    const b = buscarAparicion(t, "despues", a.fin, true)!;
    expect(b.inicio).toBe(t.indexOf("despues volví"));
    expect(buscarAparicion(t, "despues", b.fin, true)).toEqual(a);
  });

  it("sin «palabra completa» busca el fragmento exacto", () => {
    expect(buscarAparicion(t, "Ya despues volví")?.inicio).toBe(t.indexOf("Ya"));
    expect(buscarAparicion(t, "no está")).toBeNull();
  });
});

describe("Mensajes personales dentro del texto", () => {
  it("encuentra un mensaje de cariño metido en medio de una oración del caso y lo quita", () => {
    const t =
      "3. El 8 de agosto de 2026 radiqué la orden médica ante la EPS con el número de mi amor mio te amo muchísimo Papi\nradicado SV-2026-45871.";
    const [c, ...resto] = revisarFormalidad(t).correcciones;
    expect(resto).toEqual([]);
    expect(c?.original).toBe("mi amor mio te amo muchísimo Papi");
    expect(aplicarCorreccion(t, c!)).toBe(
      "3. El 8 de agosto de 2026 radiqué la orden médica ante la EPS con el número de\nradicado SV-2026-45871.",
    );
  });

  it("«mi papi» solo se cambia por «mi padre» y el trato de «tú» se avisa", () => {
    const r = revisarFormalidad("Mi papi está hospitalizado. Te pido que ordenes la cirugía.");
    expect(r.correcciones.map((c) => `${c.original}→${c.corregido}`)).toEqual(["papi→padre"]);
    expect(r.avisos.map((a) => a.fragmento)).toEqual(["Te"]);
  });
});
