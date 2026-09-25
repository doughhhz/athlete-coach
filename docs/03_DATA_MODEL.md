# Modelo conceitual de dados

Status: **canônico; baseline físico mínimo definido na Phase 2**

Este documento define conceitos e relações. Somente a identidade mínima do atleta possui schema físico nesta fase; os demais agregados continuam conceituais.

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

`Exercise`, `Muscle`, `Equipment`, `Instruction`, `Variation`, `Substitution`, `ExerciseMedia`. Conteúdo de terceiros exige origem/licença.

### Training

`TrainingProgram` contém `TrainingBlock`, `TrainingWeek`, `TrainingDay` e `ExercisePrescription`. A prescrição registra alvo e faixa (séries, reps, intensidade, RIR/RPE, descanso) sem confundir com execução.

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

## Convenções físicas

- instantes absolutos usam `timestamptz`; o banco os trata semanticamente em UTC e a apresentação converte o timezone;
- uma data civil sem horário poderá usar `date` quando o domínio a introduzir;
- cada grandeza terá unidade canônica explícita no nome/contrato: massa e carga em kg quando aplicável, comprimento em cm, energia em kcal e duração computacional em segundos;
- conversões de unidade acontecem na boundary apropriada e nunca apagam a unidade da origem;
- valores quantitativos importantes usam `numeric`, integer escalado ou tipo específico conforme precisão e operações do domínio; `float` não é padrão automático;
- soft delete não é política global e será decidido por entidade conforme privacidade, auditoria e retenção;
- audit logging de banco e o futuro Decision Ledger do Coach são conceitos distintos.

Raw Data continua significando observação, Derived Data cálculo determinístico reproduzível e Coach Intelligence interpretação. Essa separação permanece obrigatória nos contratos, mas não justifica criar antecipadamente schemas SQL `raw`, `derived` e `coach`.
