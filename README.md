# Athlete Coach

Fundação arquitetural de um aplicativo mobile pessoal de treinamento, nutrição, performance e acompanhamento por IA. **Athlete Coach é um nome técnico provisório**, não uma decisão de marca.

> Princípio inegociável: **IA interpreta. O sistema calcula.**

## Estado atual

A **Phase 5 — Training Program Engine** está implementada e aguarda revisão humana. Além de autenticação, perfil e catálogo canônico, o aplicativo permite criar, revisar, ativar, concluir, arquivar e versionar programas determinísticos com blocos, semanas, dias, exercícios e alvos por série.

Prescrição continua separada de execução: não há Workout Runner, dados realizados, progressão automática, LLM, provider externo, mídia externa, analytics nem programas fictícios de produção.

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
- Zod 4.6.5 nas fronteiras de formulário, aplicação e respostas externas.

Dependências planejadas para fases futuras, ainda não instaladas:

- Zustand para estado local de interface/sessão;
- TanStack Query para estado remoto e cache;
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
npm run test:integration:local
npm run validate
```

O teste integrado cria somente uma conta artificial local e percorre Auth, onboarding, perfil, pesagem, criação/ativação/persistência e revisão de programa, logout e novo login. Execute `npm run db:reset` depois dele para remover os dados de teste.

Os scripts confinam arquivos temporários da CLI a `.cache/`, dentro do repositório e ignorada pelo Git. Para encerrar a stack:

```powershell
npm run supabase:stop
```

Copie `apps/mobile/.env.example` para `apps/mobile/.env.local` quando o app precisar inicializar o cliente. Use a URL e a **publishable key** do ambiente desejado; nunca use `service_role` ou secret key no mobile. O iPhone físico e o banco local são validados separadamente nesta fase, sem exposição pública da stack.

### Auth e onboarding no app

Para executar o fluxo funcional, crie `apps/mobile/.env.local` a partir de `apps/mobile/.env.example` e preencha somente:

```text
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Depois reinicie o Metro sem reutilizar um processo anterior. Sem essas variáveis o app mostra `Backend não configurado`; não há fallback ou login simulado. O fluxo é conta -> sessão -> identidade do atleta -> onboarding -> Hoje/Perfil. Rascunhos ainda não enviados permanecem apenas na memória e podem ser perdidos ao fechar o app.

O Supabase local atende aos testes automatizados no computador. Não altere firewall nem exponha a stack local para conectar o iPhone. Para um teste futuro no aparelho físico, crie manualmente um projeto Supabase, revise as migrations, autorize explicitamente `supabase link`/`db push`, configure a URL e a publishable key desse projeto em `apps/mobile/.env.local`, e execute o Expo Go. Nenhum projeto remoto foi criado ou vinculado nesta fase.

### Workflow de mudança do banco

1. Criar uma migration com `npx supabase migration new <nome>`.
2. Executar `npm run db:reset`.
3. Executar `npm run db:test`.
4. Executar `npm run db:types`; nunca editar `database.types.ts` manualmente.
5. Executar `npm run typecheck` e `npm test`.
6. Revisar o diff e então criar o commit.

## Próximo passo recomendado

Revisar humanamente a Phase 5. Não iniciar a Phase 6 antes da aprovação explícita.
