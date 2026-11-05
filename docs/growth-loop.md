# Growth loop — «comparte y gana revisiones»

> **El loop en una frase:** el usuario comparte un enlace de invitación por WhatsApp; cuando un
> invitado completa su primera revisión, el usuario gana 2 revisiones gratis.

## Los cuatro pasos, y dónde vive cada uno en el código

| Paso | Qué pasa | Código |
|---|---|---|
| 1. El usuario hace… | Se queda sin revisiones con IA y pulsa **«Comparte y gana revisiones»** | `src/components/compartir-referido.tsx` (el muro aparece con `sinSaldo`) |
| 2. Eso produce… | Un mensaje de WhatsApp con su enlace único, **sin ningún dato de su caso** | `mensajeInvitacion()` en `src/lib/referidos/tipos.ts` |
| 3. Otra persona ve… | El mensaje y abre el enlace `…/r/<codigo>` | `src/routes/r.$codigo.tsx` |
| 4. Esa persona entra y… | Se registra y completa su primera revisión → quien invitó recibe 2 revisiones | `acreditarPrimeraRevision()` en `src/lib/referidos/almacen.server.ts` |

## La métrica

**Invitados que completan su primera revisión ÷ usuarios activos**, en una ventana de **7 días**.

- *Numerador:* cuentas con `invitado_por` distinto de nulo cuya `primera_revision_en` cae en la ventana.
- *Denominador:* cuentas con al menos una revisión con IA en la ventana (tabla `revisiones_ia`).
- **Umbral declarado antes de desplegar: 0.30.**

Se ve en **`/metricas`** (solo para los usuarios de `ADMIN_USER_IDS`). La página muestra la frase
lista para el entregable: «umbral 0.3, obtuvimos 0.1», junto con el numerador y el denominador por
separado, para poder decir si el número salió bajo por falta de invitaciones o por falta de
activación.

> Si el loop lleva pocos días arriba, reporta también cuántos días lleva: la ventana es de 7 y un
> número calculado al segundo día no es comparable con el umbral.

## Reglas y por qué

- **El premio se paga con la primera revisión del invitado, no con su registro.** Registrarse es
  gratis y fácil de inflar; completar una revisión es señal de uso real. Por eso el numerador de la
  métrica es el mismo evento que dispara el premio.
- **La atribución solo ocurre al crear la cuenta.** Una cuenta que ya existía no puede quedar
  atribuida después, así nadie reclama usuarios que ya estaban.
- **Nadie se invita a sí mismo:** se compara el dueño del código con el usuario que se registra, y
  la base de datos lo refuerza con `constraint sin_auto_referido`.
- **El premio se entrega exactamente una vez por invitado:** `acreditar_primera_revision` solo
  devuelve `true` la primera vez (actualización atómica sobre `primera_revision_en`).
- **El saldo no se puede gastar dos veces:** `consumir_credito` descuenta solo si queda saldo, en una
  sola sentencia; dos pestañas no pueden gastar el mismo crédito.
- **Si la IA no llega a responder, no se cobra.** Cuando la extracción cae a la heurística, el
  crédito se devuelve (`origenExtraccion` sin `ia`).
- **El enlace no filtra nada.** El mensaje de WhatsApp es un texto fijo más el código; quien invita
  solo llega a saber *cuánta* gente entró, nunca quién ni qué le pasa.

## Qué cuesta y qué sigue gratis

| | Antes | Ahora |
|---|---|---|
| Revisión en el navegador (heurística, 26 reglas) | Gratis, ilimitada | **Igual: gratis e ilimitada** |
| Revisión con IA (Gemini) | Sin límite real | 1 al registrarse, +2 por cada invitado que revise |

La revisión local sigue intacta a propósito: el muro no puede dejar a nadie sin su revisión, porque
el producto existe para que la gente no presente mal una tutela.

## Puesta en marcha

1. **Base de datos.** Aplica `supabase/migrations/20261105120000_growth_loop_referidos.sql` en
   Lovable Cloud (en el chat de Lovable: «aplica esta migración», igual que se hizo con las
   anteriores). Crea `cuentas` y `revisiones_ia` y las funciones `consumir_credito`,
   `sumar_creditos`, `acreditar_primera_revision` y `metricas_loop`.
2. **Variable opcional.** `ADMIN_USER_IDS` = ids de Clerk separados por comas, para que esas cuentas
   puedan ver `/metricas`. Sin la variable, las métricas solo se ven en desarrollo local.
3. **Nada más.** El resto funciona con las variables que ya existen (`CLERK_PUBLISHABLE_KEY`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`).

### En local, sin base de datos

Sin `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, el loop guarda todo en `.datos-local/referidos.json`
(ignorado por git) y funciona igual. En producción, en cambio, que falte esa configuración es un
error y no un silencio: `crearAlmacenReferidos()` lanza si `NODE_ENV=production`.

## Ajustes

Los números del loop están en un solo sitio, `src/lib/referidos/tipos.ts`:

```ts
export const CREDITOS_INICIALES = 1;      // revisiones con IA al registrarse
export const CREDITOS_POR_REFERIDO = 2;   // lo que gana quien invita
export const UMBRAL_LOOP = 0.3;
export const VENTANA_DIAS = 7;
```

Si subes `CREDITOS_INICIALES` el muro llega más tarde y habrá menos invitaciones dentro de la
ventana; si lo bajas, más gente se topa con el muro antes de entender el producto.
