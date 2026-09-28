# Arquitetura técnica

Status: **canônico, conceitual**

## Visão de alto nível

```text
Mobile Application (Expo / React Native)
        |
        v
Application Layer (casos de uso e portas)
        |
        v
Domain Layer (invariantes e cálculos puros)
        ^
        |
Data Access Adapters ------------------> Supabase

Backend seguro / Edge Function:
AI Gateway -> Context Builder -> Coach Orchestrator -> Safety Layer
                                                    -> LLM Provider Adapter -> Gemini API
```

O desenho representa responsabilidades, não necessariamente processos separados desde a primeira versão.

## Camadas e boundaries

### Presentation (`apps/mobile`)

Rotas, telas, componentes, acessibilidade, navegação, estado transitório e adaptação de entrada. Não calcula métricas, não acessa Supabase diretamente e não chama LLM.

### Application (`packages/application`)

Casos de uso, transações, autorização de ações, commands/queries e portas de repositório/serviço. Coordena domínio e infraestrutura sem importar implementações concretas.

### Domain (`packages/domain`)

Entidades, value objects, políticas e funções determinísticas. Não depende de frameworks. Domínios iniciais: Athlete, Exercise, Training, Workout, Performance, Recovery, Body, Nutrition, Coach, Memory e Safety.

### Data Access (`packages/data-access`)

Implementações de repositórios, mappers, cache e consultas. Converte tipos externos para contratos internos. Nenhuma linha retornada pelo banco deve atravessar sem validação/mapeamento.

A Phase 3 adiciona repositories Supabase específicos para Auth, atleta, perfil, objetivo, contexto/disponibilidade, peso e onboarding. A composição concreta vive em `apps/mobile/src/infrastructure`; Presentation consome casos de uso via contexto, não importa Data Access ou `@supabase/*` e não executa `.from(...)`. Não há repository genérico. Respostas externas são validadas/mapeadas na boundary antes de virarem tipos de domínio.

A Phase 4 adiciona `ExerciseCatalogRepository` e `AnatomyRepository`. Consultas do catálogo global passam por casos de uso; busca/filtros factuais são executados no PostgreSQL e resultados externos são validados antes do mapeamento. Tipos gerados continuam restritos ao adapter e não são modelos de domínio.

A Phase 5 adiciona `TrainingProgramRepository`, modelos puros e casos de uso específicos. A estrutura completa é salva por RPC transacional; ativação, transições e clone também são operações atômicas. Ao ativar qualquer novo draft, o mesmo RPC arquiva o ativo anterior e ativa o novo, preservando timestamps, estrutura e lineage; somente o caso de uso explícito de conclusão produz `completed`. Triggers no banco impedem mutação dos filhos quando o programa não é draft. Presentation recebe apenas modelos da aplicação e continua sem Supabase direto.

A Phase 6 adiciona `WorkoutSessionRepository` e o aggregate de execução independente. Start, complete e abandon são RPCs transacionais; record/skip usam RPCs protegidas. Snapshot planejado e performance observada ocupam colunas distintas. RLS deriva ownership dos filhos pelo root e triggers tornam todo o histórico terminal imutável. A retomada reconstrói estado do servidor; inputs não confirmados ficam na tela para retry, sem cache local concorrente nesta fase.

A Phase 7 adiciona `PerformanceReadRepository` read-only e calculadores puros em domínio próprio. O adapter consulta aggregates históricos sob RLS, valida/mapeia Raw Data e a aplicação calcula projections sob demanda. Não existem tabelas, views ou caches de métricas; uma nova versão de fórmula pode recomputar todo o histórico sem modificar Workout.

### AI (`packages/ai` e backend)

- **AI Gateway:** único ponto autenticado de entrada para solicitações de IA, com limites, observabilidade e idempotência.
- **Context Builder:** seleciona o mínimo contexto autorizado, rotula proveniência, período, unidade e frescor.
- **Coach Orchestrator:** escolhe fluxo, ferramentas determinísticas e formato de saída.
- **Safety Layer:** valida entrada/contexto antes do modelo e saída/ação depois dele. Pode bloquear ou degradar o fluxo.
- **Provider Adapter:** traduz o contrato interno para Gemini ou outro provider.

