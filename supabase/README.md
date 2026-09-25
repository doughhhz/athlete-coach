# Supabase local

Infraestrutura local oficial. `config.toml` define a stack, `migrations/` é a fonte versionada do schema, `tests/` contém pgTAP e `seed.sql` permanece sem dados pessoais. A Phase 3 acrescenta perfil, objetivo, contexto, disponibilidade, histórico de peso e RPCs transacionais. Não existe projeto remoto vinculado.

Da raiz do repositório:

```powershell
npm run supabase:start
npm run db:reset
npm run db:test
npm run db:types
npm run supabase:stop
```

Docker Desktop deve estar executando. Os wrappers usam a CLI local fixada no lockfile e uma pasta temporária ignorada em `.cache/`.
