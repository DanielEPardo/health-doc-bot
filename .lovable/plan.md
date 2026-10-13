# Guía: número de prueba de WhatsApp sin verificar el negocio

Para un trabajo universitario no hace falta verificar ningún negocio. Meta da un número de prueba gratis.

## Pasos en Meta (los haces tú)
1. Entra a developers.facebook.com → **My Apps → Create App**.
2. Caso de uso: **"Other"**. Después elige el tipo **Business**.
3. Cuando te pida un **portafolio comercial**, crea uno nuevo con tu nombre (por ejemplo "TuTelaGanas – Proyecto universitario"). No le des a "Verificar": no hace falta para las pruebas.
4. Dentro de la app, agrega el producto **WhatsApp → Set up**.
5. Ve a **WhatsApp → API Setup**. Ahí vas a ver:
   - Un **número de prueba** (de Meta)
   - El **Phone number ID**
   - Un **token temporal**, que dura 24 horas
6. En "To", agrega y confirma con código hasta **5 celulares** (el tuyo y los del profesor o tu grupo).
7. Para un token que no caduque: **Business Settings → System users → Add** (rol Admin) → asigna la app → **Generate token** con permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
8. **App settings → Basic → App secret**: cópialo.

Si en el paso 3 o 4 Meta insiste en la verificación, avísame y usamos el conector de WhatsApp de Lovable.

## Lo que hago yo después de que apruebes
1. Te pido los 4 datos en el formulario seguro: token, Phone number ID, App secret y una palabra de verificación que tú inventas.
2. Publicamos la app y te doy la dirección del webhook (`https://health-doc-bot.lovable.app/api/whatsapp`) y la palabra para pegarlas en **WhatsApp → Configuration**, y te suscribes a "messages".
3. Aplico las tablas del bot en la base de datos, si todavía no están.
4. Cambio el número del botón "Abrir WhatsApp" al número de prueba (o lo dejamos igual si prefieres).
5. Probamos juntos: "Hola" → autorización → "ACEPTO" → tutela de ejemplo → "REVISAR".

## Limitación
El número de prueba solo responde a los 5 celulares registrados. Alcanza para una demostración, pero no para el público en general.
