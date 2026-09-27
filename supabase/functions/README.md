# Edge Functions do Personal

`coach-analyze` produz análise estruturada; `coach-propose` gera e persiste uma proposta opcional; `coach-decide` lista decisões e recebe intenção humana de rejeitar ou criar draft. Todas exigem JWT e derivam o atleta da identidade corrente. Escritas no Runtime Coaching Decision Ledger usam service role somente dentro das functions; materialização permanece na RPC transacional e nunca ativa o draft.

Secrets são fornecidos pelo ambiente do Supabase e nunca enviados ao mobile ou versionados. `.env.example` contém somente placeholders. Corpos são limitados, erros são normalizados e nenhum endpoint aceita `athlete_id`, patch genérico ou mutation sugerida diretamente pelo modelo.
