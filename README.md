# Athlete Coach

Fundação arquitetural de um aplicativo mobile pessoal de treinamento, nutrição, performance e acompanhamento por IA. **Athlete Coach é um nome técnico provisório**, não uma decisão de marca.

> Princípio inegociável: **IA interpreta. O sistema calcula.**

## Estado atual

Este repositório está na **Phase 0 — Foundation**. Ele contém decisões canônicas, boundaries e diretórios para evolução futura. Ainda não contém aplicação executável, telas, banco, autenticação ou integração com LLM.

## Stack planejada

- React Native, Expo e TypeScript;
- Expo Router;
- Zustand para estado local de interface/sessão;
- TanStack Query para estado remoto e cache;
- Zod nas fronteiras de entrada e saída;
- Supabase (PostgreSQL, Auth, Storage e Edge Functions);
- um AI Gateway no backend, inicialmente com adapter para Gemini.

A inclusão de qualquer dependência deve ocorrer somente na fase que realmente a utilizar.

## Mapa do repositório

```text
apps/mobile/            futura aplicação Expo e camada de apresentação
packages/domain/        regras e tipos de domínio, sem dependências de UI/infra
packages/application/   casos de uso e portas
packages/data-access/   adapters de persistência e consultas
packages/ai/            gateway, contexto, orquestração, safety e providers
packages/shared/        primitives realmente compartilhadas, mantidas mínimas
supabase/               migrations e Edge Functions futuras
tests/architecture/     validações de boundaries e decisões arquiteturais
docs/                   documentação canônica
```

## Como iniciar uma mudança

1. Leia [AGENTS.md](AGENTS.md) e os documentos canônicos afetados.
2. Identifique se a mudança altera uma decisão existente.
3. Se alterar, siga o protocolo de [Decision Ledger](docs/09_DECISION_LEDGER.md) antes de implementar.
4. Faça a menor mudança coerente, acompanhada por validações proporcionais ao risco.
5. Entregue um relatório final com mudanças, decisões, hipóteses, riscos, testes e estado do Git.

## Próximo passo recomendado

Revisar e aprovar esta constituição; depois iniciar **Phase 1 — Mobile Shell**, criando o projeto Expo mínimo e navegável sem implementar os domínios.
