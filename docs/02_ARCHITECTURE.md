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

## Phase 13 set-count boundary

`coach-proposal-v2` adiciona ações estruturadas de séries; o validator e o espelho puro `materializeProposalPrescription` vivem no domínio, a materialização autoritativa na RPC transacional (`20260929120000`). O mobile nunca aplica edições derivadas do modelo. Outcome v2, IRE v3, Response Memory v2 e Dossier v4 incorporam a dimensão `set_count` sem novas tabelas.

Roadmap separado (não implementado): atual = intervenção de quantidade de séries por Exercise; futuro = intervenção de frequência; futuro = troca de exercício; futuro = modelagem de volume por músculo.

Validação local das Edge Functions: além da falha ambiental de TLS já conhecida, o runtime Deno não resolve imports sem extensão em `packages/data-access/src/index.ts` nem especificadores `@athlete-coach/*` (sem import map). A falha existe no baseline da Phase 12 e em `coach-decide` inalterada; registrada como dívida para tarefa separada.

## Edge Functions no runtime Deno (ADR-0067)

As Edge Functions reutilizam os packages canônicos diretamente. O Deno resolve especificadores de workspace pelo import map `supabase/functions/deno.json`, ligado por `import_map` em `supabase/config.toml` para cada function; imports relativos dos packages usam sempre extensão `.ts`. Não há bundler nem cópia de lógica em `supabase/functions`. A dívida "Edge Functions não inicializam no runtime Deno local" registrada na Phase 13 foi resolvida.

## Phase 14 exercise replacement boundary

`packages/domain/src/exercise/replacement.ts` deriva candidatos e relações a partir de linhas direcionadas de `exercise_relations`; `GetExerciseReplacementCandidates` usa o repositório do catálogo (`listRelationEdges`, read-only) e alimenta o dossier v5. `GenerateCoachProposal` valida trocas contra esses candidatos construídos pelo backend; a RPC `materialize_coach_decision` (`20260930120000`) revalida tudo no banco. `BuildInterventionOutcomes` recebe o mesmo leitor de relações para reconstruir o contexto do par ativado. Nenhum package novo nas Edge Functions (o import map da ADR-0067 continua suficiente). Autenticação ocorre antes de qualquer checagem de configuração do provider (ADR-0073).

## Phase 15 governance boundary

`packages/domain/src/coach-governance/` contém a política pura `assessCoachProposalGovernance` (`coach-governance-v1`). A aplicação orquestra: `GenerateCoachProposal` valida, classifica e persiste o envelope de governança (`blocked` nunca é persistido); `AnalyzeAthleteWithCoachAndGovernance` continua uma análise pedida pelo usuário, lê a preferência (`CoachPreferenceRepository`), consome orçamento de rate limit para a segunda chamada e isola falhas (status `not_enabled | no_change | prepared | blocked | unavailable | invalid`); `ApproveCoachProposal` recalcula a governança no servidor antes de materializar, nunca rebaixa a classe persistida e exige confirmação humana para revisão reforçada. `coach-analyze` é o ponto de orquestração (dossier memoizado por requisição; service role apenas para a escrita no ledger); `coach-propose` reutiliza a decisão existente do mesmo `analysisRequestId` sem chamar o Gemini; `coach-decide` usa leitura com JWT do usuário para recalcular a governança. Nenhum package novo no import map (ADR-0067). O cliente nunca envia origem nem classe de revisão.

## Correção pós-Implementation Phase 15 — Handoff de análise autoritativa

`AnalyzeAthleteWithCoachAndGovernance` valida o `analysisRequestId`, procura o registro existente (retentativa → reutiliza, sem dossier nem provider), senão analisa, persiste o registro via `CoachAnalysisRepository.recordCompleted` com a proveniência do programa ativo do mesmo dossier memoizado (`analysisProgramFrom`) e, em modo proativo, entrega o próprio registro ao gerador. `GenerateCoachProposal.execute` aceita apenas um `CoachAnalysisRecord` (tipo de aplicação obtido do repositório), nunca uma `CoachAnalysis` solta. O fluxo manual usa `GenerateCoachProposalForAnalysisRequest` com `coachProposalRequestSchema` estrito (`{ analysisRequestId }`). `coach-analyze` valida o corpo com `coachAnalyzeRequestSchema` estrito. Providers sem chave configurada falham apenas se chamados, então safety, reutilização, "não encontrada" e "desatualizada" são resolvidos antes. Escritas do registro e do ledger usam o service role, sempre com escopo explícito do usuário autenticado; o mobile nunca lê a tabela. Nenhum package novo no import map (ADR-0067).

## Implementation Phase 16 — Auto-draft e vínculo de requisição

