# Bot de TuTelaGanas con Twilio WhatsApp Sandbox

Objetivo: que el bot de revisión funcione por WhatsApp para la demostración universitaria, sin verificar ningún negocio en Meta.

## Lo que haces tú en Twilio (5 minutos)
1. Crea una cuenta gratis en twilio.com y confirma tu correo y tu celular.
2. Consola → **Messaging → Try it out → Send a WhatsApp message**. Ahí verás el número del Sandbox (+1 415 523 8886) y tu palabra clave ("join xxxx-yyyy").
3. Desde tu celular, envía esa palabra clave al número. Igual cada persona que vaya a probar.

## Lo que hago yo
1. **Conectar Twilio** al proyecto con el conector de Lovable (aparece una tarjeta para pegar tus datos de Twilio). Además te pido el **Auth Token** en el formulario seguro, para comprobar que cada mensaje viene de verdad de Twilio.
2. **Nueva dirección para recibir mensajes:** `/api/public/twilio/whatsapp`. Recibe el formato de Twilio, comprueba la firma de Twilio y pasa el texto al mismo bot que ya existe: pide la autorización de datos (Ley 1581), recibe la tutela en partes, responde con "REVISAR", aplica los comandos AYUDA, NUEVA y BORRAR, no guarda el texto y solo guarda el resumen.
3. **Responder** a través de Twilio en lugar de Meta. La lógica del bot no cambia: solo cambia la forma de enviar.
4. **Evitar respuestas dobles** si Twilio reintenta, con el identificador del mensaje (se reutiliza la tabla de mensajes procesados).
5. **Botón "Abrir WhatsApp"** en /revision: apuntará al número del Sandbox, con el texto "join xxxx-yyyy" ya escrito. Así quien lo pruebe se une con un toque. Un ajuste lo activa y se puede volver al número colombiano después.
6. **Política de datos:** agregar a Twilio como encargado.
7. Publicar y darte la dirección para pegarla en Twilio → Sandbox settings → "When a message comes in".
8. Probar juntos: join → "Hola" → ACEPTO → tutela de ejemplo → REVISAR.

## Qué no cambia
La conexión directa con Meta se queda en el código, apagada. Si después verifican un negocio, se puede activar sin rehacer el bot.

## Detalles técnicos
- Las solicitudes de Twilio llegan como `application/x-www-form-urlencoded` (`From=whatsapp:+57...`, `Body`, `MessageSid`). Firma: `X-Twilio-Signature` = HMAC-SHA1 en base64 de la URL completa más los parámetros ordenados, verificada con Web Crypto (compatible con Cloudflare) y el secreto `TWILIO_AUTH_TOKEN`. Respuesta 403 si la firma no es válida.
- Envío: POST `/Messages.json` por el gateway del conector, con `From=whatsapp:+14155238886` y `To=whatsapp:+57...`. El número del Sandbox va en el secreto `TWILIO_WHATSAPP_FROM`.
- Separar el envío de `bot.server.ts` en una interfaz `Transporte` con dos versiones (Meta, Twilio). `procesarMensaje` no cambia.
- Responder 200 con TwiML vacío y enviar la respuesta por la API (la revisión con IA puede tardar).
- Pruebas: firma válida e inválida, conversión del formulario de Twilio al mismo flujo del bot, MessageSid duplicado ignorado.
