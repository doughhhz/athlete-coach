# Architecture tests

Verificações automatizadas de boundaries. O teste da Phase 2 impede imports diretos de `@supabase/*` e chamadas `.from(...)` dentro da apresentação mobile. Novas regras devem refletir decisões canônicas e evitar falsos substitutos para testes de integração reais.
