# Modelo conceitual de dados

Status: **canônico, pré-schema**

Este documento define conceitos e relações; não fixa tabelas, colunas ou migrations.

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
- schema físico, cardinalidades finais e estratégia de IDs ficam para a Phase 2.
