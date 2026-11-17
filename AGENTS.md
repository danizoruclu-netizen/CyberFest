<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- App shell (sidebar, top bar, mobile drawer + bottom tabs) lives in `src/components/layout` and wraps `<Outlet />` in `__root.tsx`; nav entries come only from `nav-items.ts` so every menu stays in sync.
- Shared UI building blocks live in `src/components/common`; pages compose them instead of restyling inline, keeping the design system consistent.
- All colors, gradients, glass and glow effects are tokens/utilities in `src/styles.css`; components never hardcode colors.
- Media analysis calls go through `src/lib/deepfake/api.ts` (POST `{VITE_TRUTHGUARD_API_URL}/analyze/image|video`, multipart `file`); an unset or unreachable backend yields Demo Mode with no result, and responses pass through `parseAnalysisResponse`, which rejects anything without a valid TruthScore — so results are never guessed.
- Video (src/lib/video) and URL (src/lib/url) analysis reuse the deepfake API base URL and Demo Mode contract: parsers reject reports without a verdict/trust score, so nothing is guessed.
