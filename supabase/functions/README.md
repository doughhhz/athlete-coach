# Edge Functions do Personal

`coach-analyze` produz análise estruturada; `coach-propose` gera e persiste uma proposta opcional; `coach-decide` lista decisões e recebe intenção humana de rejeitar ou criar draft. Todas exigem JWT e derivam o atleta da identidade corrente. Escritas no Runtime Coaching Decision Ledger usam service role somente dentro das functions; materialização permanece na RPC transacional e nunca ativa o draft.

Secrets são fornecidos pelo ambiente do Supabase e nunca enviados ao mobile ou versionados. `.env.example` contém somente placeholders. Corpos são limitados, erros são normalizados e nenhum endpoint aceita `athlete_id`, patch genérico ou mutation sugerida diretamente pelo modelo.

## Resolução de módulos (Deno)

As functions importam os packages do monorepo (`packages/*/src`). O runtime Deno resolve `@athlete-coach/domain`, `@athlete-coach/application`, `@supabase/supabase-js` e `zod` pelo import map `deno.json` desta pasta, configurado por function em `supabase/config.toml` (`import_map = "./functions/deno.json"`). Imports relativos nos packages devem ter extensão `.ts`. Ao adicionar um novo especificador de workspace usado pelas functions, inclua-o no import map.

Validação local: `node scripts/run-supabase.mjs functions serve` e requests HTTP; sem `GEMINI_API_KEY` as functions de IA respondem `503 coach_unavailable` após autenticar.