A sequência exata entre orquestração e safety pode ter gates em múltiplos pontos; Safety não é uma chamada única dispensável.

## Regra de dependência

```text
presentation -> application -> domain
data-access  -> application -> domain
ai adapters  -> application/domain contracts
domain       -> nenhum framework externo
```

Dependências técnicas compartilhadas entram somente quando necessárias. O SDK do Gemini nunca aparece no mobile, domain ou application.

## Estado no cliente

- **TanStack Query:** dados remotos, cache, invalidação e estados de carregamento/erro.
- **Zustand:** estado local ou efêmero, como sessão de UI em andamento.
- **Form state local:** edição ainda não submetida.
- **Servidor/banco:** fonte de verdade persistida.

Não duplicar a mesma entidade persistentemente em Query e Zustand. A estratégia offline detalhada é uma decisão futura; o Workout Runner deve ser projetado para tolerar interrupções.

## Dados e contratos

- I/O externo validado com Zod quando implementado;
- IDs opacos e estáveis;
- timestamps em UTC; timezone original preservado quando altera o significado;
- grandezas com unidade explícita e sem conversões implícitas;
- registros derivados incluem versão do algoritmo e referências aos dados de origem;
- inteligência inclui provider/modelo, versão de prompt/policy e evidências, sem persistir raciocínio interno do modelo.

## Supabase e segurança

- Auth identifica o usuário; Row Level Security aplica isolamento no banco.
- `auth.users` é identidade de autenticação da infraestrutura; `public.athletes` é identidade do domínio e usa UUID próprio.
- Storage usa buckets e políticas específicas, não URLs públicas por padrão.
- Edge Functions guardam secrets e executam integrações privilegiadas.
- O mobile recebe somente URL e publishable key públicas; service role e secret key nunca vão para o cliente.
- Migrations versionam schema, constraints, índices, funções e políticas.
- Grants limitam operações antes da avaliação de RLS: `anon` não acessa `athletes`; `authenticated` recebe CRUD sujeito às políticas de ownership; `service_role` fica reservado ao backend confiável.
- O catálogo canônico global não possui `athlete_id`: `authenticated` recebe somente `SELECT`, `anon` não recebe acesso e clientes não recebem grants de mutação.
- O mobile usa um único cliente persistido em AsyncStorage, um único listener de ciclo de vida e os estados estruturais `BOOTING`, `CONFIGURATION_ERROR`, `SIGNED_OUT`, `SIGNED_IN_ONBOARDING_REQUIRED` e `SIGNED_IN_READY`.
- Rotas protegidas do Expo Router estruturam a navegação, mas não substituem RLS. Após sessão válida, `ensureCurrentAthlete` garante explicitamente a identidade de domínio.
- A conclusão do onboarding é uma RPC `SECURITY INVOKER`, atômica e serializada por atleta; o timestamp de conclusão só é escrito ao final.

RLS, autenticação e threat model devem existir antes de qualquer dado real.

## Confiabilidade e observabilidade

- operações mutáveis relevantes usam idempotency key;
- logs usam correlation ID e evitam payloads sensíveis;
- falhas do provider não comprometem Raw Data nem execução do treino;
- cálculos podem ser reproduzidos pela versão do algoritmo;
- recomendações e decisões permanecem auditáveis;
- backups, exportação e recuperação serão definidos antes de produção.

## Estratégia de testes

- unitários: domínio, fórmulas, invariantes e safety determinístico;
- contrato: repositories, provider adapters e schemas de IA;
- integração: Supabase local e Edge Functions;
- UI: componentes críticos e acessibilidade;
- ponta a ponta: registro de sessão, sincronização e aceite/reversão de decisão;
- evals: qualidade, grounding e segurança do Coach, sem snapshots literais frágeis.

## Estrutura de repositório

Monorepo com `apps`, `packages`, `supabase`, `tests` e `docs`. A Phase 1 adotou npm workspaces e um lockfile único na raiz, conforme ADR-0009. `apps/mobile`, `packages/application`, `packages/domain` e `packages/data-access` são workspaces ativos na Phase 3; pacotes conceituais não recebem manifests até serem usados.

O shell mobile usa Expo SDK 57, React 19.2.3, React Native 0.86.3 e Expo Router 57. A matriz veio do template oficial estável `default@sdk-57` e deve continuar sendo validada pelo CLI do Expo em upgrades.

