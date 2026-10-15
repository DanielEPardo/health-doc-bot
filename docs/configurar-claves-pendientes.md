# Configurar las claves pendientes de TuTelaGanas

**Para:** Daniel (dueño del proyecto en Lovable y de la cuenta de Clerk)
**Contexto:** ya se hizo el merge del PR #1 (documentos, PDF, historial, perfil y documentos legales). Para que todo funcione en la página publicada faltan **tres secretos** en Lovable, aplicar **una migración** y **publicar**.

> ⚠️ **Nunca pegues el valor de una clave en un chat, en un commit, en WhatsApp ni en un documento compartido.** Los secretos solo van en Lovable → Cloud → Secrets.

---

## Resumen

| # | Secreto | De dónde sale | ¿Quién? | Si falta… |
|---|---|---|---|---|
| 1 | `HISTORIAL_CLAVE` | Se genera con un comando | Gabriela ya la tiene; revisa si ya está en la lista | No aparece «Guardar en mi historial» |
| 2 | `CLERK_WEBHOOK_SECRET` | Dashboard de Clerk (webhook nuevo) | **Daniel** (la cuenta de Clerk es suya) | Si alguien elimina su cuenta, su historial no se borra |
| 3 | `TWILIO_ACCOUNT_SID` | Consola de Twilio | Quien tenga la cuenta de Twilio | El bot de Twilio no lee PDF (Evolution y Meta sí) |

Orden recomendado: **migración → secretos → publicar → probar**.

---

## 0. Cómo agregar un secreto en Lovable (sirve para los tres)

1. Abre el proyecto **Tutela Clara** en Lovable.
2. En la barra de arriba del panel derecho están los íconos: 🌐 Preview · 📄 · `</>` Code · **capas (Cloud)**. Haz clic en el de **capas**.
3. En el menú lateral de Cloud, entra a **Secrets** (ícono de llave).
4. Sube hasta arriba de la lista y presiona **Add secret** (o «New secret»).
5. **Name:** el nombre exacto, en mayúsculas y con guion bajo (por ejemplo `CLERK_WEBHOOK_SECRET`).
6. **Value:** pega el valor (Cmd + V), sin espacios antes ni después.
7. Guarda. El secreto aparece en la lista. Lovable nunca vuelve a mostrar el valor, y eso es normal.

> Lovable avisa: *«Changing a secret applies immediately in preview, but requires publish to apply on the live app.»* Después de agregar los secretos hay que **publicar** (paso 5).

Otra opción: escribirle al chat de Lovable «Agrega un secreto llamado `NOMBRE`» y pegar el valor **en el formulario seguro que aparece**, nunca en el mensaje.

---

## 1. Migración de la base de datos (si no se ha hecho)

Crea las tablas `tutelas` (historial cifrado) y `consentimientos_web` (aceptación de términos y autorizaciones), y ajusta `conversaciones` para el bot.

1. Revisa en Cloud → **Database** si ya existen las tablas `tutelas` y `consentimientos_web`. Si existen, pasa al paso 2.
2. Si no existen, escríbele esto al chat de Lovable, tal cual:

   > Aplica la migración `supabase/migrations/20261011120000_historial_tutelas.sql` en la base de datos de Lovable Cloud. Solo aplica esa migración: no cambies ningún archivo del código.

3. Si Lovable pide aprobar la ejecución del SQL, apruébala.
4. **Comprobar:** en Cloud → Database aparecen `tutelas` y `consentimientos_web`.

La migración se puede aplicar dos veces sin problema: usa `if not exists`.

---

## 2. `HISTORIAL_CLAVE`: cifra las tutelas guardadas

**Qué es:** una contraseña aleatoria de 32 bytes (44 caracteres en base64) con la que el servidor cifra el texto de las tutelas antes de guardarlo.

**Primero revisa la lista de Secrets.** Gabriela ya generó una y puede que ya la haya agregado. **Si `HISTORIAL_CLAVE` ya aparece, no hagas nada: no la cambies ni la generes de nuevo.**

Si no aparece:

- **Opción A (recomendada):** pídele a Gabriela que la agregue ella. La tiene respaldada en su computador.
- **Opción B:** generarla tú. Abre la Terminal y corre:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
  Copia el resultado (algo como `k3J9…Qw=`), agrégalo en Lovable como `HISTORIAL_CLAVE` y **guárdalo en un lugar seguro** (gestor de contraseñas). Avísale a Gabriela para que borre la suya y no queden dos distintas.

> ⚠️ **Muy importante:**
> - Si esta clave **se pierde o se cambia**, las tutelas que ya estén guardadas **no se pueden volver a leer**.
> - Debe haber **una sola**. No generes otra si ya existe.

**Comprobar:** después de publicar, inicia sesión, ve a «Revisar mi tutela» y debe aparecer la opción **«Guardar en mi historial»**.

---

## 3. `CLERK_WEBHOOK_SECRET`: borrar el historial al eliminar una cuenta

