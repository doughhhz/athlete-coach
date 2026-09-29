# Modelo conceitual de dados

Status: **canônico; perfil físico do atleta definido na Phase 3**

Este documento define conceitos e relações. A identidade, o perfil e os dados necessários ao onboarding possuem schema físico; os demais agregados continuam conceituais.

## Separação obrigatória

### Raw Data

Fatos observados ou informados: perfil, entrada de objetivo, sessão, série, carga, repetições, RIR, descanso observado, check-in, peso, medida, refeição e dado importado. Devem registrar origem, autor, instante observado, instante registrado e correções auditáveis.

### Derived Data

Resultados reproduzíveis: volume, tonelagem, e1RM, aderência, PR, médias e tendências. Cada resultado referencia entradas, janela temporal, fórmula/algoritmo e versão. Pode ser recalculado; não sobrescreve Raw Data.

### Coach Intelligence

Análise, observação, hipótese, recomendação, explicação e decisão. Cada item registra evidências disponíveis, incerteza quando aplicável, autoria técnica e ciclo de vida. Não é medição.

## Agregados conceituais

### Athlete

`AthleteProfile`, `Goal`, `GoalHistory`, `Availability`, `Preference`, `Constraint`. Objetivos e restrições mudam com o tempo; preservar vigência e histórico.

### Exercise

`Exercise`, `Muscle`, `Equipment`, `Instruction`, `Variation`, `Substitution`, `ExerciseMedia`. Conteúdo de terceiros exige origem/licença. Regra física da Phase 4: **Exercise descreve o movimento; Prescription descreve como o atleta deve executá-lo naquele contexto.** Nenhum campo de séries, repetições, carga, RIR, descanso ou tempo pertence a `Exercise`.

## Catálogo físico da Phase 4

- `body_regions -> muscle_groups -> muscles` forma a taxonomia anatômica global. Músculos possuem UUID e slug internos estáveis, nomes PT/EN e nome anatômico opcional.
- `exercises` possui identidade interna, nomes bilíngues, descrição e vocabulários fechados de padrão, mecânica, lateralidade e dificuldade opcional.
- `exercise_muscles` representa os papéis `primary`, `secondary` e `stabilizer`, sem percentuais de ativação. `exercise_equipment` vincula equipamentos canônicos.
- `exercise_aliases` sustenta busca case/accent-insensitive. `exercise_instruction_steps` guarda conteúdo original ordenado por seção.
- `exercise_relations` é explícita. `similar_pattern`, `similar_target` e `equipment_alternative` são materializadas nos dois sentidos; `variation_of`, `regression` e `progression` são direcionais. Relação não autoriza substituição contextual.
- `exercise_media` modela tipo, fonte, licença, atribuição e políticas futuras. Não há ativo nem bucket nesta fase. `exercise_external_mappings` reserva integração futura sem transformar ID externo em identidade.

Esse conhecimento global não possui `athlete_id`, é somente leitura para clientes autenticados e permanece independente de Supabase nos modelos de domínio.

### Training

`TrainingProgram -> TrainingBlock -> TrainingWeek -> TrainingDay -> ExercisePrescription -> PrescriptionSet` é o agregado físico da Phase 5. Cada nível tem sequência positiva e única no pai. `PrescriptionSet` representa métrica (`reps`, `seconds`, `meters`) e faixa, RIR e descanso opcionais em faixas, tempo opcional `E-I-C-I` com `X` permitido, e carga `unprescribed`, `athlete_selected` ou absoluta em kg. **Prescription representa intenção planejada; Performance representa execução observada.**

Programas usam lifecycle `draft`, `active`, `completed`, `archived`. Somente draft aceita mutação estrutural; revisão clona o agregado com novos UUIDs e `supersedes_program_id`. `completed` registra exclusivamente o encerramento normal explícito; a ativação de outro draft aposenta o ativo anterior como `archived`, com `archived_at`, sem preencher `completed_at`. Drafts independentes e revisões compartilham essa regra de substituição; em revisões, o lineage explica a relação, enquanto o agregado anterior permanece intacto. Um índice parcial limita um programa ativo por atleta. A referência opcional ao objetivo usa FK composta para congelar contexto sem permitir goal de outro atleta.

### Workout

`WorkoutSession -> WorkoutExercise -> WorkoutSet` é o aggregate físico da Phase 6. Sessões nascem `in_progress` ao iniciar um `TrainingDay` ativo; terminam `completed` ou `abandoned`. Não existe draft. Um índice parcial limita uma sessão em andamento por atleta.