A infraestrutura local usa Supabase CLI 2.117.0 versionada na raiz. `supabase/migrations` é a fonte do schema, `supabase/tests` contém testes pgTAP e `packages/data-access/src/generated/database.types.ts` é regenerado do banco local. Nenhum estado criado manualmente no Studio faz parte da arquitetura reproduzível.

## Phase 8 projection boundary

`BuildAthleteTrainingDossier` compõe perfil, programa, workouts e performance existentes; funções puras constroem sinais e RLS preserva ownership. O contrato é reconstruído, versionado e não persistido. Futuro, não implementado: `Dossier → Personal AI → Structured Coach Proposal → Deterministic Validator → Human Approval/Policy → Program Revision → runtime Coach Decision Ledger`.

## Phase 9 AI boundary

`coach-analyze` exige JWT, rejeita `athleteId` do cliente e cria repositories com o token corrente. O fluxo é `Dossier v1 → input safety → prompt/policy v1 → CoachModelProvider → Zod → evidence validation → output safety`. `packages/ai` contém prompt, policy e adapters; application conhece portas e domínio não conhece Gemini. O adapter inicial usa HTTP. Configuração central: `GEMINI_API_KEY`, `GEMINI_MODEL`, `COACH_TEMPERATURE`, `COACH_TIMEOUT_MS` e `COACH_MAX_OUTPUT_TOKENS`.

O gateway limita corpo a 16 KiB, contexto a seis mensagens, dez requests/minuto por instância e timeout configurável. Rate limiting é best-effort/in-memory nesta fase. Logs omitem contexto pessoal e contêm IDs, provider/model, latência, resultado e categoria de erro.

## Phase 10 proposal boundary

`coach-propose` recompõe Dossier e programa ativo sob o JWT, chama o provider separado de proposals, valida schema/evidence/IDs/invariantes e persiste via backend. `coach-decide` aceita apenas intenção de rejeitar ou materializar. Materialização ocorre na RPC transacional `materialize_coach_decision`: lock do ledger, rechecagem de ownership/status/revision, clone com novos UUIDs, aplicação das actions suportadas e vínculo ao draft. Mobile nunca envia patch nem chama Gemini/SQL diretamente.

Fluxo: `CoachAnalysis → GenerateCoachProposal (opcional) → validator determinístico → ledger proposed → decisão humana → RPC atômica → ProgramRevision draft`. Application/domain não importam Gemini ou Supabase; `packages/ai` não aplica programas.

## Phase 11 outcome projection boundary

`packages/domain/src/outcomes` contém funções puras: episode, fidelity, janelas por exposição, comparações, individual response e histórico bounded. `packages/application/src/outcomes` orquestra `BuildInterventionOutcomes`, `ListInterventionOutcomes`, `GetCoachDecisionOutcome`, `GetIndividualResponseEvidence` e `BuildInterventionHistory` sobre portas existentes (`CoachDecisionReader`, `TrainingProgramRepository.get`, `PerformanceReadRepository`) mais `BodyWeightHistoryReader` (read-only). Não há repository genérico, tabela ou cache.

`coach-analyze` e `coach-propose` montam `athlete-training-dossier-v2` com `interventionHistory` lendo decisões pelo cliente com o JWT do atleta (RLS); o service role continua restrito às escritas do ledger. No mobile, decisões chegam pelo gateway autenticado `coach-decide list`. Nada nesta camada altera programas, prompts, proposals ou pesos de modelo.

## Phase 12 response memory boundary

`packages/domain/src/response-memory` constrói, com funções puras, `IndividualResponseMemory` a partir de `IndividualResponseEvidence v2` (Phase 11): assinatura ativada, classificação strict/context-only, agregados observacionais e bounding. Application adiciona `BuildIndividualResponseMemory`, `GetResponseMemoryGroup` e `BuildInterventionContext`, que alimenta o dossier v3 com histórico e memória numa única computação. Nenhum repository, tabela, migration ou índice novo.

Loop com controle humano (não autonomia):

```text
Response Memory → Coach Interpretation → Structured Proposal → Validator
  → Human Approval → Program Revision → Outcome → Response Memory
```
