# Data access

Boundary de persistência e serviços externos. A Phase 3 fornece:

- tipos de banco gerados em `src/generated/database.types.ts`;
- factory tipada do cliente Supabase em `src/supabase/`;
- repositories Supabase específicos por capacidade;
- mappers com validação Zod de respostas externas;
- mensagens de erro seguras que não expõem SQL, tokens ou texto livre.

Não adicionar queries à apresentação, transformar linhas externas em tipos de domínio sem validação ou criar um repository genérico.

Regere os tipos exclusivamente com `npm run db:types`, após `npm run db:reset` e `npm run db:test`.