Domínio: `packages/domain/src/coach-auto-draft/` (`assessCoachAutoDraftEligibility`, `coach-auto-draft-v1`, `isAutoDraftAuthorityEnabled`), separado de `coach-governance-v1` e consumindo sua avaliação. Aplicação: `GenerateCoachProposal` grava a avaliação de auto-draft (apenas origem proativa) no envelope; `PrepareConservativeAutoDraft` relê preferências, recalcula governança e elegibilidade, revalida o programa de origem e chama `CoachDecisionRepository.autoDraft`; `AnalyzeAthleteWithCoachAndGovernance` executa-o somente após uma decisão proativa e devolve `autoDraft` (`not_applicable | not_enabled | ineligible | blocked | stale | existing_draft | materialized | failed`), isolando falhas. `fingerprintAnalysisRequest` (SHA-256 via Web Crypto nativo sobre `canonicalizeAnalysisRequest`) vincula o `analysisRequestId` à requisição. Banco: RPC backend-only `auto_draft_coach_decision` reutiliza o único motor `materialize_coach_decision` (sem duplicar a lógica de clonagem) e define a origem por configuração de transação lida por trigger — o cliente nunca escolhe origem. Não há caminho de código do Coach para ativação (teste de arquitetura). Nenhum package novo nas Edge Functions.

## Implementation Phase 17 — Projeção derivada de revisão

Domínio: `packages/domain/src/coach-draft-review/` — `buildCoachDraftReviewEvidence` (`coach-draft-review-evidence-v1`) e `buildCoachDraftReviewHistory` (`coach-draft-review-history-v1`), puros e determinísticos. O rascunho esperado vem do programa de origem congelado + snapshot imutável da proposta pelo espelho único `materializeProposalPrescription`; a comparação reutiliza `flattenPrescriptions`/`prescriptionKey`/`diffPrescription` de outcomes (agora exportados) — nenhuma segunda lógica de aplicação ou diff. Aplicação: `BuildCoachDraftReviews`, `GetCoachDraftReviewEvidence`, `ListCoachDraftReviewHistory` sobre os repositórios existentes (ledger + programas, leitura RLS). `BuildAthleteTrainingDossier` recebe o carregador opcional de histórico (dossier v6). Edge Functions apenas compõem o carregador (sem endpoint novo, sem nova autoridade). Teste de arquitetura: a política/orquestração de auto-draft e governança nunca importam o módulo de revisão.

## Implementation Phase 18 — Matcher estrutural canônico

`packages/domain/src/training/lineage.ts` é o único matcher entre revisões: `structureMatchingStrategy` (`lineage` somente quando a revisão comparada foi criada com continuidade — `lineageTracked` — e ambas as estruturas têm linhagem completa; caso contrário `legacy_position`, explícito), `matchPrescriptions` e `matchSets` (séries adicionadas pela proposta, sem linhagem na expectativa, pareiam em ordem com séries novas). `flattenPrescriptions`/`prescriptionKey` foram movidos para esse módulo. `diffPrescription` (outcomes) usa o matcher de séries e, em modo linhagem, reporta `sequence` e substituição de série; a evidência de revisão e a fidelidade de outcome usam o mesmo matcher (teste de arquitetura). O espelho `materializeProposalPrescription` preserva linhagem por construção (spread). O builder mobile carrega `lineageId` sem exibi-lo; o servidor valida.

## Correção pós-Implementation Phase 18 — Estado completo do builder

`packages/application/src/training/program-structure-editor.ts` é o modelo puro de edição: `programToStructureInput` (conversão sem perdas do agregado inteiro, com linhagem, nomes, notas, instruções, cues, dia preferido e faixas exatas) e `structureEdits` (operações tipadas sobre a árvore inteira: renomear, adicionar dia, adicionar/remover/trocar/mover exercício, adicionar/remover/editar série), sem JSON Patch. A tela usa um `DayPath` apenas como viewport e envia sempre a árvore inteira (`saveProgramStructure(programId, structure)`). Modelo de salvamento escolhido: substituição do agregado inteiro (opção A), sem RPC por nó. Teste de arquitetura impede serialização de apenas o primeiro nó.

## Implementation Phase 19 — Operações estruturais e guarda de saída

`program-structure-editor.ts` ganhou `addBlock`, `addWeek`, `removeBlock`, `removeWeek`, `removeDay`, `moveBlock`, `moveWeek` e `moveDay` em `structureEdits`. Também ganhou `structureRemovalRules` (último nó), `structureSummaries` (contagens para confirmação), `clampPath` (viewport após remoção) e `StructuralInvariantError`. Não há JSON Patch nem mutação genérica; remoções só existem em operações `remove*` (teste de arquitetura `structure-editing-boundaries`). `draft-edit-session.ts` é o modelo puro de alterações não salvas (`edited`, `save_started`, `save_succeeded`, `save_failed`, `discarded`; `shouldGuardDraftLeave`). A tela usa `usePreventRemove` de `expo-router/react-navigation` (sem nova dependência) e navega só depois que o estado limpo é renderizado. `structure-labels.ts` (apresentação) apenas formata textos. A persistência continua sendo o salvamento da árvore inteira (ADR-0095).
