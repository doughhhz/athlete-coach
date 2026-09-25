# Data access

Boundary de persistência e serviços externos. A Phase 2 fornece somente:

- tipos de banco gerados em `src/generated/database.types.ts`;
- factory tipada do cliente Supabase em `src/supabase/`;
- contrato público mínimo consumido pela infraestrutura mobile.

Repositories e mappers serão criados por capacidade quando existirem casos de uso e portas na camada de aplicação. Não adicionar queries à apresentação, transformar linhas geradas em tipos de domínio automaticamente ou criar um repository genérico.

Regere os tipos exclusivamente com `npm run db:types`, após `npm run db:reset` e `npm run db:test`.