**Qué es:** cuando una persona elimina su cuenta (Mi perfil → Seguridad), Clerk avisa a nuestro servidor, que borra sus tutelas guardadas (derecho de supresión, Ley 1581). El secreto sirve para comprobar que el aviso viene de verdad de Clerk.

### 3.1 Encontrar la aplicación correcta en Clerk

1. Entra a **https://dashboard.clerk.com** con tu cuenta.
2. Abre la aplicación del proyecto. Para estar seguro de que es la correcta, ve a **Configure → API keys** (o **Domains**). Debe decir:
   - **Frontend API URL:** `https://grand-wasp-2964.clerk.accounts.dev`
   - **Publishable key** que empieza por `pk_test_Z3JhbmQtd2FzcC0yOTY0`
3. Aprovecha y en **Settings** cambia el nombre de la aplicación de «My Application» a **TuTelaGanas** (es el nombre que ven los usuarios al iniciar sesión).

### 3.2 Crear el webhook

1. En el menú lateral de la aplicación: **Configure → Webhooks**.
2. Presiona **Add Endpoint**.
3. **Endpoint URL:**
   ```
   https://health-doc-bot.lovable.app/api/clerk-webhook
   ```
4. **Subscribe to events:** busca y marca **solo** `user.deleted`.
5. Presiona **Create**.

### 3.3 Copiar el secreto y ponerlo en Lovable

1. En la página del endpoint recién creado, busca **Signing Secret** (a la derecha). Presiona el ojo para verlo o el ícono de copiar.
2. Empieza por **`whsec_`**. Cópialo completo.
3. En Lovable → Cloud → Secrets → **Add secret**:
   - **Name:** `CLERK_WEBHOOK_SECRET`
   - **Value:** el `whsec_…` que copiaste.

### 3.4 Comprobar (después de publicar)

1. En Clerk, en el endpoint, abre la pestaña **Testing**.
2. Elige el evento `user.deleted` y presiona **Send Example**.
3. En **Message Attempts** debe aparecer con estado **200 / Succeeded**.
   - **401:** el secreto en Lovable no coincide con el de Clerk. Vuelve a copiarlo.
   - **500 «Server configuration error»:** falta `CLERK_WEBHOOK_SECRET` en Lovable o no se publicó después de agregarlo.
   - **404:** no se ha publicado la versión con el merge.

---

## 4. `TWILIO_ACCOUNT_SID`: leer PDF que lleguen por Twilio

**Qué es:** el identificador de la cuenta de Twilio. Junto con `TWILIO_AUTH_TOKEN` (que ya está en Lovable) permite descargar el PDF que una persona envía por el WhatsApp de Twilio. **Solo hace falta si usan Twilio.** Evolution (QR) y Meta leen PDF sin él.

1. Entra a **https://console.twilio.com** con la cuenta que se usó para el bot (la del sandbox de WhatsApp).
2. En la página principal (**Account Dashboard**), en el recuadro **Account Info**, está **Account SID**.
   - Empieza por **`AC`** y tiene 34 caracteres.
   - Usa el de la cuenta normal, **no** el de «Test Credentials».
3. Presiona el ícono de copiar.
4. En Lovable → Cloud → Secrets → **Add secret**:
   - **Name:** `TWILIO_ACCOUNT_SID`
   - **Value:** el `AC…` que copiaste.

**Comprobar (después de publicar):** por el WhatsApp de Twilio escribe *Hola → ACEPTO → OMITIR* y envía un PDF de una tutela de prueba. El bot debe responder **«📄 Leí tu PDF…»**. Si responde «No pude abrir ese PDF», revisa que el SID sea el correcto y que se haya publicado.

---

## 5. Publicar

1. Arriba a la derecha en Lovable, presiona el botón azul de **Publish / Update**.
2. Confirma la publicación.
3. La página pública es **https://health-doc-bot.lovable.app**.

---

## 6. Lista de comprobación final

Usa siempre la tutela **ficticia** de `src/test/fixtures/tutela-completa.txt`, **nunca datos reales**.

- [ ] Al iniciar sesión aparece la ventana **«Antes de continuar»** para aceptar los términos (esto confirma que la migración está bien).
- [ ] En /revision aparece **«Guardar en mi historial»** y, al aceptar y escribir, dice **«Guardada en tu historial»** (confirma `HISTORIAL_CLAVE`).
- [ ] La tutela aparece en **Mis tutelas** y se puede continuar.
- [ ] **Mi perfil → Mis datos** muestra las autorizaciones con fecha.
- [ ] Clerk → Webhooks → Testing → `user.deleted` da **200** (confirma `CLERK_WEBHOOK_SECRET`).
- [ ] Por Twilio, un PDF responde **«Leí tu PDF»** (confirma `TWILIO_ACCOUNT_SID`, solo si usan Twilio).

## Si algo falla

- Errores del servidor: Lovable → Cloud (capas) → **Logs**. Copia el mensaje completo y compártelo con el equipo (revisa que no tenga datos personales).
- Más detalles técnicos: `INTEGRACION.md` en la raíz del repositorio.
