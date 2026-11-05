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

# Architecture rules

- Backend is an external FastAPI REST API; never add Lovable Cloud/Supabase, server functions or a local database — the API is the single source of truth.
- All HTTP calls go through `src/lib/api.ts` (no `fetch` in components) — keeps auth headers, 401 refresh-and-retry and error parsing in one place.
- Access token lives only in module memory in `src/lib/api.ts`; never write it to localStorage/sessionStorage/cookies — the refresh token is an httpOnly cookie, so every call uses `credentials: "include"`.
- Data fetching is client-side only (`useQuery`/`useMutation`), not route loaders — the session is in browser memory, so SSR has no credentials and relative `/api` URLs don't resolve on the server.
- Route protection is the client-side `Protegido` component, not `beforeLoad` — same reason: auth state exists only after the AuthProvider restores the session in the browser.
- API base is `VITE_API_URL` or `/api`; dev server proxies `/api` to `http://localhost:8000` (vite.config.ts).
- Request/response field names not yet confirmed against the API's Swagger are marked `CONFIRMAR NO SWAGGER` in `src/lib/api.ts`; adapt shapes there (and in `src/lib/dominio.ts` helpers), not in components.
- Routing uses TanStack Router file routes (the spec's "React Router" is replaced by it); manager pages live under `src/routes/gestor.*`.
- UI text is Brazilian Portuguese; API error messages are shown verbatim.
