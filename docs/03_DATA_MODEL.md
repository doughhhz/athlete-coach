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

`WorkoutSession` contém `PerformedExercise` e `PerformedSet`. Uma série registra valores observados, ordem e estado. Edições/correções preservam auditoria. Sessões podem estar planejadas, em andamento, concluídas ou canceladas.

### Performance

`MetricDefinition`, `MetricObservation`, `PersonalRecord`, `Trend` e `ProgressionAssessment`. Observações derivadas guardam algoritmo e proveniência.

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