`WorkoutExercise` referencia prescrição e exercício canônico sem duplicar anatomia. `WorkoutSet` referencia a série prescrita, congela targets planejados em colunas estruturadas e mantém performance observada separada. `completed` exige valor positivo (inteiro para reps); carga kg e RIR são opcionais. `skipped` não fabrica performance. **Performance records reality; divergence from prescription is valid data.** Histórico terminal é imutável para clientes.

### Performance

`MetricDefinition`, `MetricObservation`, `PersonalRecord`, `Trend` e `ProgressionAssessment`. Observações derivadas guardam algoritmo e proveniência.

Na Phase 7, Performance é uma projection não persistida sobre Workout. Session metrics, attainment, histórico por exercício e personal bests são reconstruídos dos aggregates brutos. E1RM usa `epley-v1`; o point mantém session/set/exercise e proveniência temporal. Missing não vira zero ou falha. Nenhuma tabela de derived metrics foi criada.

### Recovery

`RecoveryCheckIn`, `SleepObservation`, `SorenessObservation` e `ReadinessAssessment`. Readiness é derivado ou interpretado conforme sua fonte; nunca rotular interpretação como medição.

### Body

`BodyWeightObservation`, `BodyMeasurement`, `ProgressMedia`. Fotografias e medidas exigem controles reforçados de privacidade.

### Nutrition

`NutritionGoal`, `Food`, `Serving`, `Meal`, `FoodLog`, `MacroSummary`. Valores de alimentos podem ser declarados, importados ou estimados; origem e confiança devem ser explícitas.

### Coach

`CoachAnalysis`, `CoachObservation`, `Hypothesis`, `Recommendation` e `DecisionRecord`. Uma recomendação não altera automaticamente programa ou objetivo.

### Memory

`AthleteDossier`, `DossierFact`, `DossierPattern`, `DossierLearning` e referências de evidência. O dossier é uma projeção controlada e reconstruível, não um texto irrestrito tratado como verdade.

### Safety

`SafetySignal`, `SafetyAssessment`, `SafetyAction` e `Escalation`. Registra qual regra foi ativada sem produzir diagnóstico.

## Athlete Dossier

Deve poder representar perfil atual, objetivos e histórico, restrições, preferências, programas, exercícios, padrões de performance/recuperação/nutrição, observações, hipóteses, decisões, resultados e aprendizados.

Cada item possui:

- tipo (`raw_reference`, `derived`, `coach_intelligence`);
- período de validade e frescor;
- fonte/evidência;
- nível de confiança quando não factual;
- visibilidade e consentimento para uso em IA;
- estado ativo, superseded ou invalidado.

## Decision Ledger de produto

Uma `DecisionRecord` suporta ID, datas, contexto, decisão, motivo, evidências, hipótese, mudança, período de avaliação, métricas, resultado, conclusão e status (`proposed`, `accepted`, `rejected`, `active`, `evaluating`, `completed`, `reverted`). Transições e autoria devem ser auditáveis.

## Regras transversais

- todas as entidades do usuário são isoladas pelo owner e por políticas de acesso;
- exclusão, retenção e exportação serão modeladas antes de produção;
- soft delete não é adotado por padrão: cada domínio decide conforme auditoria e privacidade;
- valores financeiros ou clínicos não estão previstos;
- unidades e timezone são parte do significado;
- conteúdo gerado por IA não substitui dado observado;
- schema físico dos domínios futuros e suas cardinalidades serão decididos incrementalmente.

## Baseline físico da Phase 2

`auth.users` representa autenticação e identidade técnica no Supabase. `public.athletes` representa a identidade do atleta no domínio e não é um perfil completo. Ela possui `id uuid` gerado pelo PostgreSQL, `user_id uuid` único referenciando `auth.users(id)`, `created_at timestamptz` e `updated_at timestamptz`. A exclusão de um usuário remove fisicamente sua identidade de atleta por `ON DELETE CASCADE`; não há `deleted_at` preventivo.

Entidades principais usam UUID salvo decisão posterior documentada. Futuras relações de negócio devem apontar para `athletes.id`, não tratar detalhes de `auth.users` como modelo de domínio.

## Perfil físico da Phase 3

