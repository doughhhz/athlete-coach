# Athlete Coach

Fundação arquitetural de um aplicativo mobile pessoal de treinamento, nutrição, performance e acompanhamento por IA. **Athlete Coach é um nome técnico provisório**, não uma decisão de marca.

> Princípio inegociável: **IA interpreta. O sistema calcula.**

## Estado atual

A **Phase 7 — Performance & Derived Metrics Engine** está implementada. O histórico bruto de treinos agora produz, por cálculo determinístico, resumos factuais, attainment, séries cronológicas por exercício, carga máxima registrada, 1RM estimado e recordes conservadores.

Raw Performance permanece imutável e separada de Derived Data. Métricas são recalculadas sob demanda; não há cache persistido, tonelagem global, score, progressão automática, LLM ou interpretação estratégica.

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

O teste integrado cria somente contas artificiais locais e percorre Auth, onboarding, programa e execução de treino. Execute `npm run db:reset` depois dele para remover os dados de teste.

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

Revisar humanamente a Phase 8. AI Coach permanece Phase 9+ e não deve começar sem aprovação explícita e revisão formal de safety/privacidade.

## Phase 8 — Athlete Training Dossier & Longitudinal Signals

Implementada como projeção on-demand `athlete-training-dossier-v1`: contexto, programa ativo, janelas civis 7/28 dias, comparações por exercício, cobertura e evidências limitadas. Nenhum dossier/signal é persistido. The dossier organizes evidence; it does not interpret it. A longitudinal signal is a factual comparison, not a coaching conclusion.

## Phase 9 — Personal AI Foundation

O Personal usa o backend autenticado `coach-analyze`: constrói o dossier corrente sob a identidade JWT, aplica safety determinístico, chama um provider substituível e valida JSON e evidências. Gemini usa HTTP server-side e `GEMINI_API_KEY`; nenhuma chave ou chamada direta ao provider existe no mobile. A conversa é bounded em memória e recomendações nunca alteram programas.

## Phase 10 — Propostas revisadas do Personal

Uma recomendação elegível pode gerar, sob demanda, um `coach-proposal-v1`. O backend aceita somente ajustes de target, RIR, descanso e carga absoluta sobre IDs canônicos, valida e persiste a proposta no Runtime Coaching Decision Ledger. A aprovação cria uma revisão em rascunho em uma única transação; o programa ativo permanece intacto e a ativação continua sendo uma ação humana separada.

## Phase 11 — Resposta observada a intervenções

Decisões materializadas cujo programa foi **ativado** viram episódios de intervenção. O sistema compara deterministicamente até 3 sessões do mesmo exercício antes e depois da ativação (`intervention-outcome-v1`), registra o que foi proposto vs. realmente ativado, expõe amostras, cobertura e limitações, e acumula `individual-response-evidence-v1` por exercício e dimensão. Tudo é recalculado sob demanda; não há tabelas novas. O dossier passou a `athlete-training-dossier-v2` com `interventionHistory` bounded, e o Personal usa `coach-system-v2`. **Post-intervention change is evidence, not proof of causation.** Nada disso adapta programas automaticamente.

Uma migration corretiva (`20260928120000`) permite salvar novamente a estrutura de drafts já preenchidos (ADR-0055).

Próximo passo recomendado: revisão humana da Phase 11 antes de qualquer nova fase.

## Phase 12 — Memória de resposta do atleta

As intervenções ativadas são organizadas deterministicamente por exercício e tipo de alteração (`individual-response-memory-v1`): o que foi realmente ativado, quantas eram comparáveis, confounders, variações numéricas observadas e contradições, sempre com amostras. Nada é persistido; o dossier passou a `athlete-training-dossier-v3` e o Personal usa `coach-system-v3` com a Coach Learning Policy. **Response Memory remembers observations, not truths.** Nenhuma regra, preferência ou adaptação automática é criada.

Próximo passo recomendado: revisão humana da Phase 12.
