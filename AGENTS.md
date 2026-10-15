<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use Clerk as the only owner of visitor authentication; Cloud serves configuration but does not own these sessions.
- Load one browser Clerk instance from Clerk's hosted browser script and reuse it in the provider and /revision beforeLoad guard; this prevents initial-session races and avoids bundling Clerk's browser runtime into the development optimizer.
- Private server functions (AI review, history, documents) must verify the Clerk token with usuarioDeLaSolicitud() in src/lib/sesion.server.ts and only touch rows of that user.
- Keep the landing as one scrolling public route, with separate account and data-policy routes, because the requested experience is explicitly one page without navigation. The only header addition is the signed-in profile icon (src/components/menu-cuenta.tsx → /perfil, /mis-tutelas).
- Account deletion must also delete the user's history: /api/clerk-webhook (user.deleted, Svix signature with CLERK_WEBHOOK_SECRET). Revoking the history authorization in /perfil deletes saved tutelas too.
- Define visual roles and reusable presentation rules in src/styles.css and use design-system controls for actions.
- The tutela validator lives in src/lib/validador/ (pure TypeScript, client-safe; legal basis in docs/validador/). Each rule cites its sources in src/lib/validador/normativa/fuentes.ts; keep rules deterministic and keep the AI extractors (extraccion/gemini.server.ts, extraccion/ia.server.ts, servidor.server.ts) server-only. Anything sent to an external AI must go through anonimizar() first and requires the user's explicit consent (bot authorization message / web checkbox), because the Gemini free tier may use content to improve Google products. The web AI review (src/lib/revision-ia.functions.ts) must keep verifying the Clerk session with src/lib/clerk-verificar.server.ts. The AI legal analysis (src/lib/validador/analisis/juridico.ts) is complementary: it never changes dictamen or puntaje and may only cite sources from fuentes.ts; the AI legal notice lives in src/lib/validador/aviso-ia.ts and must be shown before consent in every channel.
- UI changes should keep the Nielsen heuristics fixes documented in docs/usabilidad/evaluacion-heuristica-nielsen.md (plain-language rule titles, visible status, undo, Spanish error pages with recovery actions).
- /revision runs the validator in the browser (src/components/revision-web.tsx); PDFs of the tutela are read in the browser (src/lib/pdf.ts). Text leaves the device only with explicit consent: AI review (anonymized), history (encrypted with HISTORIAL_CLAVE, src/lib/historial/) or document reading (separate agreement in src/lib/acuerdos.ts, never with the free Gemini tier — see proveedorDocumentosDesdeEntorno). Bump the agreement version if its text changes. Toggle the web review with REVISION_WEB_HABILITADA in src/lib/revision-access.ts.
- Document questions (cuestionario) never receive files; rules D01–D05 (src/lib/validador/reglas/documentos.ts) only run when answers exist, so reviews without answers stay unchanged.
- /api/whatsapp is the WhatsApp Cloud API webhook (src/lib/whatsapp/bot.server.ts). It authenticates every POST with Meta's X-Hub-Signature-256 (Web Crypto, Cloudflare-compatible), must ask for explicit sensitive-data consent (Ley 1581) before receiving a tutela, and must never persist the tutela text or extracted personal data — only ResumenRevision.
- /api/public/twilio/whatsapp is the Twilio WhatsApp (Sandbox) channel for the same bot (src/lib/whatsapp/twilio.server.ts): it verifies X-Twilio-Signature with TWILIO_AUTH_TOKEN, reuses procesarMensaje and the store, and sends through the Twilio connector gateway; PDFs are downloaded from MediaUrl0 (twilio.com only) with TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN; the Meta route stays as an alternative channel.
- /api/public/whatsapp/evolution is the Evolution API (WhatsApp via QR, real Colombian number) channel (src/lib/whatsapp/evolution.server.ts): it authenticates with the shared EVOLUTION_WEBHOOK_TOKEN (?token= or x-webhook-token), ignores own/group messages, reuses procesarMensaje and the store, and replies via Evolution's sendText; PDFs are fetched with /chat/getBase64FromMediaMessage and read with src/lib/pdf.ts; it is the preferred channel, Twilio and Meta stay as alternatives.
- Legal pages (/politica-de-datos, /terminos) share src/components/legal/pagina-legal.tsx and the responsible-party data in src/lib/datos-responsable.ts. If a feature changes what data is collected or who processes it, update those pages and bump the version in src/lib/acuerdos.ts so users accept again.
- There is no cookie policy page or cookie banner (team decision, 2026-10-15). The data policy's «Datos técnicos» item states what is used: Clerk session data and Lovable's visit measurement on the hosted site. Clerk telemetry is disabled (clerk-browser.ts, clerk-boundary.tsx).
- Keep src/test/accesibilidad.test.tsx passing (axe-core WCAG 2.1 AA, alt text on every <img>).