- `athletes.onboarding_completed_at timestamptz nullable` registra conclusão explícita somente após a transação válida.
- `athlete_profiles` é 1:1 com atleta e armazena `preferred_name`, `birth_date date`, `height_cm numeric(5,1)` e timezone IANA. `age` é sempre derivada.
- `athlete_goals` preserva histórico por vigência/status. Um índice parcial único permite no máximo um objetivo `active`; troca estrutural encerra o anterior e cria outro, enquanto correções futuras do mesmo objetivo não precisam criar histórico artificial.
- `athlete_training_contexts` é 1:1 e contém meses objetivos de treino resistido, consistência recente declarada, duração, ambiente, rotina, constraints/preferências e sono opcional. Preferência informa aderência; não é prescrição científica.
- `athlete_training_availability` contém somente dias disponíveis, com `1 = Monday` até `7 = Sunday`; a duração padrão permanece no contexto.
- `body_weight_entries` é Raw Data append-only para o cliente, com `measured_at`, `weight_kg`, origem manual e criação. Peso mais recente é consulta por `measured_at` e não campo duplicado.

Todas as relações apontam para `athletes.id`, usam `ON DELETE CASCADE`, RLS e ownership derivado da sessão. Campos livres têm limites, não são logados nem enviados a terceiros. Sexo/gênero não é coletado sem finalidade concreta. Exportação portátil e exclusão de conta por fluxo de produto permanecem requisitos anteriores à produção; os cascades atuais são verificados em testes.

## Convenções físicas

- instantes absolutos usam `timestamptz`; o banco os trata semanticamente em UTC e a apresentação converte o timezone;
- uma data civil sem horário poderá usar `date` quando o domínio a introduzir;
- nascimento usa `date`; instantes de pesagem e vigência usam `timestamptz`;
- cada grandeza terá unidade canônica explícita no nome/contrato: massa e carga em kg quando aplicável, comprimento em cm, energia em kcal e duração computacional em segundos;
- conversões de unidade acontecem na boundary apropriada e nunca apagam a unidade da origem;
- valores quantitativos importantes usam `numeric`, integer escalado ou tipo específico conforme precisão e operações do domínio; `float` não é padrão automático;
- soft delete não é política global e será decidido por entidade conforme privacidade, auditoria e retenção;
- audit logging de banco e o futuro Decision Ledger do Coach são conceitos distintos.

Raw Data continua significando observação, Derived Data cálculo determinístico reproduzível e Coach Intelligence interpretação. Essa separação permanece obrigatória nos contratos, mas não justifica criar antecipadamente schemas SQL `raw`, `derived` e `coach`.

## AthleteTrainingDossier v1

Read model, não tabela. Contém contexto, programa/revisão/lineage ativos, cinco janelas, exposição/comparação por `exercise_id`, cobertura, até 12 sessões com metadata de truncamento e referências tipadas. Janelas usam dias civis no timezone IANA, início inclusivo/fim exclusivo. Peso inclui só a última observação.

Na Phase 9, cada sessão recente resolve deterministicamente `sourceTrainingDayId` até programa, revisão e `supersedesProgramId` pela hierarquia imutável. Raw Workout não é alterado. `CoachAnalysis v1` é Coach Intelligence não persistida, com versões, evidência, confiança qualitativa, hipóteses, propostas, incertezas e safety. Não existe tabela de chat nesta fase.

## Runtime Coaching Decision Ledger — Phase 10

`coach_decisions` pertence ao atleta e guarda snapshot JSONB validado `coach-proposal-v1`, analysis ID resumido, source program/revision, versões de provider/model/prompt/safety/dossier, status e timestamps. `materialized_program_id` liga o fato proposto ao draft criado. Snapshot/proveniência e estados terminais são imutáveis; RLS permite somente leitura própria e operações de escrita ficam em funções backend-only. Este ledger não é `docs/09_DECISION_LEDGER.md`, que registra decisões do projeto.

Lifecycle: `proposed → rejected | stale | materialized`. `approved_at` e `materialized_at` são gravados juntos na transação para não existir aprovação sem draft. O dossier, chat completo e chain-of-thought não são persistidos.

## Intervention outcomes — Phase 11

Sem novas tabelas, views ou índices. `InterventionEpisode`, `InterventionFidelity`, `InterventionOutcomeEvaluation` (`intervention-outcome-v1`) e `IndividualResponseEvidence` (`individual-response-evidence-v1`) são projections Derived/Coach-context reconstruídas de `coach_decisions`, `training_programs` (lineage, `activated_at`, estrutura imutável após ativação), `workout_*` e `body_weight_entries`. O valor materializado é reconstruído (source + action) porque o draft pode ser editado e não possui snapshot; o valor ativado vem da estrutura imutável do programa ativado. `coach_decisions.status` mantém `proposed | rejected | stale | materialized`; não existe estado de sucesso. `AthleteTrainingDossier v2` adiciona `interventionHistory` bounded (10). A migration corretiva `20260928120000` altera apenas a função de replace de estrutura de draft (ADR-0055).

