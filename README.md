# Tutela Clara

Crea una landing page de una sola página, en español, para [NOMBRE DEL PRODUCTO], un servicio que revisa por WhatsApp si una tutela de salud ya redactada tiene lo que el juez necesita. El público son personas en Colombia que van a presentar una tutela contra su EPS y no saben si la suya está bien hecha. Muchas no dominan la tecnología, así que todo debe ser claro, de letra grande, con mucho contraste y pocas palabras.

REGLAS DE DISEÑO
- Tono sobrio, cálido y confiable. Nada de estética "startup de IA" ni exceso de efectos.
- Paleta calmada (azules o verdes suaves sobre fondo blanco). Tipografía legible, mínimo 18px en el texto.
- Mobile-first: la mayoría entrará desde el celular.
- Un solo CTA en toda la página: botón verde "Revisar mi tutela" que lleva al registro/ingreso con Clerk (usa <SignUpButton> / <SignInButton> o las rutas /sign-up y /sign-in). Aparece arriba (above the fold), a mitad de página y al final. No agregues otros botones ni menús de navegación.

AUTENTICACIÓN (Clerk)
- Usa Clerk para registro e ingreso en una sola pantalla simple.
- Métodos habilitados: número de celular (código por SMS) y Google. Sin contraseñas complicadas ni formularios largos.
- Interfaz de Clerk en español (localización es-ES) y con la misma paleta de la landing.
- Pide solo lo mínimo: no solicites nombre completo, documento ni datos de salud al registrarse.
- Crea una página protegida /revision, visible solo con sesión iniciada. Debe tener una explicación breve de los pasos y un botón "Abrir WhatsApp" que abra https://wa.me/[NUMERO]?text=Hola,%20quiero%20revisar%20mi%20tutela. Si el usuario no ha iniciado sesión, redirígelo a /sign-in.

SECCIONES DE LA LANDING (en este orden)

1. HERO
Titular: "Antes de presentar tu tutela, revisa que no le falte nada"
Subtítulo: "Envíanos tu tutela por WhatsApp y te decimos qué puntos le faltan o están débiles, para que los corrijas antes de entregarla al juzgado."
Botón: "Revisar mi tutela"
Debajo del botón, texto pequeño: "Crea tu cuenta en un minuto. Es una revisión orientativa, no reemplaza a un abogado."

2. EL PROBLEMA
Título: "Una tutela con errores puede retrasarte o ser devuelta"
Texto: "Cuando tu EPS te niega o demora un servicio de salud, la tutela es una herramienta válida. Pero si falta información clave, el juez puede pedirte corregirla o rechazarla, y mientras tanto tu tratamiento sigue esperando."

3. CÓMO FUNCIONA (3 pasos con íconos simples)
1. "Crea tu cuenta" - Con tu celular o Google, en menos de un minuto.
2. "Escríbenos por WhatsApp" - Desde tu cuenta, abre el chat con un clic y envía el texto de tu tutela.
3. "Recibe la revisión" - Te indicamos qué puntos cumple, cuáles no y qué corregir.

[Botón "Revisar mi tutela" a mitad de página]

4. QUÉ REVISAMOS (lista corta, lenguaje simple)
- Que quede claro quién presenta la tutela y contra qué entidad.
- Que los hechos estén explicados de forma ordenada.
- Que se identifique qué derecho se está vulnerando (salud, vida, etc.).
- Que haya soportes: orden médica, negación de la EPS, otros documentos.
- Que la tutela sea el camino adecuado en tu caso.
Nota al pie: "La revisión se basa en el Decreto 2591 de 1991 y en jurisprudencia de la Corte Constitucional."

5. LO QUE NO HACEMOS (sección de transparencia, tono honesto, no como letra pequeña)
Título: "Qué debes saber antes de usarlo"
- "No redactamos la tutela por ti: tú sigues siendo quien la escribe y la firma."
- "No garantizamos que el juez falle a tu favor."
- "No reemplazamos a un abogado. Si tu caso es complejo, consulta uno."
- "Tus datos de salud son sensibles: al registrarte solo guardamos [celular/correo] para identificar tu cuenta. El contenido de tu tutela se usa únicamente para la revisión y no se comparte con terceros."
Enlace discreto a "Política de tratamiento de datos".

6. PREGUNTAS FRECUENTES (acordeón, 5 preguntas)
- ¿Cuesta algo? [Sí, pero menos que una consulta a abogados] (Sugerencia, no textual)
- ¿Por qué debo crear una cuenta? "Para identificar tu revisión y mantener tu información protegida. Solo te pedimos tu celular o tu cuenta de Google."
- ¿Quién ve mi información? "Solo usamos tu celular o correo para identificar tu cuenta, y el texto de tu tutela únicamente para hacer la revisión. No lo compartimos con terceros."
- ¿Sirve si todavía no he escrito mi tutela? [No, se necesita una base que el sistema pueda retroalimentar] (Sugerencia, no textual)
- ¿Reemplaza a un abogado? "No. Es una revisión orientativa de requisitos. Si tu caso es complejo, te recomendamos consultar a un abogado."

7. CTA FINAL
Titular: "Revisa tu tutela antes de presentarla"
Botón: "Revisar mi tutela"

8. FOOTER
Nombre del proyecto, correo de contacto, enlace a política de datos. Sin redes sociales por ahora.

NO INCLUIR
- Testimonios, cifras o logos inventados.
- Promesas como "gana tu tutela", "garantizado" o "100% efectivo".
- Frases sobre "inteligencia artificial" en el titular; la IA no es lo que le importa al usuario.
- Menús de navegación, banners o pop-ups.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://health-doc-bot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f4598038-3e43-4813-8853-247394501d6b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
