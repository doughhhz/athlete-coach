# Athlete Coach

Fundação arquitetural de um aplicativo mobile pessoal de treinamento, nutrição, performance e acompanhamento por IA. **Athlete Coach é um nome técnico provisório**, não uma decisão de marca.

> Princípio inegociável: **IA interpreta. O sistema calcula.**

## Estado atual

A **Phase 1 — Mobile Shell** está implementada. O repositório contém uma aplicação Expo executável com TypeScript estrito, Expo Router, cinco tabs acessíveis, Safe Area e tema claro/escuro centralizado.

As telas são placeholders explícitos. Ainda não existem banco, autenticação, Supabase, integração com LLM, lógica de treino ou dados de domínio.

## Stack do shell

- npm workspaces e lockfile na raiz;
- Expo SDK 57, React 19.2.3, React Native 0.86.3 e TypeScript 6.0.3;
- Expo Router 57;
- ESLint e Prettier;

Dependências planejadas para fases futuras, ainda não instaladas:

- Zustand para estado local de interface/sessão;
- TanStack Query para estado remoto e cache;
- Zod nas fronteiras de entrada e saída;
- Supabase (PostgreSQL, Auth, Storage e Edge Functions);
- um AI Gateway no backend, inicialmente com adapter para Gemini.

A inclusão de qualquer dependência deve ocorrer somente na fase que realmente a utilizar.

## Mapa do repositório

```text
apps/mobile/            aplicação Expo e camada de apresentação
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

## Executar no Windows com Expo Go

Pré-requisitos: Node.js 22.13 ou mais recente, npm e Expo Go atualizado no iPhone 11. O computador e o iPhone devem estar na mesma rede local.

No PowerShell, a partir da raiz do repositório:

```powershell
npm install
npx expo login
npx expo whoami
npm run start
```

Informe suas credenciais somente no prompt local do Expo CLI. No iPhone, entre no Expo Go com a mesma conta e então leia o QR code exibido pelo terminal. Se a rede local bloquear a conexão, encerre o servidor com `Ctrl+C` e use:

```powershell
npm run start:tunnel
```

Validação local completa:

```powershell
npm run validate
```

## Próximo passo recomendado

Revisar humanamente a Phase 1. Não iniciar a Phase 2 antes da aprovação explícita.
