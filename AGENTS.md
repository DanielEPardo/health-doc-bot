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
