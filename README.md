# Athlete Coach

Fundação arquitetural de um aplicativo mobile pessoal de treinamento, nutrição, performance e acompanhamento por IA. **Athlete Coach é um nome técnico provisório**, não uma decisão de marca.

> Princípio inegociável: **IA interpreta. O sistema calcula.**

## Estado atual

A **Phase 2 — Data Architecture** está implementada e aguarda revisão humana. Além do shell Expo da Phase 1, o repositório contém uma stack Supabase local reproduzível, a identidade mínima `public.athletes`, RLS por ownership, testes pgTAP e um cliente TypeScript tipado.

As telas continuam placeholders explícitos. Não existem onboarding, autenticação visual, perfil completo, integração com LLM, lógica de treino ou dados pessoais de exemplo.

## Stack do shell

- npm workspaces e lockfile na raiz;
- Expo SDK 57, React 19.2.3, React Native 0.86.3 e TypeScript 6.0.3;
- Expo Router 57;
- ESLint e Prettier;

## Stack de dados

- Supabase CLI 2.117.0 como dependência local;
- PostgreSQL/Supabase local gerenciado pelo Docker Desktop;
- `@supabase/supabase-js` 2.117.1;
- AsyncStorage 2.2.0 e URL polyfill 4.0.0 para a infraestrutura React Native;
- migrations SQL, tipos gerados e testes pgTAP versionados.

Dependências planejadas para fases futuras, ainda não instaladas:

- Zustand para estado local de interface/sessão;
- TanStack Query para estado remoto e cache;
- Zod nas fronteiras de entrada e saída;
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

## Supabase local no Windows

Pré-requisitos: Docker Desktop com engine Linux em execução, Node.js 22.13 ou superior e dependências instaladas com `npm install` ou `npm ci`.

```powershell
npm run supabase:start
npm run supabase:status
npm run db:reset
npm run db:test
npm run db:types
npm run validate
```

Os scripts confinam arquivos temporários da CLI a `.cache/`, dentro do repositório e ignorada pelo Git. Para encerrar a stack:

```powershell
npm run supabase:stop
```

Copie `.env.example` para `.env` somente quando um fluxo mobile precisar inicializar o cliente. Use a URL e a **publishable key** do ambiente desejado; nunca use `service_role` ou secret key no mobile. O iPhone físico e o banco local são validados separadamente nesta fase, sem exposição pública da stack.

### Workflow de mudança do banco

1. Criar uma migration com `npx supabase migration new <nome>`.
2. Executar `npm run db:reset`.
3. Executar `npm run db:test`.
4. Executar `npm run db:types`; nunca editar `database.types.ts` manualmente.
5. Executar `npm run typecheck` e `npm test`.
6. Revisar o diff e então criar o commit.

## Próximo passo recomendado

Revisar humanamente a Phase 2. Não iniciar a Phase 3 antes da aprovação explícita.