## Individual Response Memory — Phase 12

Sem persistência: `individual-response-memory-v1` é reconstruída de `coach_decisions`, lineage/ativação de programas, workouts e peso corporal via outcomes da Phase 11. Três conceitos distintos: `docs/09_DECISION_LEDGER.md` (decisões do projeto), `coach_decisions` (runtime ledger do atleta) e Response Memory (projeção derivada sobre esse histórico). Não existem `athlete_response_memory`, `learned_preferences`, `response_scores` nem pesos. `IndividualResponseEvidence` passou a v2 (agrupamento com métrica de target). `AthleteTrainingDossier v3` adiciona `responseMemory` (≤10 grupos, ≤5 episódios detalhados por grupo) e o evidence kind `response_memory_group`. Correções futuras legítimas de Raw Data ou programa aparecem automaticamente no rebuild; o usuário não edita a memória.

## Phase 13 — Proposal v2 e set_count

`coach_decisions.proposal_schema_version` aceita `coach-proposal-v1` e `coach-proposal-v2`, com o snapshot obrigatoriamente na mesma versão. Snapshots v1 permanecem intactos. Sem novas tabelas: `set_count` é derivado de `prescription_sets` do programa de origem e do ativado; o conteúdo de sets adicionados vive no snapshot da proposta e, após materialização, como linhas normais do draft. `PrescriptionSet.sequence` continua positivo, único e contíguo após add/remove. Uma prescrição mantém pelo menos um set.

## Phase 14 — Proposal v3 e troca de exercício

`coach_decisions.proposal_schema_version` aceita v1, v2 e v3, com snapshot na mesma versão. A troca altera `exercise_prescriptions.exercise_id` apenas no draft criado; `workout_exercises.exercise_id`, sets executados, prescrições e programas históricos nunca são reescritos. `exercise_relations` continua a fonte das relações (sem novas tabelas). Outcome v3 inclui `crossExercisePairs`; IRE v4, memória v3 e dossier v5 carregam pares direcionados e candidatos bounded.

## Phase 15 — Preferência e envelope de governança

Migration `20261001120000_coach_governance_proactive_mode.sql` (forward, sem reescrever migrations anteriores):

- `athlete_coach_preferences` (1:1 com `athletes`, `autonomy_mode` `manual|proactive`, default `manual`; ausência de linha = manual; RLS próprio para select/insert/update; sem delete; anon sem acesso).
- `coach_decisions` ganha `proposal_origin` (`manual|proactive`, default `manual`), `autonomy_mode_at_creation`, `analysis_request_id` (uuid), `governance_policy_version`, `review_class` (`standard_review|elevated_review`; `blocked` nunca persiste) e `governance_reasons` (jsonb array). Linhas legadas mantêm governança nula e origem manual. Proativas exigem classe, request id e modo `proactive`.
- Índice único parcial `(athlete_id, analysis_request_id)` garante idempotência; a nova RPC backend-only `create_coach_decision(uuid, jsonb, jsonb)` devolve a decisão existente em retentativas. A RPC legada de 2 argumentos permanece para compatibilidade.
- O trigger de histórico passa a proteger também origem, modo, request id, política, classe e razões. Nenhuma cadeia de raciocínio do modelo é armazenada.

## Correção pós-Implementation Phase 15 — `coach_analysis_runs`

