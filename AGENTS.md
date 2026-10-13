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
- /revision contains only a WhatsApp handoff, not private server data; any future private server handler must independently verify a Clerk token.
- Keep the landing as one scrolling public route, with separate account and data-policy routes, because the requested experience is explicitly one page without navigation.
- Define visual roles and reusable presentation rules in src/styles.css and use design-system controls for actions.
- The tutela validator lives in src/lib/validador/ (pure TypeScript, client-safe; legal basis in docs/validador/). Each rule cites its sources in src/lib/validador/normativa/fuentes.ts; keep rules deterministic and keep the AI extractors (extraccion/gemini.server.ts, extraccion/ia.server.ts, servidor.server.ts) server-only. Anything sent to an external AI must go through anonimizar() first and requires the user's explicit consent (bot authorization message / web checkbox), because the Gemini free tier may use content to improve Google products. The web AI review (src/lib/revision-ia.functions.ts) must keep verifying the Clerk session with src/lib/clerk-verificar.server.ts.
- UI changes should keep the Nielsen heuristics fixes documented in docs/usabilidad/evaluacion-heuristica-nielsen.md (plain-language rule titles, visible status, undo, Spanish error pages with recovery actions).
- /revision runs the validator in the browser (src/components/revision-web.tsx) so the tutela text never leaves the device; toggle with REVISION_WEB_HABILITADA in src/lib/revision-access.ts.
- /api/whatsapp is the WhatsApp Cloud API webhook (src/lib/whatsapp/bot.server.ts). It authenticates every POST with Meta's X-Hub-Signature-256 (Web Crypto, Cloudflare-compatible), must ask for explicit sensitive-data consent (Ley 1581) before receiving a tutela, and must never persist the tutela text or extracted personal data — only ResumenRevision.
- /api/public/twilio/whatsapp is the Twilio WhatsApp (Sandbox) channel for the same bot (src/lib/whatsapp/twilio.server.ts): it verifies X-Twilio-Signature with TWILIO_AUTH_TOKEN, reuses procesarMensaje and the store, and sends through the Twilio connector gateway; the Meta route stays as an alternative channel.