Migration `20261002120000_authoritative_coach_analysis_runs.sql` (forward). Colunas: `id`, `athlete_id` (FK cascade), `analysis_request_id`, `analysis_schema_version` (`coach-analysis-v1`), `analysis_snapshot` (CoachAnalysis estruturada validada, exatamente a devolvida), `training_advice_blocked` (derivado do snapshot; o banco rejeita divergência), `safety_policy_version`, `prompt_version`, `dossier_schema_version`, `provider`, `model_identifier`, `source_program_id`/`source_program_revision` (programa ativo no dossier da análise; ambos ou nenhum) e `created_at`. `UNIQUE (athlete_id, analysis_request_id)`. Sem status: só análises concluídas e validadas são gravadas; falhas não. Imutável (trigger bloqueia qualquer UPDATE, inclusive do backend). RLS habilitado, sem grants para anon/authenticated; RPCs backend-only `record_coach_analysis_run` (idempotente) e `create_coach_decision_for_analysis` (exige registro do mesmo atleta, não bloqueado). Não armazenado: pergunta, conversa, prompt completo, dossier completo, resposta bruta do provider, raciocínio, tokens ou chaves. Retenção: mantido até uma política de retenção futura explícita; removido junto com o atleta. Ligação com decisões: `coach_decisions (athlete_id, analysis_request_id)` casa com o registro; a verificação é feita pela RPC (FK composta não adicionada porque linhas e testes da Implementation Phase 15 referenciam request ids sem registro).

## Implementation Phase 16 — Preferência, provenance e fingerprint

Migration `20261003120000_conservative_auto_draft_authority.sql` (forward):

- `athlete_coach_preferences.draft_authority_mode` (`manual_draft` padrão | `standard_auto_draft`), RLS próprio já existente.
- `coach_analysis_runs.request_fingerprint` (hex SHA-256, nulo apenas em registros anteriores). Nova sobrecarga `record_coach_analysis_run(uuid,uuid,text,jsonb,uuid,integer)`: mesmo id + mesmo fingerprint → reutiliza; fingerprint diferente ou registro legado sem fingerprint → erro `Analysis request conflict`; nunca sobrescreve.
- `coach_decisions`: `auto_draft_policy_version`, `auto_draft_eligibility` (`eligible|ineligible|blocked`), `auto_draft_reasons` (avaliação na criação; imutável) e `materialization_origin` (`human|auto_draft`, nulo antes da materialização). Backfill histórico: toda decisão já materializada recebeu `human` (único caminho existente até então); o guard foi desabilitado apenas para esse preenchimento de coluna nova.
- Ciclo de vida: status continua `proposed → rejected | stale | materialized`. Materializado exige `human` com `approved_at` preenchido ou `auto_draft` com `approved_at` **nulo** (aprovação humana é só humana). `auto_draft` exige origem proativa, `standard_review` e elegibilidade registrada `eligible`.
- RPC `auto_draft_coach_decision(uuid,uuid)` (service role): trava a decisão, relê preferências na transação, exige análise não bloqueada, uma ação escalar, fonte ativa (senão `stale` pela semântica existente) e ausência de rascunho existente (`existing_draft`, nunca sobrescreve); materializa pelo motor único e verifica que o resultado é `draft`. Retentativas e concorrência: lock de linha + linhagem única (`supersedes_program_id`) → um único rascunho.

## Implementation Phase 17 — Sem armazenamento novo

Nenhuma migration. Auditoria: editar um rascunho substitui sua estrutura, mas o estado materializado esperado é reconstruível (programa de origem imutável após ativo + `proposal_snapshot` imutável + espelho determinístico); somente rascunhos podem mudar de estrutura, então a estrutura atual de um programa ativado é exatamente a ativada; rascunhos materializados não podem ser excluídos (FK `materialized_program_id` RESTRICT); `activated_at`/`archived_at` distinguem ativação de arquivamento. A evidência é projeção derivada, não entidade; referência estável `coach_draft_review:<decisionId>` (versão `coach-draft-review-evidence-v1`). Limitação: o ledger não registra quem editou; nomes, notas, instruções e cues não são comparados.

## Implementation Phase 18 — `lineage_id` e `lineage_tracked`

Migration `20261004120000_training_structure_lineage.sql` (forward; sem mudança de PK): `lineage_id uuid not null` em `training_blocks`, `training_weeks`, `training_days`, `exercise_prescriptions` e `prescription_sets`; `training_programs.lineage_tracked` (false para linhas existentes, forçado true para novas, imutável). Backfill conservador: cada linha existente virou raiz da própria linhagem; continuidade entre revisões anteriores à migration **não** é reconstruída (sem ligação falsa). Atribuição controlada pelo servidor: trigger torna a linhagem imutável e força nova linhagem em qualquer insert que não venha de RPC confiável; `clone_training_program_as_draft`, `replace_training_program_structure` (valida que cada `lineageId` pertence ao mesmo nível do mesmo rascunho, sem duplicatas) e o motor único `materialize_coach_decision` (usado também por auto-draft) preservam a linhagem. Sem índices especulativos: as consultas por linhagem são por programa, já indexadas pelos pais.

## Correção pós-Implementation Phase 18 — Salvamento de rascunho verificado

Migration `20261005120000_full_draft_structure_preservation.sql` (forward) redefine `replace_training_program_structure`: rejeita árvores incompletas (bloco sem semana, semana sem dia, dia sem exercício, exercício sem série) e verifica a estrutura resultante antes do commit (`Incomplete program structure`), mantendo a validação de linhagem da ADR-0092. Tudo em uma transação: falha não deixa rascunho meio salvo. Sem mudança de schema.

## Implementation Phase 19 — Sem mudança de schema

Nenhuma migration. Remoção, adição e reordenação de blocos/semanas/dias usam a mesma `replace_training_program_structure` (árvore inteira, atômica, verificada). Novos nós não enviam `lineageId`: o servidor atribui. Linhagem removida não pode ser reanexada ("Unknown structure lineage"), e reordenar mantém a linhagem e muda só `sequence`. Coberto por `supabase/tests/database/structure_editing.test.sql`.

## Correção pós-Implementation Phase 19 — Identidade de criação

A migration `20261006120000_atomic_program_creation.sql` (forward) altera `training_programs`:

- colunas `creation_request_id uuid` e `creation_request_fingerprint text` (SHA-256 hex), ambas nulas ou ambas preenchidas;
- apenas em raízes criadas pelo usuário: nunca junto com `supersedes_program_id`, e as linhas históricas ficam NULL;
- índice único parcial `(athlete_id, creation_request_id)`, com escopo por atleta: o mesmo UUID de outro atleta não colide;
- trigger que só permite definir a identidade dentro da RPC atômica (`app.training_program_creation`) e a torna imutável.

`training_program_creation_fingerprint`: serialização canônica de `jsonb` (ordem de chaves canônica; arrays mantêm a ordem, que é semântica; nulos removidos), com o nome aparado, a descrição, a meta e a estrutura, versão `training-program-creation-v1`. Não entram JWT, timestamps, ids de banco nem linhagem. A impressão digital garante a integridade das tentativas; não é autenticação nem segredo.

RPC `create_training_program_with_structure(p_creation_request_id, p_name, p_structure, p_description, p_athlete_goal_id)`, security invoker (RLS aplicada), executável só por `authenticated` e `service_role`. Etapas:

1. deriva o atleta da sessão;
2. rejeita linhagem enviada pelo cliente;
3. calcula a impressão digital;
4. aplica `pg_advisory_xact_lock` por (atleta, request);
5. se o request já existe, devolve o mesmo programa ou lança `program_creation_conflict`;
6. insere o rascunho (status `draft`, revisão 1, sem `supersedes`, `lineage_tracked` pelo trigger da Implementation Phase 18);
7. grava a estrutura com a função canônica `replace_training_program_structure`, com as mesmas invariantes, a mesma atribuição de linhagem e a mesma verificação final, sem cópia de lógica.

Qualquer falha desfaz tudo. Não ativa nada.

O insert direto em `training_programs` por RLS continua permitido (fixtures pgTAP e fluxos existentes), mas não pode definir a identidade de criação; o app não o usa mais para criar programas.

## Correção pós-criação atômica — Privilégios de `training_programs`

Migration `20261007120000_enforce_atomic_program_creation_boundary.sql` (apenas para frente):

- `revoke insert on public.training_programs from authenticated, anon`; SELECT, UPDATE e DELETE continuam como antes;
- a policy `training_programs_own` (`for all`) foi substituída por `_own_select`, `_own_update` e `_own_delete`, com o mesmo predicado de dono, para que nenhuma policy descreva um INSERT que o cliente não pode mais fazer;
- RLS continua ativa;
- `create_training_program_with_structure` e `clone_training_program_as_draft` passaram para SECURITY DEFINER sem mudar o corpo.

Endurecimento das duas funções (já presente no corpo):

- `search_path=''` e objetos sempre com schema explícito;
- atleta resolvido só por `current_athlete_id()` (`auth.uid()`), sem nenhum parâmetro de atleta;
- filtros explícitos por atleta, sem depender de RLS;
- nenhum SQL dinâmico;
- a gravação da árvore continua passando pela checagem explícita de rascunho próprio em `replace_training_program_structure`;
- `anon` não pode executar nenhuma das duas.

Materialização e auto-draft já eram SECURITY DEFINER e restritos a `service_role`; não mudaram. O trigger de identidade de criação continua como defesa em profundidade.
